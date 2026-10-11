const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("../exercise-variants.js");
const mastery = require("../mastery.js");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json", "utf8"));
const originalCourse = JSON.stringify(course);
const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /exercise-variants\.js[^]*app\.js/, "variant engine loads before app initialization");
const allItems = course.trajectories.flatMap(function (trajectory) { return trajectory.items; });
assert.equal(allItems.length, 1036);
assert.equal(new Set(allItems.map(function (item) { return item.id; })).size, 1036);
assert.deepEqual(engine.validateBank(bank, course), { variants: 1712, permanentItems: 1036 });
assert.deepEqual([1, 2, 3, 4, 5, 6].map(function (number) {
  return bank.variants.filter(function (variant) { return variant.trajectory === "Trajet " + number; }).length;
}), [352, 222, 226, 292, 283, 337]);

const [first, second] = course.trajectories[0].items.filter(function (item) { return item.type === "vocabulary"; });
const articleUn = course.trajectories[0].items.find(function (item) { return item.id === "uf1-item-000126"; });
const articleUne = course.trajectories[0].items.find(function (item) { return item.id === "uf1-item-000127"; });
const numberSpec = course.trajectories[4].items.find(function (item) { return item.dynamic_range === true; });
const spellingItem = course.trajectories[5].items.find(function (item) { return item.type === "sound_rule"; });
assert.ok(first && second && articleUn && articleUne && numberSpec && spellingItem);

const single = {
  id: "T1-TEST-CTX-001", trajectory: "Trajet 1", kind: "context", scoring: "single",
  prompt: "J'ai ___.", accepted_answers: ["l’amie"], targets: [first.id]
};
const multi = {
  id: "T1-TEST-GRAM-001", trajectory: "Trajet 1", kind: "grammar", scoring: "multi_gap",
  prompt: "J'ai ___ ami et ___ amie.", gaps: [
    { id: "article-1", accepted_answers: ["un"], targets: [articleUn.id] },
    { id: "article-2", accepted_answers: ["une"], targets: [articleUne.id] }
  ]
};
const revision = {
  id: "T1-TEST-REV-001", trajectory: "Trajet 1", kind: "revision", scoring: "integrative",
  prompt: "Vertaal de volledige zin.", accepted_answers: ["Je m’appelle Emma."], targets: [first.id, second.id]
};
const number = {
  id: "T5-TEST-NUM-001", trajectory: "Trajet 5", kind: "number", scoring: "single",
  prompt: "742", accepted_answers: ["sept-cent-quarante-deux"], targets: [numberSpec.id]
};
const homophone = {
  id: "T6-TEST-HOM-001", trajectory: "Trajet 6", kind: "spelling", scoring: "single",
  prompt: "Il ___ un vélo.", accepted_answers: ["a"], targets: [spellingItem.id]
};
assert.deepEqual(engine.validateBank({ variants: [single, multi, revision, number, homophone] }, course),
  { variants: 5, permanentItems: 1036 });
assert.throws(function () { engine.validateBank({ variants: [single, single] }, course); }, /duplicate exercise variant ID/);
assert.throws(function () { engine.validateBank({ variants: [Object.assign({}, single, { targets: ["T1-TEST-NEW-ITEM"] })] }, course); }, /unknown permanent item ID/);
assert.throws(function () { engine.validateBank({ variants: [Object.assign({}, single, { accepted_answers: [] })] }, course); }, /empty\/invalid accepted answers/);
assert.throws(function () { engine.validateBank({ variants: [Object.assign({}, multi, { gaps: multi.gaps.slice(0, 1) })] }, course); }, /prompt\/gap count differs/);
assert.throws(function () { engine.validateBank({ variants: [Object.assign({}, homophone, { kind: "grammar" })] }, course); },
  /grammar exercise must target a grammar rule/);
assert.equal(JSON.stringify(course), originalCourse, "validation and compilation never mutate the permanent course");

const singleQuestion = engine.compileVariant(single, course);
assert.equal(engine.grade(singleQuestion, " L'AMIE. ").correct, true);
assert.equal(engine.grade(singleQuestion, "l'amie").evidence[0].targets[0], first.id);
assert.equal(engine.grade(singleQuestion, "l’amíe").correct, false, "accents remain strict");
const multiQuestion = engine.compileVariant(multi, course);
const partial = engine.grade(multiQuestion, ["un", "faux"]);
assert.equal(partial.correct, false);
assert.deepEqual(partial.gapResults.map(function (row) { return row.correct; }), [true, false]);
assert.deepEqual(partial.evidence.map(function (row) { return row.targets[0]; }), [articleUn.id, articleUne.id]);
assert.equal(engine.grade(multiQuestion, ["un", "une"]).correct, true);
const revisionQuestion = engine.compileVariant(revision, course);
assert.equal(engine.grade(revisionQuestion, "fout").evidence.length, 0, "failed translation gives no blanket negative mastery");
assert.deepEqual(engine.grade(revisionQuestion, "Je m'appelle Emma").evidence[0].targets, [first.id, second.id]);
assert.equal(engine.compileVariant(number, course).stableItemId, numberSpec.id, "dynamic number maps to one existing number_spec");
assert.equal(engine.compileVariant(homophone, course).stableItemId, spellingItem.id, "T6 written homophone can map to existing sound_rule");
const questionMark = Object.assign({}, revision, { id: "T1-TEST-REV-002", accepted_answers: ["Tu habites où ?"], requires_question_mark: true });
engine.validateBank({ variants: [questionMark] }, course);
assert.equal(engine.grade(engine.compileVariant(questionMark, course), "Tu habites où").correct, false);
assert.equal(engine.grade(engine.compileVariant(questionMark, course), "Tu habites où ?").correct, true);

const appElement = { innerHTML: "", focus() {} };
const input = { value: "", disabled: false, focus() {} };
const submit = { hidden: false };
const feedback = { className: "", innerHTML: "", querySelector() { return { focus() {} }; } };
const storage = new Map();
const snapshots = [];
let serial = 0;
const context = vm.createContext({
  console, setTimeout, clearTimeout,
  document: {
    visibilityState: "visible", addEventListener() {}, querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog" || selector === "#identity-dialog") return { showModal() {}, close() {} };
      if (selector === "#identityButton") return { addEventListener() {} };
      if (selector === "#strict-accents") return { checked: true, disabled: false };
      if (selector === "#answer-input") return input;
      if (selector === ".submit-button") return submit;
      if (selector === "#feedback") return feedback;
      return null;
    }
  },
  window: {
    MonParcoursExerciseVariants: engine, MonParcoursMastery: mastery,
    StudentIdentity: { getCurrentStudentIdentity() { return {
      provider: "school_email", subject: "11111111-1111-4111-8111-111111111111", verified: true, displayName: "Test"
    }; } },
    MonParcoursSync: {
      createId() { serial += 1; return "00000000-0000-4000-8000-" + String(serial).padStart(12, "0"); },
      enqueueSession(snapshot) { snapshots.push(snapshot); return true; }, scheduleFlush() {}
    },
    addEventListener() {}, scrollTo() {}
  },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function (url) { return { ok: true, json: async function () {
    return url.includes("exercise-variants") ? structuredClone(bank) : structuredClone(course);
  } }; }
});
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);
function evalApp(code) { return vm.runInContext(code, context); }

setImmediate(function () {
  context.multiQuestion = multiQuestion;
  context.revisionQuestion = revisionQuestion;
  evalApp('state.trajectoryIndex = 0; state.selectedUnitOrder = state.data.trajectories[0].units[0].order; state.selectedScope = { title: "Test" }');
  evalApp('beginSession([multiQuestion], "practice", "curated", "Test", { availableCount: 1 })');
  assert.match(appElement.innerHTML, /name="gap-0"/);
  assert.match(appElement.innerHTML, /name="gap-1"/);
  context.activeField = { name: "gap-1", isConnected: true, disabled: false, value: "",
    selectionStart: 0, selectionEnd: 0, setSelectionRange() {}, focus() {} };
  evalApp("activeAnswerInput = activeField; insertAccent('é')");
  assert.equal(context.activeField.value, "é", "accent button inserts in the selected gap");
  assert.equal(evalApp("state.session.question_count"), 1);
  evalApp('submitAnswer(["un", "faux"])');
  assert.match(feedback.innerHTML, /Vérifie les trous 2/);
  assert.equal(evalApp("state.session.attempt_count"), 1, "one submission is one actual attempt");
  assert.equal(evalApp("state.session.question_submissions.length"), 1);
  assert.equal(snapshots[snapshots.length - 1].session.question_submissions.length, 1);
  const gapAttempts = evalApp("state.session.sync_attempts");
  assert.equal(gapAttempts.length, 2, "one evidence row per gap");
  assert.deepEqual(Array.from(gapAttempts.map(function (row) { return row.was_correct; })), [true, false]);
  assert.equal(new Set(gapAttempts.map(function (row) { return row.client_attempt_id; })).size, 2);
  assert.equal(evalApp("currentMasteryRecords().get(window.MonParcoursMastery.keyFor(multiQuestion.stableItemId, multiQuestion.variantId + ':article-1')).independentCorrect"), 1);
  assert.equal(evalApp("state.progress.items[state.data.trajectories[0].items.find(i => i.id === multiQuestion.stableItemIds[0])._id].correct"), 1);
  assert.equal(evalApp("state.progress.items[state.data.trajectories[0].items.find(i => i.id === multiQuestion.stableItemIds[1])._id].wrong"), 1);
  assert.equal(snapshots[snapshots.length - 1].attempts.length, 2);

  evalApp('beginSession([revisionQuestion], "practice", "curated", "Test", { availableCount: 1 })');
  const before = evalApp("state.mastery.localAttempts.length");
  evalApp('submitAnswer("fout")');
  assert.equal(evalApp("state.session.attempt_count"), 1);
  assert.equal(evalApp("state.session.sync_attempts.length"), 0);
  assert.equal(evalApp("state.session.question_submissions.length"), 1, "a failed integrative submission still counts");
  assert.equal(evalApp("state.mastery.localAttempts.length"), before, "wrong integrative response never penalizes mapped goals");
  evalApp('submitAnswer("Je m’appelle Emma.")');
  assert.equal(evalApp("state.session.sync_attempts.length"), 1);
  assert.deepEqual(Array.from(evalApp("state.session.sync_attempts[0].equivalent_item_ids")), [first.id, second.id]);
  assert.equal(evalApp("state.session.attempt_count"), 2);

  context.singleQuestion = singleQuestion;
  evalApp('beginSession([singleQuestion], "learn", "curated", "Test", { availableCount: 1 })');
  evalApp('submitAnswer("fout")');
  assert.equal(evalApp("state.session.phase"), "correction");
  assert.match(feedback.innerHTML, /l’amie/, "learn mode reveals the model answer after an error");
  assert.equal(evalApp("state.session.questions.length"), 2, "learn mode requeues the wrong variant");
  assert.equal(evalApp("state.session.sync_attempts[0].mode"), "learn");
  assert.equal(evalApp("currentMasteryRecords().get(window.MonParcoursMastery.keyFor(singleQuestion.stableItemId, singleQuestion.variantId)).independentAttempts"), 0);

  evalApp('beginSession([singleQuestion], "test", "curated", "Test", { availableCount: 1 })');
  assert.match(appElement.innerHTML, /Tu verras ton résultat à la fin/);
  evalApp('submitAnswer("L’AMIE")');
  assert.equal(evalApp("state.session.sync_attempts[0].was_correct"), true);
  assert.equal(evalApp("state.session.sync_attempts[0].mode"), "test");
  assert.equal(JSON.stringify(course), originalCourse);
  console.log("Exercise-variant datamodel, grading, multi-gap evidence and integration regression passed.");
});
