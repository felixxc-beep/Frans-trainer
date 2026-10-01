const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const source = fs.readFileSync("app.js", "utf8");
const appElement = { innerHTML: "", focus() {} };
const inputElement = { value: "", disabled: false, focus() {} };
const submitElement = { hidden: false };
const nextButton = { focus() {} };
const feedbackElement = { className: "", innerHTML: "", querySelector() { return nextButton; } };
const strictToggle = { checked: true, disabled: false };
const storage = new Map();
const legacyProgress = {
  version: 1,
  attempted: 7,
  correct: 5,
  wrong: 2,
  items: { bestaand: { attempts: 2, correct: 1, wrong: 1, last: "2026-01-01" } },
  settings: { strictAccents: false, eigenVoorkeur: "behouden" },
  eigenVeld: "blijft staan"
};
storage.set("monParcoursProgressV1", JSON.stringify(legacyProgress));

const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FormData: class {},
  document: {
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return { showModal() {}, close() {} };
      if (selector === "#strict-accents") return strictToggle;
      if (selector === "#answer-input") return inputElement;
      if (selector === ".submit-button") return submitElement;
      if (selector === "#feedback") return feedbackElement;
      return null;
    }
  },
  window: { scrollTo() {}, confirm() { return false; } },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function () {
    return { ok: true, json: async function () { return structuredClone(course); } };
  }
});

vm.runInContext(source, context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

function vocabularyQuestion(french) {
  context.lookupFrench = french;
  return evaluate('(() => { const item = state.data.trajectories.flatMap(t => t.items).find(i => i.type === "vocabulary" && i.fr === lookupFrench); return buildQuestions([item], "vocab-nl-fr")[0]; })()');
}

setImmediate(function () {
  assert.equal(evaluate("state.progress.attempted"), 7);
  assert.equal(evaluate('state.progress.items.bestaand.wrong'), 1);
  assert.equal(evaluate('state.progress.eigenVeld'), "blijft staan");
  assert.equal(evaluate('state.progress.settings.eigenVoorkeur'), "behouden");
  assert.equal(evaluate("state.progress.settings.strictAccents"), true);
  assert.equal(evaluate("state.progress.settings.sessionSize"), 20);
  evaluate("saveProgress()");
  const saved = JSON.parse(storage.get("monParcoursProgressV1"));
  assert.equal(saved.eigenVeld, "blijft staan");
  assert.ok(saved.items.bestaand);

  const multipleAnswerCases = [
    ["nouveau, nouvelle", ["nouveau", "nouvelle"]],
    ["intelligent(e)", ["intelligent", "intelligente"]],
    ["sportif, sportive", ["sportif", "sportive"]],
    ["la professeur / le professeur", ["la professeur", "le professeur"]]
  ];
  multipleAnswerCases.forEach(function ([sourceAnswer, expected]) {
    const question = vocabularyQuestion(sourceAnswer);
    assert.deepEqual(Array.from(question.answers), expected, sourceAnswer);
    expected.forEach(function (answer) {
      context.testQuestion = question;
      context.testAnswer = answer;
      assert.equal(evaluate("isCorrect(testAnswer, testQuestion.answers)"), true, answer);
    });
  });

  const apostrophe = vocabularyQuestion("l’amie");
  context.testQuestion = apostrophe;
  assert.equal(evaluate(`isCorrect("  L'AMIE  ", testQuestion.answers)`), true);
  assert.equal(evaluate('isCorrect("la   copine", ["la copine"])'), true);
  assert.equal(evaluate('isCorrect("ecole", ["école"])'), false);

  const verbs = evaluate('state.data.trajectories.flatMap(t => t.items).filter(i => i.type === "verb" && ["être", "avoir"].includes(i.infinitive))');
  context.testItems = verbs;
  const verbQuestions = evaluate('buildQuestions(testItems, "verb-nl-inf")');
  assert.ok(verbQuestions.some(function (question) { return question.answers.length === 1 && question.answers[0] === "être"; }));
  assert.ok(verbQuestions.some(function (question) { return question.answers.length === 1 && question.answers[0] === "avoir"; }));
  assert.equal(evaluate('isCorrect("avoir", ["être"])'), false);
  assert.equal(evaluate('isCorrect("chaise", ["la chaise"])'), false);

  assert.deepEqual(Array.from(evaluate("sessionSizeOptions(18)")), [10, "all"]);
  assert.deepEqual(Array.from(evaluate("sessionSizeOptions(61)")), [10, 20, 30, "all"]);
  context.pool = Array.from({ length: 61 }, function (_, index) {
    return { itemId: "item-" + index, itemIds: ["item-" + index], prompt: "vraag " + index, answers: ["antwoord"], instruction: "test", context: "", reviewCount: 0 };
  });
  [10, 20, 30, 61].forEach(function (count) {
    context.requestedCount = count;
    const selected = evaluate("selectQuestions(pool, requestedCount)");
    assert.equal(selected.length, count);
    assert.equal(new Set(selected.map(function (question) { return question.itemId; })).size, count);
  });

  context.testQuestion = { itemId: "alternatief", itemIds: ["alternatief"], prompt: "nieuw", answers: ["nouveau", "nouvelle"], instruction: "Vertaal", context: "", reviewCount: 0 };
  evaluate('beginSession([testQuestion], "learn", "vocab-nl-fr", "Regressie", { availableCount: 61 })');
  const wrongBeforeAlternative = evaluate("state.progress.wrong");
  evaluate('submitAnswer("nouvelle")');
  assert.equal(evaluate("state.session.attempt_count"), 1);
  assert.equal(evaluate("state.progress.wrong"), wrongBeforeAlternative);

  context.testQuestion = { itemId: "herhaling", itemIds: ["herhaling"], prompt: "de tafel", answers: ["la table"], instruction: "Vertaal", context: "", reviewCount: 0 };
  evaluate('beginSession([testQuestion], "learn", "vocab-nl-fr", "Regressie", { availableCount: 61 })');
  evaluate('submitAnswer("la chaise")');
  assert.equal(evaluate("state.session.questions.length"), 2);
  assert.equal(evaluate("state.session.question_count"), 1);
  assert.equal(evaluate("state.session.attempt_count"), 1);
  assert.equal(evaluate('state.session.phase'), "correction");
  evaluate('submitAnswer("la table")');
  assert.equal(evaluate("state.session.attempt_count"), 2);

  evaluate('testQuestion.reviewCount = 0; beginSession([testQuestion], "practice", "vocab-nl-fr", "Regressie", { availableCount: 1 })');
  evaluate('submitAnswer("fout")');
  evaluate('submitAnswer("nog fout")');
  assert.equal(evaluate("state.session.questions.length"), 2);
  assert.equal(evaluate("state.session.attempt_count"), 2);

  evaluate('beginSession([testQuestion], "test", "vocab-nl-fr", "Regressie", { availableCount: 1 })');
  evaluate('submitAnswer("la table")');
  assert.equal(evaluate("state.session.attempt_count"), 1);
  assert.equal(evaluate("state.session.results[0].correct"), true);
  assert.match(appElement.innerHTML, /Je oefende alle 1 beschikbare items/);
  assert.match(appElement.innerHTML, /Aantal pogingen: 1/);

  context.schoolQuestion = vocabularyQuestion("nouveau, nouvelle");
  context.syncSnapshots = [];
  context.window.StudentIdentity = {
    getCurrentStudentIdentity() {
      return { provider: "school_code", subject: "11111111-1111-4111-8111-111111111111", displayName: "Leerling", className: "Klas", verified: true };
    }
  };
  let syncId = 0;
  context.window.MonParcoursSync = {
    createId() {
      syncId += 1;
      return "00000000-0000-4000-8000-" + String(syncId).padStart(12, "0");
    },
    enqueueSession(value) { context.syncSnapshots.push(value); },
    scheduleFlush() {}
  };
  evaluate('state.trajectoryIndex = 0; state.selectedUnitOrder = state.data.trajectories[0].units[0].order; state.selectedScope = { title: "On se rappelle ?", block: "À retenir", subsection: "On se rappelle ?" }; beginSession([schoolQuestion], "learn", "vocab-nl-fr", "Sync", { availableCount: 2 })');
  evaluate('submitAnswer("nouvelle")');
  const synced = context.syncSnapshots[context.syncSnapshots.length - 1];
  assert.equal(synced.session.question_count, 1);
  assert.equal(synced.session.attempt_count, 1);
  assert.equal(synced.session.mode, "learn");
  assert.equal(synced.attempts.length, 1);
  assert.match(synced.attempts[0].item_id, /^uf1-item-\d{6}$/);
  assert.equal(synced.attempts[0].was_correct, true);
  assert.equal(Object.prototype.hasOwnProperty.call(synced.attempts[0], "submitted_answer"), false);

  const structure = course.trajectories.map(function (trajectory) {
    return {
      trajectory: trajectory.trajectory,
      units: trajectory.units.map(function (unit) { return [unit.order, unit.top_category, unit.title]; }),
      itemCount: trajectory.items.length
    };
  });
  assert.deepEqual(structure.map(function (entry) { return entry.itemCount; }), [182, 148, 235, 170, 144, 157]);
  assert.deepEqual(structure.map(function (entry) { return entry.trajectory; }), ["Trajet 1", "Trajet 2", "Trajet 3", "Trajet 4", "Trajet 5", "Trajet 6"]);
  assert.equal(structure.reduce(function (sum, entry) { return sum + entry.units.length; }, 0), 50);

  console.log("SESSIE- EN ANTWOORDREGRESSIE GESLAAGD");
  console.log("Expliciete alternatieven, strikte accenten, 10/20/30/alle, unieke selectie en attempt_count gecontroleerd.");
  console.log("Leren, Oefenen, Test jezelf, herhaling na fouten en bestaande localStorage-voortgang gecontroleerd.");
});
