const assert = require("node:assert/strict");
const course = require("../data/course.json");
const bank = require("../data/exercise-variants.json");
const engine = require("../exercise-variants.js");

assert.equal(engine.validateBank(bank, course).variants, 1737);
const items = new Map(course.trajectories.flatMap((trajectory) =>
  trajectory.items.map((item) => [item.id, item])));
const byId = new Map(bank.variants.map((variant) => [variant.id, variant]));

for (const [prefix, count, kind, type] of [
  ["T3-VILL-", 15, "actes", "phrase"],
  ["T4-TRSP-CTX-", 15, "context", "vocabulary"],
  ["T5-PREP-", 12, "context", "vocabulary"]
]) {
  const variants = bank.variants.filter((variant) => variant.id.startsWith(prefix));
  assert.equal(variants.length, count, prefix + " stays complete");
  for (const variant of variants) {
    assert.equal(variant.kind, kind, variant.id + " is classified by learning goal");
    assert.equal(variant.targets.length, 1);
    assert.equal(items.get(variant.targets[0]).type, type);
    assert.equal(items.get(variant.targets[0]).top_category, "Atelier Parole");
    if (type === "phrase") assert.ok(
      [items.get(variant.targets[0]).fr].concat(items.get(variant.targets[0]).accepted_answers || [])
        .includes(variant.accepted_answers[0]),
      variant.id + " uses its exact permanent phrase item or documented alternative");
  }
}
assert.deepEqual(byId.get("T4-TRSP-CTX-007").targets, ["uf1-item-000635"]);
assert.deepEqual(byId.get("T5-PREP-012").targets, ["uf1-item-000763"]);

for (const variant of bank.variants.filter((entry) => entry.kind === "grammar")) {
  const targets = variant.scoring === "multi_gap"
    ? variant.gaps.flatMap((gap) => gap.targets) : variant.targets;
  for (const id of targets)
    assert.equal(items.get(id).type, "grammar_rule",
      variant.id + " may not teach incidental vocabulary or spelling as grammar evidence");
}
const homophones = bank.variants.filter((variant) => variant.id.startsWith("T6-HOM-"));
assert.equal(homophones.length, 24);
assert.equal(homophones.reduce((count, variant) => count + (variant.gaps || [variant]).length, 0), 29,
  "24 spellingvragen contain 29 checked answer fields");
for (const variant of homophones) {
  assert.equal(variant.kind, "spelling");
  assert.match(variant.instruction, /schrijfwijze/);
}

const infinitive = byId.get("T1-GRAM-AIMER-022");
assert.deepEqual(byId.get("T4-GRAM-FEM-008").targets,["uf1-item-000707"],"calme stays unchanged at the feminine");
assert.deepEqual(byId.get("T4-GRAM-PL-006").targets,["uf1-item-000713"],"rapide → rapides tests adding -s");
assert.deepEqual(byId.get("T4-GRAM-PL-005").targets,["uf1-item-000713"],"dangerous feminine is already given; only plural is requested");
assert.equal(byId.get("T4-GRAM-FCTX-008").scope_kind,"mixed","roux is relocated from the feminine scope as the master explicitly requires");
for(const suffix of ["002","007","008","009","010"]) {
  const variant=byId.get("T4-GRAM-PL-"+suffix);
  assert.equal(variant.kind,"revision");assert.equal(variant.evidence_policy,"practice_only");
  assert.equal(engine.grade(engine.compileVariant(variant,course),variant.accepted_answers[0]).evidence.length,0,
    "a requested noun cannot prove adjective mastery");
}
assert.equal(infinitive.kind, "grammar");
assert.match(infinitive.prompt, /cuisiner \/ cuisines \/ cuisine/);
assert.equal(infinitive.targets[0], "uf1-item-000135");
assert.equal(engine.grade(engine.compileVariant(infinitive, course), "cuisiner").correct, true);
assert.equal(engine.grade(engine.compileVariant(infinitive, course), "cuisine").correct, false);
assert.equal(byId.get("T1-VOC-CTX-060").kind, "context",
  "lexical cuisiner remains in vocabulary En contexte");

const mixed = byId.get("T1-GRAM-ALL-007");
assert.deepEqual(mixed.gaps.map((gap) => gap.targets[0]),
  ["uf1-item-000134", "uf1-item-000135"]);
assert.match(mixed.prompt, /regarder \/ regardes \/ regarde/);
assert.equal(engine.grade(engine.compileVariant(mixed, course), ["la", "regarder"]).correct, true);
assert.equal(engine.grade(engine.compileVariant(mixed, course), ["la", "regarde"]).correct, false);

assert.equal(byId.get("T2-GRAM-ART-009").gaps[0].targets[0], "uf1-item-000128",
  "the first article gap must not claim negation mastery");
assert.equal(byId.get("T2-GRAM-ART-009").gaps[1].targets[0], "uf1-item-000279");
assert.match(byId.get("T2-GRAM-PAS-001").instruction, /ne \.\.\. pas/);
assert.match(byId.get("T2-GRAM-ART-001").prompt, /\(ne \.\.\. pas\)/);
assert.match(byId.get("T2-GRAM-MIX-002").prompt, /\(ne \.\.\. jamais\)/);
assert.match(byId.get("T3-GRAM-A-001").prompt, /\(à \+ le\)/);
assert.match(byId.get("T5-POSS-SON-001").instruction, /bezittelijk/);
assert.match(byId.get("T5-POSS-VOTRE-004").prompt, /\(jullie\/uw\)/);
assert.equal(byId.get("T6-Q-DOUBLE-001").evidence_policy, "practice_only",
  "two accepted question constructions must not falsely prove one grammar rule");
assert.match(byId.get("T6-Q-DOUBLE-001").prompt, /\(intonation ou est-ce que\)/);
assert.match(byId.get("T6-Q-ECQ-001").prompt, /\(est-ce que\)/);

console.log("GRAMMATICA/CONTEXT GESLAAGD: 42 varianten juist ingedeeld, expliciete vormcues, correcte per-gat-targets en geen valse mastery voor alternatieve vraagvormen.");
