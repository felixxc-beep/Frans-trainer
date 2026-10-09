const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const rounds = require("../task-rounds.js");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");
const verbMastery = require("../verb-mastery.js");
const storage = new Map();
const sent = [];
let serial = 0;
const app = { innerHTML: "", focus() {} };
const input = { value: "", disabled: false, focus() {} };
const feedback = { innerHTML: "", className: "", querySelector() { return { focus() {} }; } };
const document = {
  visibilityState: "visible", addEventListener() {}, body: { appendChild() {} },
  createElement() { return { innerHTML: "", className: "", setAttribute() {}, showModal() {}, close() {}, addEventListener() {}, remove() {} }; },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#strict-accents") return { checked: true, disabled: false };
    if (selector === "#answer-input") return input;
    if (selector === ".submit-button") return { hidden: false };
    if (selector === "#feedback") return feedback;
    if (selector === "#settings-dialog") return { showModal() {}, close() {} };
    return null;
  }
};
const context = vm.createContext({ console, document, setTimeout, clearTimeout, structuredClone,
  localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
  fetch: async () => ({ ok: true, json: async () => structuredClone(course) }),
  window: { MonParcoursTaskRounds: rounds, MonParcoursMastery: mastery, MonParcoursAssignments: assignments,
    MonParcoursVerbMastery: verbMastery, addEventListener() {}, scrollTo() {},
    StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "student-1", verified: true }; },
      getSyncCredential() { return "token"; } },
    MonParcoursSync: { createId() { return "00000000-0000-4000-8000-" + String(++serial).padStart(12, "0"); },
      scheduleFlush() {}, enqueueSession(value) { sent.push(value); } } }
});
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);
function run(expression) { return vm.runInContext(expression, context); }
setImmediate(() => {
  const ids = run('state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "vocabulary").slice(0, 3).map(i => i.id)');
  context.taskIds = ids;
  run('state.assignments.items = [{ id: "00000000-0000-4000-8000-000000000099", title: "Rondetaak", status: "published",' +
    ' item_ids: taskIds, required_rounds: 3, completion_strategy: "rounds", mastery_strategy: "item_mastery" }]');
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.questions.length'), 3);
  assert.equal(run('state.session.assignment_round_number'), 1);
  const answer = run('state.session.questions[0].answers[0]');
  run('submitAnswer("niet juist")');
  assert.equal(run('state.session.questions.length'), 4, "fout item komt terug");
  assert.ok(feedback.innerHTML.includes("consult-round"), "Consulter in ronde 1");
  assert.ok(!feedback.innerHTML.includes(answer), "geen modelantwoord in foutfeedback");
  run('consultRoundCourse()');
  assert.equal(run('roundsForAssignment(state.assignments.items[0])[0].items[taskIds[0]].consulted'), true);
  run('nextQuestion()');
  for (let guard = 0; guard < 8 && run('state.view') === "practice"; guard++) {
    run('submitAnswer(state.session.questions[state.session.index].answers[0])');
    run('nextQuestion()');
  }
  assert.equal(run('state.view'), "summary");
  assert.equal(run('assignmentProgress(state.assignments.items[0]).rounds.round'), 2);
  assert.equal(run('assignmentProgress(state.assignments.items[0]).rounds.completed'), false);
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.assignment_round_number'), 2);
  run('submitAnswer("niet juist")');
  assert.ok(!feedback.innerHTML.includes("consult-round"), "ronde 2 heeft geen Consulter");
  assert.ok(!feedback.innerHTML.includes(run('state.session.questions[0].answers[0]')), "ronde 2 toont geen modelantwoord");
  run('nextQuestion()');
  for (let guard = 0; guard < 8 && run('state.view') === "practice"; guard++) {
    run('submitAnswer(state.session.questions[state.session.index].answers[0])');
    run('nextQuestion()');
  }
  assert.equal(run('state.view'), "summary");
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.assignment_round_number'), 3);
  assert.equal(run('state.session.assignment_round_selected_item_ids.length'), 1, "bij 3 items is 33% minimaal één reviewitem");
  assert.equal(run('state.session.assignment_round_selected_item_ids[0]'), ids[0], "fout uit ronde 2 is verplicht in de review");
  const reviewSelection = run('state.session.assignment_round_selected_item_ids.slice()');
  run('state.session = null; restoreActiveSession()');
  assert.deepEqual(Array.from(run('state.session.assignment_round_selected_item_ids')), Array.from(reviewSelection),
    "refresh herneemt exact dezelfde reviewset en sessie-ID");
  assert.ok(!feedback.innerHTML.includes("consult-round"));
  run('submitAnswer(state.session.questions[state.session.index].answers[0])');
  run('nextQuestion()');
  assert.equal(run('assignmentProgress(state.assignments.items[0]).rounds.completed'), true,
    "taak rondt lokaal pas na de laatste reviewset af");
  assert.ok(sent.some(entry => entry.session.assignment_round_number === 1 && entry.session.assignment_round_selected_item_ids.length === 3),
    "ronde en vaste set gaan via de bestaande idempotente queue");
  const stored = JSON.parse(storage.get("monParcoursTaskRoundsV1"));
  assert.ok(stored["student-1:00000000-0000-4000-8000-000000000099"].rounds.length >= 2);
  console.log("RONDES-APPREGRESSIE GESLAAGD");
});
