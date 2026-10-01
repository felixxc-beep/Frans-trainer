const assert = require("node:assert/strict");
const fs = require("node:fs");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const items = course.trajectories.flatMap(function (trajectory) { return trajectory.items; });
const ids = items.map(function (item) { return item.id; });
const itemTypes = Array.from(new Set(items.map(function (item) { return item.type; }))).sort();
assert.equal(ids.length, 1036);
assert.equal(new Set(ids).size, 1036);
ids.forEach(function (id) { assert.match(id, /^uf1-item-\d{6}$/); });
assert.equal(ids[0], "uf1-item-000001");
for (let number = 1; number <= 1036; number += 1) {
  assert.ok(ids.includes("uf1-item-" + String(number).padStart(6, "0")), "ontbrekende vaste ID " + number);
}
assert.equal(ids.filter(function (id) { return Number(id.slice(-6)) <= 520; }).length, 520);
assert.equal(ids.filter(function (id) { return Number(id.slice(-6)) >= 521 && Number(id.slice(-6)) <= 565; }).length, 45);
assert.equal(ids.filter(function (id) { return Number(id.slice(-6)) >= 566; }).length, 471);

const schema = fs.readFileSync("supabase/schema.sql", "utf8");
const rls = fs.readFileSync("supabase/rls.sql", "utf8");
const frontend = ["index.html", "config.js", "supabase-client.js", "student-identity.js", "sync-manager.js", "app.js"]
  .map(function (file) { return fs.readFileSync(file, "utf8"); }).join("\n");

assert.deepEqual(itemTypes, ["grammar_rule", "number", "phrase", "sound_rule", "verb", "vocabulary"]);
itemTypes.forEach(function (itemType) {
  assert.ok(schema.includes("'" + itemType + "'"), itemType + " ontbreekt in de SQL-validatie");
});
assert.doesNotMatch(schema + frontend, /submitted_answer/);
assert.match(schema, /student_code ~ '\^\[A-Za-z0-9_-\]\{8,64\}\$'/);
assert.match(schema, /char_length\(btrim\(p_student_code\)\) not between 8 and 64/);
assert.match(schema, /default private\.generate_student_code\(\)/);

["classes", "students", "practice_sessions", "practice_attempts"].forEach(function (table) {
  assert.ok(schema.includes("create table if not exists public." + table));
  assert.ok(rls.includes("alter table public." + table + " enable row level security"));
  assert.ok(rls.includes("alter table public." + table + " force row level security"));
  assert.ok(rls.includes("revoke all on table public." + table + " from anon, authenticated"));
});

assert.match(schema, /unique \(student_id, client_session_id\)/);
assert.match(schema, /unique \(student_id, client_attempt_id\)/);
assert.match(schema, /on conflict \(student_id, client_attempt_id\) do nothing/);
assert.match(schema, /create schema if not exists private/);
assert.match(schema, /create or replace function private\.verify_student_identity_impl[\s\S]+security definer[\s\S]+set search_path = ''/);
assert.match(schema, /create or replace function private\.ingest_practice_bundle_impl[\s\S]+security definer[\s\S]+set search_path = ''/);
assert.doesNotMatch(schema, /create or replace function public\.[^(]+\([^;]+security definer/);
assert.match(schema, /create or replace function public\.verify_student_identity[\s\S]+security invoker[\s\S]+private\.verify_student_identity_impl/);
assert.match(schema, /create or replace function public\.ingest_practice_bundle[\s\S]+security invoker[\s\S]+private\.ingest_practice_bundle_impl/);
assert.doesNotMatch(rls, /grant select[^;]+to anon/i);
assert.doesNotMatch(frontend, /(?:service_role|sb_secret_)[A-Za-z0-9._-]{10,}/);
assert.match(rls, /grant execute on function public\.verify_student_identity/);
assert.match(rls, /grant execute on function public\.ingest_practice_bundle/);
assert.match(rls, /revoke all on schema private from public, anon, authenticated, service_role/);
assert.match(rls, /revoke all on function private\.verify_student_identity_impl/);
assert.match(rls, /revoke all on function private\.ingest_practice_bundle_impl/);

console.log("FASE 2 SECURITY-AUDIT GESLAAGD");
console.log("1036 vaste IDs (bestaande 1–565 plus nieuwe 566–1036), alle 6 itemtypes, private SECURITY DEFINER-logica, minimale RPC-toegang en idempotente sleutels gecontroleerd.");
