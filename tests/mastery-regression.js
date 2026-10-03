const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mastery = require("../mastery.js");

function attempt(id, session, mode, correct, at, variant) {
  return {
    client_attempt_id: id,
    client_session_id: session,
    item_id: "uf1-item-test",
    equivalent_item_ids: ["uf1-item-test"],
    item_variant: variant || "",
    mode: mode,
    was_correct: correct,
    created_at: at || "2026-10-03T10:00:00.000Z"
  };
}

function status(attempts) {
  const records = mastery.mergeMasterySources([], attempts, [], []);
  return mastery.getMasteryStatus(records.get(mastery.keyFor("uf1-item-test", "")));
}

assert.equal(status([]), "new", "0 pogingen blijft Nieuw");
assert.equal(status([attempt("a1", "s1", "practice", true)]), "learning", "1/1 is nog niet Gekend");
assert.equal(status([
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", true, "2026-10-03T10:00:02Z"),
  attempt("a3", "s1", "practice", true, "2026-10-03T10:00:03Z")
]), "learning", "3/3 in één sessie blijft Aan het leren");
assert.equal(status([
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", true, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z")
]), "acquired", "3/3 over twee sessies wordt Gekend");
assert.equal(status([
  attempt("a1", "s1", "practice", false, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", true, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z"),
  attempt("a4", "s2", "test", true, "2026-10-03T10:00:04Z")
]), "acquired", "3/4 en laatste correct wordt Gekend");
assert.equal(status([
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", false, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z"),
  attempt("a4", "s2", "test", false, "2026-10-03T10:00:04Z"),
  attempt("a5", "s2", "test", true, "2026-10-03T10:00:05Z")
]), "learning", "3/5 is 60% en blijft Aan het leren");
assert.equal(status([
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", false, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z"),
  attempt("a4", "s2", "test", true, "2026-10-03T10:00:04Z"),
  attempt("a5", "s2", "test", true, "2026-10-03T10:00:05Z")
]), "acquired", "4/5 over twee sessies wordt Gekend");
assert.equal(status([
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", true, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z"),
  attempt("a4", "s2", "test", false, "2026-10-03T10:00:04Z")
]), "learning", "een laatste foute poging laat Gekend terugvallen");
assert.equal(status([
  attempt("a1", "s1", "learn", true), attempt("a2", "s2", "learn", true), attempt("a3", "s3", "learn", true)
]), "learning", "Leren maakt een item nooit Gekend");

const recovered = [
  attempt("a1", "s1", "practice", true, "2026-10-03T10:00:01Z"),
  attempt("a2", "s1", "practice", true, "2026-10-03T10:00:02Z"),
  attempt("a3", "s2", "test", true, "2026-10-03T10:00:03Z"),
  attempt("a4", "s2", "test", false, "2026-10-03T10:00:04Z"),
  attempt("a5", "s3", "practice", true, "2026-10-03T10:00:05Z")
];
assert.equal(status(recovered.slice(0, 4)), "learning");
assert.equal(status(recovered), "acquired", "na een nieuwe correcte poging kan het item opnieuw Gekend worden");

const server = [{
  item_id: "uf1-item-test", item_variant: "", practiced_attempts: 3,
  independent_attempts: 3, independent_correct: 3, independent_session_count: 2,
  independent_session_ids: ["s1", "s2"], latest_independent_at: "2026-10-03T10:00:03Z",
  latest_independent_correct: true
}];
const deduped = mastery.mergeMasterySources(server, [attempt("accepted", "s2", "practice", false, "2026-10-03T10:00:04Z")], ["accepted"], []);
assert.equal(deduped.get(mastery.keyFor("uf1-item-test", "")).independentAttempts, 3, "bevestigde lokale poging telt niet dubbel");

const dynamicItem = { id: "uf1-number-spec", type: "number", dynamic_range: true, range: [0, 100000] };
const dynamicRecords = mastery.mergeMasterySources([], [
  attempt("n1", "s1", "practice", true, "2026-10-03T10:00:01Z", "17"),
  Object.assign(attempt("n2", "s2", "practice", true, "2026-10-03T10:00:02Z", "83"), { item_id: "uf1-number-spec", equivalent_item_ids: ["uf1-number-spec"] })
], [], []);
// Zet ook de eerste poging op dezelfde number-spec.
const first = attempt("n1", "s1", "practice", true, "2026-10-03T10:00:01Z", "17");
first.item_id = "uf1-number-spec"; first.equivalent_item_ids = ["uf1-number-spec"];
const scalableRecords = mastery.mergeMasterySources([], [first, Object.assign({}, Array.from(dynamicRecords.values())[0] || {})], [], []);
const dynamicSummary = mastery.calculateMasterySummary([dynamicItem], mastery.mergeMasterySources([], [first], [], []));
assert.equal(dynamicSummary.total, 100001);
assert.equal(dynamicSummary.new, 100000, "het grote bereik wordt rekenkundig geteld zonder 100001 records te maken");
assert.equal(dynamicSummary.percentages.new + dynamicSummary.percentages.learning + dynamicSummary.percentages.acquired, 100);

const verbSummary = mastery.calculateMasterySummary([{ id: "uf1-verb", type: "verb", conjugations: [{ subject: "je" }, { subject: "tu" }] }], new Map());
assert.equal(verbSummary.total, 3, "infinitief en inhoudelijk afzonderlijke vervoegingsvarianten zijn aparte mastery-eenheden");

const root = path.join(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase", "phase5-mastery.sql"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const course = JSON.parse(fs.readFileSync(path.join(root, "data", "course.json"), "utf8"));
const ids = course.trajectories.flatMap(function (trajectory) { return trajectory.items.map(function (item) { return item.id; }); });
assert.equal(ids.length, 1036, "alle 1036 permanente course-items blijven aanwezig");
assert.equal(new Set(ids).size, 1036, "permanente IDs blijven uniek");
assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
assert.match(sql, /where pa\.student_id = matched_student_id/i);
assert.doesNotMatch(sql, /submitted_answer/i);
assert.match(sql, /revoke all on function public\.get_student_mastery/i);
assert.match(index, /mastery\.js[^]*sync-manager\.js[^]*app\.js/i, "mastery.js wordt vóór app.js geladen");
assert.match(index, /<title>Mon parcours \| Univers français 1<\/title>/);
assert.match(index, /<strong>Mon parcours<\/strong><small>Univers français 1<\/small>/);
assert.match(app, /Apprendre\. S’entraîner\. Progresser\./);
assert.match(app, /get_student_mastery/);

console.log("Mastery-regressietests geslaagd.");
