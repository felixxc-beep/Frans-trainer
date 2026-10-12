(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursExerciseVariants = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const KINDS = new Set(["translate", "context", "actes", "conjugation", "grammar", "spelling", "revision", "number"]);
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
      if (variant.kind === "grammar") {
        const grammarIds = variant.scoring === "multi_gap"
          ? variant.gaps.flatMap(function (gap) { return targetIds(gap.targets, index, variant.id + "/" + gap.id); })
          : targetIds(variant.targets, index, variant.id);
        if (grammarIds.some(function (id) { return index.get(id).type !== "grammar_rule"; }))
          throw new Error(variant.id + ": grammar exercise must target a grammar rule");
      }
      if (variant.kind === "spelling") {
        const spellingIds = variant.scoring === "multi_gap"
          ? variant.gaps.flatMap(function (gap) { return targetIds(gap.targets, index, variant.id + "/" + gap.id); })
          : targetIds(variant.targets, index, variant.id);
        if (spellingIds.some(function (id) { return index.get(id).type !== "sound_rule"; }))
          throw new Error(variant.id + ": spelling exercise must target a spelling rule");
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

  function targetsForVariant(variant) {
    return Array.from(new Set((variant.scoring === "multi_gap"
      ? variant.gaps.flatMap(function (gap) { return gap.targets; }) : variant.targets || [])
      .map(function (target) { return typeof target === "string" ? target : target.item_id; })));
  }

  // A narrow grammar scope must test every requested answer, not just one
  // incidental target in a mixed question. Broad unit/revision scopes allow mixes.
  function matchesScope(variant, ids, narrow) {
    const targets = targetsForVariant(variant);
    return targets.some(function (id) { return ids.has(id); }) &&
      (!narrow || variant.scope_kind !== "mixed") &&
      (!narrow || !["grammar", "spelling"].includes(variant.kind) ||
        targets.every(function (id) { return ids.has(id); }));
  }

  // Shared by free practice, the task creator and new task sessions. Scope
  // describes course content; goalIds remain permanent mastery IDs.
  function eligibleVariants(bank, course, scope, goalIds) {
    scope = scope || {};
    const trajectory = (course.trajectories || []).find(function (row) { return row.trajectory === scope.trajectory; });
    if (!trajectory) return [];
    const revision = /^Action/i.test(scope.top_category || '');
    const items = (trajectory.items || []).filter(function (item) {
      return ['top_category','lesson','block','subsection','category'].every(function (key) { return !scope[key] || item[key] === scope[key]; }) &&
        (!scope.itemId || item.id === scope.itemId);
    });
    const ids = new Set(goalIds || items.map(function (item) { return item.id; }));
    const explicitGoals = Array.isArray(goalIds);
    const index = itemIndex(course);
    const grammarCategories = new Set(Array.from(ids).map(function (id) { return index.get(id); })
      .filter(function (item) { return item && item.type === 'grammar_rule'; }).map(function (item) { return item.category; }));
    const narrow = Boolean(scope.category || scope.itemId || grammarCategories.size <= 1);
    const unitIds = new Set(items.map(function (item) {return item.id;}));
    const trajectoryIds = new Set((trajectory.items || []).map(function (item) {return item.id;}));
    return (bank.variants || []).filter(function (variant) {
      if (variant.trajectory !== scope.trajectory || variant.id === 'T1-GRAM-AIMER-022') return false;
      if (scope.top_category && (variant.kind === 'revision') !== revision) return false;
      const targets = targetsForVariant(variant);
      if (!targets.length) return false;
      if (scope.inventory || !explicitGoals && (!ids.size || !scope.block && !scope.subsection && !scope.category && !scope.itemId)) {
        if (!scope.inventory && variant.required_subsection && scope.subsection !== variant.required_subsection) return false;
        if (revision) return variant.kind === 'revision';
        if (targets.some(function (id) {return unitIds.has(id);})) return true;
        if (targets.some(function (id) {return trajectoryIds.has(id);})) return false;
        if (variant.kind === 'grammar') {
          const verbGoals=targets.every(function (id) {return index.get(id) && index.get(id).top_category==='Atelier Verbes';});
          return scope.top_category===(verbGoals?'Atelier Verbes':'Atelier Grammaire');
        }
        return ['context','actes'].includes(variant.kind) ? scope.top_category==='Atelier Parole' :
          variant.kind==='conjugation' ? scope.top_category==='Atelier Verbes' :
          variant.kind==='spelling' ? scope.top_category==='Comment écrire ?' : variant.kind==='number' && scope.top_category==='Chiffres et lettres';
      }
      if (revision && !explicitGoals) return !variant.required_subsection || !scope.subsection || scope.subsection === variant.required_subsection;
      if (!targets.every(function (id) { return ids.has(id); })) return false;
      if (variant.required_subsection && scope.subsection !== variant.required_subsection) return false;
      return matchesScope(variant, ids, narrow && variant.kind !== 'revision');
    });
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
    const valueCorrect = correct || question.variantKind === "number" && question.numberValueFormattingTolerance === true &&
      answers(question.answers).some(function (answer) {
        return normalizeAnswer(answer).replace(/[- ]/g, "") === normalizeAnswer(response).replace(/[- ]/g, "");
      });
    return { correct: correct, valueCorrect: Boolean(valueCorrect), gapResults: [], evidence: question.variantEvidencePolicy === "practice_only" ||
      question.variantScoring === "integrative" && !correct ? [] : [{
      key: "", correct: Boolean(valueCorrect), targets: question.variantTargets, accepted_answers: question.answers
    }] };
  }

  return { KINDS: KINDS, SCORING: SCORING, normalizeAnswer: normalizeAnswer,
    itemIndex: itemIndex, validateBank: validateBank, compileVariant: compileVariant, grade: grade,
    targetsForVariant: targetsForVariant, matchesScope: matchesScope, eligibleVariants: eligibleVariants };
});
