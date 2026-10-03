const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const source = fs.readFileSync("app.js", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));

assert.match(html, /lang="fr">Tableau de bord enseignant/);
assert.match(html, /lang="nl">Leerkrachtendashboard/);
assert.match(html, /Adresse e-mail scolaire[\s\S]*Schoolmailadres/);
assert.match(html, /Se connecter et continuer[\s\S]*Aanmelden en verdergaan/);
assert.match(html, /Utiliser un code élève[\s\S]*Aanmelden met leerlingcode/);
assert.match(css, /\.ui-nl[^}]*font-size:\s*\.78em[^}]*font-style:\s*italic/);
assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.ui-bilingual/);
assert.match(css, /\.hero > div\s*\{[^}]*max-width:\s*700px/, "het hero-tekstblok blijft rustig begrensd");
assert.match(css, /\.hero h1\s*\{[^}]*font-size:\s*clamp\(1\.9rem,\s*3vw,\s*2\.55rem\)[^}]*line-height:\s*1\.05/, "de desktopheadline is compact");
assert.match(css, /\.hero h1 \.ui-nl\s*\{[^}]*font-size:\s*\.52em/, "de Nederlandse herotitel blijft duidelijk ondersteunend");
assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.hero h1\s*\{[^}]*font-size:\s*clamp\(1\.8rem,\s*8vw,\s*2\.3rem\)/, "de hero blijft ook mobiel compact");
assert.match(html, /styles\.css\?v=20261003-1/, "de nieuwe UX-CSS krijgt een verse cacheversie");
assert.doesNotMatch(teacherHtml, /class="ui-bilingual"/, "het leerkrachtendashboard blijft Nederlandstalig");
assert.match(source, /Bonne réponse ![\s\S]*Juist!/);
assert.match(source, /Pas encore\.[\s\S]*Nog niet juist/);
assert.match(source, /sessionPlanFrench/);
assert.match(source, /modeLabelFr/);

const appElement = { innerHTML: "", focus() {} };
const feedback = { className: "", innerHTML: "", querySelector() { return { focus() {} }; } };
const input = { value: "", disabled: false, focus() {} };
const storage = new Map();
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FormData: class {},
  navigator: { onLine: true },
  document: {
    visibilityState: "visible",
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return { showModal() {}, close() {} };
      if (selector === "#strict-accents") return { checked: true, disabled: false };
      if (selector === "#answer-input") return input;
      if (selector === ".submit-button") return { hidden: false };
      if (selector === "#feedback") return feedback;
      return null;
    }
  },
  window: {
    addEventListener() {}, scrollTo() {}, confirm() { return false; },
    StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "student", displayName: "Emma", className: "1AA", verified: true }; } },
    MonParcoursSync: { createId() { return "00000000-0000-4000-8000-000000000001"; }, enqueueSession() {}, scheduleFlush() {} }
  },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function () { return { ok: true, json: async function () { return structuredClone(course); } }; }
});

vm.runInContext(source, context);
function evaluate(code) { return vm.runInContext(code, context); }

setImmediate(function () {
  assert.match(appElement.innerHTML, /Choisis ton Trajet/);
  assert.match(appElement.innerHTML, /Kies je Trajet/);
  assert.match(appElement.innerHTML, /Ma progression/);
  assert.match(appElement.innerHTML, /Mijn voortgang/);

  const unitOrder = course.trajectories[0].units[0].order;
  evaluate('state.trajectoryIndex = 0; state.selectedUnitOrder = ' + unitOrder + '; state.selectedScope = { block: "À retenir", subsection: "On se rappelle ?", title: "On se rappelle ?" }; renderSetup()');
  assert.match(appElement.innerHTML, /Que veux-tu travailler/);
  assert.match(appElement.innerHTML, /Wat wil je oefenen/);
  assert.match(appElement.innerHTML, /Apprendre/);
  assert.match(appElement.innerHTML, /Leren/);
  assert.match(appElement.innerHTML, /Combien veux-tu travailler/);
  assert.match(appElement.innerHTML, /Hoeveel wil je oefenen/);

  context.question = evaluate('questionsForSetup("vocab-nl-fr")[0]');
  evaluate('beginSession([question], "learn", "vocab-nl-fr", "Test", { availableCount: 1 })');
  assert.match(appElement.innerHTML, /Traduis en français/);
  assert.match(appElement.innerHTML, /Vertaal naar het Frans/);
  assert.match(appElement.innerHTML, /Vérifier/);
  assert.match(appElement.innerHTML, /Controleren/);

  evaluate('submitAnswer("zeker-fout")');
  assert.match(feedback.innerHTML, /Réponses possibles/);
  assert.match(feedback.innerHTML, /Mogelijke juiste antwoorden/);

  evaluate('state.session.phase = "answer"; state.session.questions = [question]; state.session.index = 0; state.session.mode = "test"; state.session.results = []; submitAnswer(question.answers[0])');
  assert.match(appElement.innerHTML, /Session terminée|Excellent résultat/);
  assert.match(appElement.innerHTML, /Sessie afgerond|Sterk resultaat/);
  assert.match(appElement.innerHTML, /Temps actif/);
  assert.match(appElement.innerHTML, /Actieve oefentijd/);

  console.log("TWEETALIGE LEERLINGINTERFACE-REGRESSIE GESLAAGD");
  console.log("Navigatie, login, sessiekeuze, modi, vraagweergave, feedback, eindscherm, mobiel en leerkrachtlink gecontroleerd.");
});
