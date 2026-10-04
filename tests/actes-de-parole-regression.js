const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const appElement = { innerHTML: "", focus() {} };
const inputElement = { value: "", disabled: false, focus() {} };
const submitElement = { hidden: false };
const nextButton = { focus() {} };
const feedbackElement = { className: "", innerHTML: "", querySelector() { return nextButton; } };
const storage = new Map();

const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FormData: class {},
  document: {
    visibilityState: "visible",
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return { showModal() {}, close() {} };
      if (selector === "#strict-accents") return { checked: true, disabled: false };
      if (selector === "#answer-input") return inputElement;
      if (selector === ".submit-button") return submitElement;
      if (selector === "#feedback") return feedbackElement;
      return null;
    }
  },
  window: {
    scrollTo() {}, confirm() { return false; }, addEventListener() {},
    StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "test-student", displayName: "Test", className: "1A", verified: true }; } }
  },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function () {
    return { ok: true, json: async function () { return structuredClone(course); } };
  }
});

vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

setImmediate(function () {
  const expectedCounts = [45, 19, 53, 49, 40, 42];
  const expectedQuestionCounts = [45, 19, 52, 49, 40, 42];

  course.trajectories.forEach(function (trajectory, trajectoryIndex) {
    const unit = trajectory.units.find(function (entry) { return entry.top_category === "Atelier Parole"; });
    assert.ok(unit, trajectory.trajectory + " moet Atelier Parole bevatten");
    assert.ok(unit.study_sections.some(function (section) {
      return section.title === "À retenir" && section.subsections.some(function (subsection) {
        return subsection.title === "Actes de parole";
      });
    }), trajectory.trajectory + " moet Actes de parole in de structuur bevatten");

    context.actesScope = { block: "À retenir", subsection: "Actes de parole", title: "Actes de parole" };
    evaluate("state.trajectoryIndex = " + trajectoryIndex + "; state.selectedUnitOrder = " + unit.order + "; renderUnit()");
    assert.match(appElement.innerHTML, /Actes de parole/);

    const items = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), actesScope)");
    const phraseItems = items.filter(function (item) { return item.type === "phrase"; });
    assert.equal(phraseItems.length, expectedCounts[trajectoryIndex], trajectory.trajectory);
    assert.equal(items.length, phraseItems.length, "Actes de parole mag niet door andere types worden vervuild");

    assert.ok(appElement.innerHTML.includes('data-subsection="Actes de parole"'));
    assert.match(appElement.innerHTML, new RegExp('data-subsection="Actes de parole"[\\s\\S]*?(?:<span>' + phraseItems.length + "</span>|<b class=\"scope-count\">" + phraseItems.length + "</b>)"));
    evaluate("state.selectedScope = actesScope; renderSetup()");
    assert.match(appElement.innerHTML, /Nederlandse zin → Franse zin/);
    assert.ok(appElement.innerHTML.includes('class="choice-count">' + expectedQuestionCounts[trajectoryIndex]));

    const questions = evaluate('questionsForSetup("phrase-nl-fr")');
    assert.equal(questions.length, expectedQuestionCounts[trajectoryIndex]);
    questions.forEach(function (question) {
      assert.equal(question.instruction, "Schrijf de volledige Franse zin");
      assert.equal(typeof question.prompt, "string");
      assert.ok(question.answers.length > 0);
    });

    const expectedSizes = questions.length < 20 ? [10, "all"] : [10, 20, 30, "all"];
    assert.deepEqual(Array.from(evaluate("sessionSizeOptions(" + questions.length + ")")), expectedSizes);
  });

  assert.deepEqual(Array.from(evaluate("sessionSizeOptions(9)")), ["all"]);

  const trajectoryOneUnit = course.trajectories[0].units.find(function (unit) {
    return unit.top_category === "Atelier Parole";
  });
  context.blockScope = { block: "À retenir", subsection: "", category: "", title: "À retenir" };
  context.sePresenterScope = { block: "À retenir", subsection: "Actes de parole", category: "Se présenter", title: "Se présenter" };
  context.presenterQuelquunScope = { block: "À retenir", subsection: "Actes de parole", category: "Présenter quelqu’un (1)", title: "Présenter quelqu’un (1)" };
  evaluate("state.trajectoryIndex = 0; state.selectedUnitOrder = " + trajectoryOneUnit.order + "; renderUnit()");
  const wholeUnit = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), { block: '', subsection: '', category: '' })");
  const wholeBlock = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), blockScope)");
  assert.equal(wholeUnit.length, 146, "Oefen alles moet de 45 zinnen bij de bestaande 101 items tellen");
  assert.equal(wholeBlock.length, 146, "Oefen dit studieblok moet de Actes-de-parole-zinnen bevatten");
  assert.equal(wholeBlock.filter(function (item) { return item.type === "phrase"; }).length, 45);
  assert.equal(wholeBlock.filter(function (item) { return item.type !== "phrase"; }).length, 101);
  assert.match(appElement.innerHTML, /146[\s\S]*éléments d’exercice[\s\S]*oefenitems/);
  assert.match(appElement.innerHTML, /Toute la partie[\s\S]*Hele onderdeel[\s\S]*146/);
  assert.doesNotMatch(appElement.innerHTML, /Tout le bloc[\s\S]*Hele blok[\s\S]*146/, "de identieke blokactie wordt niet dubbel getoond");
  assert.ok(appElement.innerHTML.includes('data-subsection="Actes de parole" data-category=""'));
  assert.ok(appElement.innerHTML.includes('data-category="Se présenter"'));
  assert.ok(appElement.innerHTML.includes('data-category="Présenter quelqu’un (1)"'));

  evaluate("state.selectedScope = blockScope; renderSetup()");
  assert.match(appElement.innerHTML, /Nederlandse zin → Franse zin/);
  assert.equal(evaluate('questionsForSetup("phrase-nl-fr").length'), 45,
    "Oefen dit studieblok moet alle Actes-de-parole-zinnen aanbieden");
  context.wholeUnitScope = { block: "", subsection: "", category: "", title: trajectoryOneUnit.title };
  evaluate("state.selectedScope = wholeUnitScope; renderSetup()");
  assert.match(appElement.innerHTML, /Nederlandse zin → Franse zin/);
  assert.equal(evaluate('questionsForSetup("phrase-nl-fr").length'), 45,
    "Oefen alles moet alle Actes-de-parole-zinnen aanbieden");

  const sePresenterItems = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), sePresenterScope)");
  const presenterQuelquunItems = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), presenterQuelquunScope)");
  assert.equal(sePresenterItems.length, 23);
  assert.equal(presenterQuelquunItems.length, 22);
  assert.ok(sePresenterItems.every(function (item) { return item.type === "phrase" && item.category === "Se présenter"; }));
  assert.ok(presenterQuelquunItems.every(function (item) { return item.type === "phrase" && item.category === "Présenter quelqu’un (1)"; }));
  evaluate("state.selectedScope = sePresenterScope; renderSetup()");
  assert.match(appElement.innerHTML, /23[\s\S]*éléments[\s\S]*items/);
  assert.ok(appElement.innerHTML.includes('class="choice-count">23'));
  assert.deepEqual(Array.from(evaluate('sessionSizeOptions(questionsForSetup("phrase-nl-fr").length)')), [10, 20, "all"]);
  evaluate("state.selectedScope = presenterQuelquunScope; renderSetup()");
  assert.match(appElement.innerHTML, /22[\s\S]*éléments[\s\S]*items/);
  assert.ok(appElement.innerHTML.includes('class="choice-count">22'));
  assert.deepEqual(Array.from(evaluate('sessionSizeOptions(questionsForSetup("phrase-nl-fr").length)')), [10, 20, "all"]);

  const trajectoryOnePhrases = course.trajectories[0].items.filter(function (item) {
    return item.type === "phrase" && item.block === "À retenir" && item.subsection === "Actes de parole";
  });
  assert.deepEqual(trajectoryOnePhrases.map(function (item) { return item.id; }),
    Array.from({ length: 45 }, function (_, index) { return "uf1-item-" + String(index + 521).padStart(6, "0"); }));
  assert.equal(trajectoryOnePhrases.filter(function (item) { return item.category === "Se présenter"; }).length, 23);
  assert.equal(trajectoryOnePhrases.filter(function (item) { return item.category === "Présenter quelqu’un (1)"; }).length, 22);

  const modelPatterns = [
    ["uf1-item-000522", "Ik heet [naam].", "Je m’appelle [nom]."],
    ["uf1-item-000524", "Mijn familienaam is [naam].", "Mon nom est [nom]."],
    ["uf1-item-000526", "Ik ben [leeftijd] jaar.", "J’ai [âge] ans."],
    ["uf1-item-000538", "Ik zit in [klas].", "Je suis en [classe]."],
    ["uf1-item-000540", "Ik zit in groep [groep].", "Je suis dans le groupe [groupe]."],
    ["uf1-item-000545", "Hij/zij heet [naam].", "Il / Elle s’appelle [nom]."],
    ["uf1-item-000547", "Zijn/haar familienaam is [naam].", "Son nom de famille, c’est [nom]."],
    ["uf1-item-000549", "Hij/zij is [leeftijd] jaar.", "Il / Elle a [âge] ans."],
    ["uf1-item-000551", "Hij/zij woont in [plaats].", "Il / Elle habite à [lieu]."],
    ["uf1-item-000565", "Hij/zij zit in [klas].", "Il / Elle est en [classe]."]
  ];
  modelPatterns.forEach(function (expected) {
    const item = trajectoryOnePhrases.find(function (entry) { return entry.id === expected[0]; });
    assert.ok(item, expected[0] + " ontbreekt");
    assert.equal(item.nl, expected[1]);
    assert.equal(item.fr, expected[2]);
  });
  assert.equal(trajectoryOnePhrases.find(function (item) { return item.id === "uf1-item-000528"; }).fr,
    "J’habite à Dinant, en Belgique.");

  const alternatePhrase = trajectoryOnePhrases.find(function (item) {
    return item.id === "uf1-item-000521";
  });
  context.phraseQuestion = evaluate('buildQuestions([state.data.trajectories[0].items.find(i => i.id === "' + alternatePhrase.id + '")], "phrase-nl-fr")[0]');
  alternatePhrase.accepted_answers.forEach(function (answer) {
    context.acceptedPhrase = answer;
    assert.equal(evaluate("isCorrect(acceptedPhrase, phraseQuestion.answers)"), true);
  });

  evaluate('state.trajectoryIndex = 0; state.selectedUnitOrder = 1; state.selectedScope = actesScope; beginSession([phraseQuestion], "learn", "phrase-nl-fr", "Actes de parole", { availableCount: 45 })');
  evaluate('submitAnswer("verkeerd")');
  assert.equal(evaluate("state.session.phase"), "correction");
  assert.equal(evaluate("state.session.questions.length"), 2);
  assert.match(feedbackElement.innerHTML, /Mogelijke juiste antwoorden/);
  assert.ok(alternatePhrase.accepted_answers.some(function (answer) { return feedbackElement.innerHTML.includes(answer); }));

  evaluate('phraseQuestion.reviewCount = 0; beginSession([phraseQuestion], "practice", "phrase-nl-fr", "Actes de parole", { availableCount: 45 })');
  evaluate('submitAnswer("verkeerd")');
  assert.equal(evaluate("state.session.questionAttempts"), 1);

  evaluate('beginSession([phraseQuestion], "test", "phrase-nl-fr", "Actes de parole", { availableCount: 45 })');
  context.correctPhrase = alternatePhrase.accepted_answers[1];
  evaluate("submitAnswer(correctPhrase)");
  assert.equal(evaluate("state.session.results[0].correct"), true);

  context.syncSnapshots = [];
  context.window.StudentIdentity = {
    getCurrentStudentIdentity() {
      return { provider: "school_email", subject: "11111111-1111-4111-8111-111111111111", verified: true };
    }
  };
  let syncId = 0;
  context.window.MonParcoursSync = {
    createId() {
      syncId += 1;
      return "00000000-0000-4000-8000-" + String(syncId).padStart(12, "0");
    },
    enqueueSession(snapshot) { context.syncSnapshots.push(snapshot); },
    scheduleFlush() {}
  };
  evaluate('state.trajectoryIndex = 0; state.selectedUnitOrder = state.data.trajectories[0].units.find(u => u.top_category === "Atelier Parole").order; state.selectedScope = actesScope; beginSession([phraseQuestion], "learn", "phrase-nl-fr", "Actes de parole", { availableCount: 45 })');
  evaluate("submitAnswer(correctPhrase)");
  const synced = context.syncSnapshots[context.syncSnapshots.length - 1];
  assert.equal(synced.session.question_count, 1);
  assert.equal(synced.session.attempt_count, 1);
  assert.equal(synced.session.trajectory, "Trajet 1");
  assert.equal(synced.session.subsection, "Actes de parole");
  assert.equal(synced.attempts[0].item_id, "uf1-item-000521");
  assert.equal(synced.attempts[0].item_type, "phrase");
  assert.equal(synced.attempts[0].was_correct, true);
  assert.equal(Object.prototype.hasOwnProperty.call(synced.attempts[0], "submitted_answer"), false);

  console.log("ACTES-DE-PAROLE-REGRESSIE GESLAAGD");
  console.log("Trajet 1–6: 45 · 19 · 53 · 49 · 40 · 42 phrase-items");
  console.log("146-itemtotalen, beide subgroepen, bronpatronen, sessiegroottes, accepted_answers, sync en alle drie modi gecontroleerd.");
});
