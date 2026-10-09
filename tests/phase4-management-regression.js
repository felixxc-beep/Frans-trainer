const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const rls = fs.readFileSync("supabase/rls.sql", "utf8");
const migration = fs.readFileSync("supabase/phase4-management.sql", "utf8");

assert.match(rls, /grant select, insert, update, delete on table public\.classes to authenticated/i);
assert.match(rls, /grant insert \(class_id, student_code, display_name, is_active\) on table public\.students to authenticated/i);
assert.match(rls, /grant update \(student_code, display_name, is_active\) on table public\.students to authenticated/i);
assert.match(rls, /classes_teacher_insert[\s\S]*owner_id = auth\.uid\(\)/i);
assert.match(rls, /students_teacher_update[\s\S]*c\.owner_id = auth\.uid\(\)/i);
assert.doesNotMatch(source, /\.delete\s*\(/, "fase 4 mag geen harde deletes uitvoeren");
assert.match(migration, /2,20/);
const migrationStatements = migration.replace(/^\s*--.*$/gm, "");
assert.doesNotMatch(migrationStatements, /grant|policy|practice_sessions|practice_attempts/i, "de handmatige migratie mag beheerrechten of resultaatdata niet verruimen");

["view-dashboard", "view-classes", "view-management"].forEach(function (action) {
  assert.match(html, new RegExp('data-action="' + action + '"'));
});
["classFilter", "studentFilter", "studentStatusFilter", "categoryFilter", "subsectionFilter"].forEach(function (id) {
  assert.match(html, new RegExp('id="' + id + '"'));
});

let randomState = 0x12345678;
const deterministicCrypto = {
  getRandomValues(bytes) {
    for (let index = 0; index < bytes.length; index += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      bytes[index] = randomState >>> 24;
    }
    return bytes;
  }
};
const windowObject = {
  MON_PARCOURS_TEACHER_TEST: true,
  MON_PARCOURS_CONFIG: {},
  crypto: deterministicCrypto
};
const context = vm.createContext({ window: windowObject, console, Intl, Date, Set, Map, Promise, Object, Array, String, Number, Math, Uint8Array });
vm.runInContext(source, context, { filename: "teacher.js" });
const api = windowObject.MonParcoursTeacher;

assert.equal(api.normalizeClassCode(" 1ab "), "1AB");
assert.equal(api.validateClassInput("Eerste A", "1aa").valid, true);
assert.equal(api.validateClassInput("Eerste A", "A").valid, false);
assert.equal(api.validateClassInput("Eerste A", "1_A").valid, false);
assert.equal(api.validateClassInput("Eerste A", "123456789012345678901").valid, false);

const generatedCodes = new Set();
for (let index = 0; index < 100; index += 1) {
  const code = api.generateStudentCode(12, deterministicCrypto);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
  assert.doesNotMatch(code, /[O0I1]/);
  generatedCodes.add(code);
}
assert.equal(generatedCodes.size, 100, "veilige codegenerator moet voldoende variatie leveren");

assert.deepEqual(Array.from(api.parseBulkNames("Emma Janssens\nNoah Peeters\n\nEmma Janssens\n Rube Jacobs ")), ["Emma Janssens", "Noah Peeters", "Rube Jacobs"]);

function mutationClient() {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        insert(payload) {
          calls.push({ type: "insert", table, payload });
          return {
            select() {
              if (table === "classes") {
                return { async single() { return { data: Object.assign({ id: "class-new" }, payload), error: null }; } };
              }
              return Promise.resolve({ data: payload.map(function (row, index) { return Object.assign({ id: "student-" + index }, row); }), error: null });
            }
          };
        },
        update(payload) {
          const call = { type: "update", table, payload, column: null, value: null };
          calls.push(call);
          return {
            eq(column, value) {
              call.column = column;
              call.value = value;
              return {
                select() {
                  return { async single() { return { data: Object.assign({ id: value }, payload), error: null }; } };
                }
              };
            }
          };
        }
      };
    }
  };
}

const baseClasses = [{ id: "class-a", name: "1AA", class_code: "1AA", is_active: true }];

(async function () {
  const client = mutationClient();
  const createdClass = await api.createClassRecord(client, { id: "teacher-1" }, { name: " 2AB ", classCode: " 2ab " }, baseClasses);
  assert.equal(createdClass.class_code, "2AB");
  assert.deepEqual(JSON.parse(JSON.stringify(client.calls[0].payload)), { owner_id: "teacher-1", name: "2AB", class_code: "2AB", is_active: true });
  await assert.rejects(api.createClassRecord(client, { id: "teacher-1" }, { name: "Duplicaat", classCode: "1aa" }, baseClasses), /bestaat al/);
  assert.equal(client.calls.filter(function (call) { return call.table === "classes" && call.type === "insert"; }).length, 1, "dubbele klascode mag Supabase niet bereiken");

  await api.updateClassRecord(client, "class-a", { name: "Nieuwe naam", is_active: false });
  const classUpdate = client.calls.find(function (call) { return call.table === "classes" && call.type === "update"; });
  assert.equal(classUpdate.payload.is_active, false);
  assert.equal(classUpdate.column, "id");

  const singleStudents = await api.createStudentRecords(client, "class-a", ["Emma Janssens"], [], deterministicCrypto, ["K7QM4PX9RT6N"]);
  assert.equal(singleStudents[0].display_name, "Emma Janssens");
  assert.equal(singleStudents[0].school_email, "janssensemma@camposturnhout.be");
  assert.equal(singleStudents[0].student_code, "K7QM4PX9RT6N");
  assert.equal(singleStudents[0].is_active, true);

  const bulkStudents = await api.createStudentRecords(client, "class-a", ["Noah Peeters", "Rube Jacobs"], ["K7QM4PX9RT6N"], deterministicCrypto);
  assert.equal(bulkStudents.length, 2);
  assert.notEqual(bulkStudents[0].student_code, bulkStudents[1].student_code);
  bulkStudents.forEach(function (student) { assert.match(student.student_code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/); });

  await api.updateStudentRecord(client, "student-1", { is_active: false });
  await api.updateStudentRecord(client, "student-1", { student_code: "ABCDEFGHJKMN" });
  const studentUpdates = client.calls.filter(function (call) { return call.table === "students" && call.type === "update"; });
  assert.equal(studentUpdates[0].payload.is_active, false, "deactivering moet een update zijn");
  assert.equal(studentUpdates[1].payload.student_code, "ABCDEFGHJKMN", "regeneratie moet uitsluitend de code bijwerken");

  const managementQueries = [];
  const managementClient = {
    from(table) {
      return {
        select(columns) {
          managementQueries.push({ table, columns });
          return { async range() { return { data: [], error: null }; } };
        }
      };
    }
  };
  await api.loadManagementDataset(managementClient);
  assert.deepEqual(managementQueries.map(function (query) { return query.table; }).sort(), ["classes", "students"]);
  assert.match(managementQueries.find(function (query) { return query.table === "classes"; }).columns, /class_code/);
  assert.match(managementQueries.find(function (query) { return query.table === "students"; }).columns, /student_code/);

  const classes = [
    { id: "class-a", name: "1AA", is_active: true },
    { id: "class-b", name: "2AB", is_active: true }
  ];
  const students = [
    { id: "student-active", class_id: "class-a", display_name: "Emma", is_active: true },
    { id: "student-inactive", class_id: "class-a", display_name: "Noah", is_active: false },
    { id: "student-other", class_id: "class-b", display_name: "Rube", is_active: true }
  ];
  const sessions = [
    { id: "match", student_id: "student-active", trajectory: "Trajet 2", top_category: "Atelier Parole", subsection: "Actes de parole", mode: "learn", question_count: 10, started_at: "2026-09-25T10:00:00Z" },
    { id: "inactive-history", student_id: "student-inactive", trajectory: "Trajet 2", top_category: "Atelier Parole", subsection: "Actes de parole", mode: "learn", question_count: 20, started_at: "2026-09-25T10:00:00Z" },
    { id: "wrong-class", student_id: "student-other", trajectory: "Trajet 2", top_category: "Atelier Parole", subsection: "Actes de parole", mode: "learn", question_count: 30, started_at: "2026-09-25T10:00:00Z" },
    { id: "wrong-mode", student_id: "student-active", trajectory: "Trajet 2", top_category: "Atelier Parole", subsection: "Actes de parole", mode: "test", question_count: 5, started_at: "2026-09-25T10:00:00Z" }
  ];
  const attempts = [
    { session_id: "match", student_id: "student-active", item_id: "item-1", item_variant: "", was_correct: true, correct_answers: ["bonjour"] },
    { session_id: "inactive-history", student_id: "student-inactive", item_id: "item-1", item_variant: "", was_correct: false, correct_answers: ["bonjour"] }
  ];
  const raw = { classes, students, sessions, attempts };
  const combined = api.filterDataset(raw, { period: "30", trajectory: "Trajet 2", mode: "learn", classId: "class-a", studentId: "student-active", studentStatus: "active", category: "Atelier Parole", subsection: "Actes de parole" }, "2026-10-01T12:00:00Z");
  assert.equal(combined.sessions.length, 1, "alle uitgebreide filters moeten combineerbaar zijn");
  assert.equal(combined.sessions[0].id, "match");
  const inactive = api.filterDataset(raw, { period: "all", trajectory: "all", mode: "all", classId: "class-a", studentId: "all", studentStatus: "inactive", category: "all", subsection: "all" }, "2026-10-01T12:00:00Z");
  assert.equal(inactive.sessions[0].id, "inactive-history", "historische data van inactieve leerlingen moet bereikbaar blijven");

  const index = api.buildCourseIndex({ trajectories: [{ trajectory: "Trajet 2", items: [{ id: "item-1", type: "phrase", top_category: "Atelier Parole", lesson: "Les", subsection: "Actes de parole", nl: "Begroet iemand", fr: "Bonjour !" }] }] });
  const classRows = api.classOverviewRows(combined, "class-a");
  const studentRows = api.studentSessionRows(combined, "student-active");
  assert.equal(classRows.length, 1);
  assert.equal(studentRows.length, 1);
  assert.doesNotMatch(JSON.stringify(classRows) + JSON.stringify(studentRows), /K7QM|student_code|sync_token/i, "resultatenexports mogen geen leerlingcodes of tokens bevatten");

  const hardAttempts = [
    { session_id: "match", student_id: "student-active", item_id: "item-1", item_variant: "variant", was_correct: false, correct_answers: ["Bonjour !"], trajectory: "Trajet 2", top_category: "Atelier Parole" },
    { session_id: "match", student_id: "student-active", item_id: "item-1", item_variant: "variant", was_correct: true, correct_answers: ["Bonjour !"], trajectory: "Trajet 2", top_category: "Atelier Parole" }
  ];
  const difficultRows = api.difficultItemRows({ classes, students, sessions, attempts: hardAttempts }, index, "class-a", null);
  assert.equal(difficultRows.length, 1);
  assert.equal(difficultRows[0][6], "variant");
  assert.doesNotMatch(JSON.stringify(difficultRows), /student_code|sync_token|submitted_answer/i);

  const codeRows = api.studentCodeRows({ classes: [{ id: "class-a", name: "1AA", class_code: "1AA" }], students: [{ class_id: "class-a", display_name: "Emma", school_email: "janssensemma@camposturnhout.be", student_code: "K7QM4PX9RT6N" }] }, "class-a");
  assert.deepEqual(JSON.parse(JSON.stringify(codeRows)), [["Emma", "1AA", "janssensemma@camposturnhout.be", "K7QM4PX9RT6N"]]);
  const csv = api.makeCsv(["Naam", "Waarde"], [["=2+2", "+SUM(A1:A2)"], ["-1", "@CMD"]]);
  assert.ok(csv.startsWith("\uFEFF"), "CSV moet een UTF-8 BOM bevatten");
  ["'=2+2", "'+SUM(A1:A2)", "'-1", "'@CMD"].forEach(function (safe) { assert.ok(csv.includes(safe), safe + " is niet tegen CSV-injection beschermd"); });

  assert.doesNotMatch(source, /service[_-]?role|secret[_-]?key/i);
  assert.doesNotMatch(source, /sync_token/i);
  console.log("FASE 4 BEHEER- EN EXPORTREGRESSIE GESLAAGD");
  console.log("Klassen, leerlingen, bulk, veilige codes, deactivering, regeneratie, gecombineerde filters, vier CSV-stromen, privacy en RLS-contracten gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
