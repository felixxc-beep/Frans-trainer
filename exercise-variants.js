(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursExerciseVariants = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const KINDS = new Set(["translate", "context", "actes", "conjugation", "grammar", "revision", "number"]);
  const SCORING = new Set(["single", "multi_gap", "integrative"]);

  function normalizeAnswer(value) {
    return String(value == null ? "" : value).normalize("NFC").toLocaleLowerCase("fr")
      .replace(/[’‘\u0060´]/g, "'").replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "").replace(/\s+/g, " ")
      .replace(/\s+([?!.,;:])/g, "$1").trim().replace(/[.!?]+$/g, "").trim();
  }

  function answers(value) {
    return Array.isArray(value) ? value.filter(function (answer) { return typeof answer === "string" && answer.trim(); }) : [];
  }

  function itemIndex(course) {
    const index = new Map();
    (course && course.trajectories || []).forEach(function (trajectory) {
      (trajectory.items || []).forEach(function (item) { index.set(item.id, item); });
    });
    return index;
  }

  function targetIds(targets, index, label) {
    if (!Array.isArray(targets) || !targets.length) throw new Error(label + ": no permanent target mapping");
    const ids = targets.map(function (target) { return typeof target === "string" ? target : target && target.item_id; });
    if (ids.some(function (id) { return !index.has(id); })) throw new Error(label + ": unknown permanent item ID");
    if (new Set(ids).size !== ids.length) throw new Error(label + ": duplicate target mapping");
    return ids;
  }

  function validateBank(bank, course) {
    if (!bank || !Array.isArray(bank.variants)) throw new Error("Exercise bank must contain a variants array");
    const index = itemIndex(course);
    const seen = new Set();
    bank.variants.forEach(function (variant) {
      if (!variant || !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(variant.id || "") || seen.has(variant.id))
        throw new Error("Missing, invalid or duplicate exercise variant ID: " + (variant && variant.id || ""));
      seen.add(variant.id);
      if (!KINDS.has(variant.kind) || !SCORING.has(variant.scoring) || !String(variant.prompt || "").trim())
        throw new Error(variant.id + ": invalid kind, scoring or prompt");
      if (!/^Trajet [1-6]$/.test(variant.trajectory || "")) throw new Error(variant.id + ": invalid trajectory");
      if (variant.exercise_key != null && !/^[a-z0-9-]{1,40}$/.test(variant.exercise_key))
        throw new Error(variant.id + ": invalid exercise key");
      if (variant.evidence_policy != null && variant.evidence_policy !== "practice_only")
        throw new Error(variant.id + ": invalid evidence policy");
      if (variant.scoring === "multi_gap") {
        if (!Array.isArray(variant.gaps) || !variant.gaps.length) throw new Error(variant.id + ": no gaps");
        if ((variant.prompt.match(/___/g) || []).length !== variant.gaps.length)
          throw new Error(variant.id + ": prompt/gap count differs");
        const gapIds = new Set();
        variant.gaps.forEach(function (gap) {
          if (!gap || !/^[a-z0-9-]+$/.test(gap.id || "") || gapIds.has(gap.id))
            throw new Error(variant.id + ": missing or duplicate gap ID");
          gapIds.add(gap.id);
          if (!answers(gap.accepted_answers).length || answers(gap.accepted_answers).length !== gap.accepted_answers.length)
            throw new Error(variant.id + ": empty/invalid gap answers");
          targetIds(gap.targets, index, variant.id + "/" + gap.id);
        });
      } else {
        if (!answers(variant.accepted_answers).length || answers(variant.accepted_answers).length !== variant.accepted_answers.length)
          throw new Error(variant.id + ": empty/invalid accepted answers");
        if (variant.requires_question_mark === true && variant.accepted_answers.some(function (answer) { return !/\?\s*$/.test(answer); }))
          throw new Error(variant.id + ": question punctuation required in accepted answers");
        targetIds(variant.targets, index, variant.id);
      }
    });
    return { variants: seen.size, permanentItems: index.size };
  }

  function compileVariant(variant, course) {
    const index = itemIndex(course);
    const mapped = variant.scoring === "multi_gap"
      ? variant.gaps.flatMap(function (gap) { return targetIds(gap.targets, index, variant.id + "/" + gap.id); })
      : targetIds(variant.targets, index, variant.id);
    const ids = Array.from(new Set(mapped));
    const item = index.get(ids[0]);
    return {
      variantId: variant.id, variantKind: variant.kind, variantScoring: variant.scoring,
      variantEvidencePolicy: variant.evidence_policy || "mastery",
      variantTargets: variant.targets || [], gaps: variant.gaps || [],
      itemId: item._id || item.id, itemIds: ids.map(function (id) { return index.get(id)._id || id; }),
      stableItemId: ids[0], stableItemIds: ids, item: item,
      itemVariant: variant.item_variant || variant.id,
      exerciseKey: variant.exercise_key || (variant.scoring === "integrative" ? "full-sentence-nl-fr" : "curated"),
      requiresQuestionMark: variant.requires_question_mark === true,
      groupPath: [variant.trajectory, variant.kind, variant.id].join("::"),
      prompt: variant.prompt, answers: variant.accepted_answers || [],
      instruction: variant.instruction || "Vul de zin aan", context: variant.context || "", reviewCount: 0
    };
  }

  function grade(question, response) {
    if (!question || !question.variantId) throw new Error("Not an exercise variant");
    if (question.variantScoring === "multi_gap") {
      const values = Array.isArray(response) ? response : [];
      const gapResults = question.gaps.map(function (gap, index) {
        const correct = answers(gap.accepted_answers).some(function (answer) {
          return normalizeAnswer(answer) === normalizeAnswer(values[index]);
        });
        return { gapId: gap.id, correct: correct, targets: gap.targets, accepted_answers: gap.accepted_answers };
      });
      return { correct: gapResults.every(function (result) { return result.correct; }), gapResults: gapResults,
        evidence: question.variantEvidencePolicy === "practice_only" ? [] : gapResults.map(function (result) { return {
          key: result.gapId, correct: result.correct, targets: result.targets, accepted_answers: result.accepted_answers
        }; }) };
    }
    const correct = (!question.requiresQuestionMark || /\?\s*$/.test(String(response))) && answers(question.answers).some(function (answer) {
      return normalizeAnswer(answer) === normalizeAnswer(response);
    });
    return { correct: correct, gapResults: [], evidence: question.variantEvidencePolicy === "practice_only" ||
      question.variantScoring === "integrative" && !correct ? [] : [{
      key: "", correct: correct, targets: question.variantTargets, accepted_answers: question.answers
    }] };
  }

  return { KINDS: KINDS, SCORING: SCORING, normalizeAnswer: normalizeAnswer,
    itemIndex: itemIndex, validateBank: validateBank, compileVariant: compileVariant, grade: grade };
});
