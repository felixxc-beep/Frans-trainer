const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const migration = fs.readFileSync("supabase/phase5-school-email.sql", "utf8");
const identitySource = fs.readFileSync("student-identity.js", "utf8");
const syncSource = fs.readFileSync("sync-manager.js", "utf8");
const appSource = fs.readFileSync("app.js", "utf8");
const teacherSource = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.match(migration, /add column if not exists school_email text/i);
assert.match(migration, /school_email_normalized text[\s\S]*generated always as \(lower\(btrim\(school_email\)\)\) stored/i);
assert.match(migration, /school_email is null/i);
assert.match(migration, /camposturnhout\\\.be/i);
assert.match(migration, /create unique index[\s\S]*school_email_normalized/i);
assert.doesNotMatch(migration, /insert into public\.students/i, "de migratie mag geen nieuwe leerlingrecords maken");
assert.match(migration, /private\.verify_student_email_impl[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(migration, /public\.verify_student_email[\s\S]*security invoker[\s\S]*set search_path = ''/i);
assert.match(migration, /from public\.students s[\s\S]*join public\.classes c/i);
assert.match(migration, /s\.is_active = true[\s\S]*c\.is_active = true/i);
assert.match(migration, /revoke all on function public\.verify_student_email\(text\)/i);
assert.match(migration, /grant execute on function public\.verify_student_email\(text\) to anon, authenticated/i);
assert.doesNotMatch(migration, /grant select[^;]*to anon/i, "anon mag geen students-select krijgen");
assert.match(migration, /grant (?:select|insert|update) \(school_email\)/i);

assert.match(html, /name="school_email"/);
assert.match(html, /achternaamvoornaam@camposturnhout\.be/);
assert.match(html, /data-method="school_code"/);
assert.match(html, /Aanmelden met leerlingcode/);
assert.match(html, /id="switch-student-button"/);

const storage = new Map();
const rpcCalls = [];
let lookupMode = "active";
let ingestOffline = false;
const canonicalSubject = "11111111-1111-4111-8111-111111111111";
const windowObject = {
  MON_PARCOURS_CONFIG: {
    supabaseUrl: "https://voorbeeld.supabase.co",
    supabasePublishableKey: "sb_publishable_phase5-test-1234567890"
  },
  crypto: {
    randomUUID() { return "22222222-2222-4222-8222-222222222222"; }
  },
  addEventListener() {},
  supabase: {
    createClient() {
      return {
        async rpc(name, parameters) {
          rpcCalls.push({ name, parameters });
          if (name === "verify_student_email") {
            if (lookupMode !== "active") return { data: { verified: false }, error: null };
            return { data: { verified: true, identity: { provider: "school_email", subject: canonicalSubject, display_name: "Emma Janssens", class_name: "1AA" } }, error: null };
          }
          if (name === "verify_student_identity") {
            return { data: { verified: true, identity: { provider: "school_code", subject: canonicalSubject, display_name: "Emma Janssens", class_name: "1AA" } }, error: null };
          }
          if (name === "ingest_practice_bundle") {
            if (ingestOffline) return { data: null, error: { status: 503 } };
            return { data: { accepted: true }, error: null };
          }
          return { data: null, error: null };
        }
      };
    }
  }
};
const context = vm.createContext({
  window: windowObject,
  console,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout() { return 1; },
  clearTimeout() {},
  Date,
  Map,
  JSON,
  Object,
  Array,
  String,
  Boolean,
  Math
});
["supabase-client.js", "student-identity.js", "sync-manager.js"].forEach(function (file) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
});
const identity = windowObject.StudentIdentity;
const sync = windowObject.MonParcoursSync;

function queue() {
  return JSON.parse(storage.get("monParcoursSyncQueueV1") || "[]");
}

(async function () {
  assert.equal(identity.normalizeSchoolEmail("  JANSSENSEMMA@CAMPOSturnhout.be "), "janssensemma@camposturnhout.be");
  assert.equal(identity.validSchoolEmail("janssensemma@camposturnhout.be"), true);
  assert.equal(identity.validSchoolEmail("janssensemma@gmail.com"), false);
  await assert.rejects(identity.connect("school_email", { schoolEmail: "emma@gmail.com" }), /INVALID_SCHOOL_EMAIL/);

  lookupMode = "unknown";
  await assert.rejects(identity.connect("school_email", { schoolEmail: "onbekend@camposturnhout.be" }), /STUDENT_EMAIL_NOT_FOUND/);
  lookupMode = "inactive";
  await assert.rejects(identity.connect("school_email", { schoolEmail: "inactief@camposturnhout.be" }), /STUDENT_EMAIL_NOT_FOUND/);

  lookupMode = "active";
  const emailIdentity = await identity.connect("school_email", { schoolEmail: "  JANSSENSEMMA@CAMPOSturnhout.be " });
  assert.equal(emailIdentity.provider, "school_email");
  assert.equal(emailIdentity.subject, canonicalSubject);
  assert.equal(emailIdentity.displayName, "Emma Janssens");
  assert.equal(emailIdentity.className, "1AA");
  const emailCall = rpcCalls.find(function (call) { return call.name === "verify_student_email" && call.parameters.p_school_email === "janssensemma@camposturnhout.be"; });
  assert.ok(emailCall, "de RPC moet uitsluitend de genormaliseerde exacte schoolmail ontvangen");
  const stored = storage.get("monParcoursStudentIdentityV1");
  assert.equal(stored.includes("janssensemma"), false, "schoolmail mag niet in localStorage worden bewaard");
  assert.ok(stored.includes(canonicalSubject), "alleen de interne identity/token moet lokaal blijven");

  const codeIdentity = await identity.connect("school_code", { classCode: "1AA", studentCode: "K7QM4PX9RT6N" });
  assert.equal(codeIdentity.provider, "school_code", "bestaande code-login moet blijven werken");
  assert.equal(codeIdentity.subject, canonicalSubject);
  sync.enqueueSession({
    client_session_id: "33333333-3333-4333-8333-333333333333",
    identity_provider: "school_code",
    identity_subject: canonicalSubject,
    session: { client_session_id: "33333333-3333-4333-8333-333333333333" },
    attempts: []
  });
  assert.equal(queue().length, 1);

  await identity.connect("school_email", { schoolEmail: "janssensemma@camposturnhout.be" });
  await sync.flush();
  assert.equal(queue().length, 0, "dezelfde canonieke leerling moet over providers heen dezelfde queue kunnen synchroniseren");
  assert.ok(rpcCalls.some(function (call) { return call.name === "ingest_practice_bundle"; }));

  ingestOffline = true;
  sync.enqueueSession({
    client_session_id: "44444444-4444-4444-8444-444444444444",
    identity_provider: "school_email",
    identity_subject: canonicalSubject,
    session: { client_session_id: "44444444-4444-4444-8444-444444444444" },
    attempts: []
  });
  await sync.flush();
  assert.equal(queue().length, 1, "offline schoolmail-sync mag geen queuedata verliezen");
  identity.switchToLocal();
  assert.equal(identity.getCurrentStudentIdentity().provider, "local");
  assert.equal(storage.has("monParcoursStudentIdentityV1"), false, "wissel leerling moet de actieve opgeslagen identiteit verwijderen");
  assert.equal(queue().length, 1, "wisselen mag de bestaande syncqueue niet verwijderen");

  const teacherWindow = { MON_PARCOURS_TEACHER_TEST: true, MON_PARCOURS_CONFIG: {} };
  const teacherContext = vm.createContext({ window: teacherWindow, console, Intl, Date, Set, Map, Promise, Object, Array, String, Number, Math, Uint8Array });
  vm.runInContext(teacherSource, teacherContext, { filename: "teacher.js" });
  const teacher = teacherWindow.MonParcoursTeacher;
  assert.equal(teacher.normalizeSchoolEmail("  EMMA@CAMPOSturnhout.be "), "emma@camposturnhout.be");
  assert.equal(teacher.validateSchoolEmail("emma@gmail.com", false).valid, false);
  assert.equal(teacher.suggestSchoolEmail("Emma Janssens"), "janssensemma@camposturnhout.be");
  assert.equal(teacher.suggestSchoolEmail("Élise D'Haene"), "dhaeneelise@camposturnhout.be");
  const bulk = Array.from(teacher.parseBulkStudents("Emma Janssens\nNoah Peeters;uitzondering@camposturnhout.be"));
  assert.deepEqual(JSON.parse(JSON.stringify(bulk)), [
    { name: "Emma Janssens", schoolEmail: "janssensemma@camposturnhout.be" },
    { name: "Noah Peeters", schoolEmail: "uitzondering@camposturnhout.be" }
  ]);
  assert.match(teacher.managementColumns.students, /school_email/);
  assert.doesNotMatch(teacher.tableColumns.students, /school_email/, "resultaatquery mag schoolmail niet laden");
  assert.doesNotMatch(teacher.tableColumns.practice_sessions + teacher.tableColumns.practice_attempts, /school_email/);
  const codeRows = teacher.studentCodeRows({ classes: [{ id: "c", class_code: "1AA" }], students: [{ class_id: "c", display_name: "Emma", school_email: "janssensemma@camposturnhout.be", student_code: "K7QM4PX9RT6N" }] }, "c");
  assert.deepEqual(JSON.parse(JSON.stringify(codeRows)), [["Emma", "1AA", "janssensemma@camposturnhout.be", "K7QM4PX9RT6N"]]);

  assert.doesNotMatch(appSource + syncSource, /p_school_email|school_email_normalized/, "schoolmail mag niet in oefen- of syncpayloads terechtkomen");
  assert.doesNotMatch(appSource + syncSource + teacherSource, /service[_-]?role|sb_secret/i);
  console.log("FASE 5A SCHOOLMAIL-REGRESSIE GESLAAGD");
  console.log("Normalisatie, domeincontrole, private RPC, beide providers, canonieke identity, offline queue, beheer, bulkvoorstellen en privacy gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
