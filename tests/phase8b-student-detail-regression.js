const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const migration = fs.readFileSync("supabase/phase8b-student-detail-hotfix.sql", "utf8");
const phase7b = fs.readFileSync("supabase/phase7b-verb-mastery.sql", "utf8");
const phase8 = fs.readFileSync("supabase/phase8-class-monitor.sql", "utf8");
const errors = [];
const browser = { MON_PARCOURS_TEACHER_TEST: true };
const content = { innerHTML: "" };
const filterBar = { hidden: false };
const document = { querySelector(selector) { return selector === "#dashboardContent" ? content : selector === "#filterBar" ? filterBar : null; }, querySelectorAll() { return []; } };
const sandbox = vm.createContext({ window: browser, document, console: { error: (...values) => errors.push(values), log() {} }, Date, Intl, Uint8Array });
vm.runInContext(source, sandbox);
const api = browser.MonParcoursTeacher;
const state = browser.MonParcoursTeacherTestState;

assert.match(source, /get_teacher_student_verb_goals", \{ p_student_id: student\.id \}/);
assert.match(phase8, /create function public\.get_teacher_student_verb_goals\(p_student_id uuid\)/);
assert.match(phase8, /private\.teacher_has_class_access\(s\.class_id\)/);
assert.match(phase7b, /pg_catalog\.least\(/, "oud fase-7b-functielichaam verklaart de runtime-fout");
assert.match(migration, /pg_catalog\.pg_get_functiondef\(v_function\)/);
assert.match(migration, /'pg_catalog\.least\(', 'least\('/);
assert.match(migration, /'pg_catalog\.greatest\(', 'greatest\('/);
assert.match(migration, /private\.verb_goal_progress\(uuid,text,text\)/);
assert.match(migration, /private\.assignment_progress_for_student\(uuid,uuid\)/);
assert.doesNotMatch(migration, /drop function|alter table|create table|grant execute|revoke all/i);
assert.match(html, /teacher\.js\?v=20261009-1/);

const student = { id: "student-felix", class_id: "class-1ab", display_name: "Heylen Felix", is_active: true };
const classRow = { id: "class-1ab", name: "1AB", is_active: true };
const filters = { period: "7", classId: classRow.id, trajectory: "all", mode: "all", category: "all", subsection: "all", assignmentId: "all", studentStatus: "active" };
const periodRow = { student_id: student.id, class_id: classRow.id, display_name: student.display_name, is_active: true,
  unique_exercises: 4, attempt_count: 6, independent_attempts: 6, independent_correct: 5,
  active_seconds: 420, last_activity_at: "2026-10-04T09:30:00Z", recent_open_session: false,
  current_mastery_percentage: 47, active_assignment_count: 1,
  active_assignment: { id: "task-1", title: "Verbes en -ER", mastery_percentage: 68 } };
const goals = [{ goal_id: "present_er", kind: "regular", attempts: 12, level: 68, persons: 5, conjugation_accuracy: 81 }];

function clientFor(rows, goalResult) {
  const calls = [];
  return { calls, rpc(name, params) {
    calls.push({ name, params });
    return Promise.resolve(name === "get_class_activity_monitor" ? { data: rows, error: null } : goalResult);
  } };
}

async function run() {
  const client = clientFor([periodRow], { data: goals, error: null });
  const loaded = await api.loadStudentDetailExtras(client, filters, student);
  assert.equal(loaded.classRows.length, 1, "A: 1AB → Heylen Felix → laatste 7 dagen");
  assert.equal(loaded.verbGoals.length, 1, "E: fase-7b-werkwoorddoel wordt geladen");
  assert.equal(loaded.verbError, false);
  assert.equal(client.calls[0].params.p_class_id, classRow.id);
  assert.equal(client.calls[1].name, "get_teacher_student_verb_goals");
  assert.equal(client.calls[1].params.p_student_id, student.id);
  assert.deepEqual(Object.keys(client.calls[1].params), ["p_student_id"], "RPC-payload mag geen student_id of extra parameters bevatten");
  assert.equal(new Date(client.calls[0].params.p_period_end) - new Date(client.calls[0].params.p_period_start), 7 * 86400000);

  state.filters.period = "7";
  state.monitor.rows = api.normalizeMonitorRows([periodRow], "2026-10-04T10:00:00Z", {});
  state.monitor.masteryByStudent[student.id] = 47;
  state.studentVerbGoals[student.id] = goals;
  const emptyDataset = { classes: [classRow], students: [student], sessions: [], attempts: [] };
  const session = { id: "session-1", student_id: student.id, trajectory: "Trajet 1", mode: "practice",
    question_count: 4, active_duration_seconds: 420, started_at: "2026-10-04T09:20:00Z", finished_at: "2026-10-04T09:30:00Z" };
  const attempts = Array.from({ length: 4 }, (_, index) => ({ id: "attempt-" + index, session_id: session.id,
    student_id: student.id, item_id: "uf1-item-00000" + (index + 1), item_variant: "",
    mode: "practice", was_correct: index !== 3, created_at: "2026-10-04T09:25:00Z" }));
  const periodDataset = { ...emptyDataset, sessions: [session], attempts };
  const rendered = api.renderStudentDetail(periodDataset, student.id);
  assert.match(rendered, /Heylen Felix · 1AB/);
  assert.match(rendered, /laatste 7 dagen/);
  assert.match(rendered, /4<\/strong> oefeningen/);
  assert.match(rendered, /7 min/);
  assert.match(rendered, /47%/);
  assert.match(rendered, /Verbes en -ER/);
  assert.match(rendered, /5\/6 persoonsgroepen/);
  assert.match(rendered, /Sessiegeschiedenis/);
  state.user = { id: "teacher-1" };
  state.raw = periodDataset;
  state.analyticsLoaded = true;
  state.filters = { ...filters, studentId: student.id };
  state.client = clientFor([periodRow], { data: goals, error: null });
  await api.openStudentDetail(student.id);
  assert.match(content.innerHTML, /Heylen Felix · 1AB/, "A: echte leerlingdetailroute rendert");
  assert.match(content.innerHTML, /Verbes en -ER/);

  const emptyRow = { ...periodRow, unique_exercises: 0, attempt_count: 0, independent_attempts: 0,
    independent_correct: 0, active_seconds: 0, last_activity_at: null,
    active_assignment_count: 0, active_assignment: null };
  const shortClient = clientFor([emptyRow], { data: [], error: null });
  const shortLoaded = await api.loadStudentDetailExtras(shortClient, { ...filters, period: "60m" }, student);
  assert.equal(shortLoaded.classRows[0].unique_exercises, 0, "B: laatste uur zonder activiteit laadt");
  assert.equal(new Date(shortClient.calls[0].params.p_period_end) - new Date(shortClient.calls[0].params.p_period_start), 3600000);
  state.filters.period = "60m";
  state.monitor.rows = api.normalizeMonitorRows([emptyRow], "2026-10-04T10:00:00Z", {});
  state.studentVerbGoals[student.id] = [];
  const emptyRendered = api.renderStudentDetail(emptyDataset, student.id);
  assert.match(emptyRendered, /0<\/strong> oefeningen/);
  assert.match(emptyRendered, /0 min/);
  assert.match(emptyRendered, /Geen actieve taak/);
  assert.match(emptyRendered, /47%/, "huidige mastery blijft staan zonder recente pogingen");
  assert.match(emptyRendered, /Nog geen sessies/, "C: leerling zonder sessies heeft lege toestand");
  state.raw = emptyDataset;
  state.filters = { ...filters, period: "60m", studentId: student.id };
  state.client = clientFor([emptyRow], { data: [], error: null });
  await api.openStudentDetail(student.id);
  assert.match(content.innerHTML, /Heylen Felix · 1AB/, "B en C: echte route blijft laden zonder periodeactiviteit");
  assert.match(content.innerHTML, /Nog geen sessies/);

  const failedGoals = clientFor([periodRow], { data: null, error: { code: "42883", message: "function pg_catalog.least does not exist" } });
  const partial = await api.loadStudentDetailExtras(failedGoals, filters, student);
  assert.equal(partial.classRows.length, 1, "D: taak en overige detaildata blijven beschikbaar bij verb-RPC-fout");
  assert.equal(partial.verbError, true);
  assert.ok(errors.some(row => String(row[0]).includes("Werkwoorddoelen")), "technische fout gaat naar console");
  state.client = failedGoals;
  await api.openStudentDetail(student.id);
  assert.match(content.innerHTML, /Heylen Felix · 1AB/, "een verb-RPC-fout mag de leerlingpagina niet blokkeren");
  assert.match(content.innerHTML, /Werkwoordbeheersing is tijdelijk niet beschikbaar/);

  const denied = { rpc(name) { return Promise.resolve(name === "get_class_activity_monitor"
    ? { data: null, error: { code: "42501", message: "class access denied" } }
    : { data: [], error: null }); } };
  await assert.rejects(api.loadStudentDetailExtras(denied, filters, student),
    error => error && error.code === "42501" && error.message === "class access denied",
    "F: onbevoegde klas wordt geweigerd");
  assert.match(source, /await refreshMonitor\(true\)/, "G: werkende klasmonitor blijft bestaan");
  console.log("FASE 8B LEERLINGDETAILREGRESSIE GESLAAGD");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
