const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const migrationPath = 'supabase/phase10-12-state-aware-upgrade.sql';
const before = fs.readFileSync(migrationPath,'utf8');
cp.execFileSync(process.execPath,['scripts/build-state-aware-upgrade.js'],{stdio:'pipe'});
const sql = fs.readFileSync(migrationPath,'utf8');
assert.equal(sql,before,'standalone migration is reproducibly generated');
assert.match(sql,/^--[\s\S]*begin;[\s\S]*commit;\s*$/);
assert.doesNotMatch(sql,/\b(?:truncate|drop table|drop column|drop function|alter function[^;]*rename|delete from)\b/i);
assert.doesNotMatch(sql,/create function /i,'all functions tolerate an existing signature');
assert.doesNotMatch(sql,/create (?:unique )?index (?!if not exists)/i);
assert.doesNotMatch(sql,/create table (?!if not exists|mon_parcours_upgrade_run)/i);
assert.doesNotMatch(sql,/add column (?!if not exists)/i);
assert.match(sql,/completion_kind text/);
assert.match(sql,/include_integrative_sentences boolean not null default false/);
assert.match(sql,/use_exercise_variants boolean not null default false/);
assert.match(sql,/practice_question_submissions \([\s\S]*client_submission_id uuid not null/);
assert.match(sql,/client_evidence_ids uuid\[\]/);
assert.match(sql,/target_results jsonb/);
assert.match(sql,/defer_round_completion/,'evidence callbacks cannot register a transient completion before question outcomes are reconciled');
assert.match(sql,/stored\.target_results is distinct from/);
assert.match(sql,/preservation_verified=true/);
assert.match(sql,/Preservation failed for %: transaction rolled back/);
assert.match(sql,/update public\.assignment_completions c set reopened_at=/);
assert.match(sql,/completed_at=coalesce\(ri\.completed_at,e\.completed_at\)/);
assert.match(sql,/v_existing is null and v_round>1/,'reopened earlier rounds do not invalidate existing later sets');
assert.match(sql,/a\.include_integrative_sentences=true or a\.use_exercise_variants=true/);
assert.match(sql,/client_attempt_id=any\(linked\.client_evidence_ids\)/,'report gate does not count multiple evidence rows as multiple submissions');
assert.match(sql,/jsonb_array_length\(p_payload->'submitted_answers'\) not between 1 and 1000/);
assert.match(sql,/original_completion jsonb not null/);
assert.match(sql,/pa\.created_at>v_report\.resolved_at/);
assert.match(sql,/q\.created_at>v_report\.resolved_at/);
assert.match(sql,/published variant mode is immutable/);
assert.match(sql,/published sentence mode is immutable/);
assert.match(sql,/function_definition_drift/);
assert.match(sql,/supabase_ledger_present/);
// The compiled wrapper graph must terminate at known phase 7–9 primitives,
// regardless of which phase 10–12 wrapper names exist on production.
const definitions = new Map([...sql.matchAll(/create or replace function ([\w.]+)\s*\([\s\S]*?\$\$;/gi)]
  .map(m=>[m[1],m[0]]));
assert.equal([...sql.matchAll(/create or replace function ([\w.]+)/gi)].length,definitions.size,
  'each function is installed exactly once; SQL replacement text must not duplicate a suffix');
const graph=new Map([...definitions].map(([name,body])=>[name,[...body.matchAll(/(?:perform|select|:=|return)\s+(private\.[\w]+)\s*\(/gi)]
  .map(m=>m[1]).filter(callee=>definitions.has(callee))]));
function visit(name,ancestors=new Set()) {
  assert.ok(!ancestors.has(name),'wrapper cycle: '+[...ancestors,name].join(' → '));
  for(const callee of graph.get(name)||[]) visit(callee,new Set([...ancestors,name]));
}
for(const name of graph.keys()) visit(name);
const verification=fs.readFileSync('supabase/phase10-12-state-aware-verification.sql','utf8');
assert.match(verification,/select private\.mon_parcours_upgrade_verification\(\)/);
assert.doesNotMatch(verification,/\b(?:alter|insert|update|delete|drop|create|truncate)\b/i);
// These are contract checks, not a substitute for executing PostgreSQL.
console.log('STATE-AWARE SQL-CONTRACTREGRESSIE GESLAAGD: herhaalbare DDL, eindige callgraph, datahashbewaking, grants en backwards compatibility.');
