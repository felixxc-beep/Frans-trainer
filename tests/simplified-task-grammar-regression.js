const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../exercise-variants.js");
const policy = require("../exercise-policy.js");

const course = JSON.parse(fs.readFileSync("data/course.json","utf8"));
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json","utf8"));
const index = engine.itemIndex(course);
const grammarGoals = course.trajectories.flatMap(t => t.items).filter(i => i.type === "grammar_rule");
assert.equal(grammarGoals.length,132);

const appliedTargets = new Set();
for (const variant of bank.variants) {
  if (variant.evidence_policy === "practice_only" || variant.scoring === "integrative") continue;
  if (!["grammar","conjugation"].includes(variant.kind)) continue;
  engine.targetsForVariant(variant).forEach(id => appliedTargets.add(id));
}
const uncovered = grammarGoals.filter(i => !appliedTargets.has(i.id));
assert.deepEqual(uncovered.map(i => i.id),[], "every grammar goal has a genuine application exercise");

const t1Grammar = course.trajectories[0].items.filter(i => i.top_category === "Atelier Grammaire");
const scope = {trajectory:"Trajet 1",top_category:"Atelier Grammaire",lesson:"L’article défini et indéfini",block:"",subsection:"",category:""};
const options = policy.options(t1Grammar,bank,course,scope);
assert.equal(options.some(o => o.key === "grammar_rule"),false,"rule-recall is never offered");
const forms = options.map(o => o.key);
const entries = policy.pool(t1Grammar,bank,course,forms,scope);
assert.ok(entries.length >= 30);
assert.equal(policy.selectEntries(entries,20,t1Grammar.map(i=>i.id)).length,20);
assert.equal(policy.selectEntries(entries,30,t1Grammar.map(i=>i.id)).length,30);

const revisionScope={trajectory:"Trajet 1",top_category:"Action !",lesson:"Révision Trajet 1",block:"",subsection:"",category:""};
const revisionEntries=policy.pool([],bank,course,["revision","revision_other"],revisionScope);
assert.ok(revisionEntries.length >= 30,"Révision is assignable as one complete exercise pool");

const teacher=fs.readFileSync("teacher.js","utf8");
assert.match(teacher,/Hoeveel oefeningen per ronde\?/);
assert.doesNotMatch(teacher,/Van leerdoel<\/span>|Tot leerdoel<\/span>/);
assert.doesNotMatch(teacher,/geselecteerde leerdoelen hebben nog geen vraag/);
console.log("VEREENVOUDIGDE-TAAKMAKER-EN-GRAMMATICA-REGRESSIE GESLAAGD");
