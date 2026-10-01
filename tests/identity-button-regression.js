const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const storage = new Map([
  ["monParcoursIdentityPromptSeenV1", "1"],
  ["monParcoursProgressV1", JSON.stringify({ attempted: 7, correct: 5, wrong: 2, items: {}, settings: { strictAccents: true, sessionSize: 20 } })],
  ["monParcoursSyncQueueV1", JSON.stringify([{ client_session_id: "pending-session" }])]
]);
const documentListeners = { click: [], submit: [], change: [] };
const buttonListeners = { click: [] };
const appElement = { innerHTML: "", focus() {} };
const strictToggle = { checked: true, disabled: false };
const settingsDialog = { showModal() {}, close() {} };
const identityDialog = {
  showCount: 0,
  closeCount: 0,
  showModal() { this.showCount += 1; },
  close() { this.closeCount += 1; }
};
const identityButton = {
  addEventListener(type, listener) { buttonListeners[type].push(listener); },
  click() {
    const event = { propagationStopped: false, stopPropagation() { this.propagationStopped = true; } };
    buttonListeners.click.forEach(function (listener) { listener(event); });
    return event;
  }
};
const identityLabel = { textContent: "Lokaal" };
const identityCurrent = { textContent: "" };
const identityFields = { hidden: false };
const identityMessage = { textContent: "" };
const submitButton = { disabled: false };
const identityForm = {
  id: "identity-form",
  values: { identity_method: "school_code", class_code: "KLAS1A", student_code: "K7M9-P4Q2" },
  querySelector(selector) { return selector === 'button[type="submit"]' ? submitButton : null; },
  reset() { this.wasReset = true; }
};

let configured = true;
let verificationResult = [{
  verified: true,
  identity: { subject: "11111111-1111-4111-8111-111111111111", display_name: "Ada", class_name: "1A" }
}];
let flushCount = 0;

const windowObject = {
  scrollTo() {},
  confirm() { return false; },
  MonParcoursSupabase: {
    isConfigured() { return configured; },
    async rpc(name, parameters) {
      assert.equal(name, "verify_student_identity");
      assert.equal(parameters.p_class_code, "KLAS1A");
      assert.equal(parameters.p_student_code, "K7M9-P4Q2");
      return verificationResult;
    }
  },
  MonParcoursSync: { scheduleFlush() { flushCount += 1; } }
};

const elements = {
  "#app": appElement,
  "#settings-dialog": settingsDialog,
  "#identity-dialog": identityDialog,
  "#identityButton": identityButton,
  "#identity-label": identityLabel,
  "#identity-current": identityCurrent,
  "#identity-fields": identityFields,
  "#identity-message": identityMessage,
  "#strict-accents": strictToggle
};

const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  window: windowObject,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  document: {
    querySelector(selector) { return elements[selector] || null; },
    addEventListener(type, listener) { documentListeners[type].push(listener); }
  },
  FormData: class {
    constructor(form) { this.form = form; }
    get(name) { return this.form.values[name]; }
  },
  fetch: async function () {
    return { ok: true, json: async function () { return structuredClone(course); } };
  }
});

function waitForAsyncWork() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

(async function () {
  assert.match(html, /id="identityButton"/);
  const scriptOrder = ["@supabase/supabase-js@2", "config.js", "supabase-client.js", "student-identity.js", "sync-manager.js", "app.js"]
    .map(function (name) { return html.indexOf(name); });
  assert.ok(scriptOrder.every(function (position, index) { return position >= 0 && (!index || position > scriptOrder[index - 1]); }));

  vm.runInContext(fs.readFileSync("student-identity.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("app.js", "utf8"), context);
  await waitForAsyncWork();

  assert.equal(buttonListeners.click.length, 1, "#identityButton moet een directe click-handler hebben");
  const clickEvent = identityButton.click();
  assert.equal(clickEvent.propagationStopped, true, "de gedelegeerde handler mag dezelfde klik niet dubbel verwerken");
  assert.equal(identityDialog.showCount, 1);
  assert.equal(identityFields.hidden, false);
  assert.match(identityMessage.textContent, /schoolmail/);

  let prevented = false;
  documentListeners.submit[0]({ target: identityForm, preventDefault() { prevented = true; } });
  await waitForAsyncWork();
  assert.equal(prevented, true);
  assert.equal(windowObject.StudentIdentity.getCurrentStudentIdentity().provider, "school_code");
  assert.equal(identityLabel.textContent, "Ada");
  assert.equal(identityCurrent.textContent, "Ada · 1A");
  assert.match(identityMessage.textContent, /Gelukt/);
  assert.equal(identityForm.wasReset, true);
  assert.ok(flushCount >= 2, "initialisatie en koppeling moeten de syncqueue laten proberen");

  identityButton.click();
  assert.equal(identityDialog.showCount, 2, "de gekoppelde leerling moet via dezelfde knop gewisseld kunnen worden");
  verificationResult = [{
    verified: true,
    identity: { subject: "22222222-2222-4222-8222-222222222222", display_name: "Bruno", class_name: "1B" }
  }];
  documentListeners.submit[0]({ target: identityForm, preventDefault() {} });
  await waitForAsyncWork();
  assert.equal(identityLabel.textContent, "Bruno");
  assert.equal(identityCurrent.textContent, "Bruno · 1B");

  verificationResult = [];
  windowObject.StudentIdentity.switchToLocal();
  identityForm.values = { identity_method: "school_code", class_code: "KLAS1A", student_code: "K7M9-P4Q2" };
  documentListeners.submit[0]({ target: identityForm, preventDefault() {} });
  await waitForAsyncWork();
  assert.match(identityMessage.textContent, /combinatie werd niet gevonden/);

  configured = false;
  identityButton.click();
  assert.equal(identityFields.hidden, true);
  assert.match(identityMessage.textContent, /volledig lokaal gebruiken/);
  assert.equal(windowObject.StudentIdentity.getCurrentStudentIdentity().provider, "local");
  assert.equal(JSON.parse(storage.get("monParcoursProgressV1")).attempted, 7);
  assert.equal(JSON.parse(storage.get("monParcoursSyncQueueV1"))[0].client_session_id, "pending-session");
  assert.match(appElement.innerHTML, /Trajet 1/);

  console.log("IDENTITY-BUTTON-REGRESSIE GESLAAGD");
  console.log("Directe click-handler, dialoog, verificatie, wisselen, foutmelding en lokale fallback gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
