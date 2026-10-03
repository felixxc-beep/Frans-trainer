const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const ids = course.trajectories.flatMap(t => t.items.map(item => item.id));
assert.equal(ids.length, 1036);
assert.equal(new Set(ids).size, 1036);
assert.equal(ids[0], "uf1-item-000001");
assert.equal(ids.at(-1), "uf1-item-001036");
ids.slice().sort().forEach((id, index) => assert.equal(id, "uf1-item-" + String(index + 1).padStart(6, "0")));

const task = { item_ids: ids.slice(0, 20), target_acquired_percentage: 80 };
const evidence = [];
function add(id, index, session, mode, correct) {
  evidence.push({ client_attempt_id: id + "-" + index, client_session_id: session,
    item_id: id, equivalent_item_ids: [id], item_variant: "", mode: mode,
    was_correct: correct, created_at: new Date(Date.UTC(2026, 9, 3, 10, index)).toISOString() });
}
for (const [index, id] of task.item_ids.slice(0, 10).entries()) add(id, index, "first", "learn", true);
let records = mastery.mergeMasterySources([], evidence, [], []);
let progress = assignments.progress(task, records);
assert.equal(progress.practiced, 10);
assert.equal(progress.status, "in_progress");
const ordered = assignments.selectItems(task.item_ids.map(id => ({ id })), records, 10);
assert.deepEqual(ordered.map(item => item.id), task.item_ids.slice(10), "tweede reeks kiest eerst de tien nieuwe items");
for (const [index, id] of task.item_ids.slice(10).entries()) add(id, index + 10, "second", "learn", true);
records = mastery.mergeMasterySources([], evidence, [], []);
progress = assignments.progress(task, records);
assert.equal(progress.practiced, 20);
assert.equal(progress.reachedLocally, false, "20/20 geoefend zonder Acquis is niet voltooid");
for (const [index, id] of task.item_ids.slice(0, 16).entries()) {
  add(id, 40 + index, "practice-1", "practice", true);
  add(id, 80 + index, "practice-1", "practice", true);
  add(id, 120 + index, "practice-2", "test", true);
}
records = mastery.mergeMasterySources([], evidence, [], []);
progress = assignments.progress(task, records);
assert.equal(progress.acquired, 16);
assert.equal(progress.acquiredPercentage, 80);
assert.equal(progress.reachedLocally, true);
assert.equal(progress.status, "in_progress", "client mag completion niet zelf definitief maken");
task.completed_at = "2026-10-04T10:00:00Z";
add(task.item_ids[0], 200, "later", "test", false);
records = mastery.mergeMasterySources([], evidence, [], []);
progress = assignments.progress(task, records);
assert.equal(progress.acquired, 15);
assert.equal(progress.status, "completed", "serverbevestigde completion blijft behouden na latere fout");

const sql = fs.readFileSync("supabase/phase7-assignments.sql", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const studentHtml = fs.readFileSync("index.html", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");
assert.match(sql, /create table public\.assignments/);
assert.match(sql, /create table public\.assignment_classes/);
assert.match(sql, /create table public\.assignment_items/);
assert.match(sql, /create table public\.assignment_completions/);
assert.match(sql, /assignment_id uuid references public\.assignments/);
assert.match(sql, /on conflict \(assignment_id, student_id\) do nothing/);
assert.match(sql, /assignment scope locked after activity/);
assert.match(sql, /item outside assignment/);
assert.match(sql, /private\.teacher_has_class_access\(v_class\)/);
assert.match(sql, /where s\.sync_token=p_identity_token::uuid/);
assert.match(sql, /a\.status='published'/);
assert.match(sql, /security definer set search_path = ''/);
assert.match(sql, /revoke all on public\.course_item_ids, public\.assignments/);
assert.doesNotMatch(sql, /grant select on public\.assignments/i);
assert.doesNotMatch(sql, /submitted_answer/i);
assert.match(studentHtml, /assignments\.js\?v=/);
assert.match(teacherHtml, /data-action="view-tasks"/);
assert.match(app, /assignment_id: session\.assignment_id/);
assert.match(app, /ASSIGNMENTS_CACHE_KEY/);
assert.match(teacher, /get_teacher_assignment_detail/);
assert.match(teacher, /save_assignment/);
const queueStorage = new Map();
let online = false;
let ingestCount = 0;
const queueWindow = { StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "student-1", verified: true }; }, getSyncCredential() { return "token"; } },
  MonParcoursSupabase: { isConfigured() { return true; }, async rpc(name, args) { assert.equal(name, "ingest_practice_bundle"); assert.equal(args.p_session.assignment_id, "task-1"); if (!online) throw new Error("offline"); ingestCount++; return { accepted: true }; } },
  addEventListener() {} };
const queueContext = vm.createContext({ window: queueWindow, console, setTimeout() {}, Date,
  localStorage: { getItem(key) { return queueStorage.get(key) || null; }, setItem(key, value) { queueStorage.set(key, value); } } });
vm.runInContext(fs.readFileSync("sync-manager.js", "utf8"), queueContext);
const snapshot = { client_session_id: "session-1", identity_provider: "school_email", identity_subject: "student-1",
  session: { client_session_id: "session-1", assignment_id: "task-1" }, attempts: [{ client_attempt_id: "attempt-1" }] };
queueWindow.MonParcoursSync.enqueueSession(snapshot);
queueWindow.MonParcoursSync.enqueueSession(snapshot);
assert.equal(JSON.parse(queueStorage.get("monParcoursSyncQueueV1")).length, 1, "snapshots vervangen elkaar idempotent");
const teacherContext = vm.createContext({ window: { MON_PARCOURS_TEACHER_TEST: true, MonParcoursAssignments: assignments }, console, Intl, Date, Set, Map, Promise, Object, Array, String, Number, Math });
vm.runInContext(teacher, teacherContext);
const teacherApi = teacherContext.window.MonParcoursTeacher;
assert.equal(teacherApi.taskDeadlineUtc("2026-10-06T16:00"), "2026-10-06T14:00:00.000Z", "deadline gebruikt Brusselse zomertijd");
assert.equal(teacherApi.taskDeadlineUtc("2026-12-06T16:00"), "2026-12-06T15:00:00.000Z", "deadline gebruikt Brusselse wintertijd");
assert.equal(teacherApi.taskDeadlineLocal("2026-10-06T14:00:00.000Z"), "2026-10-06T16:00");
assert.throws(() => teacherApi.taskDeadlineUtc("2026-03-29T02:30"), /bestaat niet/, "niet-bestaand tijdstip door zomeruur wordt geweigerd");

const appElement = { innerHTML: "", focus() {} };
const storage = new Map();
let payload = null;
const context = vm.createContext({
  console, setTimeout, clearTimeout, Date, Intl,
  document: { visibilityState: "visible", addEventListener() {}, querySelector(selector) {
    if (selector === "#app") return appElement;
    if (selector === "#strict-accents") return { checked: true, disabled: false };
    return null;
  } },
  window: { MonParcoursMastery: mastery, MonParcoursAssignments: assignments,
    StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "student-1", verified: true }; }, getSyncCredential() { return "token"; } },
    MonParcoursSupabase: { isConfigured() { return false; } },
    MonParcoursSync: { createId() { return "00000000-0000-4000-8000-000000000001"; }, enqueueSession(value) { payload = value; }, scheduleFlush() {} },
    addEventListener() {}, scrollTo() {}, performance: { now() { return 0; } } },
  localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
  fetch: async () => ({ ok: true, json: async () => structuredClone(course) })
});
vm.runInContext(app, context);
setImmediate(async () => {
  await queueWindow.MonParcoursSync.flush();
  assert.equal(JSON.parse(queueStorage.get("monParcoursSyncQueueV1")).length, 1, "mislukte sync bewaart task-session");
  online = true;
  await queueWindow.MonParcoursSync.flush();
  assert.equal(JSON.parse(queueStorage.get("monParcoursSyncQueueV1")).length, 0);
  assert.equal(ingestCount, 1, "herstel verzendt dezelfde task-session éénmaal");
  const first20 = course.trajectories[0].items.filter(item => item.type === "vocabulary").slice(0, 20);
  const taskData = { id: "00000000-0000-4000-8000-000000000002", title: "Testtaak", status: "published", item_ids: first20.map(item => item.id), target_acquired_percentage: 80 };
  context.taskData = taskData;
  vm.runInContext("state.assignments.items=[taskData]; openAssignmentSetup(taskData.id)", context);
  assert.match(appElement.innerHTML, /Testtaak/);
  const questions = vm.runInContext('questionsForSetup("assignment-mixed", 10)', context);
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map(question => question.stableItemId)).size, 10);
  assert.ok(questions.every(question => taskData.item_ids.includes(question.stableItemId)));
  const reverse = vm.runInContext('questionsForSetup("vocab-fr-nl", 10)', context);
  assert.equal(reverse.length, 10, "bestaande omgekeerde richting blijft in een taak beschikbaar");
  assert.ok(reverse.every(question => taskData.item_ids.includes(question.stableItemId)));
  context.questions = questions;
  vm.runInContext('beginSession(questions, "practice", "assignment-mixed", "Testtaak", {availableCount:20,assignmentId:taskData.id})', context);
  assert.equal(payload.session.assignment_id, taskData.id);
  assert.equal(payload.session.question_count, 10);
  assert.equal(payload.session.attempt_count, 0);
  console.log("FASE 7 TAKENREGRESSIE GESLAAGD");
});
