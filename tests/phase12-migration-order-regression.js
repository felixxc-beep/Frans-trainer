const assert = require("node:assert/strict");
const fs = require("node:fs");

const phase11 = fs.readFileSync("supabase/phase11-curated-variants.sql", "utf8");
const phase12 = fs.readFileSync("supabase/phase12-report-reliability.sql", "utf8");
const preflight = fs.readFileSync("supabase/phase12-production-preflight.sql", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const grading = fs.readFileSync("exercise-variants.js", "utf8");
const sync = fs.readFileSync("sync-manager.js", "utf8");

assert.match(phase11, /create table public\.practice_question_submissions\s*\(/i);
assert.match(phase11, /unique\s*\(student_id,\s*client_submission_id\)/i);
assert.match(phase11, /alter table public\.practice_question_submissions force row level security/i);
assert.match(phase11, /rename to ingest_practice_bundle_pre_curated_impl/i);
assert.match(phase11, /create function public\.curated_sync_version\(\)/i);

const guard = phase12.indexOf("do $phase12_prerequisites$");
const firstChange = phase12.indexOf("alter table public.assignments add column");
assert.ok(guard > phase12.indexOf("begin;") && guard < firstChange,
  "fase 12 must validate phase 11 before any schema change");
assert.match(phase12.slice(guard, firstChange), /to_regclass\('public\.practice_question_submissions'\)/i);
assert.match(phase12.slice(guard, firstChange), /to_regprocedure\('public\.curated_sync_version\(\)'\)/i);
assert.match(phase12.slice(guard, firstChange), /phase11-curated-variants\.sql/i);
assert.match(phase12, /\bcommit;\s*$/i);
assert.doesNotMatch(phase12, /(?:delete|truncate)\s+(?:from\s+)?public\.practice_(?:attempts|sessions)/i);

assert.match(preflight, /phase11_cleanly_absent/i);
assert.match(preflight, /phase11_complete/i);
assert.match(preflight, /phase12_not_started/i);
assert.match(preflight, /pg_catalog\.pg_get_constraintdef/i);
assert.doesNotMatch(preflight, /\b(?:insert|update|delete|alter|create|drop|truncate)\s+(?:into\s+|from\s+)?(?:public|private)\./i,
  "preflight must remain read-only");

assert.match(app, /session\.question_submissions\.push\(/);
assert.match(app, /if \(!graded\.evidence\.length\)/);
assert.match(grading, /variantScoring === "integrative" && !correct \? \[\]/);
assert.match(sync, /rpc\("curated_sync_version"/);

console.log("FASE 12 MIGRATIEVOLGORDE GESLAAGD: expliciete prerequisite, read-only preflight en evidence/vraaginzending-scheiding.");
