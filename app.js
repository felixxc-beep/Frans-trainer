const DATA_URL = "./data/course.json?v=20261001-1";
const STORAGE_KEY = "monParcoursProgressV1";
const ACTIVE_SESSION_KEY = "monParcoursActiveSessionV1";
const MASTERY_ATTEMPTS_KEY = "monParcoursMasteryAttemptsV1";
const MASTERY_SERVER_CACHE_KEY = "monParcoursMasteryServerCacheV1";
const ASSIGNMENTS_CACHE_KEY = "monParcoursAssignmentsCacheV1";
const VERB_EVIDENCE_KEY = "monParcoursVerbEvidenceV1";
const VERB_SERVER_CACHE_KEY = "monParcoursVerbServerCacheV1";
const INACTIVITY_TIMEOUT_MS = 60000;
const MAX_DYNAMIC_NUMBER_ALL = 101;
const ACCENTS = ["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "ô", "î", "ï"];
const EXERCISES = {
  "assignment-mixed": { type: "mixed", label: "Taakitems", labelFr: "Éléments du devoir", short: "Taak", shortFr: "Devoir" },
  "vocab-nl-fr": { type: "vocabulary", label: "Nederlands → Frans", labelFr: "Néerlandais → français", short: "Woordenschat", shortFr: "Vocabulaire" },
  "vocab-fr-nl": { type: "vocabulary", label: "Frans → Nederlands", labelFr: "Français → néerlandais", short: "Woordenschat", shortFr: "Vocabulaire" },
  "verb-nl-inf": { type: "verb", label: "Nederlands → Frans", labelFr: "Néerlandais → français", short: "Werkwoorden", shortFr: "Verbes" },
  "verb-fr-nl": { type: "verb", label: "Frans → Nederlands", labelFr: "Français → néerlandais", short: "Werkwoorden", shortFr: "Verbes" },
  "verb-nl-conj": { type: "verb", label: "Vervoegen vanuit Nederlands", labelFr: "Conjuguer depuis le néerlandais", short: "Vervoegen", shortFr: "Conjuguer" },
  "verb-fr-conj": { type: "verb", label: "Vervoegen vanuit Frans", labelFr: "Conjuguer depuis le français", short: "Vervoegen", shortFr: "Conjuguer" },
  "verb-rule-recognition": { type: "verb", label: "De uitgangen herkennen", labelFr: "Reconnaître les terminaisons", short: "Regel", shortFr: "Règle" },
  "phrase-nl-fr": { type: "phrase", label: "Nederlandse zin → Franse zin", labelFr: "Phrase néerlandaise → phrase française", short: "Zinnen", shortFr: "Phrases" },
  "grammar": { type: "grammar_rule", label: "Grammaticaregel aanvullen", labelFr: "Compléter la règle de grammaire", short: "Grammatica", shortFr: "Grammaire" },
  "number-nl-fr": { type: "number", label: "Cijfer → Frans", labelFr: "Nombre → français", short: "Getallen", shortFr: "Nombres" },
  "number-fr-nl": { type: "number", label: "Frans → cijfer", labelFr: "Français → nombre", short: "Getallen", shortFr: "Nombres" }
};
const TYPE_EXERCISES = {
  vocabulary: ["vocab-nl-fr", "vocab-fr-nl"],
  verb: ["verb-nl-inf", "verb-fr-nl", "verb-nl-conj", "verb-fr-conj", "verb-rule-recognition"],
  phrase: ["phrase-nl-fr"],
  grammar_rule: ["grammar"],
  number: ["number-nl-fr", "number-fr-nl"]
};

const state = {
  data: null,
  trajectoryIndex: 0,
  selectedUnitOrder: null,
  selectedScope: null,
  session: null,
  pendingStartAction: null,
  activeAssignmentId: null,
  assignments: { items: [], loading: false, loaded: false },
  progress: loadProgress(),
  mastery: {
    localAttempts: loadMasteryAttempts(),
    serverRows: [],
    acceptedAttemptIds: [],
    records: null,
    refreshing: false
  },
  verbEvidence: { local: loadVerbEvidence(), server: [], refreshing: false },
  view: "loading"
};

const app = document.querySelector("#app");
const settingsDialog = document.querySelector("#settings-dialog");
const identityDialog = document.querySelector("#identity-dialog");
const identityButton = document.querySelector("#identityButton");
let identityCompletionTimer = null;
const strictToggle = document.querySelector("#strict-accents");
strictToggle.checked = state.progress.settings.strictAccents;
strictToggle.disabled = true;

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);
document.addEventListener("input", handlePracticeActivity);
document.addEventListener("visibilitychange", handleVisibilityChange);
if (window.addEventListener) window.addEventListener("pagehide", handlePageHide);
if (window.addEventListener) window.addEventListener("monparcours:sync-complete", function () {
  refreshMasteryFromServer();
  refreshVerbEvidenceFromServer();
  refreshStudentAssignments();
});
if (identityButton) identityButton.addEventListener("click", handleIdentityButtonClick);

function handleIdentityButtonClick(event) {
  event.stopPropagation();
  openIdentityDialog();
}

function handleChange(event) {
  if (event.target.name === "exercise") updateSessionSizePicker();
  if (event.target.name === "session-size") {
    state.progress.settings.sessionSize = event.target.value === "all" ? "all" : Number(event.target.value);
    saveProgress();
    updateSessionPlan();
  }
}

function handleClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (state.session && control.closest(".practice-shell")) markPracticeActivity();

  if (action === "home") {
    leaveSessionUnfinished();
    state.activeAssignmentId = null;
    renderHome();
  }
  if (action === "view-assignments") renderAssignments();
  if (action === "view-assignment") launchAssignment(control.dataset.id);
  if (action === "launch-assignment") launchAssignment(control.dataset.id);
  if (action === "open-settings") settingsDialog.showModal();
  if (action === "open-identity") openIdentityDialog();
  if (action === "close-identity" && identityDialog) identityDialog.close();
  if (action === "toggle-identity-method") setIdentityMethod(control.dataset.method || "school_email");
  if (action === "switch-student-identity") {
    if (identityCompletionTimer) clearTimeout(identityCompletionTimer);
    identityCompletionTimer = null;
    leaveSessionUnfinished();
    if (window.StudentIdentity) window.StudentIdentity.switchToLocal();
    state.mastery.serverRows = [];
    state.mastery.acceptedAttemptIds = [];
    state.verbEvidence.server = [];
    invalidateMasteryRecords();
    state.pendingStartAction = null;
    state.assignments = { items: [], loading: false, loaded: false };
    state.activeAssignmentId = null;
    localStorage.removeItem(ASSIGNMENTS_CACHE_KEY);
    const identityForm = document.querySelector("#identity-form");
    if (identityForm) identityForm.reset();
    setIdentityMethod("school_email");
    updateIdentityUi();
    const identityMessage = document.querySelector("#identity-message");
    setUiMessage(identityMessage, "L'élève précédent a été déconnecté. Connecte le nouvel élève.", "De vorige leerling is afgekoppeld. Meld de nieuwe leerling aan.");
  }
  if (action === "select-trajectory") {
    state.trajectoryIndex = Number(control.dataset.index);
    renderHome();
  }
  if (action === "select-unit") {
    state.activeAssignmentId = null;
    state.selectedUnitOrder = Number(control.dataset.order);
    renderUnit();
  }
  if (action === "back-unit") {
    leaveSessionUnfinished();
    if (state.activeAssignmentId) renderAssignmentDetail(state.activeAssignmentId);
    else renderUnit();
  }
  if (action === "step-trajectory") {
    leaveSessionUnfinished();
    renderHome();
    scrollToStepTarget("#trajectory-heading");
  }
  if (action === "step-part") {
    leaveSessionUnfinished();
    renderHome();
    scrollToStepTarget("#unit-heading");
  }
  if (action === "step-content") {
    leaveSessionUnfinished();
    renderUnit();
  }
  if (action === "choose-scope") {
    state.activeAssignmentId = null;
    state.selectedScope = {
      unitOrder: Number(control.dataset.order),
      block: control.dataset.block || "",
      subsection: control.dataset.subsection || "",
      category: control.dataset.category || "",
      itemId: control.dataset.itemId || "",
      title: control.dataset.title || ""
    };
    if (hasRequiredStudentIdentity()) renderSetup();
    else requestRequiredIdentity({
      kind: "open_setup",
      trajectoryIndex: state.trajectoryIndex,
      unitOrder: state.selectedUnitOrder,
      scope: JSON.parse(JSON.stringify(state.selectedScope))
    });
  }
  if (action === "start-session") startSession(control.dataset.mode);
  if (action === "next-question") nextQuestion();
  if (action === "insert-accent") insertAccent(control.dataset.accent);
  if (action === "view-progress") renderProgress();
  if (action === "view-difficult") renderDifficult();
  if (action === "continue-session") continueLastSession();
  if (action === "practice-test-errors") practiceTestErrors();
  if (action === "practice-difficult") practiceDifficult();
  if (action === "reset-progress") {
    if (window.confirm("Veux-tu effacer toute ta progression locale ?\n\nWil je alle lokale voortgang op dit toestel wissen?")) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MASTERY_ATTEMPTS_KEY);
      localStorage.removeItem(MASTERY_SERVER_CACHE_KEY);
      state.progress = defaultProgress();
      state.mastery.localAttempts = [];
      state.mastery.serverRows = [];
      state.mastery.acceptedAttemptIds = [];
      invalidateMasteryRecords();
      strictToggle.checked = true;
      settingsDialog.close();
      renderHome();
    }
  }
}

function handleSubmit(event) {
  if (event.target.id === "identity-form") {
    event.preventDefault();
    submitStudentIdentity(event.target);
    return;
  }
  if (event.target.id === "answer-form") {
    event.preventDefault();
    submitAnswer(new FormData(event.target).get("answer") || "");
  }
}

function currentStudentIdentity() {
  if (window.StudentIdentity) return window.StudentIdentity.getCurrentStudentIdentity();
  return { provider: "local", subject: "local", displayName: "Lokale leerling", className: "Alleen op dit toestel", verified: false };
}

function hasRequiredStudentIdentity(identity) {
  const current = identity || currentStudentIdentity();
  return current.provider === "school_email" && current.verified === true && Boolean(current.subject);
}

function updateIdentityUi() {
  const identity = currentStudentIdentity();
  const label = document.querySelector("#identity-label");
  if (label) label.innerHTML = identity.provider === "local" ? uiText("Se connecter", "Aanmelden") : escapeHtml(identity.displayName);
  const current = document.querySelector("#identity-current");
  if (current) current.innerHTML = identity.provider === "local"
    ? uiText("Connecte-toi avec ton adresse scolaire avant de commencer.", "Meld je aan met je schoolmail voordat je een oefening start.", "ui-block")
    : escapeHtml(identity.displayName + " · " + identity.className) + (identity.provider === "school_code" ? uiText("Mode dépannage", "Herstelmodus") : "");
  const switchButton = document.querySelector("#switch-student-button");
  if (switchButton) switchButton.hidden = identity.provider === "local";
}

function setIdentityMethod(method) {
  const selected = method === "school_code" ? "school_code" : "school_email";
  const form = document.querySelector("#identity-form");
  const emailFields = document.querySelector("#school-email-fields");
  const codeFields = document.querySelector("#school-code-fields");
  if (form && form.elements && form.elements.identity_method) form.elements.identity_method.value = selected;
  if (emailFields) {
    emailFields.hidden = selected !== "school_email";
    emailFields.querySelectorAll("input").forEach(function (input) { input.disabled = selected !== "school_email"; });
  }
  if (codeFields) {
    codeFields.hidden = selected !== "school_code";
    codeFields.querySelectorAll("input").forEach(function (input) { input.disabled = selected !== "school_code"; });
  }
  const message = document.querySelector("#identity-message");
  if (selected === "school_email") setUiMessage(message, "Connecte-toi avec ton adresse scolaire.", "Meld aan met je schoolmail. Je hebt geen klascode of leerlingcode nodig.");
  else setUiMessage(message, "Saisis les codes reçus de ton professeur.", "Vul de klascode en leerlingcode in die je van je leerkracht kreeg.");
}

function openIdentityDialog(requiredMessage) {
  if (!identityDialog) return;
  updateIdentityUi();
  const fields = document.querySelector("#identity-fields");
  const message = document.querySelector("#identity-message");
  const remoteAvailable = Boolean(window.StudentIdentity && window.StudentIdentity.isRemoteAvailable());
  if (fields) fields.hidden = !remoteAvailable;
  if (remoteAvailable) setIdentityMethod("school_email");
  if (remoteAvailable) {
    if (requiredMessage) setUiMessage(message, "Connecte-toi d'abord avec ton adresse scolaire pour enregistrer ta progression.", requiredMessage);
    else setUiMessage(message, "Connecte-toi avec ton adresse scolaire.", "Meld aan met je schoolmail. Je hebt geen klascode of leerlingcode nodig.");
  } else if (hasRequiredStudentIdentity()) {
    setUiMessage(message, "Ton profil déjà connecté reste utilisable hors ligne.", "Je eerder gekoppelde schoolmail blijft bruikbaar terwijl je offline bent.");
  } else {
    setUiMessage(message, "Pas de connexion. Aucun élève n'a encore été connecté sur cet appareil.", "Geen internetverbinding. Op dit toestel is nog geen leerling met schoolmail gekoppeld; een oefening starten kan nu niet.");
  }
  identityDialog.showModal();
}

function requestRequiredIdentity(pendingAction) {
  state.pendingStartAction = pendingAction || state.pendingStartAction;
  openIdentityDialog("Meld je eerst aan met je schoolmail zodat je voortgang wordt bewaard.");
}

function resumePendingStartAction() {
  const pending = state.pendingStartAction;
  if (!pending || !hasRequiredStudentIdentity()) return false;
  state.pendingStartAction = null;
  if (identityDialog && identityDialog.open) identityDialog.close();
  if (pending.kind === "setup") {
    state.trajectoryIndex = pending.trajectoryIndex;
    state.selectedUnitOrder = pending.unitOrder;
    state.selectedScope = pending.scope;
    startSession(pending.mode, pending);
    return true;
  }
  if (pending.kind === "open_setup") {
    state.trajectoryIndex = pending.trajectoryIndex;
    state.selectedUnitOrder = pending.unitOrder;
    state.selectedScope = pending.scope;
    renderSetup();
    return true;
  }
  if (pending.kind === "prepared") {
    beginSession(pending.questions, pending.mode, pending.exerciseKey, pending.title, pending.metadata);
    return true;
  }
  if (pending.kind === "assignment") {
    if (pending.id) launchAssignment(pending.id);
    else renderAssignments();
    return true;
  }
  if (pending.kind === "assignment_launch") {
    launchAssignment(pending.id);
    return true;
  }
  return false;
}

async function submitStudentIdentity(form) {
  const message = document.querySelector("#identity-message");
  const submits = form.querySelectorAll ? Array.from(form.querySelectorAll('button[type="submit"]')) : [form.querySelector('button[type="submit"]')].filter(Boolean);
  const method = String(new FormData(form).get("identity_method") || "school_email");
  const provider = method === "school_code" ? "school_code" : "school_email";
  if (!window.StudentIdentity) return;
  submits.forEach(function (submit) { submit.disabled = true; });
  if (provider === "school_email") setUiMessage(message, "Vérification de l'adresse…", "Schoolmail controleren…");
  else setUiMessage(message, "Vérification des codes…", "Codes controleren…");
  try {
    const connectedIdentity = await window.StudentIdentity.connectFromForm(provider, form);
    if (state.session && state.session.identity_subject !== connectedIdentity.subject) leaveSessionUnfinished();
    restoreMasteryServerCache();
    restoreVerbServerCache();
    refreshMasteryFromServer();
    refreshVerbEvidenceFromServer();
    restoreAssignmentCache();
    refreshStudentAssignments();
    updateIdentityUi();
    form.reset();
    setIdentityMethod("school_email");
    if (provider === "school_email") {
      setUiMessage(message, "Connexion réussie. Ton exercice va s'ouvrir.", "Gelukt. Je oefening wordt geopend en je voortgang wordt veilig bewaard.");
      scheduleIdentityDialogCompletion(connectedIdentity, true);
    } else if (message) {
      setUiMessage(message, "Code de dépannage accepté.", "Herstelidentiteit gekoppeld. Voor een nieuwe oefensessie blijft aanmelden met schoolmail verplicht.");
      scheduleIdentityDialogCompletion(connectedIdentity, false);
    }
    if (window.MonParcoursSync) window.MonParcoursSync.scheduleFlush();
  } catch (error) {
    if (message) {
      if (error && error.message === "STUDENT_NOT_FOUND") {
        setUiMessage(message, "Ces codes sont inconnus. Vérifie-les.", "Deze combinatie werd niet gevonden. Controleer beide codes.");
      } else if (error && error.message === "STUDENT_EMAIL_NOT_FOUND") {
        setUiMessage(message, "Cette adresse scolaire est inconnue. Vérifie-la ou demande de l'aide à ton professeur.", "Dit schoolmailadres is niet bekend. Controleer het adres of vraag je leerkracht om het aan je profiel toe te voegen.");
      } else if (error && error.message === "STUDENT_INACTIVE") {
        setUiMessage(message, "Ce profil ou cette classe n'est pas actif. Demande de l'aide à ton professeur.", "Dit leerlingprofiel of deze klas is niet actief. Vraag je leerkracht om dit te controleren.");
      } else if (error && error.message === "INVALID_SCHOOL_EMAIL") {
        setUiMessage(message, "Utilise une adresse qui se termine par @camposturnhout.be.", "Gebruik een geldig schoolmailadres dat eindigt op @camposturnhout.be.");
      } else if (error && error.message === "INVALID_STUDENT_CODES") {
        setUiMessage(message, "Vérifie les codes : au moins 3 caractères pour la classe et 8 pour l'élève.", "Controleer de codes: de klascode heeft minstens 3 tekens en de leerlingcode minstens 8.");
      } else if (error && error.message === "SUPABASE_NOT_CONFIGURED") {
        setUiMessage(message, "Pas de connexion en ligne. Aucun profil scolaire n'est encore lié à cet appareil.", "Geen internetverbinding of online koppeling. Omdat op dit toestel nog geen schoolmail is gekoppeld, kun je nu geen oefening starten.");
      } else {
        if (navigator.onLine === false) setUiMessage(message, "Pas de connexion. Cette adresse ne peut pas être vérifiée maintenant.", "Geen internetverbinding. Een schoolmail die nog niet op dit toestel is gekoppeld, kan nu niet worden gecontroleerd.");
        else setUiMessage(message, "Le serveur est temporairement indisponible. Réessaie dans un instant.", "De server kon je schoolmail tijdelijk niet controleren. Probeer het over enkele ogenblikken opnieuw.");
      }
    }
  } finally {
    submits.forEach(function (submit) { submit.disabled = false; });
  }
}

function scheduleIdentityDialogCompletion(connectedIdentity, resumePending) {
  if (identityCompletionTimer) clearTimeout(identityCompletionTimer);
  const connectedSubject = connectedIdentity.subject;
  identityCompletionTimer = setTimeout(function () {
    identityCompletionTimer = null;
    const current = currentStudentIdentity();
    if (!current || current.subject !== connectedSubject) return;
    const resumed = resumePending ? resumePendingStartAction() : false;
    if (!resumed && identityDialog && identityDialog.open) identityDialog.close();
  }, 650);
}

function initializeIdentity() {
  updateIdentityUi();
  restoreMasteryServerCache();
  restoreVerbServerCache();
  restoreAssignmentCache();
  if (window.MonParcoursSync) window.MonParcoursSync.scheduleFlush();
}

async function loadCourse() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error("De cursus kon niet worden geladen (" + response.status + ").");
    const data = await response.json();
    if (!Array.isArray(data.trajectories)) throw new Error("De cursus bevat geen trajecten.");
    data.trajectories.forEach(function (trajectory, trajectoryIndex) {
      (trajectory.items || []).forEach(function (item, itemIndex) {
        item._id = trajectory.trajectory + "::" + itemIndex;
        item._trajectoryIndex = trajectoryIndex;
      });
    });
    state.data = data;
    invalidateMasteryRecords();
    if (!restoreActiveSession()) renderHome();
    refreshMasteryFromServer();
    refreshVerbEvidenceFromServer();
    refreshStudentAssignments();
  } catch (error) {
    app.innerHTML = '<section class="error-card"><p class="eyebrow">' + uiText("Échec du chargement", "Laden mislukt") + '</p><h1>' + uiText("Le cours n'a pas pu être ouvert.", "De cursus kon niet worden geopend.") + '</h1><p>' + uiText("Vérifie ta connexion puis recharge la page.", "Controleer je verbinding en laad de pagina opnieuw.") + '</p><p>' + uiText("Ouvre cette application via un serveur web local.", "Open deze map via een lokale webserver; dubbelklikken op index.html is niet voldoende.") + '</p></section>';
  }
}

function renderHome() {
  if (!state.data) return;
  state.view = "home";
  state.session = null;
  const trajectory = state.data.trajectories[state.trajectoryIndex];
  const last = state.progress.lastSession;
  const difficultCount = getDifficultItems("vocabulary").length;
  const overallMastery = masterySummaryForItems(allCourseItems());

  app.innerHTML =
    '<section class="hero">' +
      '<div><h1>' + uiText("Que veux-tu travailler ?", "Wat wil je oefenen?") + '</h1><p class="brand-tagline">' + uiText("Apprendre. S’entraîner. Progresser.", "Leren. Oefenen. Vooruitgaan.") + '</p></div>' +
    '</section>' +
    assignmentHomeSection() +
    '<section class="quick-grid" aria-label="Jouw overzicht">' +
      dashboardCard("Continuer", "Verder oefenen", last ? (last.titleFr || last.title) : "Choisis d'abord une partie", last ? (last.titleNl || last.title) : "Kies eerst een onderdeel", last ? "Reprends où tu t'es arrêté" : "Ta dernière session apparaîtra ici", last ? "Ga door waar je stopte" : "Je laatste sessie verschijnt hier", "continue-session", !last, "play") +
      dashboardCard("Mes mots difficiles", "Mijn moeilijke woorden", difficultCount + (difficultCount === 1 ? " mot" : " mots"), difficultCount + " " + (difficultCount === 1 ? "woord" : "woorden"), "Répète ce qui n'est pas encore acquis", "Herhaal wat nog niet vlot gaat", "view-difficult", false, "spark") +
      masteryDashboardCard(overallMastery) +
    '</section>' +
    journeySteps(1) +
    '<div class="home-browser">' +
    '<section aria-labelledby="trajectory-heading">' +
      '<div class="section-heading home-heading"><h2 id="trajectory-heading">' + uiText("Choisis ton Trajet", "Kies je Trajet") + '</h2></div>' +
      '<div class="trajectory-grid">' +
        state.data.trajectories.map(function (entry, index) {
          const stats = trajectoryStats(index);
          const total = (entry.items || []).length;
          const mastery = masterySummaryForItems(entry.items || []);
          return '<button class="trajectory-card" type="button" data-action="select-trajectory" data-index="' + index + '" aria-pressed="' + (index === state.trajectoryIndex) + '">' +
            '<span class="trajectory-number"><strong>' + escapeHtml(entry.trajectory) + '</strong><span class="count-badge">' + total + '</span></span>' +
            '<small class="trajectory-progress">' + uiText(stats.practiced + " / " + total + " travaillés", stats.practiced + " / " + total + " geoefend") + '</small>' + masteryBar(mastery, true) +
            '<small class="mastery-level">' + uiText(mastery.masteryLevel + "% maîtrise", "beheerst") + '</small>' +
          '</button>';
        }).join("") +
      '</div>' +
    '</section>' +
    '<section aria-labelledby="unit-heading">' +
      '<div class="section-heading home-heading"><h2 id="unit-heading">' + uiText("Parties de " + trajectory.trajectory, "Onderdelen van " + trajectory.trajectory) + '</h2><span class="step-label">' + (trajectory.items || []).length + '</span></div>' +
      '<div class="unit-list">' +
        trajectory.units.map(function (unit) {
          const count = exerciseItemCount(itemsForUnit(trajectory, unit).filter(isExerciseItem));
          const unitStats = categoryStats(state.trajectoryIndex, unit.top_category);
          const mastery = masterySummaryForItems(itemsForUnit(trajectory, unit));
          return '<button class="unit-card" type="button" data-action="select-unit" data-order="' + unit.order + '">' +
            '<span class="unit-order">' + unit.order + '</span>' +
            '<span class="unit-copy"><strong>' + contentIcon(contentTypeKey(unit.top_category)) + escapeHtml(unit.top_category) + '</strong><small>' + escapeHtml(unit.title) + '</small></span>' +
            '<span class="unit-meta">' + (mastery.total ? '<strong>' + unitStats.practiced + '/' + mastery.total + ' · ' + mastery.masteryLevel + '%</strong><span class="sr-only">' + uiText("travaillés · maîtrise", "geoefend · beheerst") + '</span>' : uiText("Information", "Cursusinfo")) + '</span>' +
          '</button>';
        }).join("") +
      '</div>' +
    '</section></div>';
  focusApp();
}

function restoreAssignmentCache() {
  const identity = currentStudentIdentity();
  try {
    const cache = JSON.parse(localStorage.getItem(ASSIGNMENTS_CACHE_KEY));
    state.assignments.items = cache && cache.identity_subject === identity.subject && Array.isArray(cache.items) ? cache.items : [];
    state.assignments.loaded = Boolean(cache && cache.identity_subject === identity.subject);
  } catch (error) {
    state.assignments.items = [];
    state.assignments.loaded = false;
  }
}

async function refreshStudentAssignments() {
  if (state.assignments.loading || !state.data || !window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured()) return false;
  const identity = currentStudentIdentity();
  const token = window.StudentIdentity && window.StudentIdentity.getSyncCredential && window.StudentIdentity.getSyncCredential();
  if (!identity.verified || !token) return false;
  state.assignments.loading = true;
  try {
    const items = await window.MonParcoursSupabase.rpc("get_student_assignments", { p_identity_token: token });
    if (!Array.isArray(items) || currentStudentIdentity().subject !== identity.subject) return false;
    state.assignments.items = items;
    state.assignments.loaded = true;
    localStorage.setItem(ASSIGNMENTS_CACHE_KEY, JSON.stringify({ identity_subject: identity.subject, items: items, updated_at: new Date().toISOString() }));
    if (state.view === "home") renderHome();
    else if (state.view === "assignments") renderAssignments();
    else if (state.view === "assignment-detail") renderAssignmentDetail(state.activeAssignmentId);
    return true;
  } catch (error) {
    return false;
  } finally {
    state.assignments.loading = false;
  }
}

function assignmentById(id) {
  return state.assignments.items.find(function (assignment) { return assignment.id === id; });
}

function assignmentCourseItems(assignment) {
  if (!assignment || !state.data) return [];
  const index = new Map(allCourseItems().filter(isExerciseItem).map(function (item) { return [item.id, item]; }));
  return (assignment.item_ids || []).map(function (id) { return index.get(id); }).filter(Boolean);
}

function assignmentProgress(assignment) {
  return window.MonParcoursAssignments.progress(assignment, currentMasteryRecords(), undefined, currentVerbEvidence());
}

function assignmentDue(assignment) {
  if (!assignment.due_at) return uiText("Sans échéance", "Geen deadline");
  const date = new Date(assignment.due_at);
  const format = { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels" };
  return uiText("À faire pour " + date.toLocaleDateString("fr-BE", format), "Te maken tegen " + date.toLocaleDateString("nl-BE", format));
}

function assignmentStatus(progress) {
  const labels = {
    completed: ["Terminée", "Afgerond"],
    late: ["En retard", "Te laat"],
    in_progress: ["En cours", "Bezig"],
    not_started: ["Pas commencé", "Nog niet gestart"]
  };
  return uiText.apply(null, labels[progress.status] || labels.not_started);
}

function assignmentCard(assignment) {
  const progress = assignmentProgress(assignment);
  if (progress.goals) return '<button class="assignment-card" type="button" data-action="view-assignment" data-id="' + escapeAttr(assignment.id) + '">' +
    '<strong class="assignment-card-title">' + assignmentContentIcon(assignment) + escapeHtml(assignment.title) + '</strong><span>' + assignmentDue(assignment) + '</span>' +
    '<span>' + assignmentShortProgress(progress) + '</span><span class="assignment-card-cta">' + uiText("Continuer", "Verder oefenen") + ' →</span></button>';
  return '<button class="assignment-card" type="button" data-action="view-assignment" data-id="' + escapeAttr(assignment.id) + '">' +
    '<strong class="assignment-card-title">' + assignmentContentIcon(assignment) + escapeHtml(assignment.title) + '</strong><span>' + assignmentDue(assignment) + '</span>' +
    '<span>' + assignmentStatus(progress) + ' · ' + progress.practiced + '/' + progress.total + ' ' + uiText("travaillés", "geoefend") + '</span>' +
    '<span>' + uiText("Niveau de maîtrise : " + progress.masteryLevel + "%", "Beheersingsniveau: " + progress.masteryLevel + "%") + '</span>' +
    '<span>' + progress.acquired + '/' + progress.total + ' ' + uiText("acquis · objectif " + progress.target + "% acquis", "gekend · doel " + progress.target + "% gekend") + '</span>' +
    masteryBar(progress, true) + '<span class="assignment-card-cta">' + uiText(progress.practiced ? "Continuer" : "Commencer", progress.practiced ? "Verder oefenen" : "Starten") + ' →</span></button>';
}

function assignmentShortProgress(progress) {
  if (progress.goals) {
    if (progress.goals.length === 1 && progress.goals[0].kind === "regular") {
      const goal = progress.goals[0];
      return uiText("Règle : " + goal.level + "% · " + goal.persons + "/6 personnes · objectif " + goal.target + "%",
        "Regel: " + goal.level + "% · " + goal.persons + "/6 personen · doel " + goal.target + "%");
    }
    return uiText(progress.acquired + "/" + progress.total + " objectifs acquis · " + progress.masteryLevel + "% maîtrise",
      progress.acquired + "/" + progress.total + " doelen gekend · " + progress.masteryLevel + "% beheerst");
  }
  return progress.acquired + '/' + progress.total + ' ' + uiText("acquis · objectif " + progress.target + "% acquis", "gekend · doel " + progress.target + "% gekend");
}

// One quiet, fixed icon vocabulary for every student-facing content surface.
function contentTypeKey(label, itemType) {
  const text = String(label || "").toLocaleLowerCase("fr");
  if (/expressions?/.test(text)) return "expressions";
  if (/actes de parole|se présenter|présenter quelqu/.test(text) || itemType === "phrase") return "speaking";
  if (/verbes?|être et avoir/.test(text) || itemType === "verb") return "verbs";
  if (/grammaire|adjectifs|mots invariables/.test(text) || itemType === "grammar_rule") return "grammar";
  if (/nombres?|chiffres/.test(text) || itemType === "number") return "numbers";
  if (/\bsons?\b|prononciation|comment dire/.test(text) || itemType === "sound_rule") return "sounds";
  return "vocabulary";
}

function contentIcon(kind) {
  const paths = {
    vocabulary: '<path d="M12 5c-2.5-1.5-5-1.7-8-1v15c3-.7 5.5-.5 8 1m0-15c2.5-1.5 5-1.7 8-1v15c-3-.7-5.5-.5-8 1m0-15v15"/>',
    expressions: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8m-8 3h5"/>',
    verbs: '<path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4"/>',
    grammar: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="8.5" y="15" width="7" height="6" rx="1"/><path d="M6.5 11v2h11v-2m-5.5 2v2"/>',
    speaking: '<path d="M3 5h12v9H8l-4 3V5Zm13 4h5v9h-4l-3 3v-5"/>',
    numbers: '<path d="M5 7h3v10m-3 0h6m3-8c0-1.2 1-2 2.5-2S19 8 19 9.5c0 3-5 4-5 7.5h6"/>',
    sounds: '<path d="M4 10h4l5-4v12l-5-4H4v-4Zm12-1c1.5 1 1.5 5 0 6m2-9c3 2 3 10 0 12"/>'
  };
  return '<svg class="content-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[kind] || paths.vocabulary) + '</svg>';
}

function assignmentContentIcon(assignment) {
  const first = assignmentCourseItems(assignment)[0];
  return contentIcon(contentTypeKey(first && first.category, first && first.type));
}

function assignmentHomeRow(assignment) {
  const progress = assignmentProgress(assignment);
  const due = assignment.due_at ? new Date(assignment.due_at) : null;
  const dueText = due && !Number.isNaN(due.getTime())
    ? uiText("Pour le " + due.toLocaleDateString("fr-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" }), "Tegen " + due.toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" }))
    : uiText("Sans échéance", "Geen deadline");
  return '<button class="assignment-home-row" type="button" data-action="view-assignment" data-id="' + escapeAttr(assignment.id) + '">' +
    '<span class="content-icon-wrap">' + assignmentContentIcon(assignment) + '</span>' +
    '<span class="assignment-home-copy"><strong>' + escapeHtml(assignment.title) + '</strong><small>' + assignmentShortProgress(progress) + '</small></span>' +
    '<span class="assignment-home-due">' + dueText + '</span>' +
    '<span class="assignment-home-cta">' + uiText("Continuer", "Verdergaan") + ' →</span></button>';
}

function assignmentHomeSection() {
  const identity = currentStudentIdentity();
  const items = state.assignments.items.filter(function (item) { return item.status === "published" && !item.completed_at; });
  return '<section class="assignments-home" aria-labelledby="assignments-heading"><div class="section-heading"><h2 id="assignments-heading">' + uiText("Mes devoirs", "Mijn taken") + '</h2>' +
    '<button class="text-button" type="button" data-action="view-assignments">' + uiText("Voir tout", "Alles bekijken") + '</button></div>' +
    (items.length ? '<div class="assignment-home-list">' + items.slice(0, 2).map(assignmentHomeRow).join("") + '</div>' :
      '<p class="muted">' + (identity.verified && !state.assignments.loaded ? uiText("Connecte-toi à Internet pour charger tes devoirs.", "Maak verbinding met internet om je taken op te halen.") : identity.verified ? uiText("Aucun devoir à faire pour le moment.", "Momenteel geen openstaande taken.") :
        uiText("Connecte-toi pour voir tes devoirs.", "Meld je aan om je taken te zien.")) + '</p>') + '</section>';
}

function renderAssignments() {
  if (!hasRequiredStudentIdentity()) return requestRequiredIdentity({ kind: "assignment", id: null });
  state.view = "assignments";
  const items = state.assignments.items.filter(function (item) { return item.status === "published"; });
  app.innerHTML = breadcrumbHtml([{ label: "Mon parcours", action: "home" }]) +
    '<section class="setup-header"><h1>' + uiText("Mes devoirs", "Mijn taken") + '</h1></section>' +
    (items.length ? '<div class="assignment-list">' + items.map(assignmentCard).join("") + '</div>' :
      '<p class="muted">' + (state.assignments.loaded ? uiText("Aucun devoir disponible.", "Geen taken beschikbaar.") : uiText("Connecte-toi à Internet pour charger tes devoirs.", "Maak verbinding met internet om je taken op te halen.")) + '</p>');
  focusApp();
}

function renderAssignmentDetail(id) {
  if (!id) return renderAssignments();
  if (!hasRequiredStudentIdentity()) return requestRequiredIdentity({ kind: "assignment", id: id });
  const assignment = assignmentById(id);
  if (!assignment) return renderAssignments();
  state.activeAssignmentId = id;
  state.view = "assignment-detail";
  const progress = assignmentProgress(assignment);
  const goalDetails = progress.goals ? '<div class="verb-task-goals">' + progress.goals.map(function (goal) {
    const item = assignmentCourseItems(assignment).find(function (row) { return row.id === goal.goalId; });
    const name = item ? displayScopeTitle(item.infinitive) : goal.goalId === "present_er" ? "Verbes en -ER" : goal.goalId;
    return '<div><strong>' + escapeHtml(name) + '</strong><span>' + goal.level + '% · ' + uiText(goal.status === "acquired" ? "Acquis" : "En cours", goal.status === "acquired" ? "Gekend" : "Aan het leren") + '</span><small>' + goal.persons + '/6 ' + uiText("personnes", "persoonsgroepen") + '</small></div>';
  }).join("") + '</div>' : "";
  app.innerHTML = breadcrumbHtml([{ label: "Mon parcours", action: "home" }, { label: "Mes devoirs", action: "view-assignments" }]) +
    '<section class="assignment-detail"><p class="eyebrow">' + assignmentStatus(progress) + '</p><h1>' + assignmentContentIcon(assignment) + escapeHtml(assignment.title) + '</h1>' +
    '<p>' + assignmentDue(assignment) + '</p>' +
    (assignment.instructions ? '<p class="assignment-instructions">' + escapeHtml(assignment.instructions) + '</p>' : '') +
    (progress.goals ? '<div class="assignment-stats"><strong>' + assignmentShortProgress(progress) + '</strong></div>' :
      '<div class="assignment-stats"><strong>' + progress.practiced + '/' + progress.total + ' ' + uiText("travaillés", "geoefend") + '</strong>' +
      '<strong>' + uiText("Niveau de maîtrise : " + progress.masteryLevel + "%", "Beheersingsniveau: " + progress.masteryLevel + "%") + '</strong>' +
      '<strong>' + progress.acquired + '/' + progress.total + ' ' + uiText("acquis", "gekend") + '</strong>' +
      '<strong>' + uiText("Objectif : " + progress.target + "% acquis", "Doel: " + progress.target + "% gekend") + '</strong></div>' + masteryBar(progress, false)) +
    (progress.completedAt ? '<p class="perfect-note">' + uiText("Objectif atteint ! Le " + new Date(progress.completedAt).toLocaleDateString("fr-BE") + ".", "Doel behaald! Op " + new Date(progress.completedAt).toLocaleDateString("nl-BE") + ".") + '</p>' :
      progress.reachedLocally ? '<p class="sync-note">' + uiText("Objectif atteint sur cet appareil. Confirmation après synchronisation.", "Doel op dit toestel behaald. Bevestiging volgt na synchronisatie.") + '</p>' :
      (progress.goals ? '<p>' + uiText("Travaille les personnes et les verbes indiqués pour atteindre l’objectif.", "Oefen de persoonsgroepen en werkwoorden om het doel te bereiken.") + '</p>' :
      '<p>' + uiText("La tâche est terminée quand tous les éléments ont été travaillés et que le pourcentage acquis atteint l’objectif.", "De taak is klaar als alle items geoefend zijn en het gekend-percentage het doel bereikt.") + '</p>')) +
    '<button class="button button-primary" type="button" data-action="launch-assignment" data-id="' + escapeAttr(id) + '">' + uiText(progress.practiced ? "Continuer" : "Commencer", progress.practiced ? "Verder oefenen" : "Starten") + '</button></section>';
  focusApp();
}

function launchAssignment(id) {
  if (!hasRequiredStudentIdentity()) return requestRequiredIdentity({ kind: "assignment_launch", id: id });
  const assignment = assignmentById(id);
  const allItems = assignmentCourseItems(assignment);
  const first = allItems[0];
  if (!assignment || !first) return renderAssignments();
  state.activeAssignmentId = id;
  state.trajectoryIndex = first._trajectoryIndex;
  const unit = currentTrajectory().units.find(function (row) { return row.top_category === first.top_category; });
  state.selectedUnitOrder = unit && unit.order;
  state.selectedScope = { unitOrder: state.selectedUnitOrder, block: first.block || "", subsection: first.subsection || "", category: first.category || "", title: assignment.title };
  if (assignment.mastery_strategy && assignment.mastery_strategy !== "item_mastery") {
    const questions = verbTaskQuestions(assignment, allItems);
    beginSession(questions, "practice", "assignment-mixed", assignment.title, { availableCount: questions.length, assignmentId: id });
    return;
  }
  const selectedItems = window.MonParcoursAssignments.selectItems(allItems, currentMasteryRecords(), 20);
  const questions = taskQuestionsForItems(selectedItems, "assignment-mixed");
  beginSession(questions, "practice", "assignment-mixed", assignment.title, { availableCount: allItems.length, assignmentId: id });
}

function verbTaskQuestions(assignment, items) {
  const api = window.MonParcoursVerbMastery;
  if (!api) return [];
  const goalIds = new Set((assignment.requirements || []).map(function (row) { return row.reference_id; }));
  const relevant = items.filter(function (item) { return goalIds.has(api.goalForItem(item)); });
  const candidates = buildQuestions(relevant, "verb-fr-conj").concat(buildQuestions(relevant, "verb-nl-conj"));
  const count = Math.min(20, candidates.length);
  const recognitionCount = goalIds.has("present_er") ? Math.min(4, Math.floor(count / 5)) : 0;
  const selected = api.selectPracticeQuestions(candidates, currentVerbEvidence(), count - recognitionCount);
  if (recognitionCount) {
    const recognition = buildQuestions(relevant, "verb-rule-recognition");
    const missing = new Set(api.calculate("present_er", currentVerbEvidence()).coveredPersons);
    recognition.sort(function (left, right) {
      return Number(missing.has(api.canonicalPerson(left.itemVariant.split(":")[2]))) - Number(missing.has(api.canonicalPerson(right.itemVariant.split(":")[2])));
    });
    selected.push.apply(selected, recognition.slice(0, recognitionCount));
  }
  return shuffle(selected);
}

function dashboardCard(titleFr, titleNl, valueFr, valueNl, descriptionFr, descriptionNl, action, disabled, icon) {
  return '<button class="quick-card" type="button" data-action="' + action + '"' + (disabled ? " disabled" : "") + '>' +
    '<span class="quick-icon ' + icon + '" aria-hidden="true">' + dashboardIcon(icon) + '</span><span><small>' + uiText(titleFr, titleNl) + '</small><strong>' + uiText(valueFr, valueNl) + '</strong><em>' + uiText(descriptionFr, descriptionNl) + '</em></span></button>';
}

function dashboardIcon(kind) {
  if (kind === "spark") return contentIcon("vocabulary");
  const path = kind === "play" ? '<path d="m9 5 10 7-10 7V5Z"/>' : '<path d="M4 19V5m0 14h16M8 16v-4m5 4V8m5 8V6"/>';
  return '<svg class="content-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
}

function masteryDashboardCard(summary) {
  return '<button class="quick-card mastery-dashboard-card" type="button" data-action="view-progress">' +
    '<span class="quick-icon chart" aria-hidden="true">' + dashboardIcon("chart") + '</span><span><small>' + uiText("Ma progression", "Mijn voortgang") + '</small>' +
    '<strong>' + uiText("Niveau de maîtrise : " + summary.masteryLevel + "%", "Beheersingsniveau: " + summary.masteryLevel + "%") + '</strong>' + masteryBar(summary, true) + '</span></button>';
}

function masteryBar(summary, compact) {
  const percentages = summary && summary.percentages ? summary.percentages : { new: 100, learning: 0, acquired: 0 };
  const label = percentages.new + "% nouveau, " + percentages.learning + "% en cours, " + percentages.acquired + "% acquis";
  return '<span class="mastery-bar' + (compact ? " is-compact" : "") + '" role="img" aria-label="' + escapeAttr(label) + '">' +
    '<i class="mastery-new" style="width:' + percentages.new + '%"></i>' +
    '<i class="mastery-learning" style="width:' + percentages.learning + '%"></i>' +
    '<i class="mastery-known" style="width:' + percentages.acquired + '%"></i></span>';
}

function journeySteps(activeStep) {
  const steps = [
    ["Trajet", "Trajet"],
    ["Partie", "Onderdeel"],
    ["Contenu", "Inhoud"],
    ["Exercice", "Oefening"]
  ];
  const actions = ["step-trajectory", "step-part", "step-content", ""];
  return '<nav class="journey-steps" aria-label="Étapes / Stappen">' + steps.map(function (labels, index) {
    const number = index + 1;
    const content = '<b>' + number + '</b>' + uiText(labels[0], labels[1]);
    if (number < activeStep) return '<button class="journey-step is-reached" type="button" data-action="' + actions[index] + '">' + content + '</button>';
    return '<span class="journey-step' + (number === activeStep ? " is-active" : "") + '"' + (number === activeStep ? ' aria-current="step"' : "") + '>' + content + '</span>';
  }).join("") + '</nav>';
}

function scrollToStepTarget(selector) {
  const target = document.querySelector(selector);
  if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderUnit() {
  state.view = "unit";
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  if (!unit) return renderHome();
  state.session = null;
  const unitItems = itemsForUnit(trajectory, unit);
  const exerciseItems = unitItems.filter(isExerciseItem);
  const exerciseCount = exerciseItems.length;
  const unitMastery = masterySummaryForItems(unitItems);
  const soundItems = unitItems.filter(function (item) { return item.type === "sound_rule"; });
  const sectionsHtml = unit.study_sections.length
    ? unit.study_sections.map(function (section) {
        const blockItems = unitItems.filter(function (item) { return item.block === section.title && isExerciseItem(item); });
        const blockCount = blockItems.length;
        const blockDuplicatesUnit = samePermanentItemSet(blockItems, exerciseItems);
        return '<article class="structure-card">' +
          '<div class="structure-heading"><div><small>' + uiText("Bloc d'étude", "Studieblok") + '</small><h3>' + escapeHtml(section.title) + '</h3></div>' +
          (blockCount && !blockDuplicatesUnit ? compactScopeButton(unit, section.title, "", section.title, blockCount, "Tout le bloc", "Hele blok") : "") + '</div>' +
          '<div class="subsection-list">' +
            section.subsections.map(function (subsection) {
              const subsectionScope = {
                block: section.title,
                subsection: subsection.title
              };
              const subset = exerciseItemsForScope(trajectory, unit, subsectionScope);
              const subsetCount = subset.length;
              const categoryChoices = subsection.content_types.map(function (contentType) {
                const categoryValue = isUmbrellaContentType(contentType) ? "" : contentType;
                const categoryScope = {
                  block: section.title,
                  subsection: subsection.title,
                  category: categoryValue
                };
                const categoryItems = exerciseItemsForScope(trajectory, unit, categoryScope);
                const categoryCount = categoryItems.length;
                return categoryCount
                  ? scopeChoiceCard(unit, section.title, subsection.title, contentType, categoryCount, categoryValue, masterySummaryForItems(categoryItems))
                  : "";
              }).filter(Boolean);
              const auxiliaryItems = subset.filter(function (item) { return item.category === "être / avoir"; });
              if (auxiliaryItems.length && !subsection.content_types.includes("être / avoir")) {
                categoryChoices.push(scopeChoiceCard(unit, section.title, subsection.title, "Être et avoir", auxiliaryItems.length, "être / avoir", masterySummaryForItems(auxiliaryItems)));
              }
              const verbGrid = subsetCount && subset.every(function (item) { return item.type === "verb"; })
                ? renderVerbScopeGroups(unit, section.title, subsection.title, subset) : "";
              const categoryGrid = verbGrid || (categoryChoices.length
                ? '<div class="scope-choice-grid">' + categoryChoices.join("") + '</div>'
                : (subsetCount ? '<div class="scope-choice-grid">' + scopeChoiceCard(unit, section.title, subsection.title, subsection.title, subsetCount, "", masterySummaryForItems(subset)) + '</div>' : '<span class="source-only">' + uiText("Informations du cours", "Alleen cursusinfo") + '</span>'));
              return '<section class="subsection-row"><div class="subsection-title"><div><h4>' + escapeHtml(subsection.title) + '</h4>' + (subsetCount ? masteryCompactLine(masterySummaryForItems(subset)) : "") + '</div>' +
                (subsetCount && categoryChoices.length > 1 ? compactScopeButton(unit, section.title, subsection.title, subsection.title, subsetCount, "Tout ce contenu", "Alles hiervan") : "") +
                '</div>' + categoryGrid + '</section>';
            }).join("") +
          '</div></article>';
      }).join("")
    : '<article class="empty-panel"><p class="eyebrow">' + uiText("Structure du cours", "Cursusstructuur") + '</p><h3>' + uiText("Aucun exercice dans la source", "Geen oefenblokken in de bron") + '</h3><p>' + uiText("Cette partie reste visible parce qu'elle appartient au cours.", "Dit onderdeel blijft zichtbaar omdat het in de cursus staat. De JSON bevat hier geen oefenitems voor.") + '</p></article>';

  app.innerHTML =
    breadcrumbHtml([{ label: trajectory.trajectory, action: "home" }]) +
    journeySteps(3) +
    '<section class="unit-hero"><div><p class="eyebrow unit-kind">' + contentIcon(contentTypeKey(unit.top_category)) + escapeHtml(unit.top_category) + '</p><h1>' + escapeHtml(unit.title) + '</h1>' +
    '<p class="lede">' + exerciseCount + ' ' + uiText("éléments d’exercice", "oefenitems") + '</p>' + masteryPageSummary(unitMastery) + '</div>' +
    (exerciseCount ? compactScopeButton(unit, "", "", unit.title, exerciseCount, "Toute la partie", "Hele onderdeel") : "") + '</section>' +
    '<section class="structure-stack" aria-label="Cursusstructuur">' + sectionsHtml + '</section>' +
    renderSoundNotes(soundItems);
  focusApp();
}

function scopeAttributes(unit, block, subsection, title, category, itemId) {
  return ' data-action="choose-scope" data-order="' + unit.order +
    '" data-block="' + escapeAttr(block) + '" data-subsection="' + escapeAttr(subsection) + '" data-category="' + escapeAttr(category || "") + '" data-item-id="' + escapeAttr(itemId || "") + '" data-title="' + escapeAttr(title) + '">';
}

function renderVerbScopeGroups(unit, block, subsection, items) {
  const api = window.MonParcoursVerbMastery;
  if (!api) return "";
  const rules = new Map();
  const irregular = [];
  items.forEach(function (item) {
    const type = api.classification(item.id);
    if (!type) return;
    if (type.ruleId) {
      if (!rules.has(type.ruleId)) rules.set(type.ruleId, []);
      rules.get(type.ruleId).push(item);
    } else irregular.push(item);
  });
  const groups = [];
  if (rules.size) groups.push('<div class="verb-scope-group"><h5>' + uiText("Réguliers", "Regelmatige werkwoorden") + '</h5><div class="scope-choice-grid">' +
    Array.from(rules.entries()).map(function (entry) {
      const ruleId = entry[0], ruleItems = entry[1];
      const title = ruleItems[0].category;
      return verbGoalCard(unit, block, subsection, title, scopeLabelDutch(title), ruleItems.length, title, "", ruleId);
    }).join("") + '</div></div>');
  if (irregular.length) groups.push('<div class="verb-scope-group"><h5>' + uiText("Irréguliers", "Onregelmatige werkwoorden") + '</h5><div class="scope-choice-grid">' +
    irregular.map(function (item) {
      return verbGoalCard(unit, block, subsection, displayScopeTitle(item.infinitive), item.nl, 1, item.category, item.id, item.id);
    }).join("") +
    (irregular.length > 1 && irregular[0].category === "être / avoir" && irregular.every(function (item) { return item.category === irregular[0].category; })
      ? irregularGroupCard(unit, block, subsection, irregular) : "") +
    '</div></div>');
  return groups.length ? '<div class="verb-scope-groups">' + groups.join("") + '</div>' : "";
}

function irregularGroupCard(unit, block, subsection, items) {
  const api = window.MonParcoursVerbMastery;
  const scores = items.map(function (item) { return api.calculate(item.id, currentVerbEvidence()); });
  const level = Math.round(scores.reduce(function (sum, row) { return sum + row.level; }, 0) / scores.length);
  const title = items.map(function (item) { return displayScopeTitle(item.infinitive); }).join(" + ");
  return '<button class="scope-choice-card verb-goal-card" type="button"' +
    scopeAttributes(unit, block, subsection, title, items[0].category) +
    '<span class="content-icon-wrap">' + contentIcon("verbs") + '</span><strong>' + escapeHtml(title) + '</strong><b class="scope-count">' + items.length + '</b>' +
    '<small>' + uiText("Ensemble", "Samen oefenen") + '</small><small class="scope-mastery">' +
    uiText(level + "% maîtrise · " + scores.filter(function (row) { return row.status === "acquired"; }).length + "/" + items.length + " acquis",
      "beheerst · " + scores.filter(function (row) { return row.status === "acquired"; }).length + "/" + items.length + " gekend") + '</small></button>';
}

function verbGoalCard(unit, block, subsection, title, dutch, count, category, itemId, goalId) {
  const progress = window.MonParcoursVerbMastery.calculate(goalId, currentVerbEvidence());
  return '<button class="scope-choice-card verb-goal-card" type="button" data-goal-id="' + escapeAttr(goalId) + '"' +
    scopeAttributes(unit, block, subsection, title, category, itemId) +
    '<span class="content-icon-wrap">' + contentIcon("verbs") + '</span><strong>' + escapeHtml(title) + '</strong><b class="scope-count">' + count + '</b>' +
    '<small lang="nl">' + escapeHtml(dutch) + '</small><small class="scope-mastery">' + uiText(progress.level + "% maîtrise · " + progress.persons + "/6 personnes", "beheerst · " + progress.persons + "/6 persoonsgroepen") + '</small></button>';
}

function compactScopeButton(unit, block, subsection, title, count, labelFr, labelNl, category) {
  return '<button class="scope-all-button" type="button"' + scopeAttributes(unit, block, subsection, title, category) +
    uiText(labelFr, labelNl) + '<span>' + count + '</span></button>';
}

function scopeChoiceCard(unit, block, subsection, title, count, category, mastery) {
  const kind = contentTypeKey(subsection === "Actes de parole" ? subsection : title);
  return '<button class="scope-choice-card" type="button"' + scopeAttributes(unit, block, subsection, title, category) +
    '<span class="content-icon-wrap">' + contentIcon(kind) + '</span><strong>' + escapeHtml(displayScopeTitle(title)) + '</strong><b class="scope-count">' + count + '</b><small lang="nl">' + escapeHtml(scopeLabelDutch(title)) + '</small>' + (mastery ? '<small class="scope-mastery">' + uiText(mastery.masteryLevel + "% maîtrise", "beheerst") + '</small>' : "") + '</button>';
}

function masteryPageSummary(summary) {
  if (!summary || !summary.total) return "";
  return '<span class="unit-summary">' + uiText(summary.masteryLevel + "% maîtrise", "beheerst") + '</span>';
}

function masteryCompactLine(summary) {
  if (!summary || !summary.total) return "";
  return '<small class="mastery-compact-line">' + summary.practiced + '/' + summary.total + ' · ' + summary.masteryLevel + '%<span class="sr-only">' + uiText("travaillés · maîtrise", "geoefend · beheerst") + '</span></small>';
}

function samePermanentItemSet(left, right) {
  const leftIds = new Set((left || []).map(function (item) { return item.id; }).filter(Boolean));
  const rightIds = new Set((right || []).map(function (item) { return item.id; }).filter(Boolean));
  if (leftIds.size !== rightIds.size) return false;
  return Array.from(leftIds).every(function (id) { return rightIds.has(id); });
}

function displayScopeTitle(title) {
  const text = String(title || "");
  return text ? text.charAt(0).toLocaleUpperCase("fr") + text.slice(1) : text;
}

function isUmbrellaContentType(contentType) {
  const normalized = String(contentType || "").trim().toLocaleLowerCase("fr");
  return normalized === "vocabulaire" || normalized === "nombres";
}

function scopeLabelDutch(title) {
  const normalized = String(title || "").trim().toLocaleLowerCase("fr");
  const labels = {
    "vocabulaire": "Woordenschat",
    "expressions": "Uitdrukkingen",
    "se présenter": "Zich voorstellen",
    "présenter quelqu’un (1)": "Iemand voorstellen (1)",
    "présenter quelqu’un (2)": "Iemand voorstellen (2)",
    "verbes en -er": "Werkwoorden op -ER",
    "type finir": "Werkwoorden van het type finir",
    "verbes en -re": "Werkwoorden op -RE",
    "être et avoir": "être en avoir",
    "adjectifs": "Bijvoeglijke naamwoorden",
    "verbes": "Werkwoorden",
    "mots invariables": "Onveranderlijke woorden",
    "nombres": "Getallen"
  };
  return labels[normalized] || "Oefen dit onderdeel";
}

function renderSoundNotes(items) {
  if (!items.length) return "";
  return '<section class="source-notes"><div class="section-heading"><div><p class="eyebrow">' + uiText("De ton cours", "Uit je cursus") + '</p><h2>' + contentIcon("sounds") + uiText("Règles de prononciation", "Klankregels") + '</h2></div></div>' +
    items.map(function (item) {
      const spelling = item.spelling || (item.spellings || []).join(", ") || item.category || item.word || "Klankregel";
      const heading = item.sound ? spelling + " → " + item.sound : spelling;
      const text = item.rule_nl || item.example_fr || "";
      const examples = item.examples_fr || [];
      return '<article><strong>' + escapeHtml(heading) + '</strong><p>' + escapeHtml(text) + '</p>' +
        (examples.length ? '<ul>' + examples.map(function (example) { return '<li>' + escapeHtml(example) + '</li>'; }).join("") + '</ul>' : "") + '</article>';
    }).join("") + '</section>';
}

function renderSetup() {
  state.view = "setup";
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  const scope = state.selectedScope;
  if (!scope || !unit) return renderUnit();
  const assignment = assignmentById(state.activeAssignmentId);
  const items = assignment ? assignmentCourseItems(assignment) : itemsForScope(trajectory, unit, scope);
  const exerciseItems = items.filter(isExerciseItem);
  const available = assignment ? ["assignment-mixed"].concat(exerciseKeysForItems(exerciseItems)) : exerciseKeysForItems(exerciseItems);
  if (!available.length) return renderUnit();

  app.innerHTML =
    breadcrumbHtml([
      { label: trajectory.trajectory, action: "home" },
      { label: assignment ? "Mes devoirs" : unit.top_category, action: assignment ? "view-assignments" : "back-unit" }
    ]) +
    journeySteps(4) +
    '<section class="setup-header"><h1>' + contentIcon(contentTypeKey(scope.category || scope.title)) + escapeHtml(scope.title) + '</h1><span class="setup-total">' + exerciseItemCount(exerciseItems) + ' ' + uiText("éléments", "items") + '</span></section>' +
    '<section class="setup-grid"><div class="setup-choices"><div class="section-heading compact"><h2>' + uiText("Que veux-tu travailler ?", "Wat wil je oefenen?") + '</h2></div>' +
      '<div class="choice-list" role="radiogroup">' +
        available.map(function (key, index) {
          const option = EXERCISES[key];
          const exerciseItems = option.type === "mixed" ? items : items.filter(function (item) { return item.type === option.type; });
          const count = assignment ? exerciseItems.length : questionCountForItems(exerciseItems, key);
          const isConjugation = key === "verb-nl-conj" || key === "verb-fr-conj";
          const countLabel = isConjugation ? exerciseItems.length + " verbes" : count;
          const group = key === "verb-nl-inf" || key === "verb-fr-nl" ? "Vocabulaire" : isConjugation ? "Conjugaison" : key === "verb-rule-recognition" ? "Règle" : "";
          const preceding = index ? available[index - 1] : "";
          const precedingGroup = preceding === "verb-nl-inf" || preceding === "verb-fr-nl" ? "Vocabulaire" : preceding === "verb-nl-conj" || preceding === "verb-fr-conj" ? "Conjugaison" : preceding === "verb-rule-recognition" ? "Règle" : "";
          const applyingRule = group === "Conjugaison" && exerciseItems.length && exerciseItems.every(function (item) {
            const type = window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(item.id);
            return type && type.kind === "regular";
          });
          const groupHeading = group && group !== precedingGroup ? '<h3 class="exercise-group-heading">' + uiText(group, { Vocabulaire: "Woordenschat", Conjugaison: "Vervoegen", Règle: "Regel" }[group]) +
            (applyingRule ? ' · ' + uiText("Appliquer la règle", "De regel toepassen") : '') + '</h3>' : "";
          return groupHeading + '<label class="radio-card"><input type="radio" name="exercise" value="' + key + '"' + (index === 0 ? " checked" : "") + '>' +
            '<span><strong>' + contentIcon(contentTypeKey(scope.category || scope.title, option.type)) + uiText(option.labelFr, option.label) + '</strong><b class="choice-count">' + countLabel + '</b></span></label>';
        }).join("") +
      '</div><section class="session-size-panel" aria-labelledby="session-size-heading"><div class="section-heading compact"><h2 id="session-size-heading">' + uiText("Combien veux-tu travailler ?", "Hoeveel wil je oefenen?") + '</h2></div>' +
        '<div id="session-size-picker"></div></section></div>' +
      '<div class="setup-modes"><div class="section-heading compact"><h2>' + uiText("Choisis ton mode", "Kies je modus") + '</h2></div><div class="mode-list">' +
        modeCard("learn", "Apprendre", "Leren", "Vois la réponse, puis retape-la.", "Bekijk het antwoord en typ het na.") +
        modeCard("practice", "S'entraîner", "Oefenen", "Réessaie après une erreur.", "Probeer opnieuw na een fout.") +
        modeCard("test", "Se tester", "Test jezelf", "Découvre ton résultat à la fin.", "Bekijk je resultaat op het einde.") +
      '</div><p class="session-note">' + uiText("Les erreurs peuvent revenir plus tard.", "Fouten kunnen later opnieuw verschijnen.") + '</p></div>' +
    '</section>';
  updateSessionSizePicker();
  focusApp();
}

function sessionSizeOptions(availableCount, includeAll) {
  const options = [10, 20, 30].filter(function (count) { return count <= availableCount; });
  if (includeAll !== false) options.push("all");
  return options;
}

function preferredSessionSize(availableCount, includeAll) {
  const options = sessionSizeOptions(availableCount, includeAll);
  const preference = state.progress.settings.sessionSize;
  if (preference === "all" && options.includes("all")) return "all";
  if (options.includes(Number(preference))) return Number(preference);
  const numeric = options.filter(function (option) { return typeof option === "number"; });
  return numeric.length ? numeric[numeric.length - 1] : "all";
}

function exerciseItemsForSetup(exerciseKey) {
  const assignment = assignmentById(state.activeAssignmentId);
  if (assignment && EXERCISES[exerciseKey]) return assignmentCourseItems(assignment).filter(function (item) {
    return exerciseKey === "assignment-mixed" || item.type === EXERCISES[exerciseKey].type;
  });
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  if (!exerciseKey || !EXERCISES[exerciseKey] || !unit || !state.selectedScope) return [];
  return itemsForScope(trajectory, unit, state.selectedScope).filter(function (item) {
    return item.type === EXERCISES[exerciseKey].type;
  });
}

function questionsForSetup(exerciseKey, requestedCount) {
  if (assignmentById(state.activeAssignmentId)) {
    const items = window.MonParcoursAssignments.selectItems(exerciseItemsForSetup(exerciseKey), currentMasteryRecords(), requestedCount);
    return taskQuestionsForItems(items, exerciseKey);
  }
  return buildQuestionsForItems(exerciseItemsForSetup(exerciseKey), exerciseKey, requestedCount);
}

function taskQuestionsForItems(items, exerciseKey) {
  return items.map(function (item) {
      const key = exerciseKey === "assignment-mixed" ?
        { vocabulary: "vocab-nl-fr", verb: "verb-nl-inf", phrase: "phrase-nl-fr", grammar_rule: "grammar", number: "number-nl-fr" }[item.type] : exerciseKey;
      if (!key) return null;
      const questions = buildQuestionsForItems([item], key, 1);
      return questions[Math.floor(Math.random() * questions.length)] || null;
  }).filter(Boolean);
}

function availableQuestionCount(exerciseKey) {
  if (assignmentById(state.activeAssignmentId)) return exerciseItemsForSetup(exerciseKey).length;
  return questionCountForItems(exerciseItemsForSetup(exerciseKey), exerciseKey);
}

function setupAllowsAll(exerciseKey) {
  if (assignmentById(state.activeAssignmentId)) return true;
  const items = exerciseItemsForSetup(exerciseKey);
  if (exerciseKey === "verb-nl-conj" || exerciseKey === "verb-fr-conj") return questionCountForItems(items, exerciseKey) <= 30;
  return !items.some(isDynamicNumberItem) || questionCountForItems(items, exerciseKey) <= MAX_DYNAMIC_NUMBER_ALL;
}

function updateSessionSizePicker() {
  const picker = document.querySelector("#session-size-picker");
  const selectedExercise = document.querySelector('input[name="exercise"]:checked');
  if (!picker || !selectedExercise) return;
  const availableCount = availableQuestionCount(selectedExercise.value);
  const includeAll = setupAllowsAll(selectedExercise.value);
  const preferred = preferredSessionSize(availableCount, includeAll);
  picker.innerHTML = '<div class="size-options" role="radiogroup">' + sessionSizeOptions(availableCount, includeAll).map(function (option) {
    const value = String(option);
    const labelNl = option === "all" ? "Alle " + availableCount : value;
    const labelFr = option === "all" ? "Tous les " + availableCount : value;
    const optionLabel = option === "all" ? uiText(labelFr, labelNl) : escapeHtml(value);
    return '<label class="size-choice"><input type="radio" name="session-size" value="' + value + '"' + (option === preferred ? " checked" : "") + '><span>' + optionLabel + '</span></label>';
  }).join("") + '</div><p id="session-plan" class="session-plan" aria-live="polite"></p>';
  updateSessionPlan();
}

function updateSessionPlan() {
  const plan = document.querySelector("#session-plan");
  const selectedExercise = document.querySelector('input[name="exercise"]:checked');
  const selectedSize = document.querySelector('input[name="session-size"]:checked');
  if (!plan || !selectedExercise || !selectedSize) return;
  const availableCount = availableQuestionCount(selectedExercise.value);
  const dynamicNumbers = exerciseItemsForSetup(selectedExercise.value).some(isDynamicNumberItem);
  if (selectedExercise.value === "verb-nl-conj" || selectedExercise.value === "verb-fr-conj") {
    const verbCount = exerciseItemsForSetup(selectedExercise.value).length;
    plan.innerHTML = uiText("Tu travailleras " + selectedSize.value + " questions de conjugaison · " + verbCount + " verbes · 6 personnes.",
      "Je oefent " + selectedSize.value + " vervoegingen · " + verbCount + " werkwoorden · 6 persoonsgroepen.", "ui-block");
    return;
  }
  if (selectedExercise.value === "verb-rule-recognition") {
    plan.innerHTML = uiText("Tu travailleras les 6 terminaisons de la règle.", "Je oefent de 6 uitgangen van de regel.", "ui-block");
    return;
  }
  plan.innerHTML = uiText(sessionPlanFrench(selectedSize.value, availableCount, dynamicNumbers), sessionPlanText(selectedSize.value, availableCount, dynamicNumbers), "ui-block");
}

function sessionPlanText(selectedSize, availableCount, dynamicNumbers) {
  const noun = dynamicNumbers ? "mogelijke getallen" : "items";
  return selectedSize === "all"
    ? "Je oefent alle " + availableCount + " " + noun + "."
    : "Je oefent " + selectedSize + " van " + availableCount + " " + noun + ".";
}

function sessionPlanFrench(selectedSize, availableCount, dynamicNumbers) {
  const noun = dynamicNumbers ? "nombres possibles" : "éléments";
  return selectedSize === "all"
    ? "Tu travailleras les " + availableCount + " " + noun + "."
    : "Tu travailleras " + selectedSize + " des " + availableCount + " " + noun + ".";
}

function modeCard(mode, titleFr, titleNl, descriptionFr, descriptionNl) {
  return '<button class="mode-card" type="button" data-action="start-session" data-mode="' + mode + '"><span class="mode-symbol" aria-hidden="true">' +
    (mode === "learn" ? "01" : mode === "practice" ? "02" : "03") + '</span><span><strong>' + uiText(titleFr, titleNl) + '</strong><small>' + uiText(descriptionFr, descriptionNl) + '</small></span></button>';
}

function startSession(mode) {
  const supplied = arguments.length > 1 ? arguments[1] : null;
  const selected = document.querySelector('input[name="exercise"]:checked');
  const selectedSize = document.querySelector('input[name="session-size"]:checked');
  const exerciseKey = supplied && supplied.exerciseKey ? supplied.exerciseKey : selected && selected.value;
  const sizeValue = supplied && supplied.sizeValue != null ? String(supplied.sizeValue) : selectedSize && selectedSize.value;
  if (!exerciseKey || !sizeValue) return;
  const pending = supplied || {
    kind: "setup",
    trajectoryIndex: state.trajectoryIndex,
    unitOrder: state.selectedUnitOrder,
    scope: state.selectedScope ? JSON.parse(JSON.stringify(state.selectedScope)) : null,
    exerciseKey: exerciseKey,
    sizeValue: sizeValue,
    mode: mode
  };
  if (!hasRequiredStudentIdentity()) {
    requestRequiredIdentity(pending);
    return;
  }
  const availableCount = availableQuestionCount(exerciseKey);
  const requestedCount = sizeValue === "all" ? availableCount : Number(sizeValue);
  state.progress.settings.sessionSize = sizeValue === "all" ? "all" : requestedCount;
  const allQuestions = questionsForSetup(exerciseKey, requestedCount);
  const taskSession = Boolean(assignmentById(state.activeAssignmentId));
  const questions = taskSession ? allQuestions : selectQuestions(allQuestions, requestedCount);
  beginSession(questions, mode, exerciseKey, state.selectedScope.title, { availableCount: availableCount, assignmentId: taskSession ? state.activeAssignmentId : null });
}

function beginSession(questions, mode, exerciseKey, title, metadata) {
  if (!questions.length) return;
  if (!hasRequiredStudentIdentity()) {
    requestRequiredIdentity({
      kind: "prepared",
      questions: questions,
      mode: mode,
      exerciseKey: exerciseKey,
      title: title,
      metadata: metadata || {}
    });
    return;
  }
  state.pendingStartAction = null;
  const availableCount = metadata && metadata.availableCount ? metadata.availableCount : questions.length;
  const identity = currentStudentIdentity();
  const sessionPath = currentSessionPath();
  state.session = {
    questions: questions,
    index: 0,
    mode: mode,
    exerciseKey: exerciseKey,
    title: title,
    titleFr: metadata && metadata.titleFr ? metadata.titleFr : title,
    titleNl: metadata && metadata.titleNl ? metadata.titleNl : title,
    phase: "answer",
    questionAttempts: 0,
    question_count: questions.length,
    attempt_count: 0,
    available_count: availableCount,
    assignment_id: metadata && metadata.assignmentId || null,
    client_session_id: createClientId(),
    identity_provider: identity.provider,
    identity_subject: identity.subject,
    identity_verified: identity.verified === true,
    course_path: sessionPath,
    sync_attempts: [],
    results: [],
    startedAt: new Date().toISOString(),
    active_duration_seconds: 0,
    activeTimeMs: 0,
    activeClockStartedAt: monotonicNow(),
    activeClockLastInteraction: monotonicNow(),
    activeClockRunning: document.visibilityState !== "hidden"
  };
  state.progress.lastSession = {
    trajectoryIndex: state.trajectoryIndex,
    unitOrder: state.selectedUnitOrder,
    scope: state.selectedScope,
    exerciseKey: exerciseKey,
    mode: mode,
    title: title,
    titleFr: metadata && metadata.titleFr ? metadata.titleFr : title,
    titleNl: metadata && metadata.titleNl ? metadata.titleNl : title,
    question_count: questions.length,
    available_count: availableCount,
    assignmentId: metadata && metadata.assignmentId || null,
    at: new Date().toISOString()
  };
  saveProgress();
  persistActiveSession();
  syncSessionSnapshot();
  renderQuestion();
}

function monotonicNow() {
  return window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
}

function settleActiveTime(pause) {
  const session = state.session;
  if (!session || session.finishedAt || !session.activeClockRunning) return;
  const now = monotonicNow();
  const storedStart = Number(session.activeClockStartedAt);
  const startedAt = Number.isFinite(storedStart) ? storedStart : now;
  const storedInteraction = session.activeClockLastInteraction == null ? NaN : Number(session.activeClockLastInteraction);
  const lastInteraction = Number.isFinite(storedInteraction) ? storedInteraction : startedAt;
  const countedUntil = Math.min(now, lastInteraction + INACTIVITY_TIMEOUT_MS);
  session.activeTimeMs = Math.max(0, Number(session.activeTimeMs || 0)) + Math.max(0, countedUntil - startedAt);
  session.active_duration_seconds = Math.floor(session.activeTimeMs / 1000);
  session.activeClockStartedAt = now;
  if (pause || now >= lastInteraction + INACTIVITY_TIMEOUT_MS) session.activeClockRunning = false;
}

function markPracticeActivity() {
  const session = state.session;
  if (!session || session.finishedAt || document.visibilityState === "hidden") return;
  settleActiveTime(false);
  const now = monotonicNow();
  session.activeClockLastInteraction = now;
  session.activeClockStartedAt = now;
  session.activeClockRunning = true;
}

function handlePracticeActivity(event) {
  if (!state.session || !event.target || !event.target.closest || !event.target.closest(".practice-shell")) return;
  markPracticeActivity();
}

function handleVisibilityChange() {
  if (!state.session) return;
  if (document.visibilityState === "hidden") {
    settleActiveTime(true);
    persistActiveSession();
    syncSessionSnapshot();
  }
}

function handlePageHide() {
  if (!state.session || state.session.finishedAt) return;
  settleActiveTime(true);
  persistActiveSession();
  syncSessionSnapshot();
}

function serializableSession(session) {
  if (!session) return null;
  const copy = JSON.parse(JSON.stringify(session));
  delete copy.activeClockStartedAt;
  delete copy.activeClockLastInteraction;
  delete copy.activeClockRunning;
  copy.active_duration_seconds = Math.max(0, Math.floor(Number(copy.active_duration_seconds || 0)));
  copy.activeTimeMs = copy.active_duration_seconds * 1000;
  return copy;
}

function persistActiveSession() {
  if (!state.session || state.session.finishedAt) return;
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(serializableSession(state.session)));
  } catch (error) {
    /* De syncqueue blijft de minimale duurzame fallback. */
  }
}

function clearActiveSession() {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

function restoreActiveSession() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY));
  } catch (error) {
    clearActiveSession();
    return false;
  }
  const identity = currentStudentIdentity();
  if (!saved || saved.finishedAt || !Array.isArray(saved.questions) || !saved.questions.length ||
      !hasRequiredStudentIdentity(identity) || saved.identity_subject !== identity.subject || !saved.client_session_id) {
    if (saved && saved.identity_subject && saved.identity_subject !== identity.subject) clearActiveSession();
    return false;
  }
  saved.active_duration_seconds = Math.max(0, Math.floor(Number(saved.active_duration_seconds || 0)));
  saved.activeTimeMs = saved.active_duration_seconds * 1000;
  saved.activeClockStartedAt = monotonicNow();
  saved.activeClockLastInteraction = null;
  saved.activeClockRunning = false;
  state.session = saved;
  state.activeAssignmentId = saved.assignment_id || null;
  renderQuestion('<span class="resume-note">' + uiText("Ta session inachevée a été reprise.", "Je onvoltooide sessie is veilig hervat.") + '</span>');
  return true;
}

function leaveSessionUnfinished() {
  if (!state.session || state.session.finishedAt) return;
  settleActiveTime(true);
  persistActiveSession();
  syncSessionSnapshot();
  clearActiveSession();
  state.session = null;
}

function currentSessionPath() {
  const trajectory = state.data && state.data.trajectories[state.trajectoryIndex];
  const unit = trajectory && currentUnit();
  const scope = state.selectedScope || {};
  return {
    course_key: "UF1",
    trajectory: trajectory ? trajectory.trajectory : "Onbekend",
    top_category: unit ? unit.top_category : "Extra oefening",
    lesson: unit ? unit.title : (scope.title || "Extra oefening"),
    block: scope.block || "",
    subsection: scope.subsection || ""
  };
}

function createClientId() {
  if (window.MonParcoursSync) return window.MonParcoursSync.createId();
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
}

function renderQuestion(message) {
  state.view = "practice";
  const session = state.session;
  const question = session.questions[session.index];
  if (!question) return finishSession();
  const progress = Math.round((session.index / session.questions.length) * 100);
  const isTest = session.mode === "test";
  app.innerHTML =
    '<section class="practice-shell">' +
      '<header class="practice-header"><button class="text-button" type="button" data-action="back-unit">' + uiText("Arrêter", "Stoppen") + '</button>' +
      '<div class="practice-progress" aria-label="Voortgang"><span style="width:' + progress + '%"></span></div>' +
      '<strong>' + (session.index + 1) + ' / ' + session.questions.length + '</strong></header>' +
      taskPracticeContextHtml(session) +
      '<article class="question-card">' +
        '<div class="question-meta"><span>' + uiText(modeLabelFr(session.mode), modeLabel(session.mode)) + '</span><span>' + contentIcon(contentTypeKey(question.item && question.item.category || state.selectedScope && (state.selectedScope.category || state.selectedScope.title), question.item && question.item.type || EXERCISES[session.exerciseKey].type)) + uiText(EXERCISES[session.exerciseKey].labelFr, EXERCISES[session.exerciseKey].label) + '</span></div>' +
        '<p class="prompt-label">' + uiText(instructionFrench(question.instruction), question.instruction) + '</p><h1 class="question-prompt">' + escapeHtml(question.prompt) + '</h1>' +
        (question.context ? '<p class="question-context">' + escapeHtml(question.context) + '</p>' : "") +
        '<form id="answer-form" autocomplete="off"><label for="answer-input" class="sr-only">Ta réponse / Jouw antwoord</label>' +
          '<input id="answer-input" name="answer" type="text" autocapitalize="none" spellcheck="false" placeholder="Écris ta réponse / Typ je antwoord" aria-describedby="answer-help" autofocus>' +
          '<div class="accent-row" aria-label="Franse accenten">' + ACCENTS.map(function (accent) {
            return '<button type="button" data-action="insert-accent" data-accent="' + accent + '">' + accent + '</button>';
          }).join("") + '</div>' +
          '<p id="answer-help" class="input-help">' + (isTest ? uiText("Tu verras ton résultat à la fin.", "Je krijgt je resultaat op het einde.") : uiText("Appuie sur Entrée pour vérifier.", "Druk op Enter om te controleren.")) + '</p>' +
          '<button class="button button-primary submit-button" type="submit">' + (isTest ? uiText("Enregistrer la réponse", "Antwoord bewaren") : uiText("Vérifier", "Controleren")) + '</button>' +
        '</form>' +
        '<div id="feedback" class="feedback" aria-live="polite">' + (message || "") + '</div>' +
      '</article>' +
    '</section>';
  focusAnswer();
}

function taskPracticeContextHtml(session) {
  const assignment = assignmentById(session.assignment_id);
  if (!assignment) return "";
  const progress = assignmentProgress(assignment);
  if (progress.goals) return '<aside class="task-practice-context" aria-label="Devoir / Taak"><strong>' + escapeHtml(assignment.title) + '</strong><span>' + assignmentShortProgress(progress) + '</span></aside>';
  return '<aside class="task-practice-context" aria-label="Devoir / Taak"><strong>' + escapeHtml(assignment.title) + '</strong><span>' +
    uiText(progress.practiced + ' / ' + progress.total + ' travaillés', progress.practiced + ' / ' + progress.total + ' geoefend') + '</span><span>' +
    uiText('Niveau de maîtrise : ' + progress.masteryLevel + '%', 'Beheersingsniveau: ' + progress.masteryLevel + '%') + '</span><span>' +
    uiText(progress.acquired + ' / ' + progress.total + ' acquis', progress.acquired + ' / ' + progress.total + ' gekend') + '</span><span>' +
    uiText('Objectif : ' + progress.target + '% acquis', 'Doel: ' + progress.target + '% gekend') + '</span></aside>';
}

function submitAnswer(rawAnswer) {
  const session = state.session;
  const question = session.questions[session.index];
  if (!question || !rawAnswer.trim()) return;
  markPracticeActivity();
  session.attempt_count += 1;
  const correct = isCorrect(rawAnswer, question.answers);
  session.lastMasteryFeedback = recordSyncAttempt(question, correct);

  if (session.mode === "test") {
    session.results.push({ question: question, answer: rawAnswer, correct: correct });
    session.index += 1;
    session.phase = "answer";
    renderQuestion();
    return;
  }

  if (session.mode === "learn") {
    if (session.phase === "correction") {
      if (correct) {
        recordAttempt(question, true);
        showFeedback(true, "Bien corrigé ! Tu le retiendras mieux.", "Goed verbeterd. Zo blijft het beter hangen.", true);
      } else {
        showFeedback(false, 'Regarde bien et écris une bonne réponse : <strong>' + escapeHtml(formatAnswers(question)) + '</strong>', 'Kijk goed en typ een juist antwoord: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>', false);
      }
      return;
    }
    if (correct) {
      recordAttempt(question, true);
      showFeedback(true, "Bonne réponse ! Bravo.", "Juist! Sterk gedaan.", true);
    } else {
      recordAttempt(question, false);
      requeueQuestion(question);
      session.phase = "correction";
      showFeedback(false, 'Réponses possibles : <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Écris-en une maintenant.', 'Mogelijke juiste antwoorden: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Typ er nu zelf één opnieuw.', false, true);
    }
    return;
  }

  if (correct) {
    recordAttempt(question, true);
    showFeedback(true, "Bonne réponse ! Continue.", "Juist! Ga zo verder.", true);
  } else {
    recordAttempt(question, false);
    session.questionAttempts += 1;
    if (session.questionAttempts === 1) {
      showFeedback(false, "Pas encore. Regarde bien et réessaie.", "Nog niet juist. Kijk nog eens goed en probeer opnieuw.", false);
    } else {
      requeueQuestion(question);
      showFeedback(false, 'Réponses possibles : <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Cet élément reviendra plus tard.', 'Mogelijke juiste antwoorden: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Dit item komt straks terug.', true, true);
    }
  }
}

function showFeedback(correct, messageFr, messageNl, allowNext, clearInput) {
  const feedback = document.querySelector("#feedback");
  const input = document.querySelector("#answer-input");
  const submit = document.querySelector(".submit-button");
  feedback.className = "feedback visible " + (correct ? "correct" : "wrong");
  feedback.innerHTML = '<span class="feedback-mark" aria-hidden="true">' + (correct ? "✓" : "!") + '</span><div><p>' + uiHtml(messageFr, messageNl) + '</p>' +
    masteryFeedbackHtml(state.session && state.session.lastMasteryFeedback) +
    (allowNext ? '<button class="button button-primary" type="button" data-action="next-question">' + uiText("Suivant", "Volgende") + '</button>' : "") + '</div>';
  if (allowNext) {
    input.disabled = true;
    submit.hidden = true;
    feedback.querySelector("button").focus();
  } else {
    if (clearInput !== false) input.value = "";
    input.focus();
  }
}

function nextQuestion() {
  const session = state.session;
  markPracticeActivity();
  session.index += 1;
  session.phase = "answer";
  session.questionAttempts = 0;
  renderQuestion();
}

function finishSession() {
  const session = state.session;
  settleActiveTime(true);
  if (session.mode === "test") {
    session.results.forEach(function (result) { recordAttempt(result.question, result.correct); });
  }
  state.progress.lastCompleted = {
    title: session.title,
    mode: session.mode,
    at: new Date().toISOString(),
    questions: session.question_count,
    question_count: session.question_count,
    attempt_count: session.attempt_count,
    available_count: session.available_count,
    active_duration_seconds: session.active_duration_seconds
  };
  session.finishedAt = new Date().toISOString();
  saveProgress();
  syncSessionSnapshot();
  clearActiveSession();
  renderSummary();
}

function recordSyncAttempt(question, correct) {
  const session = state.session;
  if (!session || !session.identity_verified) return null;
  const stableIds = question.stableItemIds || (question.stableItemId ? [question.stableItemId] : []);
  if (!stableIds.length) return null;
  const item = question.item || {};
  const path = session.course_path;
  const attemptNumber = session.sync_attempts.filter(function (attempt) {
    return attempt.item_id === stableIds[0] && attempt.item_variant === (question.itemVariant || "");
  }).length + 1;
  const before = masteryStatusForQuestion(question);
  const beforeLevel = masteryLevelForQuestion(question);
  const attempt = {
    client_attempt_id: createClientId(),
    item_id: stableIds[0],
    equivalent_item_ids: stableIds,
    legacy_item_id: question.itemId || "",
    item_variant: question.itemVariant || "",
    item_type: item.type || EXERCISES[session.exerciseKey].type,
    trajectory: path.trajectory,
    top_category: item.top_category || path.top_category,
    lesson: item.lesson || path.lesson,
    block: item.block || path.block,
    subsection: item.subsection || path.subsection,
    exercise_key: question.exerciseKey || session.exerciseKey,
    mode: session.mode,
    prompt: question.prompt,
    correct_answers: question.answers.slice(),
    was_correct: correct,
    attempt_number: attemptNumber,
    created_at: new Date().toISOString(),
    client_session_id: session.client_session_id,
    identity_subject: session.identity_subject
  };
  session.sync_attempts.push(attempt);
  appendMasteryAttempt(attempt);
  appendVerbEvidence(attempt);
  const after = masteryStatusForQuestion(question);
  const afterLevel = masteryLevelForQuestion(question);
  syncSessionSnapshot();
  return { before: before, after: after, beforeLevel: beforeLevel, afterLevel: afterLevel };
}

function syncSessionSnapshot() {
  const session = state.session;
  if (!session || !session.identity_verified || !window.MonParcoursSync) return;
  settleActiveTime(false);
  persistActiveSession();
  const path = session.course_path;
  window.MonParcoursSync.enqueueSession({
    client_session_id: session.client_session_id,
    identity_provider: session.identity_provider,
    identity_subject: session.identity_subject,
    session: {
      client_session_id: session.client_session_id,
      assignment_id: session.assignment_id,
      course_key: path.course_key,
      trajectory: path.trajectory,
      top_category: path.top_category,
      lesson: path.lesson,
      block: path.block,
      subsection: path.subsection,
      exercise_key: session.exerciseKey,
      mode: session.mode,
      question_count: session.question_count,
      attempt_count: session.attempt_count,
      active_duration_seconds: Math.max(0, Math.floor(Number(session.active_duration_seconds || 0))),
      started_at: session.startedAt,
      finished_at: session.finishedAt || null
    },
    attempts: session.sync_attempts.slice()
  });
}

function renderSummary() {
  state.view = "summary";
  const session = state.session;
  const results = session.mode === "test"
    ? session.results
    : session.questions.slice(0, Math.min(session.index, session.questions.length)).map(function (question) {
        return { question: question, correct: true, answer: "" };
      });
  const wrong = session.mode === "test" ? results.filter(function (result) { return !result.correct; }) : [];
  const correctCount = session.mode === "test" ? results.length - wrong.length : results.length;
  const score = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  const headingNl = session.mode === "test" ? (score >= 80 ? "Sterk resultaat." : score >= 60 ? "Goed op weg." : "Nog even oefenen.") : "Sessie afgerond.";
  const headingFr = session.mode === "test" ? (score >= 80 ? "Excellent résultat !" : score >= 60 ? "Tu es sur la bonne voie." : "Encore un peu d'entraînement.") : "Session terminée.";
  const madeCount = uniqueAnsweredExercises(session.sync_attempts);
  const remaining = Math.max(0, session.available_count - session.question_count);
  const coverageTextNl = session.question_count === session.available_count
    ? "Je oefende alle " + session.available_count + " beschikbare items."
    : "Je oefende " + session.question_count + " van de " + session.available_count + " beschikbare items.";
  const coverageTextFr = session.question_count === session.available_count
    ? "Tu as travaillé les " + session.available_count + " éléments disponibles."
    : "Tu as travaillé " + session.question_count + " des " + session.available_count + " éléments disponibles.";
  const storageNoteNl = session.identity_verified
    ? "Je voortgang is lokaal bewaard. Online synchronisatie gebeurt automatisch."
    : "Je voortgang is lokaal bewaard op dit toestel.";
  const storageNoteFr = session.identity_verified
    ? "Ta progression est enregistrée et sera synchronisée automatiquement."
    : "Ta progression est enregistrée sur cet appareil.";

  app.innerHTML =
    '<section class="summary-card"><p class="eyebrow">' + uiText(modeLabelFr(session.mode), modeLabel(session.mode)) + '</p><h1>' + uiText(headingFr, headingNl) + '</h1>' +
      '<div class="summary-coverage"><strong>' + uiText(coverageTextFr, coverageTextNl) + '</strong><span>' + uiText("Exercices réellement faits : " + madeCount + ".", "Werkelijk gemaakte oefeningen: " + madeCount + ".") + '</span><span>' + uiText("Pas sélectionnés dans cette session : " + remaining + ".", "Nog niet in deze sessie geselecteerd: " + remaining + ".") + '</span><span>' + uiText("Tentatives : " + session.attempt_count + ".", "Aantal pogingen: " + session.attempt_count + ".") + '</span><span>' + uiText("Temps actif : " + formatActiveDurationFr(session.active_duration_seconds) + ".", "Actieve oefentijd: " + formatActiveDuration(session.active_duration_seconds) + ".") + '</span></div>' +
      '<p class="sync-note">' + uiText(storageNoteFr, storageNoteNl) + '</p>' +
      '<div class="score-ring" style="--score:' + score + '"><span><strong>' + score + '%</strong><small>' + uiText(correctCount + " sur " + results.length + " correctes", correctCount + " van " + results.length + " juist") + '</small></span></div>' +
      (wrong.length ? '<div class="review-list"><h2>' + uiText("Revois tes erreurs", "Bekijk je fouten") + '</h2>' + wrong.map(function (result) {
        return '<article><span><small>' + uiText("Question", "Vraag") + '</small><strong>' + escapeHtml(result.question.prompt) + '</strong></span>' +
          '<span><small>' + uiText("Ta réponse", "Jouw antwoord") + '</small><del>' + escapeHtml(result.answer || "Aucune réponse / Geen antwoord") + '</del></span>' +
          '<span><small>' + uiText("Réponse correcte", "Correct") + '</small><ins>' + escapeHtml(formatAnswers(result.question)) + '</ins></span></article>';
      }).join("") + '</div>' : '<p class="perfect-note">' + uiText("Aucune erreur à retravailler.", "Geen fouten om opnieuw te oefenen.") + '</p>') +
      '<div class="summary-actions">' +
        (wrong.length ? '<button class="button button-primary" type="button" data-action="practice-test-errors">' + uiText("Retravailler mes erreurs", "Oefen mijn fouten") + '</button>' : "") +
        '<button class="button button-secondary" type="button" data-action="home">' + uiText("Retour à l'accueil", "Terug naar start") + '</button>' +
      '</div>' +
    '</section>';
  focusApp();
}

function uniqueAnsweredExercises(attempts) {
  const identities = new Set();
  (attempts || []).forEach(function (attempt) {
    identities.add(String(attempt.item_id || "") + "\u001f" + String(attempt.item_variant || ""));
  });
  return identities.size;
}

function formatActiveDuration(value) {
  const seconds = Math.max(0, Math.floor(Number(value || 0)));
  if (seconds < 60) return seconds + " s";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min " + String(seconds % 60).padStart(2, "0") + " s";
  return Math.floor(seconds / 3600) + " u " + String(Math.floor((seconds % 3600) / 60)).padStart(2, "0") + " min";
}

function formatActiveDurationFr(value) {
  const seconds = Math.max(0, Math.floor(Number(value || 0)));
  if (seconds < 60) return seconds + " s";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min " + String(seconds % 60).padStart(2, "0") + " s";
  return Math.floor(seconds / 3600) + " h " + String(Math.floor((seconds % 3600) / 60)).padStart(2, "0") + " min";
}

function practiceTestErrors() {
  const wrongQuestions = state.session.results.filter(function (result) { return !result.correct; }).map(function (result) {
    return Object.assign({}, result.question, { reviewCount: 0 });
  });
  beginSession(shuffle(wrongQuestions), "learn", state.session.exerciseKey, "Mes erreurs de test", { availableCount: wrongQuestions.length, titleFr: "Mes erreurs de test", titleNl: "Mijn testfouten", assignmentId: state.session.assignment_id });
}

function renderProgress() {
  state.view = "progress";
  const accuracy = state.progress.attempted ? Math.round((state.progress.correct / state.progress.attempted) * 100) : 0;
  const overall = masterySummaryForItems(allCourseItems());
  app.innerHTML =
    breadcrumbHtml([{ label: "Start", labelFr: "Accueil", action: "home" }]) +
    '<section class="page-heading"><p class="eyebrow">' + uiText("Sur cet appareil", "Op dit toestel") + '</p><h1>' + uiText("Ma progression", "Mijn voortgang") + '</h1><p class="lede">' + uiText("Tes résultats restent enregistrés dans ce navigateur.", "Je resultaten blijven bewaard in deze browser.") + '</p></section>' +
    '<section class="mastery-overview"><small>' + uiText("Niveau de maîtrise", "Beheersingsniveau") + '</small><h2>' + overall.masteryLevel + '%</h2>' + masteryBar(overall, false) + '<p class="mastery-acquired-total">' + uiText(overall.acquired + " / " + overall.total + " acquis", overall.acquired + " / " + overall.total + " gekend") + '</p><div class="mastery-counts"><span>' + uiText("Nouveau", "Nieuw") + '<strong>' + overall.new + '</strong></span><span>' + uiText("En cours", "Aan het leren") + '<strong>' + overall.learning + '</strong></span><span>' + uiText("Acquis", "Gekend") + '<strong>' + overall.acquired + '</strong></span></div></section>' +
    '<section class="stat-grid"><article><small>' + uiText("Réponses", "Antwoorden") + '</small><strong>' + state.progress.attempted + '</strong></article>' +
      '<article><small>' + uiText("Correctes", "Juist") + '</small><strong>' + state.progress.correct + '</strong></article>' +
      '<article><small>' + uiText("Erreurs", "Fouten") + '</small><strong>' + state.progress.wrong + '</strong></article>' +
      '<article><small>' + uiText("Précision", "Nauwkeurigheid") + '</small><strong>' + accuracy + '%</strong></article></section>' +
    '<section class="progress-stack">' +
      state.data.trajectories.map(function (trajectory, trajectoryIndex) {
        const stats = trajectoryStats(trajectoryIndex);
        const trajectoryMastery = masterySummaryForItems(trajectory.items || []);
        return '<article class="progress-card"><header><div><p class="eyebrow">' + escapeHtml(trajectory.trajectory) + '</p><h2>' + uiText("Niveau de maîtrise : " + trajectoryMastery.masteryLevel + "%", "Beheersingsniveau: " + trajectoryMastery.masteryLevel + "%") + '</h2></div><strong>' + trajectoryMastery.acquired + ' / ' + trajectoryMastery.total + ' ' + uiText("acquis", "gekend") + '</strong></header>' +
          masteryBar(trajectoryMastery, false) +
          '<div class="category-progress">' + trajectory.units.map(function (unit) {
            const category = categoryStats(trajectoryIndex, unit.top_category);
            const unitMastery = masterySummaryForItems(itemsForUnit(trajectory, unit));
            return '<div><span>' + contentIcon(contentTypeKey(unit.top_category)) + escapeHtml(unit.top_category) + '</span><strong>' + unitMastery.masteryLevel + '% ' + uiText("maîtrise", "beheersing") + ' · ' + unitMastery.acquired + ' ' + uiText("acquis", "gekend") + '</strong></div>';
          }).join("") + '</div></article>';
      }).join("") +
    '</section><button class="text-button danger" type="button" data-action="reset-progress">' + uiText("Effacer ma progression locale", "Wis mijn lokale voortgang") + '</button>';
  focusApp();
}

function renderDifficult() {
  const difficult = getDifficultItems("vocabulary");
  app.innerHTML =
    breadcrumbHtml([{ label: "Start", labelFr: "Accueil", action: "home" }]) +
    '<section class="page-heading"><p class="eyebrow">' + uiText("À revoir", "Extra aandacht") + '</p><h1>' + uiText("Mes mots difficiles", "Mijn moeilijke woorden") + '</h1>' +
    '<p class="lede">' + uiText("Les mots difficiles apparaissent automatiquement ici.", "Woorden waarop je fouten maakte, komen hier automatisch terecht.") + '</p></section>' +
    (difficult.length
      ? '<div class="difficult-list">' + difficult.map(function (item) {
          const stats = state.progress.items[item._id];
          return '<article><span><strong>' + escapeHtml(item.fr) + '</strong><small>' + escapeHtml(item.nl) + '</small></span><span class="mistake-badge">' + uiText(stats.wrong + "× faux", stats.wrong + "× fout") + '</span></article>';
        }).join("") + '</div><button class="button button-primary page-action" type="button" data-action="practice-difficult">' + uiText("Travailler mes mots difficiles", "Oefen mijn moeilijke woorden") + '</button>'
      : '<article class="empty-panel"><h2>' + uiText("Pas encore de mots difficiles", "Nog geen moeilijke woorden") + '</h2><p>' + uiText("Un mot apparaîtra ici après une erreur.", "Wanneer je een woord fout beantwoordt, verschijnt het hier.") + '</p><button class="button button-secondary" type="button" data-action="home">' + uiText("Choisir un exercice", "Kies een oefening") + '</button></article>');
  focusApp();
}

function practiceDifficult() {
  const items = getDifficultItems("vocabulary");
  if (!items.length) return renderDifficult();
  state.selectedScope = { unitOrder: 0, block: "", subsection: "", title: "Mes mots difficiles" };
  const questions = buildQuestions(items, "vocab-nl-fr");
  beginSession(selectQuestions(questions, questions.length), "learn", "vocab-nl-fr", "Mes mots difficiles", { availableCount: questions.length, titleFr: "Mes mots difficiles", titleNl: "Mijn moeilijke woorden" });
}

function continueLastSession() {
  const last = state.progress.lastSession;
  if (!last) return;
  if (last.assignmentId) {
    launchAssignment(last.assignmentId);
    return;
  }
  state.trajectoryIndex = last.trajectoryIndex;
  state.selectedUnitOrder = last.unitOrder;
  state.selectedScope = last.scope;
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  if (!unit) return renderHome();
  const items = itemsForScope(trajectory, unit, last.scope).filter(function (item) {
    return item.type === EXERCISES[last.exerciseKey].type;
  });
  const availableCount = questionCountForItems(items, last.exerciseKey);
  const requestedCount = last.question_count || Math.min(20, availableCount);
  const allQuestions = buildQuestionsForItems(items, last.exerciseKey, requestedCount);
  beginSession(selectQuestions(allQuestions, requestedCount), last.mode, last.exerciseKey, last.title, { availableCount: availableCount, titleFr: last.titleFr || last.title, titleNl: last.titleNl || last.title });
}

function isDynamicNumberItem(item) {
  return item && item.type === "number" && item.dynamic_range === true && Array.isArray(item.range) && item.range.length === 2;
}

function dynamicNumberCount(item) {
  if (!isDynamicNumberItem(item)) return 1;
  return Math.max(0, Number(item.range[1]) - Number(item.range[0]) + 1);
}

function exerciseItemCount(items) {
  return items.reduce(function (total, item) { return total + dynamicNumberCount(item); }, 0);
}

function questionCountForItems(items, exerciseKey) {
  if (exerciseKey === "assignment-mixed") return items.length;
  if (exerciseKey === "number-nl-fr" || exerciseKey === "number-fr-nl") {
    return items.reduce(function (total, item) { return total + dynamicNumberCount(item); }, 0);
  }
  return buildQuestions(items, exerciseKey).length;
}

function buildQuestionsForItems(items, exerciseKey, requestedCount) {
  if (exerciseKey !== "number-nl-fr" && exerciseKey !== "number-fr-nl") return buildQuestions(items, exerciseKey);
  const regularItems = items.filter(function (item) { return !isDynamicNumberItem(item); });
  const dynamicItems = items.filter(isDynamicNumberItem);
  const questions = buildQuestions(regularItems, exerciseKey);
  let remaining = Math.max(0, Number(requestedCount == null ? 30 : requestedCount) - questions.length);
  dynamicItems.forEach(function (item, index) {
    const remainingSpecs = dynamicItems.length - index;
    const count = Math.min(dynamicNumberCount(item), Math.ceil(remaining / remainingSpecs));
    questions.push.apply(questions, buildDynamicNumberQuestions(item, exerciseKey, count));
    remaining -= count;
  });
  return mergeEquivalentQuestions(questions);
}

function buildDynamicNumberQuestions(item, exerciseKey, count) {
  return dynamicNumberValues(item, count).map(function (value) {
    const displayValue = formatNumberValue(value);
    const french = belgianNumber(value);
    const regional = item.accepted_regional_alternatives && item.accepted_regional_alternatives[String(value)];
    const answers = exerciseKey === "number-nl-fr"
      ? unique([french, regional])
      : unique([displayValue, String(value)]);
    const base = {
      itemId: item._id + "::" + value,
      itemIds: [item._id + "::" + value],
      stableItemId: item.id,
      stableItemIds: [item.id],
      itemVariant: String(value),
      item: item,
      groupPath: [item._trajectoryIndex, item.top_category, item.lesson, item.block, item.subsection, item.type].join("::"),
      reviewCount: 0
    };
    return makeQuestion(
      base,
      exerciseKey === "number-nl-fr" ? displayValue : french,
      answers,
      exerciseKey === "number-nl-fr" ? "Schrijf het getal in het Frans" : "Schrijf het cijfer"
    );
  });
}

function dynamicNumberValues(item, requestedCount) {
  const minimum = Number(item.range[0]);
  const maximum = Number(item.range[1]);
  const available = maximum - minimum + 1;
  const count = Math.min(available, Math.max(0, Number(requestedCount) || 0));
  if (count === available) return Array.from({ length: available }, function (_, index) { return minimum + index; });
  const values = new Set();
  function add(value) {
    const number = Number(String(value).replace(/\s/g, ""));
    if (Number.isInteger(number) && number >= minimum && number <= maximum && values.size < count) values.add(number);
  }
  (item.source_examples || []).forEach(add);
  add(minimum);
  add(maximum);
  Object.keys(item.accepted_regional_alternatives || {}).forEach(add);
  while (values.size < count) add(minimum + Math.floor(Math.random() * available));
  return Array.from(values);
}

function formatNumberValue(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function belgianNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) return "";
  if (number < 1000) return belgianNumberBelowThousand(number);
  const thousands = Math.floor(number / 1000);
  const remainder = number % 1000;
  let prefix = thousands === 1 ? "mille" : belgianNumberBelowThousand(thousands).replace(/(?:cents|vingts)$/, function (match) { return match.slice(0, -1); }) + "-mille";
  return remainder ? prefix + "-" + belgianNumberBelowThousand(remainder) : prefix;
}

function belgianNumberBelowThousand(number) {
  const small = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
  if (number < small.length) return small[number];
  if (number < 20) return "dix-" + small[number - 10];
  if (number < 100) {
    const tens = Math.floor(number / 10) * 10;
    const remainder = number % 10;
    const tensWords = { 20: "vingt", 30: "trente", 40: "quarante", 50: "cinquante", 60: "soixante", 70: "septante", 80: "quatre-vingt", 90: "nonante" };
    if (!remainder) return tens === 80 ? "quatre-vingts" : tensWords[tens];
    return tensWords[tens] + (remainder === 1 && tens !== 80 ? "-et-un" : "-" + small[remainder]);
  }
  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  const prefix = hundreds === 1 ? "cent" : small[hundreds] + "-cent" + (remainder ? "" : "s");
  return remainder ? prefix + "-" + belgianNumberBelowThousand(remainder) : prefix;
}

function buildQuestions(items, exerciseKey) {
  if (exerciseKey === "verb-rule-recognition") {
    const model = window.MonParcoursVerbMastery;
    const representative = items.find(function (item) { const type = model && model.classification(item.id); return type && type.ruleId === "present_er"; });
    if (!representative) return [];
    return model.PERSONS.map(function (person) {
      const base = { itemId: representative._id, itemIds: [representative._id], stableItemId: representative.id, exerciseKey: exerciseKey,
        stableItemIds: [representative.id], itemVariant: "rule:present_er:" + person, item: representative,
        groupPath: [representative._trajectoryIndex, representative.top_category, representative.lesson, "present_er", "recognition"].join("::"), reviewCount: 0 };
      return makeQuestion(base, "verbe en -ER — " + person, [model.ER_ENDINGS[person], model.ER_ENDINGS[person].slice(1)],
        "Geef de uitgang van de regel");
    });
  }
  const questions = [];
  items.forEach(function (item) {
    if (isDynamicNumberItem(item) && (exerciseKey === "number-nl-fr" || exerciseKey === "number-fr-nl")) {
      questions.push.apply(questions, buildDynamicNumberQuestions(item, exerciseKey, Math.min(30, dynamicNumberCount(item))));
      return;
    }
    const base = {
      itemId: item._id,
      itemIds: [item._id],
      stableItemId: item.id,
      stableItemIds: [item.id],
      exerciseKey: exerciseKey,
      item: item,
      groupPath: [item._trajectoryIndex, item.top_category, item.lesson, item.block, item.subsection, item.type].join("::"),
      reviewCount: 0
    };
    if (exerciseKey === "vocab-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Vertaal naar het Frans"));
    if (exerciseKey === "vocab-fr-nl") questions.push(makeQuestion(base, item.fr, dutchAnswers(item.nl, item), "Vertaal naar het Nederlands"));
    if (exerciseKey === "verb-nl-inf") questions.push(makeQuestion(base, item.nl, [item.infinitive], "Geef de Franse infinitief"));
    if (exerciseKey === "verb-fr-nl") questions.push(makeQuestion(base, item.infinitive, dutchAnswers(item.nl, item), "Vertaal naar het Nederlands"));
    if (exerciseKey === "phrase-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Schrijf de volledige Franse zin"));
    if (exerciseKey === "grammar") questions.push(makeQuestion(base, item.prompt, answerList(item.answer, item), "Vul de regel aan · " + item.category, item.example_fr || item.example_nl || ""));
    if (exerciseKey === "number-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Schrijf het getal in het Frans"));
    if (exerciseKey === "number-fr-nl") questions.push(makeQuestion(base, item.fr, [item.nl], "Schrijf het cijfer"));
    if (exerciseKey === "verb-nl-conj" || exerciseKey === "verb-fr-conj") {
      (item.conjugations || []).forEach(function (conjugation) {
        concreteConjugations(conjugation).forEach(function (variant) {
          const prompt = (exerciseKey === "verb-nl-conj" ? item.nl : item.infinitive) + " — " + variant.subject;
          questions.push(makeQuestion(Object.assign({}, base, { itemVariant: variant.subject }), prompt, [variant.form], "Vervoeg het werkwoord"));
        });
      });
    }
  });
  return mergeEquivalentQuestions(questions);
}

function concreteConjugations(conjugation) {
  const subject = String(conjugation.subject || "").trim();
  const form = String(conjugation.form || "").trim();
  if (!subject.includes("/")) return [{ subject: subject, form: form }];
  if (!form.startsWith(subject + " ")) return [];
  const ending = form.slice(subject.length).trim();
  return subject.split("/").map(function (person) {
    const name = person.trim();
    return { subject: name, form: name + " " + ending };
  });
}

function makeQuestion(base, prompt, answers, instruction, context) {
  return Object.assign({}, base, { prompt: prompt, answers: unique(answers), instruction: instruction, context: context || "" });
}

function mergeEquivalentQuestions(questions) {
  const grouped = new Map();
  questions.forEach(function (question) {
    const key = [question.groupPath, question.instruction, normalizeAnswer(question.prompt, true), question.context].join("||");
    if (!grouped.has(key)) {
      grouped.set(key, Object.assign({}, question, {
        answers: question.answers.slice(),
        itemIds: question.itemIds.slice(),
        stableItemIds: question.stableItemIds.slice()
      }));
      return;
    }
    const existing = grouped.get(key);
    existing.answers = unique(existing.answers.concat(question.answers));
    existing.itemIds = unique(existing.itemIds.concat(question.itemIds));
    existing.stableItemIds = unique(existing.stableItemIds.concat(question.stableItemIds));
  });
  return Array.from(grouped.values());
}

function formatAnswers(question) {
  return unique(question.answers).join(", ");
}

function answerList(primary, item) {
  const explicit = Array.isArray(item.accepted_answers) ? item.accepted_answers : [];
  return unique(explicit.length ? explicit : [primary]);
}

function dutchAnswers(value, item) {
  const explicit = item && Array.isArray(item.accepted_answers_nl) ? item.accepted_answers_nl : [];
  return unique(explicit.length ? explicit : [value]);
}

function selectQuestions(questions, requestedCount) {
  const scored = questions.map(function (question) {
    const stats = (question.itemIds || [question.itemId]).reduce(function (total, itemId) {
      const itemStats = state.progress.items[itemId] || { wrong: 0, correct: 0 };
      total.wrong += itemStats.wrong;
      total.correct += itemStats.correct;
      return total;
    }, { wrong: 0, correct: 0 });
    const weight = 1 + Math.max(0, stats.wrong - stats.correct);
    return { question: question, score: Math.pow(Math.random(), 1 / weight) };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  const limit = Math.min(requestedCount == null ? 20 : requestedCount, scored.length);
  return scored.slice(0, limit).map(function (entry) {
    return Object.assign({}, entry.question, { reviewCount: 0 });
  });
}

function requeueQuestion(question) {
  if (question.reviewCount >= 1) return;
  question.reviewCount += 1;
  const copy = Object.assign({}, question);
  const queue = state.session.questions;
  const minimum = state.session.index + 2;
  const insertion = Math.min(queue.length, minimum + Math.floor(Math.random() * 3));
  queue.splice(insertion, 0, copy);
}

function isCorrect(answer, accepted) {
  const candidate = normalizeAnswer(answer, true);
  return accepted.some(function (value) { return normalizeAnswer(value, true) === candidate; });
}

function normalizeAnswer(value, strict) {
  let normalized = String(value)
    .normalize("NFC")
    .toLocaleLowerCase("fr")
    .replace(/[’‘\u0060´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.,;:])/g, "$1")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!strict) normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized;
}

function recordAttempt(question, correct) {
  const progress = state.progress;
  const now = new Date().toISOString();
  (question.itemIds || [question.itemId]).forEach(function (itemId) {
    const itemStats = progress.items[itemId] || { attempts: 0, correct: 0, wrong: 0, last: null };
    itemStats.attempts += 1;
    itemStats.correct += correct ? 1 : 0;
    itemStats.wrong += correct ? 0 : 1;
    itemStats.last = now;
    progress.items[itemId] = itemStats;
  });
  progress.attempted += 1;
  progress.correct += correct ? 1 : 0;
  progress.wrong += correct ? 0 : 1;
  progress.updatedAt = now;
  saveProgress();
}

function allCourseItems() {
  if (!state.data) return [];
  return state.data.trajectories.reduce(function (items, trajectory) {
    return items.concat(trajectory.items || []);
  }, []);
}

function allExerciseItems() {
  return allCourseItems().filter(isExerciseItem);
}

function loadMasteryAttempts() {
  try {
    const stored = JSON.parse(localStorage.getItem(MASTERY_ATTEMPTS_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function loadVerbEvidence() {
  try {
    const rows = JSON.parse(localStorage.getItem(VERB_EVIDENCE_KEY));
    return Array.isArray(rows) ? rows : [];
  } catch (error) { return []; }
}

function currentVerbEvidence() {
  const identity = currentStudentIdentity();
  const merged = new Map();
  state.verbEvidence.server.forEach(function (row) { if (row.client_attempt_id) merged.set(String(row.client_attempt_id), row); });
  state.mastery.localAttempts.forEach(function (row) {
    if (row.identity_subject === identity.subject && row.client_attempt_id &&
        window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(row.item_id)) merged.set(String(row.client_attempt_id), row);
  });
  state.verbEvidence.local.forEach(function (row) {
    if (row.identity_subject === identity.subject && row.client_attempt_id) merged.set(String(row.client_attempt_id), row);
  });
  return Array.from(merged.values());
}

function appendVerbEvidence(attempt) {
  if (!window.MonParcoursVerbMastery || !window.MonParcoursVerbMastery.classification(attempt.item_id)) return;
  if (state.verbEvidence.local.some(function (row) { return row.client_attempt_id === attempt.client_attempt_id; })) return;
  state.verbEvidence.local.push({ client_attempt_id: attempt.client_attempt_id, client_session_id: attempt.client_session_id,
    identity_subject: attempt.identity_subject, item_id: attempt.item_id, item_variant: attempt.item_variant,
    exercise_key: attempt.exercise_key, mode: attempt.mode, was_correct: attempt.was_correct, created_at: attempt.created_at });
  localStorage.setItem(VERB_EVIDENCE_KEY, JSON.stringify(state.verbEvidence.local));
}

function saveMasteryAttempts() {
  localStorage.setItem(MASTERY_ATTEMPTS_KEY, JSON.stringify(state.mastery.localAttempts));
}

function invalidateMasteryRecords() {
  if (state.mastery) state.mastery.records = null;
}

function appendMasteryAttempt(attempt) {
  if (!attempt || !attempt.client_attempt_id) return;
  if (state.mastery.localAttempts.some(function (entry) { return entry.client_attempt_id === attempt.client_attempt_id; })) return;
  state.mastery.localAttempts.push({
    client_attempt_id: attempt.client_attempt_id,
    client_session_id: attempt.client_session_id,
    identity_subject: attempt.identity_subject,
    item_id: attempt.item_id,
    equivalent_item_ids: (attempt.equivalent_item_ids || []).slice(),
    item_variant: attempt.item_variant || "",
    item_type: attempt.item_type || "",
    exercise_key: attempt.exercise_key || "",
    mode: attempt.mode,
    was_correct: attempt.was_correct === true,
    created_at: attempt.created_at
  });
  saveMasteryAttempts();
  invalidateMasteryRecords();
}

function legacyMasteryRows() {
  if (!state.data) return [];
  const byLegacy = new Map();
  allCourseItems().forEach(function (item) { byLegacy.set(item._id, item); });
  const rows = [];
  Object.keys(state.progress.items || {}).forEach(function (legacyId) {
    const direct = byLegacy.get(legacyId);
    let item = direct;
    let variant = "";
    if (!item) {
      byLegacy.forEach(function (candidate, candidateId) {
        if (!item && legacyId.indexOf(candidateId + "::") === 0) {
          item = candidate;
          variant = legacyId.slice(candidateId.length + 2);
        }
      });
    }
    const stats = state.progress.items[legacyId];
    if (!item || !stats || !stats.attempts) return;
    if (item.type === "verb") return; // Legacy totals mix lexical and conjugation; never infer lexical mastery from them.
    rows.push({
      item_id: item.id,
      item_variant: variant,
      practiced_attempts: stats.attempts,
      independent_attempts: 0,
      independent_correct: 0,
      independent_session_count: 0,
      latest_independent_correct: null
    });
  });
  return rows;
}

function currentMasteryRecords() {
  if (state.mastery.records) return state.mastery.records;
  const api = window.MonParcoursMastery;
  if (!api) return new Map();
  const identity = currentStudentIdentity();
  const attempts = state.mastery.localAttempts.filter(function (attempt) {
    if (attempt.identity_subject && attempt.identity_subject !== identity.subject) return false;
    const verbType = window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(attempt.item_id);
    return !verbType || ["verb-nl-inf", "verb-fr-nl"].includes(attempt.exercise_key) ||
      !attempt.exercise_key && !attempt.item_variant;
  });
  state.mastery.records = api.mergeMasterySources(
    state.mastery.serverRows,
    attempts,
    state.mastery.acceptedAttemptIds,
    legacyMasteryRows()
  );
  return state.mastery.records;
}

function masterySummaryForItems(items) {
  const api = window.MonParcoursMastery;
  if (api) return api.calculateMasterySummary(items || [], currentMasteryRecords());
  const total = new Set((items || []).map(function (item) { return item && item.id; }).filter(Boolean)).size;
  return { total: total, practiced: 0, new: total, learning: 0, acquired: 0, masteryLevel: 0, masteryScoreTotal: 0, percentages: { new: total ? 100 : 0, learning: 0, acquired: 0 } };
}

function masteryStatusForQuestion(question) {
  const api = window.MonParcoursMastery;
  if (!api || !question) return "new";
  const verbGoal = verbGoalForQuestion(question);
  if (verbGoal) return window.MonParcoursVerbMastery.calculate(verbGoal, currentVerbEvidence()).status;
  const itemId = question.stableItemId || (question.stableItemIds || [])[0];
  const record = currentMasteryRecords().get(api.keyFor(itemId, question.itemVariant || ""));
  return api.getMasteryStatus(record);
}

function masteryLevelForQuestion(question) {
  const api = window.MonParcoursMastery;
  if (!api || !question) return 0;
  const verbGoal = verbGoalForQuestion(question);
  if (verbGoal) return window.MonParcoursVerbMastery.calculate(verbGoal, currentVerbEvidence()).level;
  const itemId = question.stableItemId || (question.stableItemIds || [])[0];
  const record = currentMasteryRecords().get(api.keyFor(itemId, question.itemVariant || ""));
  return api.getMasteryLevel(record);
}

function verbGoalForQuestion(question) {
  const api = window.MonParcoursVerbMastery;
  if (!api || !question || !question.item || question.item.type !== "verb" || !question.itemVariant) return null;
  return api.goalForItem(question.item);
}

function masteryFeedbackHtml(change) {
  if (!change) return "";
  const levelFr = change.beforeLevel === change.afterLevel
    ? "Niveau de maîtrise : " + change.afterLevel + "%"
    : "Niveau de maîtrise : " + change.beforeLevel + "% → " + change.afterLevel + "%";
  const levelNl = change.beforeLevel === change.afterLevel
    ? "Beheersingsniveau: " + change.afterLevel + "%"
    : "Beheersingsniveau: " + change.beforeLevel + "% → " + change.afterLevel + "%";
  if (change.before === "learning" && change.after === "acquired") {
    return '<p class="mastery-feedback is-newly-acquired">' + uiText("Acquis ! · " + levelFr, "Nu gekend! · " + levelNl) + '</p>';
  }
  const labels = {
    new: ["Nouveau", "Nieuw"],
    learning: ["Statut : En cours", "Status: Aan het leren"],
    acquired: ["Statut : Acquis", "Status: Gekend"]
  };
  const label = labels[change.after] || labels.learning;
  return '<p class="mastery-feedback">' + uiText(levelFr + " · " + label[0], levelNl + " · " + label[1]) + '</p>';
}

function restoreMasteryServerCache() {
  const identity = currentStudentIdentity();
  state.mastery.serverRows = [];
  state.mastery.acceptedAttemptIds = [];
  try {
    const cache = JSON.parse(localStorage.getItem(MASTERY_SERVER_CACHE_KEY));
    if (cache && cache.identity_subject === identity.subject && Array.isArray(cache.items)) state.mastery.serverRows = cache.items;
  } catch (error) {
    /* Een beschadigde cache mag de lokale trainer niet blokkeren. */
  }
  invalidateMasteryRecords();
}

function restoreVerbServerCache() {
  state.verbEvidence.server = [];
  try {
    const cache = JSON.parse(localStorage.getItem(VERB_SERVER_CACHE_KEY));
    if (cache && cache.identity_subject === currentStudentIdentity().subject && Array.isArray(cache.items)) state.verbEvidence.server = cache.items;
  } catch (error) { /* Offline fallback remains local. */ }
}

async function refreshVerbEvidenceFromServer() {
  if (state.verbEvidence.refreshing || !window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured() || !window.StudentIdentity) return false;
  const identity = currentStudentIdentity();
  const credential = window.StudentIdentity.getSyncCredential && window.StudentIdentity.getSyncCredential();
  if (!identity.verified || !credential) return false;
  state.verbEvidence.refreshing = true;
  try {
    const rows = await window.MonParcoursSupabase.rpc("get_student_verb_evidence", { p_identity_token: credential });
    if (!Array.isArray(rows) || currentStudentIdentity().subject !== identity.subject) return false;
    state.verbEvidence.server = rows;
    localStorage.setItem(VERB_SERVER_CACHE_KEY, JSON.stringify({ identity_subject: identity.subject, items: rows }));
    if (state.view === "home") renderHome();
    else if (state.view === "unit") renderUnit();
    else if (state.view === "assignment-detail") renderAssignmentDetail(state.activeAssignmentId);
    return true;
  } catch (error) { return false; }
  finally { state.verbEvidence.refreshing = false; }
}

async function refreshMasteryFromServer() {
  if (state.mastery.refreshing || !window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured() || !window.StudentIdentity) return false;
  const identity = currentStudentIdentity();
  const credential = window.StudentIdentity.getSyncCredential && window.StudentIdentity.getSyncCredential();
  if (!identity || !identity.verified || identity.provider === "local" || !credential) return false;
  state.mastery.refreshing = true;
  try {
    const pendingIds = state.mastery.localAttempts.filter(function (attempt) {
      return attempt.identity_subject === identity.subject;
    }).map(function (attempt) { return attempt.client_attempt_id; }).filter(Boolean).slice(-5000);
    const result = await window.MonParcoursSupabase.rpc("get_student_mastery", {
      p_identity_token: credential,
      p_pending_attempt_ids: pendingIds
    });
    const rows = result && Array.isArray(result.items) ? result.items : [];
    const accepted = result && Array.isArray(result.accepted_pending_attempt_ids) ? result.accepted_pending_attempt_ids.map(String) : [];
    state.mastery.serverRows = rows;
    state.mastery.acceptedAttemptIds = accepted;
    if (accepted.length) {
      const acceptedSet = new Set(accepted);
      state.mastery.localAttempts = state.mastery.localAttempts.filter(function (attempt) {
        return attempt.identity_subject !== identity.subject || !acceptedSet.has(String(attempt.client_attempt_id));
      });
      saveMasteryAttempts();
      state.mastery.acceptedAttemptIds = [];
    }
    localStorage.setItem(MASTERY_SERVER_CACHE_KEY, JSON.stringify({ identity_subject: identity.subject, items: rows, updated_at: new Date().toISOString() }));
    invalidateMasteryRecords();
    if (state.view === "home") renderHome();
    else if (state.view === "unit") renderUnit();
    else if (state.view === "assignment-detail") renderAssignmentDetail(state.activeAssignmentId);
    return true;
  } catch (error) {
    return false;
  } finally {
    state.mastery.refreshing = false;
  }
}

function trajectoryStats(index) {
  const trajectory = state.data.trajectories[index];
  const ids = (trajectory.items || []).map(function (item) { return item._id; });
  return statsForIds(ids, ids.length);
}

function categoryStats(trajectoryIndex, category) {
  const items = (state.data.trajectories[trajectoryIndex].items || []).filter(function (item) { return item.top_category === category; });
  return statsForIds(items.map(function (item) { return item._id; }), items.length);
}

function statsForIds(ids, total) {
  let practiced = 0;
  let correct = 0;
  let attempted = 0;
  ids.forEach(function (id) {
    const stats = state.progress.items[id];
    if (!stats) return;
    practiced += 1;
    correct += stats.correct;
    attempted += stats.attempts;
  });
  return {
    practiced: practiced,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    coverage: total ? Math.round((practiced / total) * 100) : 0
  };
}

function getDifficultItems(type) {
  const all = state.data ? state.data.trajectories.reduce(function (items, trajectory) {
    return items.concat(trajectory.items || []);
  }, []) : [];
  return all.filter(function (item) {
    const stats = state.progress.items[item._id];
    return item.type === type && stats && stats.wrong > 0 && stats.wrong >= stats.correct;
  }).sort(function (a, b) {
    return state.progress.items[b._id].wrong - state.progress.items[a._id].wrong;
  });
}

function itemsForUnit(trajectory, unit) {
  return (trajectory.items || []).filter(function (item) {
    return item.top_category === unit.top_category && item.lesson === unit.title;
  });
}

function itemsForScope(trajectory, unit, scope) {
  return itemsForUnit(trajectory, unit).filter(function (item) {
    if (scope.block && item.block !== scope.block) return false;
    if (scope.subsection && item.subsection !== scope.subsection) return false;
    if (scope.category && item.category !== scope.category) return false;
    if (scope.itemId && item.id !== scope.itemId) return false;
    return true;
  });
}

function exerciseItemsForScope(trajectory, unit, scope) {
  return itemsForScope(trajectory, unit, scope).filter(isExerciseItem);
}

function exerciseKeysForItems(items) {
  const available = [];
  Object.keys(TYPE_EXERCISES).forEach(function (type) {
    if (!items.some(function (item) { return item.type === type; })) return;
    TYPE_EXERCISES[type].forEach(function (key) {
      if (key === "verb-rule-recognition" && !items.some(function (item) {
        const classification = window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(item.id);
        return classification && classification.ruleId === "present_er";
      })) return;
      available.push(key);
    });
  });
  return available;
}

function isExerciseItem(item) {
  return Object.prototype.hasOwnProperty.call(TYPE_EXERCISES, item.type);
}

function currentTrajectory() {
  return state.data.trajectories[state.trajectoryIndex];
}

function currentUnit() {
  return currentTrajectory().units.find(function (unit) { return unit.order === state.selectedUnitOrder; });
}

function breadcrumbHtml(items) {
  return '<nav class="breadcrumbs" aria-label="Fil d’Ariane / Kruimelpad">' + items.map(function (item) {
    return '<button type="button" data-action="' + item.action + '">' + (item.labelFr ? uiText(item.labelFr, item.label) : escapeHtml(item.label)) + '</button><span>/</span>';
  }).join("") + '<strong>' + (currentUnit() ? escapeHtml(currentUnit().title) : uiText("Aperçu", "Overzicht")) + '</strong></nav>';
}

function modeLabel(mode) {
  return mode === "learn" ? "Leren" : mode === "practice" ? "Oefenen" : "Test jezelf";
}

function modeLabelFr(mode) {
  return mode === "learn" ? "Apprendre" : mode === "practice" ? "S'entraîner" : "Se tester";
}

function instructionFrench(instruction) {
  const value = String(instruction || "");
  if (value === "Vertaal naar het Frans") return "Traduis en français";
  if (value === "Vertaal naar het Nederlands") return "Traduis en néerlandais";
  if (value === "Geef de Franse infinitief") return "Donne l'infinitif français";
  if (value === "Schrijf de volledige Franse zin") return "Écris la phrase française complète";
  if (value === "Schrijf het getal in het Frans") return "Écris le nombre en français";
  if (value === "Schrijf het cijfer") return "Écris le nombre en chiffres";
  if (value === "Vervoeg het werkwoord") return "Conjugue le verbe";
  if (value === "Geef de uitgang van de regel") return "Donne la terminaison de la règle";
  if (value.indexOf("Vul de regel aan") === 0) return value.replace("Vul de regel aan", "Complète la règle");
  return value;
}

function insertAccent(accent) {
  const input = document.querySelector("#answer-input");
  if (!input) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = input.value.slice(0, start) + accent + input.value.slice(end);
  input.setSelectionRange(start + accent.length, start + accent.length);
  input.focus();
}

function focusAnswer() {
  const input = document.querySelector("#answer-input");
  if (input) input.focus();
}

function focusApp() {
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function shuffle(values) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function defaultProgress() {
  return {
    version: 1,
    attempted: 0,
    correct: 0,
    wrong: 0,
    items: {},
    settings: { strictAccents: true, sessionSize: 20 },
    lastSession: null,
    lastCompleted: null,
    updatedAt: null
  };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.assign(defaultProgress(), saved || {}, {
      items: (saved && saved.items) || {},
      settings: Object.assign({ sessionSize: 20 }, saved && saved.settings, { strictAccents: true })
    });
  } catch (error) {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, " ");
}

function uiText(french, dutch, extraClass) {
  return '<span class="ui-bilingual' + (extraClass ? " " + escapeAttr(extraClass) : "") + '"><span class="ui-fr" lang="fr">' + escapeHtml(french) + '</span><span class="ui-nl" lang="nl">' + escapeHtml(dutch) + '</span></span>';
}

function uiHtml(frenchHtml, dutchHtml) {
  return '<span class="ui-bilingual ui-block"><span class="ui-fr" lang="fr">' + frenchHtml + '</span><span class="ui-nl" lang="nl">' + dutchHtml + '</span></span>';
}

function setUiMessage(element, french, dutch) {
  if (element) element.innerHTML = '<span class="ui-message">' + uiText(french, dutch, "ui-block") + '</span>';
}

initializeIdentity();
loadCourse();
