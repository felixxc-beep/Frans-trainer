const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sql = fs.readFileSync("supabase/phase11-teacher-task-lifecycle.sql", "utf8");
const original = fs.readFileSync("supabase/phase7-assignments.sql", "utf8");
const teacherSource = fs.readFileSync("teacher.js", "utf8");
const css = fs.readFileSync("teacher.css", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
assert.match(original, /created_by_teacher_id uuid not null references public\.teachers\(auth_user_id\)/);
assert.match(original, /values \(auth\.uid\(\),v_title/);
assert.match(original, /'created_by_teacher_id',a\.created_by_teacher_id/);
assert.match(original, /'created_at',a\.created_at/);
assert.match(sql, /alter table public\.assignments alter column created_by_teacher_id drop not null/);
assert.doesNotMatch(sql, /update public\.assignments set created_by_teacher_id/,
  "legacy-makers mogen niet willekeurig worden ingevuld");
assert.match(sql, /assignment_auto_archive_grace_days\(\)[\s\S]*select 7/);
assert.match(sql, /when v_status='draft' then 'draft'[\s\S]*when v_status='archived' then 'archived'[\s\S]*v_due\+pg_catalog\.make_interval\(days => v_grace\)/);
assert.match(sql, /private\.get_teacher_assignments_pre_lifecycle_impl\(\)/,
  "bestaande class-scoped teacher-RPC blijft de basis");
assert.match(sql, /private\.teacher_has_class_access\(s\.class_id\)/);
assert.match(sql, /create or replace function public\.get_teacher_assignments\(\)[\s\S]*private\.get_teacher_assignments_impl\(\)/);
assert.match(sql, /private\.current_teacher_is_admin\(\) or v_task\.created_by_teacher_id=auth\.uid\(\)/);
assert.match(sql, /private\.teacher_has_class_access\(ac\.class_id\)/);
assert.match(sql, /security definer set search_path = ''/);
assert.match(sql, /create function public\.restore_assignment[\s\S]*security invoker set search_path = ''/);
assert.doesNotMatch(sql, /delete from public\.(assignments|practice_attempts|assignment_completions|assignment_rounds|assignment_item_reports)/i);
assert.doesNotMatch(sql, /update public\.assignments set[^;]*due_at/i,
  "herstellen wijzigt de deadline niet");
assert.doesNotMatch(sql, /update public\.assignments set status='archived'/i,
  "automatisch archiveren is uitsluitend afgeleid, zonder database-mutatie");
assert.match(html, /teacher\.js\?v=20261009-3/);
assert.match(css, /\.task-owner-tabs/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.task-overview-row/);
assert.match(teacherSource, /action === "task-owner-filter"[\s\S]*state\.tasks\.ownerFilter = target\.dataset\.value/);
assert.match(teacherSource, /form\.dataset\.form === "task-archive-filters"[\s\S]*state\.tasks\.archiveFilters/);
assert.match(teacherSource, /action === "restore-task"[\s\S]*rpc\("restore_assignment", \{ p_assignment_id: task\.id \}\)/);

const windowObject = { MON_PARCOURS_TEACHER_TEST: true };
vm.runInNewContext(fs.readFileSync("teacher.js", "utf8"), { window: windowObject, document: {}, console, Date, Intl });
const api = windowObject.MonParcoursTeacherTaskTest;
const state = windowObject.MonParcoursTeacherTestState;
const due = "2026-10-10T12:00:00Z";
const lifecycleTask = { status: "published", due_at: due, auto_archive_grace_days: 7 };
assert.equal(api.taskLifecycle(lifecycleTask, Date.parse("2026-10-10T11:59:59Z")), "active");
assert.equal(api.taskLifecycle(lifecycleTask, Date.parse("2026-10-11T12:00:00Z")), "recent");
assert.equal(api.taskLifecycle(lifecycleTask, Date.parse("2026-10-17T11:59:59Z")), "recent");
assert.equal(api.taskLifecycle(lifecycleTask, Date.parse("2026-10-17T12:00:01Z")), "archived");
assert.equal(api.taskLifecycle({ status: "archived", due_at: "2030-01-01T00:00:00Z" }), "archived");
assert.equal(api.taskLifecycle({ status: "draft" }), "draft");
assert.match(api.taskDeadlineLabel(lifecycleTask, "recent", Date.parse("2026-10-11T12:00:00Z")), /Gisteren afgelopen/);
assert.match(api.taskDeadlineLabel(lifecycleTask, "recent", Date.parse("2026-10-12T12:00:00Z")), /2 dagen geleden/);

const teacherA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const teacherB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const classId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tomorrow = new Date(Date.now() + 86400000).toISOString();
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
function task(id, title, creator, creatorName, lifecycle, deadline, reports) {
  return { id, title, created_by_teacher_id: creator, creator_name: creatorName,
    status: lifecycle === "archived" ? "archived" : lifecycle === "draft" ? "draft" : "published",
    lifecycle_status: lifecycle, auto_archive_grace_days: 7,
    due_at: deadline, created_at: "2026-09-01T00:00:00Z", updated_at: yesterday,
    classes: [{ id: classId, name: "1AA" }], class_ids: [classId], item_ids: ["uf1-item-000001"],
    student_count: 15, completed_count: 11, open_report_count: reports || 0,
    completion_strategy: "rounds", required_rounds: 3, mastery_strategy: "item_mastery" };
}
const own = task("task-a", "Eigen taak", teacherA, "M. Cabanier", "active", tomorrow, 2);
const colleague = task("task-b", "Collega-taak", teacherB, "K. Koyen", "active", nextWeek, 0);
const recentNew = task("task-c", "Gisteren verlopen", teacherB, "K. Koyen", "recent", yesterday, 0);
const recentOld = task("task-d", "Eerder verlopen", teacherA, "M. Cabanier", "recent", twoDaysAgo, 0);
const archived = task("task-e", "Oude taak", teacherB, "K. Koyen", "archived", "2026-01-01T00:00:00Z", 0);
const legacy = task("task-f", "Legacy taak", null, null, "archived", "2026-01-01T00:00:00Z", 0);
state.user = { id: teacherA };
state.teacherProfile = { role: "teacher", is_active: true };
state.tasks.list = [archived, colleague, recentOld, own, legacy, recentNew];
let page = api.renderTasksPage();
assert.match(page, /Mijn taken/);
assert.doesNotMatch(page, /Collega-taak|Gisteren verlopen|Oude taak/);
assert.match(page, /Eigen taak/);
assert.match(page, /⚠ 2 meldingen/);
assert.match(page, /<details class="section-block task-archive"><summary>GEARCHIVEERD/);
state.tasks.ownerFilter = "all";
page = api.renderTasksPage();
assert.match(page, /Collega-taak/);
assert.match(page, /Door K\. Koyen/);
assert.match(page, /Legacy \/ onbekende maker/);
assert.match(page, /Mijn taak/);
assert.ok(page.indexOf("Eigen taak") < page.indexOf("Collega-taak"), "actieve taak met eerstvolgende deadline staat bovenaan");
assert.ok(page.indexOf("Gisteren verlopen") < page.indexOf("Eerder verlopen"), "recentst verlopen taak eerst");
state.tasks.selectedId = colleague.id;
state.tasks.detail = [];
state.tasks.reports = [];
let detail = api.renderTaskDetail();
assert.doesNotMatch(detail, /data-action="edit-task"|data-action="archive-task"/, "gewone collega heeft alleen leestoegang");
state.teacherProfile.role = "admin";
detail = api.renderTaskDetail();
assert.match(detail, /data-action="edit-task"/);
assert.match(detail, /data-action="archive-task"/);
state.tasks.selectedId = archived.id;
detail = api.renderTaskDetail();
assert.match(detail, /data-action="restore-task"/);
state.teacherProfile.role = "teacher";
state.tasks.selectedId = legacy.id;
detail = api.renderTaskDetail();
assert.doesNotMatch(detail, /data-action="edit-task"|data-action="restore-task"/,
  "legacy-taak zonder maker is alleen door admin te beheren");

const filtered = api.taskArchiveFilterRows([archived, legacy], { classId, creatorId: teacherB, period: "all", query: "Oude" });
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, archived.id);
assert.equal(api.taskArchiveFilterRows([archived, legacy], { classId: "other", creatorId: "all", period: "all", query: "" }).length, 0);
const oldArchive = { ...archived, updated_at: "2020-01-01T00:00:00Z" };
assert.equal(api.taskArchiveFilterRows([oldArchive], { classId: "all", creatorId: "all", period: "30", query: "" }).length, 0);
assert.equal(api.taskArchiveFilterRows([oldArchive], { classId: "all", creatorId: "all", period: "older", query: "" }).length, 1);
console.log("TEACHER-TAAK-LIFECYCLEREGRESSIE GESLAAGD");
