const DATA_URL = "./data/course.json";
const STORAGE_KEY = "monParcoursProgressV1";
const ACCENTS = ["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "ô", "î", "ï"];
const EXERCISES = {
  "vocab-nl-fr": { type: "vocabulary", label: "Nederlands → Frans", short: "Woordenschat" },
  "vocab-fr-nl": { type: "vocabulary", label: "Frans → Nederlands", short: "Woordenschat" },
  "verb-nl-inf": { type: "verb", label: "Nederlands → infinitief", short: "Werkwoorden" },
  "verb-fr-nl": { type: "verb", label: "Infinitief → Nederlands", short: "Werkwoorden" },
  "verb-nl-conj": { type: "verb", label: "Nederlands + persoon → vervoeging", short: "Vervoegen" },
  "verb-fr-conj": { type: "verb", label: "Infinitief + persoon → vervoeging", short: "Vervoegen" },
  "phrase-nl-fr": { type: "phrase", label: "Nederlandse zin → Franse zin", short: "Zinnen" },
  "grammar": { type: "grammar_rule", label: "Grammaticaregel aanvullen", short: "Grammatica" },
  "number-nl-fr": { type: "number", label: "Cijfer → Frans", short: "Getallen" },
  "number-fr-nl": { type: "number", label: "Frans → cijfer", short: "Getallen" }
};
const TYPE_EXERCISES = {
  vocabulary: ["vocab-nl-fr", "vocab-fr-nl"],
  verb: ["verb-nl-inf", "verb-fr-nl", "verb-nl-conj", "verb-fr-conj"],
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
  progress: loadProgress()
};

const app = document.querySelector("#app");
const settingsDialog = document.querySelector("#settings-dialog");
const strictToggle = document.querySelector("#strict-accents");
strictToggle.checked = state.progress.settings.strictAccents;

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
strictToggle.addEventListener("change", function (event) {
  state.progress.settings.strictAccents = event.target.checked;
  saveProgress();
});

function handleClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;

  if (action === "home") renderHome();
  if (action === "open-settings") settingsDialog.showModal();
  if (action === "select-trajectory") {
    state.trajectoryIndex = Number(control.dataset.index);
    renderHome();
  }
  if (action === "select-unit") {
    state.selectedUnitOrder = Number(control.dataset.order);
    renderUnit();
  }
  if (action === "back-unit") renderUnit();
  if (action === "choose-scope") {
    state.selectedScope = {
      unitOrder: Number(control.dataset.order),
      block: control.dataset.block || "",
      subsection: control.dataset.subsection || "",
      title: control.dataset.title || ""
    };
    renderSetup();
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
    if (window.confirm("Wil je alle lokale voortgang op dit toestel wissen?")) {
      localStorage.removeItem(STORAGE_KEY);
      state.progress = defaultProgress();
      strictToggle.checked = true;
      settingsDialog.close();
      renderHome();
    }
  }
}

function handleSubmit(event) {
  if (event.target.id !== "answer-form") return;
  event.preventDefault();
  submitAnswer(new FormData(event.target).get("answer") || "");
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
    renderHome();
  } catch (error) {
    app.innerHTML = '<section class="error-card"><p class="eyebrow">Laden mislukt</p><h1>De cursus kon niet worden geopend.</h1><p>' + escapeHtml(error.message) + '</p><p>Open deze map via een lokale webserver; dubbelklikken op index.html is niet voldoende.</p></section>';
  }
}

function renderHome() {
  if (!state.data) return;
  state.session = null;
  const trajectory = state.data.trajectories[state.trajectoryIndex];
  const totalItems = state.data.trajectories.reduce(function (sum, entry) {
    return sum + (entry.items || []).length;
  }, 0);
  const last = state.progress.lastSession;
  const difficultCount = getDifficultItems("vocabulary").length;
  const accuracy = state.progress.attempted
    ? Math.round((state.progress.correct / state.progress.attempted) * 100)
    : 0;

  app.innerHTML =
    '<section class="hero">' +
      '<div><p class="eyebrow">Frans leren op jouw tempo</p><h1>Kies waar je vandaag sterker in wilt worden.</h1>' +
      '<p class="lede">Oefen de leerstof in precies dezelfde volgorde als in je cursus. Eén duidelijke stap per keer.</p></div>' +
      '<aside class="hero-note" aria-label="Cursusoverzicht"><strong>' + state.data.trajectories.length + ' trajecten</strong>' +
      '<span>' + totalItems + ' leeritems uit je cursus</span></aside>' +
    '</section>' +
    '<section class="quick-grid" aria-label="Jouw overzicht">' +
      dashboardCard("Verder oefenen", last ? last.title : "Kies eerst een onderdeel", last ? "Ga door waar je stopte" : "Je laatste sessie verschijnt hier", "continue-session", !last, "play") +
      dashboardCard("Mijn moeilijke woorden", difficultCount + " " + (difficultCount === 1 ? "woord" : "woorden"), "Herhaal wat nog niet vlot gaat", "view-difficult", false, "spark") +
      dashboardCard("Mijn voortgang", accuracy + "% juist", state.progress.attempted + " antwoorden gegeven", "view-progress", false, "chart") +
    '</section>' +
    '<section aria-labelledby="trajectory-heading">' +
      '<div class="section-heading"><div><p class="eyebrow">Stap 1</p><h2 id="trajectory-heading">Kies je Trajet</h2></div></div>' +
      '<div class="trajectory-grid">' +
        state.data.trajectories.map(function (entry, index) {
          const stats = trajectoryStats(index);
          return '<button class="trajectory-card" type="button" data-action="select-trajectory" data-index="' + index + '" aria-pressed="' + (index === state.trajectoryIndex) + '">' +
            '<span class="trajectory-number"><span>' + escapeHtml(entry.trajectory) + '</span><span class="count-badge">' + (entry.items || []).length + '</span></span>' +
            '<strong>' + escapeHtml(entry.trajectory) + '</strong><small>' + entry.units.length + ' cursusonderdelen · ' + stats.practiced + ' geoefend</small>' +
          '</button>';
        }).join("") +
      '</div>' +
    '</section>' +
    '<section aria-labelledby="unit-heading">' +
      '<div class="section-heading"><div><p class="eyebrow">Stap 2</p><h2 id="unit-heading">Onderdelen van ' + escapeHtml(trajectory.trajectory) + '</h2></div><span class="step-label">' + (trajectory.items || []).length + ' leeritems</span></div>' +
      '<div class="unit-list">' +
        trajectory.units.map(function (unit) {
          const count = itemsForUnit(trajectory, unit).length;
          const unitStats = categoryStats(state.trajectoryIndex, unit.top_category);
          return '<button class="unit-card" type="button" data-action="select-unit" data-order="' + unit.order + '">' +
            '<span class="unit-order">' + unit.order + '</span>' +
            '<span class="unit-copy"><strong>' + escapeHtml(unit.top_category) + '</strong><small>' + escapeHtml(unit.title) + '</small></span>' +
            '<span class="unit-meta">' + (count ? count + ' items · ' + unitStats.practiced + ' geoefend' : "cursusinfo") + '</span>' +
          '</button>';
        }).join("") +
      '</div>' +
    '</section>';
  focusApp();
}

function dashboardCard(title, value, description, action, disabled, icon) {
  return '<button class="quick-card" type="button" data-action="' + action + '"' + (disabled ? " disabled" : "") + '>' +
    '<span class="quick-icon ' + icon + '" aria-hidden="true"></span><span><small>' + escapeHtml(title) + '</small><strong>' + escapeHtml(value) + '</strong><em>' + escapeHtml(description) + '</em></span></button>';
}

function renderUnit() {
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  if (!unit) return renderHome();
  state.session = null;
  const unitItems = itemsForUnit(trajectory, unit);
  const exerciseItems = unitItems.filter(isExerciseItem);
  const soundItems = unitItems.filter(function (item) { return item.type === "sound_rule"; });
  const sectionsHtml = unit.study_sections.length
    ? unit.study_sections.map(function (section) {
        const blockItems = unitItems.filter(function (item) { return item.block === section.title && isExerciseItem(item); });
        return '<article class="structure-card">' +
          '<div class="structure-heading"><div><p class="eyebrow">Studieblok</p><h3>' + escapeHtml(section.title) + '</h3></div>' +
          (blockItems.length ? scopeButton(unit, section.title, "", section.title, blockItems.length, "Oefen dit studieblok") : "") + '</div>' +
          '<div class="subsection-list">' +
            section.subsections.map(function (subsection) {
              const subset = unitItems.filter(function (item) {
                return item.block === section.title && item.subsection === subsection.title && isExerciseItem(item);
              });
              return '<div class="subsection-row"><div><strong>' + escapeHtml(subsection.title) + '</strong>' +
                '<div class="content-tags">' + subsection.content_types.map(function (type) {
                  return '<span>' + escapeHtml(type) + '</span>';
                }).join("") + '</div></div>' +
                (subset.length ? scopeButton(unit, section.title, subsection.title, subsection.title, subset.length, "Kies") : '<span class="source-only">Alleen cursusinfo</span>') +
              '</div>';
            }).join("") +
          '</div></article>';
      }).join("")
    : '<article class="empty-panel"><p class="eyebrow">Cursusstructuur</p><h3>Geen oefenblokken in de bron</h3><p>Dit onderdeel blijft zichtbaar omdat het in de cursus staat. De JSON bevat hier geen oefenitems voor.</p></article>';

  app.innerHTML =
    breadcrumbHtml([{ label: trajectory.trajectory, action: "home" }]) +
    '<section class="unit-hero"><div><p class="eyebrow">' + escapeHtml(unit.top_category) + '</p><h1>' + escapeHtml(unit.title) + '</h1>' +
    '<p class="lede">' + exerciseItems.length + ' oefenitems in dit cursusonderdeel.</p></div>' +
    (exerciseItems.length ? scopeButton(unit, "", "", unit.title, exerciseItems.length, "Oefen alles") : "") + '</section>' +
    '<section class="structure-stack" aria-label="Cursusstructuur">' + sectionsHtml + '</section>' +
    renderSoundNotes(soundItems);
  focusApp();
}

function scopeButton(unit, block, subsection, title, count, label) {
  return '<button class="button button-secondary" type="button" data-action="choose-scope" data-order="' + unit.order +
    '" data-block="' + escapeAttr(block) + '" data-subsection="' + escapeAttr(subsection) + '" data-title="' + escapeAttr(title) + '">' +
    escapeHtml(label) + '<small>' + count + ' items</small></button>';
}

function renderSoundNotes(items) {
  if (!items.length) return "";
  return '<section class="source-notes"><div class="section-heading"><div><p class="eyebrow">Uit je cursus</p><h2>Klankregels</h2></div></div>' +
    items.map(function (item) {
      const heading = item.spelling ? item.spelling + " → " + item.sound : item.word;
      const text = item.rule_nl || item.example_fr || "";
      const examples = item.examples_fr || [];
      return '<article><strong>' + escapeHtml(heading) + '</strong><p>' + escapeHtml(text) + '</p>' +
        (examples.length ? '<ul>' + examples.map(function (example) { return '<li>' + escapeHtml(example) + '</li>'; }).join("") + '</ul>' : "") + '</article>';
    }).join("") + '</section>';
}

function renderSetup() {
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  const scope = state.selectedScope;
  if (!scope || !unit) return renderUnit();
  const items = itemsForScope(trajectory, unit, scope);
  const available = [];
  Object.keys(TYPE_EXERCISES).forEach(function (type) {
    if (items.some(function (item) { return item.type === type; })) {
      TYPE_EXERCISES[type].forEach(function (key) { available.push(key); });
    }
  });
  if (!available.length) return renderUnit();

  app.innerHTML =
    breadcrumbHtml([
      { label: trajectory.trajectory, action: "home" },
      { label: unit.top_category, action: "back-unit" }
    ]) +
    '<section class="setup-header"><p class="eyebrow">Stap 3 en 4</p><h1>' + escapeHtml(scope.title) + '</h1>' +
    '<p class="lede">' + items.filter(isExerciseItem).length + ' leeritems · kies je oefenvorm en modus.</p></section>' +
    '<section class="setup-grid"><div><div class="section-heading compact"><h2>Wat wil je oefenen?</h2></div>' +
      '<div class="choice-list" role="radiogroup">' +
        available.map(function (key, index) {
          const option = EXERCISES[key];
          const count = items.filter(function (item) { return item.type === option.type; }).length;
          return '<label class="radio-card"><input type="radio" name="exercise" value="' + key + '"' + (index === 0 ? " checked" : "") + '>' +
            '<span><small>' + escapeHtml(option.short) + '</small><strong>' + escapeHtml(option.label) + '</strong><em>' + count + ' bronitems</em></span></label>';
        }).join("") +
      '</div></div>' +
      '<div><div class="section-heading compact"><h2>Kies je modus</h2></div><div class="mode-list">' +
        modeCard("learn", "Leren", "Je ziet het juiste antwoord en typt het daarna zelf.") +
        modeCard("practice", "Oefenen", "Je probeert opnieuw; pas na de tweede fout verschijnt het antwoord.") +
        modeCard("test", "Test jezelf", "Geen feedback onderweg. Je resultaat verschijnt op het einde.") +
      '</div><p class="session-note">Een sessie bevat maximaal 20 vragen. Moeilijke items krijgen voorrang.</p></div>' +
    '</section>';
  focusApp();
}

function modeCard(mode, title, description) {
  return '<button class="mode-card" type="button" data-action="start-session" data-mode="' + mode + '"><span class="mode-symbol" aria-hidden="true">' +
    (mode === "learn" ? "01" : mode === "practice" ? "02" : "03") + '</span><span><strong>' + title + '</strong><small>' + description + '</small></span></button>';
}

function startSession(mode) {
  const selected = document.querySelector('input[name="exercise"]:checked');
  if (!selected) return;
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  const items = itemsForScope(trajectory, unit, state.selectedScope).filter(function (item) {
    return item.type === EXERCISES[selected.value].type;
  });
  const questions = selectQuestions(buildQuestions(items, selected.value));
  beginSession(questions, mode, selected.value, state.selectedScope.title);
}

function beginSession(questions, mode, exerciseKey, title) {
  if (!questions.length) return;
  state.session = {
    questions: questions,
    index: 0,
    mode: mode,
    exerciseKey: exerciseKey,
    title: title,
    phase: "answer",
    attempts: 0,
    results: [],
    startedAt: new Date().toISOString()
  };
  state.progress.lastSession = {
    trajectoryIndex: state.trajectoryIndex,
    unitOrder: state.selectedUnitOrder,
    scope: state.selectedScope,
    exerciseKey: exerciseKey,
    mode: mode,
    title: title,
    at: new Date().toISOString()
  };
  saveProgress();
  renderQuestion();
}

function renderQuestion(message) {
  const session = state.session;
  const question = session.questions[session.index];
  if (!question) return finishSession();
  const progress = Math.round((session.index / session.questions.length) * 100);
  const isTest = session.mode === "test";
  app.innerHTML =
    '<section class="practice-shell">' +
      '<header class="practice-header"><button class="text-button" type="button" data-action="back-unit">Stoppen</button>' +
      '<div class="practice-progress" aria-label="Voortgang"><span style="width:' + progress + '%"></span></div>' +
      '<strong>' + (session.index + 1) + ' / ' + session.questions.length + '</strong></header>' +
      '<article class="question-card">' +
        '<div class="question-meta"><span>' + escapeHtml(modeLabel(session.mode)) + '</span><span>' + escapeHtml(EXERCISES[session.exerciseKey].label) + '</span></div>' +
        '<p class="prompt-label">' + escapeHtml(question.instruction) + '</p><h1 class="question-prompt">' + escapeHtml(question.prompt) + '</h1>' +
        (question.context ? '<p class="question-context">' + escapeHtml(question.context) + '</p>' : "") +
        '<form id="answer-form" autocomplete="off"><label for="answer-input" class="sr-only">Jouw antwoord</label>' +
          '<input id="answer-input" name="answer" type="text" autocapitalize="none" spellcheck="false" placeholder="Typ je antwoord" aria-describedby="answer-help" autofocus>' +
          '<div class="accent-row" aria-label="Franse accenten">' + ACCENTS.map(function (accent) {
            return '<button type="button" data-action="insert-accent" data-accent="' + accent + '">' + accent + '</button>';
          }).join("") + '</div>' +
          '<p id="answer-help" class="input-help">' + (isTest ? "Je krijgt je resultaat op het einde." : "Druk op Enter om te controleren.") + '</p>' +
          '<button class="button button-primary submit-button" type="submit">' + (isTest ? "Antwoord bewaren" : "Controleren") + '</button>' +
        '</form>' +
        '<div id="feedback" class="feedback" aria-live="polite">' + (message || "") + '</div>' +
      '</article>' +
    '</section>';
  focusAnswer();
}

function submitAnswer(rawAnswer) {
  const session = state.session;
  const question = session.questions[session.index];
  if (!question || !rawAnswer.trim()) return;
  const correct = isCorrect(rawAnswer, question.answers);

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
        showFeedback(true, "Goed verbeterd. Zo blijft het beter hangen.", true);
      } else {
        showFeedback(false, 'Kijk goed en typ een juist antwoord: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>', false);
      }
      return;
    }
    if (correct) {
      recordAttempt(question, true);
      showFeedback(true, "Juist! Sterk gedaan.", true);
    } else {
      recordAttempt(question, false);
      requeueQuestion(question);
      session.phase = "correction";
      showFeedback(false, 'Mogelijke juiste antwoorden: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Typ er nu zelf één opnieuw.', false, true);
    }
    return;
  }

  if (correct) {
    recordAttempt(question, true);
    showFeedback(true, "Juist! Ga zo verder.", true);
  } else {
    recordAttempt(question, false);
    session.attempts += 1;
    if (session.attempts === 1) {
      showFeedback(false, "Nog niet juist. Kijk nog eens goed en probeer opnieuw.", false);
    } else {
      requeueQuestion(question);
      showFeedback(false, 'Mogelijke juiste antwoorden: <strong>' + escapeHtml(formatAnswers(question)) + '</strong>. Dit item komt straks terug.', true, true);
    }
  }
}

function showFeedback(correct, message, allowNext, clearInput) {
  const feedback = document.querySelector("#feedback");
  const input = document.querySelector("#answer-input");
  const submit = document.querySelector(".submit-button");
  feedback.className = "feedback visible " + (correct ? "correct" : "wrong");
  feedback.innerHTML = '<span class="feedback-mark" aria-hidden="true">' + (correct ? "✓" : "!") + '</span><div><p>' + message + '</p>' +
    (allowNext ? '<button class="button button-primary" type="button" data-action="next-question">Volgende</button>' : "") + '</div>';
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
  session.index += 1;
  session.phase = "answer";
  session.attempts = 0;
  renderQuestion();
}

function finishSession() {
  const session = state.session;
  if (session.mode === "test") {
    session.results.forEach(function (result) { recordAttempt(result.question, result.correct); });
  }
  state.progress.lastCompleted = {
    title: session.title,
    mode: session.mode,
    at: new Date().toISOString(),
    questions: session.questions.length
  };
  saveProgress();
  renderSummary();
}

function renderSummary() {
  const session = state.session;
  const results = session.mode === "test"
    ? session.results
    : session.questions.slice(0, Math.min(session.index, session.questions.length)).map(function (question) {
        return { question: question, correct: true, answer: "" };
      });
  const wrong = session.mode === "test" ? results.filter(function (result) { return !result.correct; }) : [];
  const correctCount = session.mode === "test" ? results.length - wrong.length : results.length;
  const score = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  const heading = session.mode === "test" ? (score >= 80 ? "Sterk resultaat." : score >= 60 ? "Goed op weg." : "Nog even oefenen.") : "Sessie afgerond.";

  app.innerHTML =
    '<section class="summary-card"><p class="eyebrow">' + escapeHtml(modeLabel(session.mode)) + '</p><h1>' + heading + '</h1>' +
      '<div class="score-ring" style="--score:' + score + '"><span><strong>' + score + '%</strong><small>' + correctCount + ' van ' + results.length + ' juist</small></span></div>' +
      (wrong.length ? '<div class="review-list"><h2>Bekijk je fouten</h2>' + wrong.map(function (result) {
        return '<article><span><small>Vraag</small><strong>' + escapeHtml(result.question.prompt) + '</strong></span>' +
          '<span><small>Jouw antwoord</small><del>' + escapeHtml(result.answer || "Geen antwoord") + '</del></span>' +
          '<span><small>Correct</small><ins>' + escapeHtml(formatAnswers(result.question)) + '</ins></span></article>';
      }).join("") + '</div>' : '<p class="perfect-note">Geen fouten om opnieuw te oefenen.</p>') +
      '<div class="summary-actions">' +
        (wrong.length ? '<button class="button button-primary" type="button" data-action="practice-test-errors">Oefen mijn fouten</button>' : "") +
        '<button class="button button-secondary" type="button" data-action="home">Terug naar start</button>' +
      '</div>' +
    '</section>';
  focusApp();
}

function practiceTestErrors() {
  const wrongQuestions = state.session.results.filter(function (result) { return !result.correct; }).map(function (result) {
    return Object.assign({}, result.question, { reviewCount: 0 });
  });
  beginSession(shuffle(wrongQuestions), "learn", state.session.exerciseKey, "Mijn testfouten");
}

function renderProgress() {
  const accuracy = state.progress.attempted ? Math.round((state.progress.correct / state.progress.attempted) * 100) : 0;
  app.innerHTML =
    breadcrumbHtml([{ label: "Start", action: "home" }]) +
    '<section class="page-heading"><p class="eyebrow">Op dit toestel</p><h1>Mijn voortgang</h1><p class="lede">Je resultaten blijven bewaard in deze browser.</p></section>' +
    '<section class="stat-grid"><article><small>Antwoorden</small><strong>' + state.progress.attempted + '</strong></article>' +
      '<article><small>Juist</small><strong>' + state.progress.correct + '</strong></article>' +
      '<article><small>Fouten</small><strong>' + state.progress.wrong + '</strong></article>' +
      '<article><small>Nauwkeurigheid</small><strong>' + accuracy + '%</strong></article></section>' +
    '<section class="progress-stack">' +
      state.data.trajectories.map(function (trajectory, trajectoryIndex) {
        const stats = trajectoryStats(trajectoryIndex);
        return '<article class="progress-card"><header><div><p class="eyebrow">' + escapeHtml(trajectory.trajectory) + '</p><h2>' + stats.practiced + ' items geoefend</h2></div><strong>' + stats.accuracy + '%</strong></header>' +
          '<div class="bar"><span style="width:' + stats.coverage + '%"></span></div>' +
          '<div class="category-progress">' + trajectory.units.map(function (unit) {
            const category = categoryStats(trajectoryIndex, unit.top_category);
            return '<div><span>' + escapeHtml(unit.top_category) + '</span><strong>' + category.practiced + '</strong></div>';
          }).join("") + '</div></article>';
      }).join("") +
    '</section><button class="text-button danger" type="button" data-action="reset-progress">Wis mijn lokale voortgang</button>';
  focusApp();
}

function renderDifficult() {
  const difficult = getDifficultItems("vocabulary");
  app.innerHTML =
    breadcrumbHtml([{ label: "Start", action: "home" }]) +
    '<section class="page-heading"><p class="eyebrow">Extra aandacht</p><h1>Mijn moeilijke woorden</h1>' +
    '<p class="lede">Woorden waarop je fouten maakte, komen hier automatisch terecht.</p></section>' +
    (difficult.length
      ? '<div class="difficult-list">' + difficult.map(function (item) {
          const stats = state.progress.items[item._id];
          return '<article><span><strong>' + escapeHtml(item.fr) + '</strong><small>' + escapeHtml(item.nl) + '</small></span><span class="mistake-badge">' + stats.wrong + '× fout</span></article>';
        }).join("") + '</div><button class="button button-primary page-action" type="button" data-action="practice-difficult">Oefen mijn moeilijke woorden</button>'
      : '<article class="empty-panel"><h2>Nog geen moeilijke woorden</h2><p>Wanneer je een woord fout beantwoordt, verschijnt het hier.</p><button class="button button-secondary" type="button" data-action="home">Kies een oefening</button></article>');
  focusApp();
}

function practiceDifficult() {
  const items = getDifficultItems("vocabulary");
  if (!items.length) return renderDifficult();
  state.selectedScope = { unitOrder: 0, block: "", subsection: "", title: "Mijn moeilijke woorden" };
  beginSession(selectQuestions(buildQuestions(items, "vocab-nl-fr")), "learn", "vocab-nl-fr", "Mijn moeilijke woorden");
}

function continueLastSession() {
  const last = state.progress.lastSession;
  if (!last) return;
  state.trajectoryIndex = last.trajectoryIndex;
  state.selectedUnitOrder = last.unitOrder;
  state.selectedScope = last.scope;
  const trajectory = currentTrajectory();
  const unit = currentUnit();
  if (!unit) return renderHome();
  const items = itemsForScope(trajectory, unit, last.scope).filter(function (item) {
    return item.type === EXERCISES[last.exerciseKey].type;
  });
  beginSession(selectQuestions(buildQuestions(items, last.exerciseKey)), last.mode, last.exerciseKey, last.title);
}

function buildQuestions(items, exerciseKey) {
  const questions = [];
  items.forEach(function (item) {
    const base = {
      itemId: item._id,
      itemIds: [item._id],
      item: item,
      groupPath: [item._trajectoryIndex, item.top_category, item.lesson, item.block, item.subsection, item.type].join("::"),
      reviewCount: 0
    };
    if (exerciseKey === "vocab-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Vertaal naar het Frans"));
    if (exerciseKey === "vocab-fr-nl") questions.push(makeQuestion(base, item.fr, dutchAnswers(item.nl), "Vertaal naar het Nederlands"));
    if (exerciseKey === "verb-nl-inf") questions.push(makeQuestion(base, item.nl, [item.infinitive], "Geef de Franse infinitief"));
    if (exerciseKey === "verb-fr-nl") questions.push(makeQuestion(base, item.infinitive, dutchAnswers(item.nl), "Vertaal naar het Nederlands"));
    if (exerciseKey === "phrase-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Schrijf de volledige Franse zin"));
    if (exerciseKey === "grammar") questions.push(makeQuestion(base, item.prompt, [item.answer], "Vul de regel aan · " + item.category, item.example_fr || item.example_nl || ""));
    if (exerciseKey === "number-nl-fr") questions.push(makeQuestion(base, item.nl, answerList(item.fr, item), "Schrijf het getal in het Frans"));
    if (exerciseKey === "number-fr-nl") questions.push(makeQuestion(base, item.fr, [item.nl], "Schrijf het cijfer"));
    if (exerciseKey === "verb-nl-conj" || exerciseKey === "verb-fr-conj") {
      (item.conjugations || []).forEach(function (conjugation) {
        const prompt = (exerciseKey === "verb-nl-conj" ? item.nl : item.infinitive) + " — " + conjugation.subject;
        questions.push(makeQuestion(base, prompt, [conjugation.form], "Vervoeg het werkwoord"));
      });
    }
  });
  return mergeEquivalentQuestions(questions);
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
        itemIds: question.itemIds.slice()
      }));
      return;
    }
    const existing = grouped.get(key);
    existing.answers = unique(existing.answers.concat(question.answers));
    existing.itemIds = unique(existing.itemIds.concat(question.itemIds));
  });
  return Array.from(grouped.values());
}

function formatAnswers(question) {
  return unique(question.answers).slice(0, 4).join(" / ");
}

function answerList(primary, item) {
  const answers = [primary].concat(Array.isArray(item.accepted_answers) ? item.accepted_answers : []);
  if (item.type === "vocabulary" && primary.includes(" / ")) {
    primary.split(" / ").forEach(function (part) { answers.push(part.trim()); });
  }
  return unique(answers.reduce(function (all, answer) { return all.concat(optionalVariants(answer)); }, []));
}

function dutchAnswers(value) {
  const answers = [value];
  if (value.includes(",")) value.split(",").forEach(function (part) { answers.push(part.trim()); });
  return unique(answers);
}

function optionalVariants(value) {
  const match = String(value).match(/\(([^)]+)\)/);
  if (!match) return [String(value)];
  const withText = String(value).replace(match[0], match[1]);
  const withoutText = String(value).replace(match[0], "");
  return unique([String(value)].concat(optionalVariants(withText), optionalVariants(withoutText)));
}

function selectQuestions(questions) {
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
  const limit = Math.min(20, scored.length);
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
  const strict = state.progress.settings.strictAccents;
  const candidate = normalizeAnswer(answer, strict);
  return accepted.some(function (value) { return normalizeAnswer(value, strict) === candidate; });
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
    return true;
  });
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
  return '<nav class="breadcrumbs" aria-label="Kruimelpad">' + items.map(function (item) {
    return '<button type="button" data-action="' + item.action + '">' + escapeHtml(item.label) + '</button><span>/</span>';
  }).join("") + '<strong>' + escapeHtml(currentUnit() ? currentUnit().title : "Overzicht") + '</strong></nav>';
}

function modeLabel(mode) {
  return mode === "learn" ? "Leren" : mode === "practice" ? "Oefenen" : "Test jezelf";
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
    settings: { strictAccents: true },
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
      settings: Object.assign({ strictAccents: true }, saved && saved.settings)
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

loadCourse();
