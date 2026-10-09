const assert = require("node:assert/strict");
const fs = require("node:fs");

const sql = fs.readFileSync("supabase/phase10-item-reports.sql", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sync = fs.readFileSync("sync-manager.js", "utf8");

assert.match(sql, /create table public\.assignment_item_reports/);
assert.match(sql, /unique \(assignment_id,student_id,round_number,item_id\)/);
assert.match(sql, /jsonb_array_length\(submitted_answers\) between 1 and 3/);
assert.match(sql, /from public\.practice_attempts pa[\s\S]*v_wrong<2/);
assert.match(sql, /alter table public\.assignment_item_reports enable row level security/);
assert.match(sql, /alter table public\.assignment_item_reports force row level security/);
assert.match(sql, /revoke all on public\.assignment_item_reports from public,anon,authenticated/);
assert.match(sql, /private\.teacher_has_class_access\(c\.id\)/);
assert.match(sql, /private\.teacher_has_class_access\(v_class\)/);
assert.match(sql, /security definer set search_path = ''/);
assert.match(sql, /create function public\.report_assignment_item[\s\S]*security invoker/);
assert.match(sql, /create function public\.resolve_assignment_item_report[\s\S]*security invoker/);
assert.match(sql, /p_decision='approved'[\s\S]*completion_kind='teacher_approved'/);
assert.match(sql, /completion_kind='reported_pending'/);
assert.match(sql, /update public\.assignment_round_items ri set completion_kind='correct'/);
assert.match(sql, /else\s+update public\.assignment_round_items ri set completed_at=null,completion_kind=null/);
assert.doesNotMatch(sql, /alter table public\.practice_attempts add column submitted_answer/);
assert.doesNotMatch(sql, /service_role\s+to/i);

assert.match(teacher, /get_teacher_assignment_reports", \{ p_assignment_id: id \}/);
assert.match(teacher, /state\.tasks\.reports = reportResult\.error \? \[\] : asArray\(reportResult\.data\)/,
  "ontbrekende migratie mag bestaande taakdetails niet blokkeren");
assert.match(teacher, /resolve_assignment_item_report", \{[\s\S]*p_report_id: id, p_decision: decision/);
assert.match(teacher, /Probleemmeldingen/);
assert.match(teacher, /data-action="resolve-item-report"/);
assert.match(html, /teacher\.js\?v=20261009-3/);
assert.match(app, /Signaler un problème/);
assert.match(app, /Terminé pour toi/);
assert.match(app, /À refaire/);
assert.match(sync, /enqueueIssueReport/);
assert.match(sync, /report_assignment_item/);

console.log("ITEM-MELDING-REGRESSIE GESLAAGD");
