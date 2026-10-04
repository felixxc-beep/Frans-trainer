const assert = require("node:assert/strict");
const fs = require("node:fs");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");

const sql = fs.readFileSync("supabase/phase8c-mastery-growth.sql", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const studentHtml = fs.readFileSync("index.html", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const ids = course.trajectories.flatMap(trajectory => trajectory.items.map(item => item.id));

assert.equal(ids.length, 1036);
assert.equal(new Set(ids).size, 1036);
assert.match(sql, /create function private\.item_mastery_level\(/);
assert.match(sql, /security invoker set search_path = ''/);
assert.match(sql, /revoke all on function private\.item_mastery_level/);
assert.match(sql, /create or replace function private\.get_student_mastery_impl\(/);
assert.match(sql, /first_independent_correct/);
assert.match(sql, /independent_correct_session_ids/);
assert.match(sql, /order by created_at,attempt_number,id/,
  "gelijke tijdstempels behouden de echte volgorde van retries");
assert.match(sql, /create or replace function private\.item_assignment_progress_for_student\(/);
assert.match(sql, /create or replace function private\.student_current_mastery_percentage\(/);
assert.equal((sql.match(/private\.item_mastery_level\(/g) || []).length >= 4, true,
  "taak, klasmonitor en SQL-regressie gebruiken dezelfde private scorehelper");
assert.doesNotMatch(sql, /create table|alter table|delete from|drop policy|grant select/i);
assert.doesNotMatch(sql, /pg_catalog\.(?:least|greatest)\(/);
assert.match(sql, /p_correct>=3 and p_correct::numeric\/nullif\(p_independent,0\)>=0\.75/);
assert.match(sql, /p_sessions>=2 and p_latest_correct is true/);
assert.match(sql, /\$curve_check\$/);
assert.match(studentHtml, /mastery\.js\?v=20261004-1/);
assert.match(studentHtml, /app\.js\?v=20261004-1/);
assert.match(teacherHtml, /mastery\.js\?v=20261004-1/);
assert.match(app, /beginSession\(questions, "practice", "assignment-mixed", assignment\.title/);
assert.match(app, /Objectif : ' \+ progress\.target \+ '% acquis/);

const task = { item_ids: Array.from({ length: 20 }, (_, index) => "item-" + index), target_acquired_percentage: 60 };
function evidence(corrected, stillWrong) {
  const rows = task.item_ids.map((id, index) => ({ client_attempt_id: "first-" + index,
    client_session_id: "session-1", item_id: id, equivalent_item_ids: [id], mode: "practice",
    was_correct: index < 14 || !corrected && !stillWrong,
    created_at: "2026-10-03T10:00:" + String(index).padStart(2, "0") + "Z" }));
  if (corrected) task.item_ids.slice(14).forEach((id, index) => rows.push({ client_attempt_id: "fix-" + index,
    client_session_id: "session-1", item_id: id, equivalent_item_ids: [id], mode: "practice", was_correct: true,
    created_at: "2026-10-03T10:01:" + String(index).padStart(2, "0") + "Z" }));
  return mastery.mergeMasterySources([], rows, [], []);
}
const allCorrect = assignments.progress(task, evidence(false, false));
assert.equal(allCorrect.masteryLevel, 60);
assert.equal(allCorrect.acquired, 0);
assert.equal(allCorrect.reachedLocally, false, "60% mastery is niet 60% Acquis");
assert.equal(assignments.progress(task, evidence(true, false)).masteryLevel, 54);
assert.equal(assignments.progress(task, evidence(false, true)).masteryLevel, 47);

const sameEvidence = { client_attempt_id: "free-1", client_session_id: "free-session",
  item_id: "item-0", equivalent_item_ids: ["item-0"], mode: "practice", was_correct: true,
  created_at: "2026-10-03T11:00:00Z" };
const freeRecords = mastery.mergeMasterySources([], [Object.assign({}, sameEvidence, { exercise_key: "vocab-nl-fr" })], [], []);
const taskRecords = mastery.mergeMasterySources([], [Object.assign({}, sameEvidence, { exercise_key: "assignment-mixed" })], [], []);
assert.equal(mastery.getItemMastery("item-0", freeRecords).level, 60);
assert.deepEqual(mastery.getItemMastery("item-0", taskRecords), mastery.getItemMastery("item-0", freeRecords),
  "vrije oefening en taakpoging leveren identieke item-evidence");

const serverRow = { item_id: "item-0", item_variant: "", practiced_attempts: 2,
  independent_attempts: 2, independent_correct: 1, independent_session_count: 1,
  independent_session_ids: ["session-1"], independent_correct_session_count: 1,
  independent_correct_session_ids: ["session-1"], first_independent_at: "2026-10-03T10:00:00Z",
  first_independent_correct: false, latest_independent_at: "2026-10-03T10:01:00Z", latest_independent_correct: true };
const serverRecords = mastery.mergeMasterySources([serverRow], [], [], []);
assert.equal(mastery.getItemMastery("item-0", serverRecords).level, 40,
  "historische server-evidence herkent fout → correct");
const pending = { client_attempt_id: "pending", client_session_id: "session-2", item_id: "item-0",
  equivalent_item_ids: ["item-0"], mode: "practice", was_correct: true, created_at: "2026-10-04T10:00:00Z" };
assert.equal(mastery.getItemMastery("item-0", mastery.mergeMasterySources([serverRow], [pending], [], [])).level, 80,
  "offline correct antwoord in latere sessie draagt mee bij");
assert.equal(mastery.getItemMastery("item-0", mastery.mergeMasterySources([serverRow], [pending], ["pending"], [])).level, 40,
  "bevestigde pending poging wordt niet dubbel geteld");

console.log("MASTERY-GROEIREGRESSIE GESLAAGD");
