const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../exercise-variants.js");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json", "utf8"));
const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");
const items = course.trajectories[1].items;
const find = (n) => items.find((item) => item.id === "uf1-item-" + String(n).padStart(6,"0"));
assert.equal(items.length,148);
assert.equal(new Set(items.map(item => item.id)).size,148);
assert.deepEqual(engine.validateBank(bank,course),{variants:1795,permanentItems:1036});

for(const [id,form,accepted] of [
  [172,"mannelijk",["l’ainé","l’aîné"]],
  [173,"vrouwelijk",["l’ainée","l’aînée"]]
]){
  const item = find(id);
  assert.ok(item.nl.includes(form));
  assert.equal(item.fr,accepted[0]);
  assert.deepEqual(item.accepted_answers,accepted);
}
assert.ok(find(191).nl.includes("mannelijk"));
assert.ok(find(192).nl.includes("vrouwelijk"));
assert.deepEqual(find(169).accepted_answers,["jouer au foot","jouer au football"]);
assert.equal(find(219).fr,"être quatre");
assert.ok(!find(219).nl.includes("("));
assert.deepEqual(find(154).accepted_answers,["le nom","le nom de famille","le nom (de famille)"]);

for(const [id,yes,no] of [
  ["T2-VOC-CTX-016",["ainé","aîné"],["aine","ainée","aînée","ainné"]],
  ["T2-VOC-CTX-017",["ainée","aînée"],["aine","ainé","aîné","ainné"]]
]){
  const question = engine.compileVariant(bank.variants.find(v => v.id === id),course);
  yes.forEach(value => assert.equal(engine.grade(question,value).correct,true,id+" "+value));
  no.forEach(value => assert.equal(engine.grade(question,value).correct,false,id+" "+value));
}

// Check real vocabulary hint logic without changing the student grading.
const from = app.indexOf("function splitAnswerArticle(");
const to = app.indexOf("\nfunction recordAttempt(",from);
assert.ok(from>=0 && to>from);
const helper = new Function("state","currentRoundItemState","window",app.slice(from,to)+"\nreturn nearCorrectHint;")(
  {session:{questionAttempts:2}},()=>null,{}
);
for(const [id,answer,expected] of [
  [149,"le grand-pére","accente"],
  [142,"le fille","lidwoord"],
  [151,"la mère","maman"],
  [156,"le père","papa"],
  [170,"jouer à des jeu vidéo","meervoud"]
]){
  const item = find(id);
  const hint = helper(answer,{item,exerciseKey:"vocab-nl-fr",answers:item.accepted_answers || [item.fr]});
  assert.ok(hint && hint.nl.toLowerCase().includes(expected),id+" "+JSON.stringify(hint));
}
assert.match(app,/report-reason/);
assert.match(app,/report-explanation/);
assert.match(app,/report_reason: reason/);
assert.match(index,/exercise-variants\.js\?v=20261030-trajet2-reports-1/);
assert.match(index,/app\.js\?v=20261030-trajet2-reports-1/);
assert.match(teacherHtml,/teacher\.js\?v=20261030-trajet2-reports-1/);
assert.match(teacher,/course\.json\?v=20261030-trajet2-reports-1/);
console.log("TRAJET 2 REPORT CORRECTIONS OK: valid spellings, strict wrong answers, feedback, unchanged IDs.");
