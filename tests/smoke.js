const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const appElement = { innerHTML: "", focus() {} };
const settingsDialog = { showModal() {}, close() {} };
const strictToggle = { checked: true, addEventListener() {} };
const storage = new Map();

const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FormData: class {},
  document: {
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return settingsDialog;
      if (selector === "#strict-accents") return strictToggle;
      return null;
    }
  },
  window: {
    scrollTo() {},
    confirm() { return false; }
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

setImmediate(function () {
  assert.equal(vm.runInContext("state.data.trajectories.length", context), 3);
  assert.equal(vm.runInContext("state.data.trajectories.reduce((n, t) => n + t.items.length, 0)", context), 520);
  assert.match(appElement.innerHTML, /Trajet 1/);
  assert.match(appElement.innerHTML, /Atelier Parole/);
  assert.match(appElement.innerHTML, /Action !/);

  const typeCounts = vm.runInContext(
    "state.data.trajectories.flatMap(t => t.items).reduce((a, i) => (a[i.type] = (a[i.type] || 0) + 1, a), {})",
    context
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(typeCounts)),
    { vocabulary: 255, verb: 52, grammar_rule: 33, phrase: 72, number: 101, sound_rule: 7 }
  );

  const generated = vm.runInContext(
    "Object.keys(EXERCISES).map(key => [key, buildQuestions(state.data.trajectories.flatMap(t => t.items).filter(i => i.type === EXERCISES[key].type), key).length])",
    context
  );
  generated.forEach(function (entry) {
    assert.ok(entry[1] > 0, entry[0] + " moet vragen opleveren");
  });

  const conjugationCount = course.trajectories
    .flatMap(function (trajectory) { return trajectory.items; })
    .filter(function (item) { return item.type === "verb"; })
    .reduce(function (sum, item) { return sum + item.conjugations.length; }, 0);
  assert.equal(Object.fromEntries(generated)["verb-fr-conj"], conjugationCount);
  assert.equal(Object.fromEntries(generated)["verb-nl-conj"], conjugationCount);

  const synonymQuestion = vm.runInContext(
    '(() => { const items = state.data.trajectories[0].items.filter(i => i.type === "vocabulary" && i.lesson === "Se présenter / Présenter quelqu’un (1)" && i.block === "À retenir" && i.subsection === "On se rappelle ?"); return buildQuestions(items, "vocab-nl-fr").find(q => q.prompt === "de vriendin"); })()',
    context
  );
  assert.deepEqual(
    Array.from(synonymQuestion.answers),
    ["l’amie", "la copine"]
  );
  assert.equal(synonymQuestion.itemIds.length, 2);
  vm.runInContext("state.progress.settings.strictAccents = true", context);
  context.synonymQuestion = synonymQuestion;
  assert.equal(vm.runInContext('isCorrect("l’amie", synonymQuestion.answers)', context), true);
  assert.equal(vm.runInContext('isCorrect("la copine", synonymQuestion.answers)', context), true);

  const articleQuestions = vm.runInContext(
    '(() => { const items = state.data.trajectories[0].items.filter(i => i.type === "grammar_rule"); return buildQuestions(items, "grammar").filter(q => q.prompt === "mannelijk enkelvoud"); })()',
    context
  );
  assert.equal(articleQuestions.length, 2);
  assert.ok(articleQuestions.some(function (question) { return question.instruction.includes("articles indéfinis") && question.answers.includes("un"); }));
  assert.ok(articleQuestions.some(function (question) { return question.instruction.includes("articles définis") && question.answers.includes("le"); }));

  assert.equal(vm.runInContext('isCorrect("école", ["école"])', context), true);
  assert.equal(vm.runInContext('isCorrect("ecole", ["école"])', context), false);
  vm.runInContext("state.progress.settings.strictAccents = false", context);
  assert.equal(vm.runInContext('isCorrect("ecole", ["école"])', context), true);
  assert.equal(vm.runInContext('isCorrect("âge", ["l’âge"])', context), false);

  assert.equal(
    vm.runInContext(
      '(() => { const i = state.data.trajectories.flatMap(t => t.items).find(i => i.type === "number" && i.nl === "70"); return isCorrect("soixante-dix", answerList(i.fr, i)); })()',
      context
    ),
    true
  );

  vm.runInContext("state.trajectoryIndex = 1; renderHome()", context);
  assert.match(appElement.innerHTML, /On joue !/);
  assert.match(appElement.innerHTML, /Bonne mémoire \?/);
  vm.runInContext("state.trajectoryIndex = 2; renderHome()", context);
  assert.match(appElement.innerHTML, /L’article contracté/);

  const progress = vm.runInContext("defaultProgress()", context);
  assert.equal(progress.attempted, 0);
  assert.equal(progress.settings.strictAccents, true);
  assert.equal(typeof context.localStorage.setItem, "function");

  console.log("Smoke tests geslaagd: cursusstructuur, 10 oefenvormen, antwoorden, accenten, vervoegingen en voortgang.");
});
