const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const progressBefore = JSON.stringify({ version: 1, attempted: 14, correct: 10, wrong: 4, items: { oud: { attempts: 2 } } });
storage.set("monParcoursProgressV1", progressBefore);
let rpcMode = "verify";
let rpcCalls = [];
let idCounter = 0;

function response(ok, body, status) {
  return { ok: ok, status: status || (ok ? 200 : 503), json: async function () { return body; } };
}

const windowObject = {
  MON_PARCOURS_CONFIG: {
    supabaseUrl: "https://voorbeeld.supabase.co",
    supabaseAnonKey: "public-anon-key-for-tests-1234567890"
  },
  crypto: {
    randomUUID() {
      idCounter += 1;
      return "00000000-0000-4000-8000-" + String(idCounter).padStart(12, "0");
    }
  },
  addEventListener() {}
};

const context = vm.createContext({
  console,
  window: windowObject,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function (url, options) {
    rpcCalls.push({ url: url, body: JSON.parse(options.body) });
    if (url.endsWith("/verify_student_identity")) {
      if (rpcMode === "not-found") return response(true, { verified: false });
      return response(true, {
        verified: true,
        identity: {
          provider: "school_code",
          subject: "11111111-1111-4111-8111-111111111111",
          display_name: "Leerling 01",
          class_name: "Klas 1A"
        }
      });
    }
    if (rpcMode === "offline") return response(false, {}, 503);
    return response(true, { accepted: true, attempt_count: 1 });
  },
  AbortController,
  setTimeout: function () { return 1; },
  clearTimeout: function () {},
  Date,
  Map,
  JSON,
  Object,
  Array,
  String,
  Boolean,
  Math
});

for (const file of ["supabase-client.js", "student-identity.js", "sync-manager.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const StudentIdentity = windowObject.StudentIdentity;
const Sync = windowObject.MonParcoursSync;

function queue() {
  return JSON.parse(storage.get("monParcoursSyncQueueV1") || "[]");
}

function snapshot(attempts) {
  return {
    client_session_id: "22222222-2222-4222-8222-222222222222",
    identity_provider: "school_code",
    identity_subject: "11111111-1111-4111-8111-111111111111",
    session: {
      client_session_id: "22222222-2222-4222-8222-222222222222",
      course_key: "UF1",
      trajectory: "Trajet 1",
      top_category: "Atelier Parole",
      lesson: "Se présenter",
      block: "À retenir",
      subsection: "On se rappelle ?",
      exercise_key: "vocab-nl-fr",
      mode: "learn",
      question_count: 20,
      attempt_count: attempts.length,
      started_at: "2026-09-30T10:00:00.000Z",
      finished_at: null
    },
    attempts: attempts
  };
}

(async function () {
  assert.equal(windowObject.MonParcoursSupabase.isConfigured(), true);
  assert.equal(StudentIdentity.getCurrentStudentIdentity().provider, "local");
  await assert.rejects(
    StudentIdentity.connect("school_code", { classCode: "KLAS1A", studentCode: "001" }),
    /INVALID_STUDENT_CODES/
  );

  const identity = await StudentIdentity.connect("school_code", { classCode: "KLAS1A", studentCode: "K7M9-P4Q2" });
  assert.equal(identity.provider, "school_code");
  assert.equal(identity.displayName, "Leerling 01");
  const storedIdentity = storage.get("monParcoursStudentIdentityV1");
  assert.equal(storedIdentity.includes("KLAS1A"), false);
  assert.equal(storedIdentity.includes("K7M9-P4Q2"), false);

  const attempt = {
    client_attempt_id: "33333333-3333-4333-8333-333333333333",
    item_id: "uf1-item-000001",
    was_correct: true
  };
  Sync.enqueueSession(snapshot([attempt]));
  Sync.enqueueSession(snapshot([attempt, Object.assign({}, attempt, { client_attempt_id: "44444444-4444-4444-8444-444444444444" })]));
  assert.equal(queue().length, 1, "dezelfde client_session_id moet één outbox-item blijven");
  assert.equal(queue()[0].attempts.length, 2);

  rpcMode = "offline";
  await Sync.flush();
  assert.equal(queue().length, 1, "een mislukte sync mag niets verwijderen");
  assert.equal(queue()[0].retry_count, 1);

  rpcMode = "online";
  await Sync.flush();
  assert.equal(queue().length, 0, "een geslaagde retry ruimt het outbox-item op");
  assert.ok(rpcCalls.some(function (call) { return call.url.endsWith("/ingest_practice_bundle"); }));
  assert.equal(storage.get("monParcoursProgressV1"), progressBefore, "bestaande voortgang mag niet worden herschreven");

  StudentIdentity.switchToLocal();
  assert.equal(StudentIdentity.getCurrentStudentIdentity().provider, "local");

  windowObject.MON_PARCOURS_CONFIG = {};
  assert.equal(windowObject.MonParcoursSupabase.isConfigured(), false);
  Sync.enqueueSession(snapshot([attempt]));
  const result = await Sync.flush();
  assert.equal(result.sent, 0);
  assert.equal(queue().length, 1, "zonder configuratie blijft data lokaal in de outbox");

  const appSource = fs.readFileSync("app.js", "utf8");
  const syncSource = fs.readFileSync("sync-manager.js", "utf8");
  assert.equal(/class_code|student_code/.test(appSource + syncSource), false, "alleen de identity-provider mag codes kennen");

  console.log("FASE 2 SYNC-REGRESSIE GESLAAGD");
  console.log("Modulaire identiteit, offline outbox, retry, sessie-upsert en behoud van monParcoursProgressV1 gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
