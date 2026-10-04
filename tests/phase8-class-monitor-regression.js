const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const css = fs.readFileSync("teacher.css", "utf8");
const sql = fs.readFileSync("supabase/phase8-class-monitor.sql", "utf8");
const sandbox = vm.createContext({ window: { MON_PARCOURS_TEACHER_TEST: true }, console, Date, Intl, Uint8Array });
vm.runInContext(source, sandbox);
const api = sandbox.window.MonParcoursTeacher;

const now = "2026-10-04T10:00:00Z";
const rawRows = Array.from({ length: 15 }, (_, index) => ({
  student_id: "s" + index, class_id: "class-a", display_name: "Leerling " + index,
  is_active: true, unique_exercises: index < 9 ? 10 : 0,
  attempt_count: index < 9 ? 12 : 0,
  independent_attempts: index < 9 ? 10 : 0,
  independent_correct: index < 9 ? 8 : 0,
  active_seconds: index < 9 ? 420 : 0,
  last_activity_at: index < 3 ? "2026-10-04T09:58:30Z" : index < 9 ? "2026-10-04T09:30:00Z" : null,
  recent_open_session: index < 3, current_mastery_percentage: 41,
  active_assignment_count: index === 0 ? 1 : 0,
  active_assignment: index === 0 ? { id: "task-1", title: "Verbes en -ER", mastery_percentage: 68 } : null
}));
const rows = api.normalizeMonitorRows(rawRows, now, {});
assert.equal(rows.length, 15);
assert.equal(rows.filter(row => row.status === "Bezig").length, 3);
assert.equal(rows.filter(row => row.status === "Geoefend").length, 6);
assert.equal(rows.filter(row => row.status === "Nog niet gestart").length, 6);
const summary = api.monitorSummary(rows);
assert.equal(summary.total, 15);
assert.equal(summary.practiced, 9);
assert.equal(summary.idle, 6);
assert.equal(summary.active, 3);
assert.equal(summary.exercises, 90);
assert.equal(summary.accuracy, 80);
assert.equal(rows[9].exercisesMade, 0);
assert.equal(rows[9].activeDurationSeconds, 0);
assert.equal(rows[9].lastActivity, null);
assert.equal(rows[9].accuracy, null);
assert.equal(rows[9].masteryPercentage, 41, "huidige mastery blijft bestaan zonder periodeactiviteit");
assert.equal(api.sortClassMonitor(rows, "auto")[0].status, "Nog niet gestart");
assert.equal(api.sortClassMonitor(rows, "made")[0].exercisesMade, 10);
assert.equal(api.formatMonitorDuration(0), "0 min");
assert.equal(api.formatMonitorDuration(42), "< 1 min");
assert.equal(api.formatMonitorDuration(433), "7 min");
assert.equal(api.formatMonitorDuration(4320), "1 u 12 min");
assert.equal(api.relativeActivity("2026-10-04T09:59:10Z", now), "nu");
assert.equal(api.relativeActivity("2026-10-04T09:46:00Z", now), "14 min geleden");
const idleOldSession = api.normalizeMonitorRows([{ ...rawRows[0], last_activity_at: "2026-10-04T09:10:00Z" }], now, {});
assert.equal(idleOldSession[0].status, "Geoefend", "een oude open sessie is niet automatisch Bezig");
const stuck = api.normalizeMonitorRows([{ ...rawRows[0], independent_attempts: 5, independent_correct: 1 }], now, {});
assert.equal(stuck[0].mayBeStuck, true);
const rendered = api.renderClassMonitor({ id: "class-a", name: "1AA" }, rows, "all");
assert.equal((rendered.match(/class="monitor-row"/g) || []).length, 15, "alle 15 leerlingen staan in de monitor");
assert.match(rendered, /9 \/ 15/);
assert.match(rendered, /Huidige mastery/);
assert.match(rendered, /Verbes en -ER/);
assert.match(rendered, /Nog niet gestart/);
const idleRendered = api.renderClassMonitor({ id: "class-a", name: "1AA" }, rows, "idle");
assert.equal((idleRendered.match(/class="monitor-row"/g) || []).length, 6);

const today = api.periodBounds("today", "2026-03-29T12:00:00Z");
assert.equal(new Date(today.start).toISOString(), "2026-03-28T23:00:00.000Z", "Brusselse dagstart bij zomeruur");
const yesterday = api.periodBounds("yesterday", "2026-10-26T12:00:00Z");
assert.equal(yesterday.end - yesterday.start, 25 * 3600000, "vorige kalenderdag bij winteruur duurt 25 uur");

let rpcCall;
const monitorClient = { rpc(name, params) { rpcCall = { name, params }; return Promise.resolve({ data: rawRows, error: null }); } };
api.fetchClassMonitor(monitorClient, { period: "60m", classId: "class-a", trajectory: "Trajet 1", mode: "practice",
  category: "Atelier Parole", subsection: "Actes de parole", assignmentId: "task-1", studentStatus: "active" }, true, now).then(function (result) {
  assert.equal(result.length, 15);
  assert.equal(rpcCall.name, "get_class_activity_monitor");
  assert.equal(rpcCall.params.p_class_id, "class-a");
  assert.equal(rpcCall.params.p_period_start, "2026-10-04T09:00:00.000Z");
  assert.equal(rpcCall.params.p_assignment_id, "task-1");
  assert.equal(rpcCall.params.p_student_status, "active");
  assert.equal(rpcCall.params.p_include_mastery, true);
  const fetched = [];
  const baseClient = { from(name) { fetched.push(name); return { select() { return { range() { return Promise.resolve({ data: [], error: null }); } }; } }; } };
  return api.loadDashboardBase(baseClient).then(function () {
    assert.deepEqual(fetched, ["classes", "students"], "dashboard mag geen ruwe sessies/pogingen ophalen");
    assert.match(html, /id="assignmentFilter"/);
    assert.match(html, /Laatste 15 minuten[\s\S]*Laatste 30 minuten[\s\S]*Laatste 60 minuten/);
    assert.match(source, /document\.hidden/);
    assert.match(source, /MONITOR_REFRESH_MS = 30000/);
    const refreshBlock = source.slice(source.indexOf("function scheduleAutoRefresh()"), source.indexOf("function showLogin("));
    assert.match(refreshBlock, /await refreshMonitor\(false\)/);
    assert.doesNotMatch(refreshBlock, /loadRlsDataset/, "automatisch verversen mag geen ruwe historie ophalen");
    assert.match(source, /monitor-quick/);
    assert.match(source, /export-monitor/);
    assert.match(css, /monitor-table th \{ position: sticky/);
    assert.match(sql, /private\.teacher_has_class_access\(p_class_id\)/);
    assert.match(sql, /private\.teacher_has_class_access\(s\.class_id\)/);
    assert.match(sql, /security definer set search_path = ''/);
    assert.match(sql, /security invoker set search_path = ''/);
    assert.match(sql, /count\(distinct \(session_id,item_id,coalesce\(item_variant,''\)\)\)/);
    assert.match(sql, /active_duration_seconds/);
    assert.match(sql, /practice_attempts_created_student_idx/);
    assert.match(sql, /private\.student_current_mastery_percentage/);
    assert.match(sql, /private\.verb_goal_progress/);
    assert.doesNotMatch(sql, /submitted_answer/);
    assert.match(sql, /revoke all on function public\.get_class_activity_monitor/);
    assert.match(sql, /grant execute on function public\.get_class_activity_monitor[\s\S]*to authenticated/);
    console.log("FASE 8 KLASMONITORREGRESSIE GESLAAGD");
  });
}).catch(function (error) { console.error(error); process.exitCode = 1; });
