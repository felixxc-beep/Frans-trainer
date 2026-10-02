const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const migration = fs.readFileSync("supabase/phase5-active-time.sql", "utf8");
const appSource = fs.readFileSync("app.js", "utf8");
const teacherSource = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));

assert.match(migration, /add column if not exists active_duration_seconds integer/i);
assert.match(migration, /active_duration_seconds = case[\s\S]*greatest\(existing_session\.active_duration_seconds, excluded\.active_duration_seconds\)/i, "retries mogen tijd niet cumulatief optellen");
assert.match(migration, /on conflict \(student_id, client_session_id\) do update/i);
assert.match(migration, /private\.ingest_practice_bundle_impl[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(migration, /reason', 'inactive'/i);
assert.doesNotMatch(migration, /submitted_answer/i);
assert.match(html, /href="\.\/teacher\.html"/);
assert.doesNotMatch(html, /teacher[^\n]*(password|wachtwoord).*input/i, "leerlingpagina mag geen leerkrachtlogin bevatten");
assert.match(teacherSource, /practice_sessions:[^\n]*active_duration_seconds/);
assert.match(teacherSource, /Oefeningen gemaakt/);
assert.match(teacherSource, /Actieve oefentijd/);
assert.match(teacherSource, /Actieve tijd \(seconden\)/);

let now = 0;
let identity = { provider: "local", subject: "device", displayName: "Lokaal", className: "", verified: false };
let configured = true;
const storage = new Map();
const snapshots = [];
const listeners = { click: [], submit: [], change: [], input: [], visibilitychange: [] };
const appElement = { innerHTML: "", focus() {} };
const identityDialog = { open: false, showCount: 0, showModal() { this.open = true; this.showCount += 1; }, close() { this.open = false; } };
const basicFieldGroup = { hidden: false, querySelectorAll() { return []; } };
const message = { innerHTML: "", textContent: "" };
const selectedExercise = { value: "vocab-nl-fr" };
const selectedSize = { value: "10" };
const documentObject = {
  visibilityState: "visible",
  addEventListener(type, handler) { if (listeners[type]) listeners[type].push(handler); },
  querySelector(selector) {
    if (selector === "#app") return appElement;
    if (selector === "#strict-accents") return { checked: true, disabled: false };
    if (selector === "#settings-dialog") return { showModal() {}, close() {} };
    if (selector === "#identity-dialog") return identityDialog;
    if (selector === "#identity-fields") return basicFieldGroup;
    if (selector === "#school-email-fields" || selector === "#school-code-fields") return basicFieldGroup;
    if (selector === "#identity-message") return message;
    if (selector === 'input[name="exercise"]:checked') return selectedExercise;
    if (selector === 'input[name="session-size"]:checked') return selectedSize;
    if (selector === "#answer-input") return { value: "", disabled: false, focus() {} };
    if (selector === ".submit-button") return { hidden: false };
    if (selector === "#feedback") return { className: "", innerHTML: "", querySelector() { return { focus() {} }; } };
    return null;
  }
};
const windowObject = {
  performance: { now() { return now; } },
  addEventListener() {},
  scrollTo() {},
  confirm() { return false; },
  StudentIdentity: {
    getCurrentStudentIdentity() { return identity; },
    isRemoteAvailable() { return configured; },
    getSyncCredential() { return identity.verified ? identity.subject : null; },
    switchToLocal() { identity = { provider: "local", subject: "device", verified: false }; }
  },
  MonParcoursSync: {
    createId() { return "00000000-0000-4000-8000-" + String(snapshots.length + 1).padStart(12, "0"); },
    enqueueSession(snapshot) { snapshots.push(structuredClone(snapshot)); return true; },
    scheduleFlush() {}
  }
};
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  structuredClone,
  FormData: class {},
  navigator: { onLine: true },
  document: documentObject,
  window: windowObject,
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function () { return { ok: true, json: async function () { return structuredClone(course); } }; }
});

vm.runInContext(appSource, context);
function evaluate(code) { return vm.runInContext(code, context); }

setImmediate(function () {
  context.testQuestion = evaluate('buildQuestions([state.data.trajectories[0].items.find(i => i.type === "vocabulary")], "vocab-nl-fr")[0]');

  evaluate('state.trajectoryIndex = 0; state.selectedUnitOrder = state.data.trajectories[0].units[0].order; state.selectedScope = { block: "À retenir", subsection: "On se rappelle ?", title: "On se rappelle ?" }; startSession("test")');
  assert.equal(evaluate("state.session"), null, "zonder schoolmail mag geen sessie starten");
  assert.equal(identityDialog.showCount, 1, "de loginmodal moet openen");
  assert.equal(evaluate("state.pendingStartAction.kind"), "setup");
  evaluate("state.trajectoryIndex = 2; state.selectedScope = null");

  identity = { provider: "school_email", subject: "student-token", displayName: "Emma", className: "1AA", verified: true };
  assert.equal(evaluate("resumePendingStartAction()"), true);
  const sessionId = evaluate("state.session.client_session_id");
  assert.ok(sessionId, "de gewenste sessie moet na schoolmaillogin starten");
  assert.equal(evaluate("state.trajectoryIndex"), 0);
  assert.equal(evaluate("state.session.mode"), "test");
  assert.equal(evaluate("state.session.question_count"), 10);
  assert.equal(evaluate("state.selectedScope.subsection"), "On se rappelle ?");

  now = 42000;
  evaluate("settleActiveTime(true)");
  assert.equal(evaluate("state.session.active_duration_seconds"), 42);

  now = 142000;
  evaluate("markPracticeActivity()");
  now = 147000;
  evaluate("settleActiveTime(true)");
  assert.equal(evaluate("state.session.active_duration_seconds"), 47, "terugkeer telt pas na een nieuwe interactie");

  now = 247000;
  evaluate("markPracticeActivity()");
  now = 367000;
  evaluate("settleActiveTime(true)");
  assert.equal(evaluate("state.session.active_duration_seconds"), 107, "inactiviteit mag maximaal zestig seconden doorlopen");

  evaluate("markPracticeActivity()");
  documentObject.visibilityState = "hidden";
  now = 377000;
  evaluate("handleVisibilityChange()");
  const hiddenSeconds = evaluate("state.session.active_duration_seconds");
  documentObject.visibilityState = "visible";
  now = 477000;
  evaluate("settleActiveTime(false)");
  assert.equal(evaluate("state.session.active_duration_seconds"), hiddenSeconds, "een verborgen tab en terugkeer zonder interactie tellen niet");

  evaluate("syncSessionSnapshot()");
  evaluate("syncSessionSnapshot()");
  assert.equal(snapshots.at(-1).session.active_duration_seconds, hiddenSeconds);
  assert.equal(snapshots.at(-2).session.active_duration_seconds, hiddenSeconds, "een retry mag de tijd niet verdubbelen");
  assert.ok(storage.has("monParcoursActiveSessionV1"));
  const storedId = JSON.parse(storage.get("monParcoursActiveSessionV1")).client_session_id;
  assert.equal(storedId, sessionId);

  evaluate("state.session = null");
  assert.equal(evaluate("restoreActiveSession()"), true);
  assert.equal(evaluate("state.session.client_session_id"), sessionId, "refresh moet dezelfde sessie-id hervatten");
  assert.equal(evaluate("state.session.activeClockRunning"), false, "refresh mag tijd niet automatisch opnieuw starten");

  evaluate("leaveSessionUnfinished()");
  assert.equal(evaluate("state.session"), null);
  assert.equal(storage.has("monParcoursActiveSessionV1"), false);
  assert.equal(snapshots.at(-1).session.finished_at, null, "verlaten sessie blijft herkenbaar als onvoltooid");

  identity = { provider: "school_code", subject: "student-token", displayName: "Emma", className: "1AA", verified: true };
  evaluate('beginSession([testQuestion], "learn", "vocab-nl-fr", "Legacy", { availableCount: 1 })');
  assert.equal(evaluate("state.session"), null, "code-login alleen mag geen normale sessie starten");

  identity = { provider: "school_email", subject: "student-token", displayName: "Emma", className: "1AA", verified: true };
  configured = false;
  evaluate('beginSession([testQuestion], "learn", "vocab-nl-fr", "Offline", { availableCount: 1 })');
  assert.ok(evaluate("state.session"), "eerder gekoppelde schoolmail moet offline kunnen oefenen");

  const teacherContext = vm.createContext({ window: { MON_PARCOURS_TEACHER_TEST: true }, document: {}, console, Blob: class {}, URL: {}, Uint8Array });
  vm.runInContext(teacherSource, teacherContext);
  const api = teacherContext.window.MonParcoursTeacher;
  const sessions = [
    { id: "s1", question_count: 20, active_duration_seconds: 754 },
    { id: "s2", question_count: 10, active_duration_seconds: null }
  ];
  const attempts = [];
  for (let index = 0; index < 6; index += 1) attempts.push({ session_id: "s1", item_id: "item-" + index, item_variant: "", was_correct: index > 1 });
  assert.equal(api.sessionStats(sessions[0], attempts).exercisesMade, 6, "20 geselecteerd en 6 beantwoord moet gemaakt = 6 geven");
  attempts.push({ session_id: "s1", item_id: "item-0", item_variant: "", was_correct: true });
  assert.equal(api.sessionStats(sessions[0], attempts).exercisesMade, 6, "een herhaling verhoogt pogingen maar niet gemaakt");
  attempts.push({ session_id: "s1", item_id: "item-0", item_variant: "17", was_correct: true });
  assert.equal(api.sessionStats(sessions[0], attempts).exercisesMade, 7, "item_variant moet een aparte oefening onderscheiden");
  attempts.push({ session_id: "s2", item_id: "item-0", item_variant: "", was_correct: true });
  const summary = api.summarize(sessions, attempts);
  assert.equal(summary.questions, 30);
  assert.equal(summary.exercisesMade, 8, "uniek per sessie en itemvariant");
  assert.equal(summary.attempts, 9);
  assert.equal(summary.activeDurationSeconds, 754);
  assert.equal(api.formatActiveDuration(42), "42 s");
  assert.equal(api.formatActiveDuration(754), "12 min 34 s");
  assert.equal(api.formatActiveDuration(4080), "1 u 08 min");
  assert.equal(api.formatActiveDuration(null), "—");

  const filteredRaw = {
    classes: [{ id: "c1", name: "1AA", is_active: true }],
    students: [{ id: "student", class_id: "c1", is_active: true }],
    sessions: [
      { id: "filter-1", student_id: "student", trajectory: "Trajet 1", mode: "learn", top_category: "Atelier Parole", subsection: "Actes de parole", question_count: 10, active_duration_seconds: 30, started_at: "2026-10-01T10:00:00Z" },
      { id: "filter-2", student_id: "student", trajectory: "Trajet 2", mode: "test", top_category: "Atelier Grammaire", subsection: "On découvre !", question_count: 20, active_duration_seconds: 90, started_at: "2026-10-01T11:00:00Z" }
    ],
    attempts: [
      { session_id: "filter-1", student_id: "student", item_id: "a", item_variant: "", was_correct: true },
      { session_id: "filter-2", student_id: "student", item_id: "b", item_variant: "", was_correct: false }
    ]
  };
  const filtered = api.filterDataset(filteredRaw, { period: "all", trajectory: "Trajet 1", mode: "all", classId: "all", studentId: "all", studentStatus: "active", category: "all", subsection: "all" }, "2026-10-02T12:00:00Z");
  const filteredSummary = api.summarize(filtered.sessions, filtered.attempts);
  assert.equal(filteredSummary.exercisesMade, 1);
  assert.equal(filteredSummary.attempts, 1);
  assert.equal(filteredSummary.activeDurationSeconds, 30, "filters moeten tijd en aantallen op dezelfde dataset berekenen");

  console.log("FASE 5B IDENTITEIT-, TIJD- EN STATISTIEKREGRESSIE GESLAAGD");
  console.log("Verplichte schoolmail, offline hervatten, 60-secondenregel, refresh-idempotentie, gemaakte oefeningen, dashboardtijd en migratie gecontroleerd.");
});
