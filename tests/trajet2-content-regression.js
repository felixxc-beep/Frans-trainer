const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../exercise-variants.js");
const policy = require("../exercise-policy.js");

const source = fs.readFileSync("app.js", "utf8");
const home = fs.readFileSync("index.html", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json", "utf8"));
const items = course.trajectories[1].items;
const id = function (n) { return "uf1-item-" + String(n).padStart(6, "0"); };

assert.equal(items.length, 148, "Do not change existing permanent mastery goals");
assert.deepEqual(["vocabulary", "phrase", "verb", "number", "grammar_rule", "sound_rule"].map(function (type) {
  return items.filter(function (item) { return item.type === type; }).length;
}), [83, 19, 15, 21, 5, 5]);
assert.deepEqual(engine.validateBank(bank, course), { variants: 1795, permanentItems: 1036 });

const answers = bank.variants.filter(function (row) { return /^T2-PRES-R-/.test(row.id); });
const sounds = bank.variants.filter(function (row) { return /^T2-SON-E-/.test(row.id); });
assert.equal(answers.length, 22);
assert.equal(sounds.length, 15);
assert.equal(new Set(answers.flatMap(function (row) { return row.targets; })).size, 10);
assert.deepEqual(new Set(sounds.flatMap(function (row) { return row.targets; })).size, 5);
const wanted = new Map([[281,"ai"],[282,"er"],[283,"ez"],[284,"é"],[285,"et"]]);
sounds.forEach(function (row) {
  const suffix = Number(row.targets[0].slice(-3));
  assert.equal(row.accepted_answers[0], wanted.get(suffix));
  assert.match(row.instruction, /ontbrekende letters/);
  assert.match(row.prompt, /___/);
  const question = engine.compileVariant(row, course);
  assert.equal(engine.grade(question, row.accepted_answers[0]).correct, true);
  assert.equal(engine.grade(question, "bogus").correct, false);
});
answers.forEach(function (row) {
  assert.equal(engine.grade(engine.compileVariant(row, course), row.accepted_answers[0]).correct, true);
  assert.doesNotMatch(row.prompt, /…|\[[^\]]+\]/);
  assert.doesNotMatch(row.accepted_answers.join(" / "), /…|\[[^\]]+\]/);
});

for (const suffix of [276,277,278]) {
  const rule = items.find(function (item) { return item.id === id(suffix); });
  assert.match(rule.answer, /NE \/ N’/);
  assert.match(rule.rule_nl, /stomme h/);
  assert.equal(rule.accepted_answers.length, 2);
}
for (const [suffix,prompt,answer] of [
  ["003","C’est un enfant unique.","Ce n’est pas un enfant unique."],
  ["004","C’est une Française.","Ce n’est pas une Française."]
]) {
  const item = bank.variants.find(function (row) { return row.id === "T2-GRAM-ETRE-" + suffix; });
  assert.equal(item.prompt, prompt);
  assert.deepEqual(item.accepted_answers, [answer]);
}

// Exercise the real family question materializer and number recognition generator.
function body(start, end) {
  const from = source.indexOf(start), until = source.indexOf(end, from + 1);
  assert.ok(from >= 0 && until > from, start);
  return source.slice(from, until);
}
const helper = body("function trajet2FamilyQuestions(", "\nfunction concreteConjugations(");
const makeQuestion = function (base, prompt, answers, instruction) {
  return Object.assign({}, base, { prompt, answers, instruction });
};
const functions = new Function("makeQuestion", "mergeEquivalentQuestions", "isDynamicNumberItem",
  "buildDynamicNumberQuestions", "window", "state", helper +
  "\nreturn { buildQuestions, trajet2FamilyQuestions };")(
  makeQuestion, function (values) { return values; }, function () { return false; },
  function () { return []; }, { MonParcoursExerciseVariants: engine }, { variantBank: bank, data: course });

const familyIds = Array.from({length:9},function (_,index) { return id(221 + index); });
for (const familyId of familyIds) {
  const sourceItem = items.find(function (item) { return item.id === familyId; });
  const generated = functions.buildQuestions([Object.assign({}, sourceItem, {
    _trajectoryIndex: 1, _id: sourceItem.id
  })], "phrase-nl-fr");
  assert.equal(generated.length, 2, familyId);
  generated.forEach(function (question) {
    assert.doesNotMatch(question.prompt + question.answers.join(","), /…|\[[^\]]+\]/);
    assert.equal(question.item.id, familyId);
    assert.match(question.prompt, /is|zijn/);
  });
}
const numberItems = items.filter(function (item) { return item.type === "number"; }).map(function (item) {
  return Object.assign({}, item, { _trajectoryIndex: 1, _id: item.id });
});
const recognition = functions.buildQuestions(numberItems, "number-recognition");
assert.equal(recognition.length, 21);
recognition.forEach(function (question) {
  assert.equal(question.choices.length, 4);
  assert.equal(new Set(question.choices).size, 4);
  assert.ok(question.choices.includes(question.answers[0]));
  assert.ok(question.choices.every(function (digit) { return Number.isInteger(+digit) && +digit >= 0 && +digit <= 20; }));
  assert.equal(question.instruction, "Kies het juiste cijfer");
});
assert.ok(recognition.some(function (question) { return question.choices[0] !== question.answers[0]; }),
  "The correct digit must not always be option one");

const numberChoiceSnippet = body("function isExerciseItem(", "\nfunction currentTrajectory(");
const isExerciseItem = new Function("TYPE_EXERCISES", numberChoiceSnippet + "\nreturn isExerciseItem;")({
  vocabulary:[],phrase:[],verb:[],number:[],grammar_rule:[]
});
const soundItem = items.find(function (item) { return item.id === id(281); });
assert.equal(isExerciseItem(Object.assign({}, soundItem, { _trajectoryIndex:1 })), true);
assert.equal(isExerciseItem(Object.assign({}, soundItem, { _trajectoryIndex:0 })), false);
assert.ok(engine.eligibleVariants(bank,course,{
  trajectory:"Trajet 2",top_category:"Comment dire ?",lesson:"Le son [e] (télé)"
}).filter(function (row) { return row.kind === "spelling"; }).length >= 15);
const soundOptions = policy.options(items.filter(function (item) { return item.type === "sound_rule"; }),
  bank,course,{trajectory:"Trajet 2",top_category:"Comment dire ?",lesson:"Le son [e] (télé)"});
assert.ok(soundOptions.some(function (row) { return row.key === "spelling" && row.variantCount >= 15; }),
  "Teacher must be able to assign the written sound exercises");

assert.match(home,/app\.js\?v=20261030-t2-1/);
assert.match(home,/exercise-policy\.js\?v=20261030-t2-1/);
assert.match(teacherHtml,/teacher\.js\?v=20261030-t2-1/);
assert.match(teacherHtml,/exercise-policy\.js\?v=20261030-t2-1/);
assert.match(source,/const DATA_URL = ".+20261030-t2-1"/);
assert.match(source,/const VARIANT_DATA_URL = ".+20261030-t2-1"/);
assert.match(teacher,/exercise-variants\.json\?v=20261030-t2-1/);
assert.match(source,/number-goal-note/);
console.log("TRAJET 2 CONTENT + TASK OPTIONS OK: 148 goals, 37 new variants, 18 family examples, 21 recognition questions.");
