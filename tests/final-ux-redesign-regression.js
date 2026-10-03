const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));

const appElement = { innerHTML: "", focus() {} };
const picker = { innerHTML: "" };
const identityMessage = { innerHTML: "" };
const identityCurrent = { innerHTML: "" };
const identityLabel = { innerHTML: "" };
const identityFields = { hidden: false };
const methodFields = { hidden: false, querySelectorAll() { return []; } };
const identityDialog = {
  open: true,
  closeCount: 0,
  showModal() { this.open = true; },
  close() { this.open = false; this.closeCount += 1; }
};
const submitButton = { disabled: false };
const identityForm = {
  elements: { identity_method: { value: "school_email" } },
  values: { identity_method: "school_email", school_email: "leerling@camposturnhout.be" },
  querySelectorAll() { return [submitButton]; },
  reset() { this.wasReset = true; }
};
const scheduled = [];
let identity = { provider: "local", subject: "local", displayName: "Lokale leerling", className: "", verified: false };
let selectedExercise = "verb-nl-inf";
let nextIdentityProvider = "school_email";

const context = vm.createContext({
  console,
  setTimeout(fn, delay) { scheduled.push({ fn, delay }); return scheduled.length; },
  clearTimeout() {},
  navigator: { onLine: true },
  FormData: class {
    constructor(form) { this.form = form; }
    get(name) { return this.form.values[name]; }
  },
  document: {
    visibilityState: "visible",
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return { showModal() {}, close() {} };
      if (selector === "#identity-dialog") return identityDialog;
      if (selector === "#identityButton") return { addEventListener() {} };
      if (selector === "#identity-label") return identityLabel;
      if (selector === "#identity-current") return identityCurrent;
      if (selector === "#identity-fields") return identityFields;
      if (selector === "#school-email-fields" || selector === "#school-code-fields") return methodFields;
      if (selector === "#identity-message") return identityMessage;
      if (selector === "#switch-student-button") return { hidden: true };
      if (selector === "#strict-accents") return { checked: true, disabled: false };
      if (selector === "#session-size-picker") return picker;
      if (selector === 'input[name="exercise"]:checked') return { value: selectedExercise };
      if (selector === 'input[name="session-size"]:checked') return { value: "10" };
      if (selector === "#session-plan") return { innerHTML: "" };
      return null;
    }
  },
  window: {
    addEventListener() {},
    scrollTo() {},
    confirm() { return false; },
    StudentIdentity: {
      getCurrentStudentIdentity() { return identity; },
      isRemoteAvailable() { return true; },
      async connectFromForm() {
        identity = { provider: nextIdentityProvider, subject: "student-1", displayName: "Hakki Anouar", className: "1AB", verified: true };
        return identity;
      }
    },
    MonParcoursSync: { createId() { return "00000000-0000-4000-8000-000000000001"; }, scheduleFlush() {} }
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  fetch: async function () { return { ok: true, json: async function () { return structuredClone(course); } }; }
});
context.identityForm = identityForm;

vm.runInContext(source, context);
function evaluate(code) { return vm.runInContext(code, context); }

(async function () {
  await new Promise(function (resolve) { setImmediate(resolve); });

  const home = appElement.innerHTML;
  assert.match(home, /Que veux-tu travailler/);
  assert.match(home, /Wat wil je oefenen/);
  assert.doesNotMatch(home, /Suis le même ordre|1036 éléments du cours|hero-note/);
  assert.equal((home.match(/data-action="select-trajectory"/g) || []).length, 6, "alle zes Trajets blijven selecteerbaar");
  assert.equal((home.match(/<span class="journey-step/g) || []).length, 4, "de stappenbalk bevat vier stappen");
  assert.match(home, /journey-step is-active[^>]*aria-current="step"/);
  assert.match(home, /class="home-browser"/);
  const firstTrajectoryCard = home.match(/<button class="trajectory-card"[\s\S]*?<\/button>/)[0];
  assert.equal((firstTrajectoryCard.match(/Trajet 1/g) || []).length, 1, "een Trajetnaam wordt niet dubbel getoond");
  assert.match(home, /class="unit-list"/);

  const paroleUnit = course.trajectories[0].units.find(function (unit) { return unit.top_category === "Atelier Parole"; });
  evaluate("state.trajectoryIndex = 0; state.selectedUnitOrder = " + paroleUnit.order + "; renderUnit()");
  const parole = appElement.innerHTML;
  assert.match(parole, /scope-choice-grid/);
  assert.match(parole, /Vocabulaire/);
  assert.match(parole, /Expressions/);
  assert.match(parole, /Se présenter/);
  assert.match(parole, /Présenter quelqu’un \(1\)/);
  assert.match(parole, /Woordenschat/);
  assert.match(parole, /Uitdrukkingen/);
  assert.match(parole, /Zich voorstellen/);
  assert.match(parole, /Iemand voorstellen \(1\)/);
  assert.doesNotMatch(parole, />Choisir</);
  assert.doesNotMatch(parole, /Tout le bloc/, "een blok met exact dezelfde itemset als de partie krijgt geen dubbele actie");
  assert.match(parole, /journey-step is-active[^>]*aria-current="step"[\s\S]*Contenu/);

  const verbUnit = course.trajectories[0].units.find(function (unit) { return unit.top_category === "Atelier Verbes"; });
  evaluate("state.selectedUnitOrder = " + verbUnit.order + "; renderUnit()");
  const verbContent = appElement.innerHTML;
  assert.match(verbContent, /Verbes en -ER[\s\S]*22 éléments/);
  assert.match(verbContent, /Être et avoir[\s\S]*2 éléments/);
  assert.doesNotMatch(verbContent, /Tout le bloc[\s\S]*24/, "ook de 24 werkwoorden krijgen geen dubbele partie- en blokactie");
  const erItems = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), { block: 'À retenir', subsection: 'On se rappelle ?', category: 'verbes en -ER' })");
  const auxiliaryItems = evaluate("exerciseItemsForScope(currentTrajectory(), currentUnit(), { block: 'À retenir', subsection: 'On se rappelle ?', category: 'être / avoir' })");
  assert.equal(erItems.length, 22);
  assert.deepEqual(Array.from(auxiliaryItems, function (item) { return item.infinitive; }).sort(), ["avoir", "être"]);
  assert.match(verbContent, /data-action="step-trajectory"/);
  assert.match(verbContent, /data-action="step-part"/);
  context.stepControl = { closest() { return { dataset: { action: "step-part" } }; } };
  evaluate("handleClick({ target: stepControl })");
  assert.match(appElement.innerHTML, /class="home-browser"/, "de stap Partie navigeert terug naar de onderdelen");

  evaluate("state.selectedUnitOrder = " + verbUnit.order + "; state.selectedScope = { block: 'À retenir', subsection: 'On se rappelle ?', category: '', title: 'On se rappelle ?' }; renderSetup()");
  const setup = appElement.innerHTML;
  assert.match(setup, /Néerlandais → français/);
  assert.match(setup, /Français → néerlandais/);
  assert.match(setup, /Conjuguer depuis le néerlandais/);
  assert.match(setup, /Conjuguer depuis le français/);
  assert.match(setup, /data-action="step-content"/);
  assert.equal((setup.match(/class="mode-card"/g) || []).length, 3);
  assert.match(setup, /Apprendre/);
  assert.match(setup, /S&#39;entraîner/);
  assert.match(setup, /Se tester/);
  assert.match(picker.innerHTML, /value="10"[^>]*><span>10<\/span>/);
  assert.match(picker.innerHTML, /Tous les 24/);
  assert.doesNotMatch(picker.innerHTML, /<span class="ui-fr" lang="fr">10<\/span>/, "cijfers worden niet dubbel vertaald");

  assert.match(css, /\.journey-steps[^}]*grid-template-columns:\s*repeat\(4, 1fr\)/);
  assert.match(css, /\.trajectory-grid[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/);
  assert.match(css, /\.home-browser[^}]*grid-template-columns:\s*minmax\(250px, 330px\)/);
  assert.match(css, /\.home-browser \.trajectory-grid[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.scope-choice-grid[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.trajectory-grid\s*\{[^}]*grid-template-columns:\s*1fr/);

  identity = { provider: "local", subject: "local", displayName: "Lokale leerling", className: "", verified: false };
  identityDialog.open = true;
  identityDialog.closeCount = 0;
  evaluate("state.trajectoryIndex = 0; state.selectedUnitOrder = " + paroleUnit.order + "; state.pendingStartAction = { kind: 'open_setup', trajectoryIndex: 0, unitOrder: " + paroleUnit.order + ", scope: { block: 'À retenir', subsection: 'Actes de parole', category: 'Se présenter', title: 'Se présenter' } }");
  await evaluate("submitStudentIdentity(identityForm)");
  assert.match(identityMessage.innerHTML, /Connexion réussie/);
  assert.equal(identityDialog.closeCount, 0, "de successtatus blijft kort zichtbaar");
  const completion = scheduled.find(function (timer) { return timer.delay >= 500 && timer.delay <= 800; });
  assert.ok(completion, "de loginmodal plant automatisch sluiten binnen 500–800 ms");
  completion.fn();
  assert.equal(identityDialog.closeCount, 1, "de loginmodal sluit automatisch");
  assert.equal(evaluate("state.pendingStartAction"), null, "de pending oefenactie wordt hervat");
  assert.match(appElement.innerHTML, /Se présenter/);
  assert.match(identityLabel.innerHTML, /Hakki Anouar/);

  nextIdentityProvider = "school_code";
  identityForm.values.identity_method = "school_code";
  identityDialog.open = true;
  identityDialog.closeCount = 0;
  const timerCountBeforeFallback = scheduled.length;
  await evaluate("submitStudentIdentity(identityForm)");
  assert.match(identityMessage.innerHTML, /Code de dépannage accepté/);
  const fallbackCompletion = scheduled.slice(timerCountBeforeFallback).find(function (timer) { return timer.delay >= 500 && timer.delay <= 800; });
  assert.ok(fallbackCompletion, "ook fallbackcode-login plant automatisch sluiten");
  fallbackCompletion.fn();
  assert.equal(identityDialog.closeCount, 1, "ook fallbackcode-login sluit de modal automatisch");

  console.log("FINALE UX-REDESIGNREGRESSIE GESLAAGD");
  console.log("Login-afsluiting, pending actie, stappenbalk, Trajets, compacte onderdelen, expliciete scopes, Verbes, modi, aantallen en responsive CSS gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
