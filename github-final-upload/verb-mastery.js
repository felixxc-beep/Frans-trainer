(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursVerbMastery = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Permanent item-ID classification, based on the explicit course categories.
  // Never infer regularity from the spelling of an infinitive (aller ends in -er).
  const GROUPS = Object.freeze({
    present_er: { kind: "regular", label: "Verbes en -ER", ids: [102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123] },
    present_ir_finir: { kind: "regular", label: "Verbes du type finir", ids: [246,247,248,249,250,251,252,253,254] },
    present_re: { kind: "regular", label: "Verbes en -RE", ids: [415,416,417,418,419,420,421,422] },
    irregular: { kind: "irregular", label: "Verbes irréguliers", ids: [124,125,240,241,242,243,244,245,410,411,412,413,414,697,698,699] }
  });
  const byItemId = new Map();
  Object.keys(GROUPS).forEach(function (groupId) {
    GROUPS[groupId].ids.forEach(function (number) {
      const itemId = "uf1-item-" + String(number).padStart(6, "0");
      byItemId.set(itemId, Object.freeze({ kind: GROUPS[groupId].kind,
        ruleId: GROUPS[groupId].kind === "regular" ? groupId : null,
        verbId: GROUPS[groupId].kind === "irregular" ? itemId : null }));
    });
  });
  const THRESHOLDS = Object.freeze({ persons: 6, ruleVerbs: 3, correctConjugations: 8, accuracy: 0.75, sessions: 2 });
  const PERSONS = Object.freeze(["je", "tu", "il", "nous", "vous", "ils"]);
  const ER_ENDINGS = Object.freeze({ je: "-e", tu: "-es", il: "-e", nous: "-ons", vous: "-ez", ils: "-ent" });

  function classification(itemId) { return byItemId.get(String(itemId || "")) || null; }
  function canonicalPerson(person) {
    const value = String(person || "").toLocaleLowerCase("fr").replace(/[’']/g, "'").trim();
    if (value === "je" || value === "j'") return "je";
    if (value === "tu") return "tu";
    if (["il", "elle", "on", "il/elle/on"].includes(value)) return "il";
    if (value === "nous" || value === "vous") return value;
    if (["ils", "elles", "ils/elles"].includes(value)) return "ils";
    return "";
  }
  function attemptPerson(attempt) {
    const variant = String(attempt.item_variant || attempt.itemVariant || "");
    return canonicalPerson(variant.startsWith("rule:") ? variant.split(":")[2] : variant);
  }
  function isConjugation(attempt) {
    const key = String(attempt.exercise_key || attempt.exerciseKey || "");
    return key === "verb-nl-conj" || key === "verb-fr-conj" || key === "assignment-mixed" && Boolean(attemptPerson(attempt)) ||
      !key && Boolean(attemptPerson(attempt)) && !String(attempt.item_variant || "").startsWith("rule:");
  }
  function isRecognition(attempt) {
    return String(attempt.exercise_key || attempt.exerciseKey || "") === "verb-rule-recognition" &&
      String(attempt.item_variant || "").startsWith("rule:present_er:");
  }
  function goalAttempts(goalId, attempts) {
    const seen = new Set();
    return (attempts || []).filter(function (attempt) {
      const id = String(attempt.client_attempt_id || "");
      if (id && seen.has(id)) return false;
      if (id) seen.add(id);
      const classificationForItem = classification(attempt.item_id);
      if (!classificationForItem || !["practice", "test"].includes(attempt.mode)) return false;
      if (goalId.startsWith("uf1-item-")) return classificationForItem.verbId === goalId && isConjugation(attempt);
      return classificationForItem.ruleId === goalId && (isConjugation(attempt) || isRecognition(attempt));
    });
  }
  function calculate(goalId, attempts) {
    const irregular = goalId.startsWith("uf1-item-");
    const rows = goalAttempts(goalId, attempts).sort(function (a, b) {
      return String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.client_attempt_id || "").localeCompare(String(b.client_attempt_id || ""));
    });
    const conjugations = rows.filter(isConjugation);
    const correct = rows.filter(function (row) { return row.was_correct === true; }).length;
    const correctConjugations = conjugations.filter(function (row) { return row.was_correct === true; });
    const covered = new Set(correctConjugations.map(attemptPerson).filter(Boolean));
    const verbs = new Set(correctConjugations.map(function (row) { return row.item_id; }));
    const sessions = new Set(rows.map(function (row) { return row.client_session_id || row.session_id; }).filter(Boolean));
    const conjugationSessions = new Set(conjugations.map(function (row) { return row.client_session_id || row.session_id; }).filter(Boolean));
    const accuracy = rows.length ? correct / rows.length : 0;
    const conjugationAccuracy = conjugations.length ? correctConjugations.length / conjugations.length : 0;
    const acquired = covered.size === THRESHOLDS.persons &&
      (irregular || verbs.size >= THRESHOLDS.ruleVerbs) &&
      correctConjugations.length >= THRESHOLDS.correctConjugations &&
      conjugationAccuracy >= THRESHOLDS.accuracy && conjugationSessions.size >= THRESHOLDS.sessions &&
      conjugations.length > 0 && conjugations[conjugations.length - 1].was_correct === true;
    const accuracyScore = Math.min(1, correct / Math.max(THRESHOLDS.correctConjugations, rows.length));
    const personScore = covered.size / THRESHOLDS.persons;
    const diversityScore = irregular ? 0 : Math.min(1, verbs.size / THRESHOLDS.ruleVerbs);
    const sessionScore = Math.min(1, sessions.size / THRESHOLDS.sessions);
    // No independent evidence => zero. A non-acquired goal can never display 100%.
    const weighted = irregular
      ? 0.4 * accuracyScore + 0.5 * personScore + 0.1 * sessionScore
      : 0.3 * accuracyScore + 0.4 * personScore + 0.2 * diversityScore + 0.1 * sessionScore;
    const level = acquired ? 100 : Math.min(99, Math.round(weighted * 100));
    return { goalId: goalId, kind: irregular ? "irregular" : "regular", status: !rows.length ? "new" : acquired ? "acquired" : "learning",
      level: level, attempts: rows.length, correct: correct, conjugationCorrect: correctConjugations.length,
      accuracy: rows.length ? Math.round(accuracy * 100) : 0, conjugationAccuracy: Math.round(conjugationAccuracy * 100),
      conjugationAttempts: conjugations.length, persons: covered.size, coveredPersons: PERSONS.filter(function (person) { return covered.has(person); }),
      verbs: verbs.size, sessions: conjugationSessions.size, evidenceSessions: sessions.size,
      latestCorrect: conjugations.length ? conjugations[conjugations.length - 1].was_correct === true : null,
      lastActivity: rows.length ? rows[rows.length - 1].created_at || "" : "" };
  }
  function meetsTarget(result, target) {
    return result.level >= Number(target) && result.persons === THRESHOLDS.persons &&
      (result.kind === "irregular" || result.verbs >= THRESHOLDS.ruleVerbs) && result.sessions >= THRESHOLDS.sessions;
  }
  function goalForItem(item) {
    const type = classification(item && item.id);
    return type ? type.ruleId || type.verbId : null;
  }
  function goalsForItems(items) {
    return Array.from(new Set((items || []).map(goalForItem).filter(Boolean)));
  }

  function selectPracticeQuestions(questions, attempts, count) {
    const history = (attempts || []).filter(function (row) { return ["practice", "test"].includes(row.mode) && isConjugation(row); })
      .sort(function (a, b) { return String(a.created_at || "").localeCompare(String(b.created_at || "")); });
    const selected = [];
    const remaining = questions.slice();
    const selectedPersons = new Map(), selectedVerbs = new Map(), selectedGoals = new Map();
    while (remaining.length && selected.length < count) {
      remaining.sort(function (left, right) {
        function rank(question) {
          const person = canonicalPerson(question.itemVariant);
          const id = question.stableItemId;
          const goal = goalForItem(question.item) || "";
          const prior = history.filter(function (row) { return row.item_id === id && attemptPerson(row) === person; });
          const priorCorrect = prior.some(function (row) { return row.was_correct === true; });
          const lastWrong = prior.length && prior[prior.length - 1].was_correct === false;
          return [priorCorrect ? 1 : 0, selectedPersons.get(person) || 0, selectedGoals.get(goal) || 0,
            lastWrong ? 0 : 1, selectedVerbs.get(id) || 0, prior.length, String(question.prompt || "")];
        }
        const a = rank(left), b = rank(right);
        for (let i = 0; i < a.length; i += 1) {
          if (a[i] < b[i]) return -1;
          if (a[i] > b[i]) return 1;
        }
        return 0;
      });
      const next = remaining.shift();
      selected.push(next);
      const person = canonicalPerson(next.itemVariant);
      const goal = goalForItem(next.item) || "";
      selectedPersons.set(person, (selectedPersons.get(person) || 0) + 1);
      selectedVerbs.set(next.stableItemId, (selectedVerbs.get(next.stableItemId) || 0) + 1);
      selectedGoals.set(goal, (selectedGoals.get(goal) || 0) + 1);
    }
    return selected;
  }

  return { GROUPS: GROUPS, THRESHOLDS: THRESHOLDS, PERSONS: PERSONS, ER_ENDINGS: ER_ENDINGS,
    classification: classification, canonicalPerson: canonicalPerson, attemptPerson: attemptPerson,
    isConjugation: isConjugation, isRecognition: isRecognition, calculate: calculate,
    meetsTarget: meetsTarget, goalForItem: goalForItem, goalsForItems: goalsForItems,
    selectPracticeQuestions: selectPracticeQuestions };
});
