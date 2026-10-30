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

// A report should require a reason, but must keep valid complaints possible.
const reportStart = app.indexOf("function reportRoundItem()");
const reportEnd = app.indexOf("\nfunction reportExerciseDirection(", reportStart);
assert.ok(reportStart >= 0 && reportEnd > reportStart);
const fields = {
  "#report-reason": { value: "", focus() {} },
  "#report-explanation": { value: "", focus() {} },
  "#report-validation": { textContent: "" },
  "#feedback": { className: "", innerHTML: "", querySelector() { return { focus() {} }; } }
};
const reportItem = { wrong_count: 2, reported_pending: false, completed_at: null, attempt_history: [
  { answer: "jouer au football", was_correct: false },
  { answer: "jouer au football", was_correct: false }
] };
const reportQuestion = { prompt: "voetballen", answers: ["jouer au foot"],
  item: find(169), exerciseKey: "vocab-nl-fr" };
const reports = [];
const reportHandler = new Function("state", "currentRoundItemState", "window", "document",
  "createClientId", "reportExerciseDirection", "formatAnswers", "saveAssignmentRounds", "uiText",
  'const APP_VERSION = "regression";\n' + app.slice(reportStart, reportEnd) + "\nreturn reportRoundItem;")(
  { session: { index: 0, questions: [reportQuestion], assignment_round_number: 1,
    assignment_id: "assignment", identity_subject: "student" } },
  () => ({ item: reportItem, itemId: find(169).id, assignment: {}, rounds: [] }),
  { MonParcoursSync: { enqueueIssueReport(value) { reports.push(value); return true; } } },
  { querySelector(selector) { return fields[selector] || null; } },
  () => "00000000-0000-4000-8000-000000000001",
  () => "vocab-nl-fr", () => "jouer au foot", () => {}, (_, nl) => nl
);
reportHandler();
assert.equal(reports.length, 0);
fields["#report-reason"].value = "correct_alternative";
fields["#report-explanation"].value = "fout";
reportHandler();
assert.equal(reports.length, 0);
fields["#report-explanation"].value = "Het boek aanvaardt ook jouer au football.";
reportHandler();
assert.equal(reports.length, 1);
assert.equal(reports[0].report.attempt_details[0].report_reason, "correct_alternative");
assert.match(reports[0].report.attempt_details[0].report_explanation, /football/);
reportHandler();
assert.equal(reports.length, 1);

console.log("TRAJET 2 REPORT CORRECTIONS OK: valid spellings, strict wrong answers, feedback, unchanged IDs.");
