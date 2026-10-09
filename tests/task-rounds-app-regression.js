const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const css = fs.readFileSync("styles.css", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const rounds = require("../task-rounds.js");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");
const verbMastery = require("../verb-mastery.js");
const storage = new Map();
const sent = [];
const reported = [];
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
      scheduleFlush() {}, enqueueSession(value) { sent.push(value); },
      enqueueIssueReport(value) { reported.push(value); return true; } } }
});
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);
function run(expression) { return vm.runInContext(expression, context); }
setImmediate(() => {
  const ids = run('state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "vocabulary").slice(0, 3).map(i => i.id)');
  context.taskIds = ids;
  run('state.assignments.items = [{ id: "00000000-0000-4000-8000-000000000099", title: "Rondetaak", status: "published",' +
    ' item_ids: taskIds, required_rounds: 3, completion_strategy: "rounds", mastery_strategy: "item_mastery" }]');
  run('renderHome()');
  assert.match(app.innerHTML, /class="assignment-home-row"[^>]*data-action="launch-assignment"/);
  assert.match(app.innerHTML, /Devoir[\s\S]*Taak[\s\S]*Rondetaak/);
  assert.match(app.innerHTML, /Passage 1 sur 3[\s\S]*0 \/ 3[\s\S]*Encore 3[\s\S]*Continuer →/);
  assert.match(app.innerHTML, /round-step is-current[\s\S]*●[\s\S]*round-step is-future[\s\S]*○/);
  assert.doesNotMatch(app.innerHTML, /\d+% maîtrise|objectifs acquis|objectif \d+%/);
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.questions.length'), 3);
  assert.equal(run('state.session.assignment_round_number'), 1);
  assert.match(app.innerHTML, /class="task-round-score"><b>0 \/ 3<\/b>/);
  assert.match(app.innerHTML, /role="progressbar"[^>]*aria-valuenow="0"/);
  assert.equal((app.innerHTML.match(/role="progressbar"/g) || []).length, 1,
    "de taak toont precies één voortgangsbalk voor de huidige ronde");
  assert.doesNotMatch(app.innerHTML, /class="practice-progress"/);
  assert.match(app.innerHTML, /Consulter disponible[\s\S]*Opzoeken mogelijk/);
  const answer = run('state.session.questions[0].answers[0]');
  run('submitAnswer("niet juist")');
  assert.equal(run('state.session.questions.length'), 4, "fout item komt terug");
  assert.ok(feedback.innerHTML.includes("consult-round"), "Consulter in ronde 1");
  assert.match(feedback.innerHTML, /consult-action[\s\S]*Consulter[\s\S]*Opzoeken/);
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
  assert.match(app.innerHTML, /Passage 2 sur 3[\s\S]*0 \/ 3/,
    "na ronde 1 toont het eindscherm onmiddellijk de volgende ronde, niet alleen 3/3");
  run('renderHome()');
  assert.match(app.innerHTML, /round-step is-complete[\s\S]*✓[\s\S]*round-step is-current[\s\S]*●/);
  assert.match(app.innerHTML, /Passage 2 sur 3[\s\S]*0 \/ 3/);
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.assignment_round_number'), 2);
  assert.match(app.innerHTML, /Sans aide[\s\S]*Zonder hulp/);
  run('submitAnswer("niet juist")');
  assert.ok(!feedback.innerHTML.includes("consult-round"), "ronde 2 heeft geen Consulter");
  assert.ok(!feedback.innerHTML.includes(run('state.session.questions[0].answers[0]')), "ronde 2 toont geen modelantwoord");
  run('nextQuestion()');
  for (let guard = 0; guard < 8 && run('state.view') === "practice"; guard++) {
    run('submitAnswer(state.session.questions[state.session.index].answers[0])');
    run('nextQuestion()');
  }
  assert.equal(run('state.view'), "summary");
  assert.match(app.innerHTML, /Passage 3 sur 3[\s\S]*0 \/ 1/,
    "na ronde 2 toont het eindscherm de kleinere adaptieve reviewronde");
  run('launchAssignment("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.session.assignment_round_number'), 3);
  assert.equal(run('state.session.assignment_round_selected_item_ids.length'), 1, "bij 3 items is 33% minimaal één reviewitem");
  assert.match(app.innerHTML, /Passage 3 sur 3[\s\S]*0 \/ 1[\s\S]*Encore 1/,
    "adaptieve ronde toont de werkelijke kleinere selectie");
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
  run('renderHome()');
  assert.match(app.innerHTML, /assignment-home-row is-complete[^>]*data-action="show-assignment-detail"/);
  assert.equal((app.innerHTML.match(/round-step is-complete/g) || []).length, 3);
  assert.match(app.innerHTML, /Devoir terminé[\s\S]*Taak klaar/);
  const completedCard = app.innerHTML.match(/<button class="assignment-home-row is-complete"[\s\S]*?<\/button>/)[0];
  assert.doesNotMatch(completedCard, /Continuer|Verdergaan/);
  assert.match(completedCard, /Voir →[\s\S]*Bekijken →/);
  run('renderAssignments()');
  assert.match(app.innerHTML, /data-action="show-assignment-detail"/,
    "afgeronde taak opent het detail in plaats van een nieuwe oefensessie");
  run('renderAssignmentDetail("00000000-0000-4000-8000-000000000099")');
  assert.equal(run('state.view'), 'assignment-detail');
  assert.match(app.innerHTML, /Devoir terminé[\s\S]*Taak klaar/);
  assert.doesNotMatch(app.innerHTML, /data-action="launch-assignment"/);
  const fourRoundStatus = run('roundStatusHtml({ required: 4, round: 3, selected: 8, done: 5, remaining: 3, completed: false }, false, true)');
  assert.equal((fourRoundStatus.match(/round-step is-complete/g) || []).length, 2);
  assert.equal((fourRoundStatus.match(/round-step is-current/g) || []).length, 1);
  assert.equal((fourRoundStatus.match(/round-step is-future/g) || []).length, 1);
  assert.match(fourRoundStatus, /Passage 3 sur 4[\s\S]*5 \/ 8[\s\S]*Encore 3/);
  assert.match(css, /\.round-tracker \{[^}]*flex-wrap: nowrap/,
    "tracker blijft ook mobiel op één regel");
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.round-step \{[^}]*min-width: 35px/,
    "mobiele stappen zijn compact maar leesbaar");
  assert.ok(sent.some(entry => entry.session.assignment_round_number === 1 && entry.session.assignment_round_selected_item_ids.length === 3),
    "ronde en vaste set gaan via de bestaande idempotente queue");
  const stored = JSON.parse(storage.get("monParcoursTaskRoundsV1"));
  assert.ok(stored["student-1:00000000-0000-4000-8000-000000000099"].rounds.length >= 2);
  const hobby = run('state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025")');
  assert.equal(hobby.nl, "de hobby");
  assert.equal(hobby.fr, "le hobby");
  assert.equal(run('buildQuestions([state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025")], "vocab-nl-fr")[0].prompt'), "de hobby");
  assert.deepEqual(Array.from(run('buildQuestions([state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025")], "vocab-nl-fr")[0].answers')), ["le hobby"]);
  assert.equal(run('buildQuestions([state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025")], "vocab-fr-nl")[0].prompt'), "le hobby");
  assert.deepEqual(Array.from(run('buildQuestions([state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025")], "vocab-fr-nl")[0].answers')), ["de hobby"]);
  assert.equal(run('state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "vocabulary").every(i => buildQuestions([i], "vocab-nl-fr")[0].answers.length && buildQuestions([i], "vocab-fr-nl")[0].answers.length)'), true);
  assert.match(fs.readFileSync("app.js", "utf8"), /function consultRoundCourse\([\s\S]*?const dutch = item\.type === "vocabulary" \? dutchAnswers\(item\.nl, item\)[\s\S]*?const french = item\.type === "vocabulary" \|\| item\.type === "phrase" \? answerList\(item\.fr, item\)/);
  assert.equal(run('isCorrect("la hobby", ["le hobby"])'), false);
  assert.equal(run('isCorrect("le hobby", ["le hobby"])'), true);
  assert.match(run('nearCorrectHint("la hobby", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["le hobby"] }).nl'), /lidwoord/);
  assert.match(run('nearCorrectHint("hobby", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["le hobby"] }).nl'), /lidwoord/);
  assert.match(run('nearCorrectHint("le hobbi", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["le hobby"] }).nl'), /spelling/);
  assert.match(run('nearCorrectHint("ecole", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["école"] }).nl'), /accenten/);
  assert.equal(run('isCorrect("ecole", ["école"])'), false, "accent blijft verplicht");
  assert.equal(run('nearCorrectHint("banane", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["le hobby"] })'), null,
    "sterk afwijkend antwoord krijgt geen misleidende hint");
  assert.equal(run('nearCorrectHint("le hobby", { item: state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000025"), exerciseKey: "vocab-nl-fr", answers: ["le hobby"] })'), null);
  const reportTaskId = "00000000-0000-4000-8000-000000000098";
  run('state.assignments.items.push({ id: "' + reportTaskId + '", title: "Meldingstaak", status: "published", item_ids: [taskIds[0]], required_rounds: 1, completion_strategy: "rounds", mastery_strategy: "item_mastery" })');
  run('launchAssignment("' + reportTaskId + '")');
  run('submitAnswer("eerste fout")');
  assert.doesNotMatch(feedback.innerHTML, /report-round-item/, "melden verschijnt pas na twee fouten");
  run('nextQuestion()');
  run('submitAnswer("tweede fout")');
  assert.match(feedback.innerHTML, /report-round-item/, "na twee fouten is melden beschikbaar");
  run('reportRoundItem()');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].report.submitted_answers.length, 2);
  assert.equal(reported[0].report.item_id, ids[0]);
  assert.equal(reported[0].report.app_version, "20261009-4");
  run('nextQuestion()');
  assert.equal(run('assignmentProgress(state.assignments.items[1]).status'), "pending_review");
  run('renderHome()');
  assert.match(app.innerHTML, /Terminé pour toi[\s\S]*Voor jou afgewerkt/);
  assert.match(app.innerHTML, /En attente du professeur[\s\S]*Wacht op controle/);
  run('state.assignments.items[1].rounds = structuredClone(roundsForAssignment(state.assignments.items[1]))');
  run('state.assignments.items[1].reports = [{ round_number: 1, item_id: taskIds[0], status: "rejected" }]');
  run('mergeAssignmentRounds(state.assignments.items[1])');
  assert.equal(run('assignmentProgress(state.assignments.items[1]).status'), "in_progress");
  assert.equal(run('roundsForAssignment(state.assignments.items[1])[0].items[taskIds[0]].returned_for_retry'), true);
  console.log("RONDES-APPREGRESSIE GESLAAGD");
});
