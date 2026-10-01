const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const appElement = { innerHTML: "", focus() {} };
const inputElement = { value: "", disabled: false, focus() {} };
const submitElement = { hidden: false };
const nextButton = { focus() {} };
const feedbackElement = { className: "", innerHTML: "", querySelector() { return nextButton; } };
const storage = new Map([
  ["monParcoursProgressV1", JSON.stringify({ attempted: 11, correct: 8, wrong: 3, items: {}, settings: { strictAccents: true, sessionSize: 20 } })],
  ["monParcoursSyncQueueV1", JSON.stringify([{ client_session_id: "bewaarde-sessie" }])]
]);

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
      if (selector === "#strict-accents") return { checked: true, disabled: false };
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

vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

setImmediate(function () {
  const trajectories = course.trajectories.slice(3);
  const allItems = course.trajectories.flatMap(function (trajectory) { return trajectory.items; });
  const oldItems = allItems.filter(function (item) { return Number(item.id.slice(-6)) <= 565; });
  const oldHash = crypto.createHash("sha256").update(JSON.stringify(oldItems)).digest("hex");
  assert.equal(oldHash, "83a12cb11fc0506eedecd43a9afd2bc076058ce882397a63d53931942ef02f20");
  assert.deepEqual(trajectories.map(function (trajectory) { return trajectory.trajectory; }), ["Trajet 4", "Trajet 5", "Trajet 6"]);
  assert.deepEqual(trajectories.map(function (trajectory) { return trajectory.items.length; }), [170, 144, 157]);
  assert.equal(allItems.length, 1036);

  const ids = allItems.map(function (item) { return item.id; });
  assert.equal(new Set(ids).size, 1036);
  for (let number = 1; number <= 1036; number += 1) {
    assert.ok(ids.includes("uf1-item-" + String(number).padStart(6, "0")), "ID-gat bij " + number);
  }
  assert.equal(trajectories[0].items[0].id, "uf1-item-000566");
  assert.equal(trajectories[2].items[trajectories[2].items.length - 1].id, "uf1-item-001036");

  const expectedTypes = [
    { grammar_rule: 37, number: 1, phrase: 49, sound_rule: 2, verb: 3, vocabulary: 78 },
    { grammar_rule: 30, number: 1, phrase: 40, sound_rule: 1, vocabulary: 72 },
    { grammar_rule: 32, number: 1, phrase: 42, sound_rule: 6, vocabulary: 76 }
  ];
  trajectories.forEach(function (trajectory, index) {
    const counts = trajectory.items.reduce(function (result, item) {
      result[item.type] = (result[item.type] || 0) + 1;
      return result;
    }, {});
    assert.deepEqual(counts, expectedTypes[index]);
    assert.ok(trajectory.units.some(function (unit) { return unit.top_category === "Atelier Parole"; }));
    assert.ok(trajectory.units.some(function (unit) { return unit.top_category === "Atelier Verbes"; }));
    assert.ok(trajectory.units.some(function (unit) { return unit.top_category === "Chiffres et lettres"; }));
    assert.ok(trajectory.units.some(function (unit) { return unit.top_category === "Atelier Grammaire"; }));
    const actes = trajectory.units.find(function (unit) { return unit.top_category === "Atelier Parole"; })
      .study_sections[0].subsections.find(function (subsection) { return subsection.title === "Actes de parole"; });
    assert.ok(actes);
  });

  const expectedActesGroups = [
    { "Dire comment on se déplace": 24, "De petits problèmes dans le trafic": 25 },
    { "Montrer une maison": 40 },
    { "Décrire une pièce": 23, "Situer un objet": 19 }
  ];
  trajectories.forEach(function (trajectory, offset) {
    const trajectoryIndex = offset + 3;
    const unit = trajectory.units.find(function (entry) { return entry.top_category === "Atelier Parole"; });
    evaluate("state.trajectoryIndex = " + trajectoryIndex + "; state.selectedUnitOrder = " + unit.order + "; renderUnit()");
    assert.match(appElement.innerHTML, /Actes de parole/);
    Object.keys(expectedActesGroups[offset]).forEach(function (category) {
      assert.ok(appElement.innerHTML.includes('data-category="' + category + '"'));
    });
    Object.entries(expectedActesGroups[offset]).forEach(function (entry) {
      context.groupScope = { block: "À retenir", subsection: "Actes de parole", category: entry[0], title: entry[0] };
      const items = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), groupScope)");
      assert.equal(items.length, entry[1]);
      assert.ok(items.every(function (item) { return item.type === "phrase" && item.category === entry[0]; }));
      evaluate("state.selectedScope = groupScope; renderSetup()");
      assert.match(appElement.innerHTML, /Nederlandse zin → Franse zin/);
      assert.equal(evaluate('questionsForSetup("phrase-nl-fr").length'), entry[1]);
    });
  });

  trajectories.forEach(function (trajectory, offset) {
    const trajectoryIndex = offset + 3;
    const vocabulary = trajectory.items.find(function (item) { return item.type === "vocabulary"; });
    const grammar = trajectory.items.find(function (item) { return item.type === "grammar_rule"; });
    context.auditItems = [vocabulary];
    assert.equal(evaluate('buildQuestions(auditItems, "vocab-nl-fr")[0].answers.includes(auditItems[0].fr)'), true);
    context.auditItems = [grammar];
    assert.equal(evaluate('buildQuestions(auditItems, "grammar")[0].answers.includes(auditItems[0].answer)'), true);

    const soundUnit = trajectory.units.find(function (unit) { return unit.top_category === "Comment dire ?" || unit.top_category === "Comment écrire ?"; });
    evaluate("state.trajectoryIndex = " + trajectoryIndex + "; state.selectedUnitOrder = " + soundUnit.order + "; renderUnit()");
    assert.doesNotMatch(appElement.innerHTML, /undefined/);
    trajectory.items.filter(function (item) { return item.type === "sound_rule"; }).forEach(function (item) {
      assert.ok(appElement.innerHTML.includes(evaluate("escapeHtml(" + JSON.stringify(item.rule_nl) + ")")));
    });
  });

  const trajectoryFourVerbs = trajectories[0].items.filter(function (item) { return item.type === "verb"; });
  assert.deepEqual(trajectoryFourVerbs.map(function (item) { return item.infinitive; }), ["prendre", "mettre", "faire"]);
  trajectoryFourVerbs.forEach(function (verb) {
    context.auditItems = [verb];
    assert.equal(evaluate('buildQuestions(auditItems, "verb-fr-conj").length'), 6);
  });
  assert.equal(trajectories[1].items.filter(function (item) { return item.type === "verb"; }).length, 0);
  assert.equal(trajectories[2].items.filter(function (item) { return item.type === "verb"; }).length, 0);

  const numberExpectations = [
    { count: 101, options: [10, 20, 30, "all"] },
    { count: 1001, options: [10, 20, 30] },
    { count: 100001, options: [10, 20, 30] }
  ];
  trajectories.forEach(function (trajectory, offset) {
    const trajectoryIndex = offset + 3;
    const unit = trajectory.units.find(function (entry) { return entry.top_category === "Chiffres et lettres"; });
    const section = unit.study_sections[0];
    const subsection = section.subsections[0];
    context.numberScope = { block: section.title, subsection: subsection.title, category: "", title: subsection.title };
    evaluate("state.trajectoryIndex = " + trajectoryIndex + "; state.selectedUnitOrder = " + unit.order + "; state.selectedScope = numberScope");
    assert.equal(evaluate('availableQuestionCount("number-nl-fr")'), numberExpectations[offset].count);
    assert.deepEqual(Array.from(evaluate('sessionSizeOptions(availableQuestionCount("number-nl-fr"), setupAllowsAll("number-nl-fr"))')), numberExpectations[offset].options);
    const questions = evaluate('questionsForSetup("number-nl-fr", 30)');
    assert.equal(questions.length, 30);
    assert.equal(new Set(questions.map(function (question) { return question.itemVariant; })).size, 30);
  });
  assert.equal(evaluate("belgianNumber(70)"), "septante");
  assert.equal(evaluate("belgianNumber(90)"), "nonante");
  assert.equal(evaluate("belgianNumber(100000)"), "cent-mille");
  assert.equal(evaluate('sessionPlanText("all", 101, true)'), "Je oefent alle 101 mogelijke getallen.");
  assert.equal(evaluate('sessionPlanText("20", 1001, true)'), "Je oefent 20 van 1001 mogelijke getallen.");
  assert.equal(evaluate('sessionPlanText("30", 100001, true)'), "Je oefent 30 van 100001 mogelijke getallen.");
  context.numberSpec = trajectories[0].items.find(function (item) { return item.dynamic_range; });
  const allTrajetFourNumbers = evaluate('buildDynamicNumberQuestions(numberSpec, "number-nl-fr", 101)');
  const seventy = allTrajetFourNumbers.find(function (question) { return question.itemVariant === "70"; });
  assert.ok(seventy.answers.includes("septante"));
  assert.ok(seventy.answers.includes("soixante-dix"));

  const alternativePhrase = trajectories[0].items.find(function (item) {
    return item.type === "phrase" && item.accepted_answers && item.accepted_answers.length > 1;
  });
  context.phraseQuestion = evaluate('buildQuestions([state.data.trajectories[3].items.find(i => i.id === "' + alternativePhrase.id + '")], "phrase-nl-fr")[0]');
  alternativePhrase.accepted_answers.forEach(function (answer) {
    context.acceptedAnswer = answer;
    assert.equal(evaluate("isCorrect(acceptedAnswer, phraseQuestion.answers)"), true);
  });
  assert.equal(evaluate('isCorrect("ete", ["été"])'), false);

  context.newScope = { block: "À retenir", subsection: "Actes de parole", category: alternativePhrase.category, title: alternativePhrase.category };
  evaluate('state.trajectoryIndex = 3; state.selectedUnitOrder = state.data.trajectories[3].units.find(u => u.top_category === "Atelier Parole").order; state.selectedScope = newScope; beginSession([phraseQuestion], "learn", "phrase-nl-fr", newScope.title, { availableCount: 24 })');
  evaluate('submitAnswer("verkeerd")');
  assert.equal(evaluate("state.session.phase"), "correction");
  assert.equal(evaluate("state.session.questions.length"), 2);
  assert.equal(evaluate("state.session.attempt_count"), 1);
  evaluate('phraseQuestion.reviewCount = 0; beginSession([phraseQuestion], "practice", "phrase-nl-fr", newScope.title, { availableCount: 24 })');
  evaluate('submitAnswer("verkeerd")');
  assert.equal(evaluate("state.session.questionAttempts"), 1);
  evaluate('beginSession([phraseQuestion], "test", "phrase-nl-fr", newScope.title, { availableCount: 24 })');
  context.correctAnswer = alternativePhrase.accepted_answers[0];
  evaluate("submitAnswer(correctAnswer)");
  assert.equal(evaluate("state.session.results[0].correct"), true);
  assert.equal(evaluate("state.session.question_count"), 1);
  assert.equal(evaluate("state.session.attempt_count"), 1);

  context.syncSnapshots = [];
  context.window.StudentIdentity = {
    getCurrentStudentIdentity() {
      return { provider: "school_code", subject: "11111111-1111-4111-8111-111111111111", verified: true };
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
  evaluate('beginSession([phraseQuestion], "learn", "phrase-nl-fr", newScope.title, { availableCount: 24 })');
  evaluate("submitAnswer(correctAnswer)");
  const synced = context.syncSnapshots[context.syncSnapshots.length - 1];
  assert.equal(synced.session.trajectory, "Trajet 4");
  assert.equal(synced.session.question_count, 1);
  assert.equal(synced.session.attempt_count, 1);
  assert.equal(synced.attempts[0].item_id, alternativePhrase.id);
  assert.equal(synced.attempts[0].item_type, "phrase");
  assert.equal(Object.prototype.hasOwnProperty.call(synced.attempts[0], "submitted_answer"), false);

  const trajectorySixNumberUnit = trajectories[2].units.find(function (unit) { return unit.top_category === "Chiffres et lettres"; });
  const trajectorySixNumberSection = trajectorySixNumberUnit.study_sections[0];
  context.numberScope = {
    block: trajectorySixNumberSection.title,
    subsection: trajectorySixNumberSection.subsections[0].title,
    category: "",
    title: trajectorySixNumberSection.subsections[0].title
  };
  evaluate("state.trajectoryIndex = 5; state.selectedUnitOrder = " + trajectorySixNumberUnit.order + "; state.selectedScope = numberScope");
  context.dynamicNumberQuestion = evaluate('questionsForSetup("number-nl-fr", 10)[0]');
  context.dynamicNumberAnswer = context.dynamicNumberQuestion.answers[0];
  evaluate('beginSession([dynamicNumberQuestion], "learn", "number-nl-fr", numberScope.title, { availableCount: 100001 })');
  evaluate("submitAnswer(dynamicNumberAnswer)");
  const syncedNumber = context.syncSnapshots[context.syncSnapshots.length - 1];
  assert.equal(syncedNumber.session.trajectory, "Trajet 6");
  assert.equal(syncedNumber.session.question_count, 1);
  assert.equal(syncedNumber.session.attempt_count, 1);
  assert.equal(syncedNumber.attempts[0].item_id, "uf1-item-001036");
  assert.match(syncedNumber.attempts[0].item_variant, /^\d+$/);
  assert.equal(syncedNumber.attempts[0].item_type, "number");

  assert.equal(evaluate("state.progress.attempted") >= 11, true);
  assert.equal(JSON.parse(storage.get("monParcoursSyncQueueV1"))[0].client_session_id, "bewaarde-sessie");
  [3, 4, 5].forEach(function (index) {
    evaluate("state.trajectoryIndex = " + index + "; renderHome()");
    assert.ok(appElement.innerHTML.includes("Trajet " + (index + 1)));
  });

  console.log("TRAJET-4–6-REGRESSIE GESLAAGD");
  console.log("Bronstructuur, oude-itemhash, 471 nieuwe IDs, alle types, Actes-subgroepen en dynamische getallen gecontroleerd.");
  console.log("Leren, Oefenen, Test jezelf, herhaling, localStorage en Supabase-payload gecontroleerd.");
});
