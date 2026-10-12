const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const css = fs.readFileSync("styles.css", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const rounds = require("../task-rounds.js");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");
const verbMastery = require("../verb-mastery.js");
const variantEngine = require("../exercise-variants.js");
const variantBank = JSON.parse(fs.readFileSync("data/exercise-variants.json", "utf8"));
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
  fetch: async (url) => ({ ok: true, json: async () =>
    structuredClone(url.includes("exercise-variants") ? variantBank : course) }),
  window: { MonParcoursTaskRounds: rounds, MonParcoursMastery: mastery, MonParcoursAssignments: assignments,
    MonParcoursVerbMastery: verbMastery, MonParcoursExerciseVariants: variantEngine,
    addEventListener() {}, scrollTo() {},
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
  assert.match(app.innerHTML, /class="assignment-home-row is-todo"[^>]*data-action="launch-assignment"/);
  assert.match(app.innerHTML, /Devoir[\s\S]*Taak[\s\S]*Rondetaak/);
  assert.match(app.innerHTML, /À faire[\s\S]*Niet gestart[\s\S]*Passage 1 sur 3[\s\S]*0 \/ 3[\s\S]*Encore 3[\s\S]*Commencer →/);
  assert.equal((app.innerHTML.match(/round-step is-future/g) || []).length, 3);
  assert.doesNotMatch(app.innerHTML, /round-step is-current/);
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
  assert.match(app.innerHTML, /assignment-home-row is-in-progress/);
  assert.match(app.innerHTML, /En cours[\s\S]*Bezig — niet klaar/);
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
  const salle = run('buildQuestions([state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000077")], "vocab-nl-fr")[0]');
  assert.deepEqual(Array.from(salle.answers), ["la salle", "la salle de danse", "la salle de sport"]);
  for (const answer of salle.answers) assert.equal(run('isCorrect(' + JSON.stringify(answer) + ', ' + JSON.stringify(salle.answers) + ')'), true,
    "uf1-item-000077 accepts each exact course variant");
  assert.equal(run('isCorrect("la salle de sport\u200b", ' + JSON.stringify(salle.answers) + ')'), true,
    "invisible copy/paste marks cannot falsely reject an otherwise exact answer");
  assert.equal(run('isCorrect("\u200ela salle de sport", ' + JSON.stringify(salle.answers) + ')'), true);
  assert.equal(run('isCorrect("le salle de sport", ' + JSON.stringify(salle.answers) + ')'), false);
  const trainer = run('state.data.trajectories.flatMap(t => t.items).find(i => i.id === "uf1-item-000122")');
  context.trainer = trainer;
  assert.deepEqual(Array.from(run('buildQuestions([trainer], "verb-nl-inf")[0].answers')), ["trainer", "traîner"]);
  assert.equal(run('buildQuestions([trainer], "verb-nl-conj").some(q => q.answers.includes("tu traînes"))'), true);
  const reportTaskId = "00000000-0000-4000-8000-000000000098";
  run('state.assignments.items.push({ id: "' + reportTaskId + '", title: "Meldingstaak", status: "published", item_ids: [taskIds[0]], required_rounds: 1, completion_strategy: "rounds", mastery_strategy: "item_mastery" })');
  run('launchAssignment("' + reportTaskId + '")');
  run('submitAnswer("eerste fout")');
  assert.doesNotMatch(feedback.innerHTML, /report-round-item/, "melden verschijnt pas na twee fouten");
  run('nextQuestion()');
  run('submitAnswer("tweede fout")');
  assert.match(feedback.innerHTML, /report-round-item/, "na twee fouten is melden beschikbaar");
  run('nextQuestion()');
  run('submitAnswer("derde fout")');
  const reportSession = run('state.session.client_session_id');
  run('state.session = null; restoreActiveSession()');
  assert.equal(run('state.session.client_session_id'), reportSession, "refresh houdt dezelfde sessie-ID");
  assert.equal(run('roundsForAssignment(state.assignments.items[1])[0].items[taskIds[0]].attempt_history.length'), 3,
    "alle getypte pogingen overleven een refresh");
  run('submitAnswer("vierde fout")');
  run('reportRoundItem()');
  assert.equal(reported.length, 1);
  assert.deepEqual(Array.from(reported[0].report.submitted_answers),
    ["eerste fout", "tweede fout", "derde fout", "vierde fout"]);
  assert.equal(reported[0].report.item_id, ids[0]);
  assert.equal(reported[0].report.app_version, vm.runInContext("APP_VERSION", context));
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
  run(`{
    const ids42 = state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "vocabulary").slice(0, 42).map(i => i.id);
    const task = { id: "00000000-0000-4000-8000-000000000097", title: "Bestaande taak",
      item_ids: ids42, required_rounds: 3, completion_strategy: "rounds", mastery_strategy: "item_mastery" };
    state.assignments.items.push(task);
    const round = window.MonParcoursTaskRounds.createRound(task, []);
    ids42.slice(0, 9).forEach(id => window.MonParcoursTaskRounds.markAttempt(round, id, true, "2026-10-01T12:00:00Z"));
    saveAssignmentRounds(task, [round]);
    task.rounds = structuredClone(roundsForAssignment(task));
    mergeAssignmentRounds(task);
    if (assignmentProgress(task).rounds.done !== 9 || assignmentProgress(task).rounds.selected !== 42)
      throw new Error("9/42 changed during merge");
    ids42.slice(9, 35).forEach(id => window.MonParcoursTaskRounds.markAttempt(round, id, true, "2026-10-02T12:00:00Z"));
    saveAssignmentRounds(task, [round]);
    task.rounds = structuredClone(roundsForAssignment(task));
    mergeAssignmentRounds(task);
    if (assignmentProgress(task).rounds.done !== 35 || assignmentProgress(task).rounds.selected !== 42)
      throw new Error("35/42 changed during merge");
  }`);
  const previousTask = run('state.assignments.items.find(a => a.id === "00000000-0000-4000-8000-000000000097")');
  assert.equal(run('assignmentProgress(state.assignments.items.find(a => a.id === "00000000-0000-4000-8000-000000000097")).rounds.done'), 35);
  assert.equal(previousTask.item_ids.length, 42, "permanente itemselectie blijft exact bestaan");
  const sentence = variantBank.variants.find(function (variant) {
    return variant.kind === "revision" && variant.scoring === "integrative" &&
      variant.targets.length === 1;
  });
  assert.ok(sentence, "source-backed full sentence exists");
  context.sentenceId = sentence.id;
  context.sentenceItemId = sentence.targets[0];
  run(`{
    state.variantBank = structuredClone(${JSON.stringify(variantBank)});
    const extras = state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "vocabulary" && i.id !== sentenceItemId).slice(0, 2);
    state.assignments.items.push({ id: "00000000-0000-4000-8000-000000000096", title: "Zinnentaak",
      item_ids: [sentenceItemId, ...extras.map(i => i.id)], required_rounds: 2,
      include_integrative_sentences: true, completion_strategy: "rounds", mastery_strategy: "item_mastery" });
  }`);
  run('launchAssignment("00000000-0000-4000-8000-000000000096")');
  assert.equal(run('state.session.questions[0].variantId'), sentence.id,
    "opt-in rondetaak gebruikt de brongebonden volledige zin");
  assert.equal(run('state.session.questions[0].exerciseKey'), "full-sentence-nl-fr");
  const masteryBeforeSentence = run('state.mastery.localAttempts.length');
  run('submitAnswer("geen juiste volledige zin")');
  assert.equal(run('state.mastery.localAttempts.length'), masteryBeforeSentence,
    "foute volledige zin geeft geen blanket negative mastery");
  assert.equal(run('state.session.question_submissions[0].item_id'), sentence.targets[0]);
  assert.doesNotMatch(feedback.innerHTML, new RegExp(sentence.accepted_answers[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  run('nextQuestion()');
  assert.notEqual(run('state.session.questions[state.session.index].variantId'), sentence.id,
    "foute zin komt niet meteen opnieuw");
  run('state.session.index = state.session.questions.findIndex((q, i) => i > 0 && q.variantId === sentenceId)');
  run('submitAnswer(state.session.questions[state.session.index].answers[0])');
  assert.equal(run('state.session.sync_attempts.some(a => a.was_correct && a.legacy_item_id === sentenceId)'), true,
    "volledig juiste zin geeft positieve evidence aan het gekoppelde doel");
  run(`{
    state.assignments.items.push({ id: "00000000-0000-4000-8000-000000000095", title: "Twee leerdoelen",
      item_ids: ["uf1-item-000076", "uf1-item-000068", taskIds[0]], required_rounds: 1,
      include_integrative_sentences: true, completion_strategy: "rounds", mastery_strategy: "item_mastery" });
  }`);
  run('launchAssignment("00000000-0000-4000-8000-000000000095")');
  assert.equal(run('state.session.questions[0].variantId'), "T1-REV-005");
  run('submitAnswer(state.session.questions[0].answers[0])');
  assert.equal(run('window.MonParcoursTaskRounds.progress(state.assignments.items.at(-1), roundsForAssignment(state.assignments.items.at(-1))).done'), 2,
    "één volledig juiste bronzin voltooit beide expliciet gekoppelde ronde-items");
  assert.deepEqual(Array.from(run('state.session.sync_attempts[0].equivalent_item_ids')),
    ["uf1-item-000076", "uf1-item-000068"], "positieve evidence bereikt beide doelen");
  run(`{
    const task = { id: "00000000-0000-4000-8000-000000000094", title: "Teruggestuurde vroege ronde",
      completed_at: "2026-10-08T12:00:00Z", item_ids: [taskIds[0]], required_rounds: 3,
      completion_strategy: "rounds", mastery_strategy: "item_mastery" };
    const first = window.MonParcoursTaskRounds.createRound(task, []);
    window.MonParcoursTaskRounds.markAttempt(first, taskIds[0], true, "2026-10-08T10:00:00Z");
    const second = window.MonParcoursTaskRounds.createRound(task, [first]);
    window.MonParcoursTaskRounds.markAttempt(second, taskIds[0], true, "2026-10-08T11:00:00Z");
    const third = window.MonParcoursTaskRounds.createRound(task, [first, second]);
    saveAssignmentRounds(task, [first, second, third]);
    task.rounds = structuredClone(roundsForAssignment(task));
    task.reports = [{ round_number: 1, item_id: taskIds[0], status: "rejected",
      resolved_at: "2026-10-09T12:00:00Z" }];
    state.assignments.items.push(task);
    mergeAssignmentRounds(task);
  }`);
  assert.equal(run('assignmentProgress(state.assignments.items.at(-1)).rounds.round'), 1,
    "terugsturen heropent een oudere ronde, zelfs nadat de leerling ronde 3 bereikte");
  assert.equal(run('assignmentProgress(state.assignments.items.at(-1)).status'), "in_progress",
    "verouderde completed_at mag een teruggestuurde taak niet als klaar tonen");
  assert.equal(run('roundsForAssignment(state.assignments.items.at(-1)).length'), 3,
    "latere rondes worden niet verwijderd of opnieuw gegenereerd");
  run(`{
    const makeTask = (id, title, due_at) => ({ id, title, due_at, status: "published", item_ids: [taskIds[0]],
      required_rounds: 1, completion_strategy: "rounds", mastery_strategy: "item_mastery" });
    const done = makeTask("00000000-0000-4000-8000-000000000090", "Groene taak", "2000-01-01T00:00:00Z");
    const todo = makeTask("00000000-0000-4000-8000-000000000091", "Roze taak", null);
    const active = makeTask("00000000-0000-4000-8000-000000000092", "Amber taak", null);
    const late = makeTask("00000000-0000-4000-8000-000000000093", "Rode taak", "2000-01-01T00:00:00Z");
    const activeRound = window.MonParcoursTaskRounds.createRound(active, []);
    saveAssignmentRounds(active, [activeRound]);
    const doneRound = window.MonParcoursTaskRounds.createRound(done, []);
    window.MonParcoursTaskRounds.markAttempt(doneRound, taskIds[0], true, new Date().toISOString());
    saveAssignmentRounds(done, [doneRound]);
    state.assignments.items = [done, todo, active, late];
  }`);
  run('renderAssignments()');
  const cards = app.innerHTML;
  assert.match(cards, /assignment-card is-late[\s\S]*En retard[\s\S]*Te laat — niet klaar/);
  assert.match(cards, /assignment-card is-in-progress[\s\S]*En cours[\s\S]*Bezig — niet klaar/);
  assert.match(cards, /assignment-card is-todo[\s\S]*À faire[\s\S]*Niet gestart/);
  assert.match(cards, /assignment-card is-complete[\s\S]*✓ Terminé[\s\S]*Klaar/);
  assert.ok(cards.indexOf("Rode taak") < cards.indexOf("Amber taak") &&
    cards.indexOf("Amber taak") < cards.indexOf("Roze taak") &&
    cards.indexOf("Roze taak") < cards.indexOf("Groene taak"), "taakvolgorde: te laat, bezig, niet gestart, klaar");
  assert.match(cards, /Commencer →[\s\S]*Starten →/);
  assert.match(cards, /Voir →[\s\S]*Bekijken →/);
  run('renderHome()');
  assert.match(app.innerHTML, /assignment-home-row is-late[\s\S]*Rode taak[\s\S]*assignment-home-row is-in-progress[\s\S]*Amber taak/);
  assert.doesNotMatch(app.innerHTML, /Roze taak|Groene taak/, "homepage toont eerst de twee dringendste taken");
  for (const status of ["todo", "in-progress", "late", "complete"]) {
    assert.match(css, new RegExp('\\.assignment-home-row\\.is-' + status + '[^}]*background:'), status + " kleurt de volledige homepagekaart");
    assert.match(css, new RegExp('\\.assignment-card\\.is-' + status + '[^}]*background:'), status + " kleurt de volledige kaart in de takenlijst");
  }
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.assignment-home-row \{ grid-template-columns: 32px minmax\(0, 1fr\)/,
    "mobiele taakkaart behoudt compacte twee-kolomsindeling");
  {
  context.salleRegression = run('allCourseItems().find(i => i.id === "uf1-item-000077")');
  for (const answer of ["la salle", "la salle de danse", "la salle de sport", " La salle. ", "la\u00a0salle", "la\u200bsalle".replace("\u200b", "\u200b ")]) {
    context.salleAnswer = answer;
    assert.equal(run('isCorrect(salleAnswer, answerList(salleRegression.fr,salleRegression))'), true, JSON.stringify(answer));
  }
  for (const answer of ["le salle de sport", "amical"]) {
    context.salleAnswer = answer;
    assert.equal(run('isCorrect(salleAnswer, answerList(salleRegression.fr,salleRegression))'), false);
  }
  assert.equal(run('isCorrect("école", ["école"])'), true);
  assert.equal(run('isCorrect("ecole", ["école"])'), false);
  for (const [id,external] of [["uf1-item-000093","amical"],["uf1-item-000094","intelligent"],["uf1-item-000072","le passe-temps"],
    ["uf1-item-000670","Non, pas du tout."],["uf1-item-000830","Oh, oui."]]) {
    context.directId=id;context.externalAnswer=external;
    assert.equal(run('(()=>{const item=allCourseItems().find(i=>i.id===directId); return isCorrect(externalAnswer,answerList(item.fr,item));})()'),false);
  }
  const reaction = variantBank.variants.find(v=>v.id==="T4-ACT-MOVE-018");
  assert.equal(variantEngine.grade(variantEngine.compileVariant(reaction,course),"Top !").correct,true);
  const trainer = run('allCourseItems().find(i => i.id === "uf1-item-000090")');
  context.trainer = trainer;
  assert.equal(run('isCorrect("traîner",answerList(trainer.fr,trainer))'), true);
  run('state.trajectoryIndex=0;state.selectedUnitOrder=state.data.trajectories[0].units.find(u=>u.top_category==="Atelier Parole").order;state.selectedScope={}');
  assert.equal(run('curatedVariantsForScope("curated-context").some(v=>v.id==="T1-VOC-CTX-032")'),false,
    "the master excludes intelligent from the mixed scope where malin is active");
  assert.equal(run('curatedVariantsForScope("curated-context",{subsection:"On se rappelle ?"}).some(v=>v.id==="T1-VOC-CTX-032")'),true);
  run('state.trajectoryIndex=0; state.selectedUnitOrder=state.data.trajectories[0].units.find(u=>u.top_category==="Atelier Grammaire").order; state.selectedScope={category:"articles indéfinis"}');
  const articleVariants = run('curatedVariantsForScope("curated-grammar")');
  assert.ok(articleVariants.length > 0);
  assert.equal(articleVariants.some(v => /cuisiner/.test(v.prompt) || v.scope_kind === "mixed"), false);
  const narrow = new Set(course.trajectories[0].items.filter(i => i.category === "articles indéfinis").map(i => i.id));
  for (const variant of articleVariants) assert.ok(variantEngine.targetsForVariant(variant).every(id => narrow.has(id)));
  run('state.trajectoryIndex=5;state.selectedScope={};state.selectedUnitOrder=state.data.trajectories[5].units.find(u=>u.top_category==="Atelier Verbes").order');
  assert.equal(run('curatedVariantsForScope("curated-grammar").some(v=>v.id==="T6-AUX-MIX-001")'),true,
    "foreign T5 auxiliary targets stay in T6 Verbes");
  run('state.selectedUnitOrder=state.data.trajectories[5].units.find(u=>u.top_category==="Atelier Grammaire").order');
  assert.equal(run('curatedVariantsForScope("curated-grammar").some(v=>v.id==="T6-AUX-MIX-001")'),false,
    "auxiliary conjugations must not appear among question-word grammar");
  run('beginSession(buildQuestions([allCourseItems().find(i=>i.id==="uf1-item-000134")],"grammar"),"practice","grammar","Lidwoord",{availableCount:1})');
  assert.match(app.innerHTML, /Welk lidwoord gebruik je\?/);
  assert.match(app.innerHTML, /<select id="answer-input"[\s\S]*le \/ la \/ l’ \/ les/);
  assert.doesNotMatch(app.innerHTML, /J’adore le chocolat/);
  const contextVariant = variantBank.variants.find(v => v.kind === "context" && v.targets.length === 1);
  context.contextItemId = contextVariant.targets[0];
  run(`state.assignments.items=[{id:"00000000-0000-4000-8000-000000000070",title:"Varianten",item_ids:[contextItemId],required_rounds:1,
    completion_strategy:"rounds",mastery_strategy:"item_mastery",use_exercise_variants:true}]; launchAssignment(state.assignments.items[0].id)`);
  assert.ok(run('state.session.questions[0].variantId'));
  run('submitAnswer("fout")');
  const variantAttempt = run('state.session.sync_attempts[0]');
  assert.equal(variantAttempt.client_submission_id, run('state.session.question_submissions[0].client_submission_id'));
  assert.equal(run('state.session.question_submissions.length'), 1);
  assert.equal(run('roundsForAssignment(state.assignments.items[0])[0].items[contextItemId].wrong_count'), 1);
  assert.doesNotMatch(feedback.innerHTML, /report-round-item/);
  run('submitAnswer("weer fout")');
  assert.match(feedback.innerHTML, /report-round-item/);
  const evidenceBeforeReport = run('state.mastery.localAttempts.length');
  run('reportRoundItem()');
  assert.equal(run('state.mastery.localAttempts.length'), evidenceBeforeReport);
  assert.equal(reported.at(-1).report.exercise_direction, "vocab-nl-fr");
  assert.equal(reported.at(-1).report.attempt_details.length, 2);
  assert.equal(run('assignmentProgress(state.assignments.items[0]).rounds.completed'), true);
  const t6Spelling = course.trajectories[5].items.filter(i => i.type === "sound_rule");
  assert.equal(assignments.scopeItems(course,{trajectory:"Trajet 6",top_category:"Comment écrire ?"}).length, t6Spelling.length);
  assert.equal(assignments.scopeItems(course,{trajectory:"Trajet 1",top_category:"Comment dire ?"}).length, 0);
  assert.equal(run('exerciseItemCount(allCourseItems().filter(isDynamicNumberItem))'), 3);
  assert.equal(run('frenchRegionalNumber(979)'), "neuf-cent-soixante-dix-neuf");
  assert.equal(run('frenchRegionalNumber(78814)'), "soixante-dix-huit-mille-huit-cent-quatorze");
  assert.deepEqual(Array.from(run('yearNumberAnswers(1999)')), ["dix-neuf-cent-nonante-neuf","dix-neuf-cent-quatre-vingt-dix-neuf","mille-neuf-cent-nonante-neuf","mille-neuf-cent-quatre-vingt-dix-neuf"]);
  assert.equal(run('yearNumberAnswers(2025)[0]'), "deux-mille-vingt-cinq");
  assert.equal(run('yearNumberAnswers(1800)[0]'), "dix-huit-cents");
  run('state.activeAssignmentId=null; state.trajectoryIndex=5; state.selectedUnitOrder=state.data.trajectories[5].units.find(u=>u.top_category==="Chiffres et lettres").order;state.selectedScope={title:"Nombres"};renderSetup()');
  assert.match(app.innerHTML, /1 [\s\S]*objectifs[\s\S]*leerdoelen/);
  assert.match(app.innerHTML, /100001 nombres possibles/);
  assert.doesNotMatch(app.innerHTML, /100001 [^<]*leerdoelen|éléments et variantes/);
  const numberItem = run('allCourseItems().find(i=>i.id==="uf1-item-000879")');
  context.numberItem = numberItem;
  const numberQuestion = run('buildDynamicNumberQuestions(numberItem,"number-nl-fr",1)[0]');
  assert.equal(numberQuestion.itemId,numberItem._id,'generated numbers use the permanent goal in local progress');
  assert.match(numberQuestion.variantId,/T5-NUM-GENERATED-/);
  const spellingOnly = variantEngine.grade(numberQuestion,numberQuestion.answers[0].replace(/-/g," "));
  if(numberQuestion.answers[0].includes('-')) {
    assert.equal(spellingOnly.correct,false);
    assert.equal(spellingOnly.valueCorrect,true);
    assert.equal(spellingOnly.evidence[0].correct,true,'value evidence stays positive after a pure hyphen error');
  }
  assert.equal(variantEngine.grade(numberQuestion,'geen getal').evidence[0].correct,false);
  const mixedQuestion=variantEngine.compileVariant(variantBank.variants.find(v=>v.id==="T1-GRAM-MIX-001"),course);
  context.mixedQuestion=mixedQuestion;
  const partialMixed=variantEngine.grade(mixedQuestion,["fout","Le"]);
  context.partialMixed=partialMixed;
  const targets=Array.from(run('submissionTargetResults(mixedQuestion,partialMixed,false)'),r=>({item_id:r.item_id,was_correct:r.was_correct}));
  assert.deepEqual(targets,[{item_id:mixedQuestion.stableItemId,was_correct:false},
    {item_id:mixedQuestion.stableItemIds[1],was_correct:true}],"a reliable secondary gap is scored separately from the whole anchor question");
  const originalTimeout=context.setTimeout;let continueRetry;
  context.setTimeout=(fn)=>{continueRetry=fn;return 1;};
  context.onlySentence=variantEngine.compileVariant(variantBank.variants.find(v=>v.scoring==="integrative"),course);
  run('beginSession([onlySentence],"practice","curated-revision","Een zin",{availableCount:1});submitAnswer("fout");nextQuestion()');
  assert.equal(run('state.view'),"practice_wait","even a one-question session cannot immediately repeat a failed full sentence");
  assert.ok(!app.innerHTML.includes(context.onlySentence.answers[0]));
  run('state.session.questions[state.session.index].retry_after=0');continueRetry();
  assert.equal(run('state.view'),"practice");context.setTimeout=originalTimeout;
  }
  console.log("RONDES-APPREGRESSIE GESLAAGD: behouden voortgang, varianten, scoping, normalisatie, meldingen en getallen");
});
