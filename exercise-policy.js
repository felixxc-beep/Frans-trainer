(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./exercise-variants.js") : root.MonParcoursExerciseVariants);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MonParcoursExercisePolicy = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (engine) {
  "use strict";
  const marker = "\n[mon-parcours-exercise-policy-v1:";
  const labels = {
    vocabulary_direct: "Woordenschat · Traduire / Direct vertalen",
    vocabulary_context: "Woordenschat · En contexte / In een zin",
    verb_conjugation: "Werkwoorden · Conjuguer / Vervoegen",
    verb_context: "Werkwoorden · Dans une phrase / In een zin",
    grammar_rule: "Grammatica · Règle / Regel herkennen of aanvullen",
    grammar_context: "Grammatica · En contexte / In een zin",
    grammar_mixed: "Grammatica · Application mixte / Gemengde toepassing",
    revision: "Révision · Phrases NL → FR / Integratieve zinnen",
    revision_other: "Révision · Autres exercices / Andere revisievragen",
    numbers: "Getallen · Reconnaître et pratiquer / Herkennen en oefenen",
    phrase_direct: "Zinnen · Traduire / Direct vertalen",
    phrase_context: "Zinnen · En contexte / In een zin",
    spelling: "Spelling · Sons et homophones / Klanken en homofonen"
  };
  function read(instructions) {
    const text = String(instructions || "");
    const start = text.lastIndexOf(marker);
    if (start < 0 || !text.endsWith("]")) return { text: text, forms: null };
    try {
      const metadata = JSON.parse(text.slice(start + marker.length, -1));
      const forms = Array.isArray(metadata) ? metadata : metadata.forms;
      if (!Array.isArray(forms) || !forms.length || forms.some(function (key) { return !Object.hasOwn(labels, key); })) throw Error("Invalid policy");
      const result = { text: text.slice(0, start), forms: Array.from(new Set(forms)) };
      if (!Array.isArray(metadata) && metadata.pool === 2) result.poolSettings = {
        pool: 2, size: [10,20,30].includes(metadata.size) ? metadata.size : 'all', scope: metadata.scope || {}
      };
      return result;
    } catch (_) { return { text: text, forms: null }; }
  }
  function write(text, forms, poolSettings) {
    const keys = Array.from(new Set(forms));
    if (!keys.length || keys.some(function (key) { return !Object.hasOwn(labels, key); })) throw Error("Kies minstens één oefenvorm.");
    const metadata = poolSettings ? { forms: keys, pool: 2, size: poolSettings.size, scope: poolSettings.scope } : keys;
    const value = String(text || "").trim() + marker + JSON.stringify(metadata) + "]";
    if (Array.from(value).length > 1000) throw Error("Verkort de instructies: instructies en oefenkeuzes mogen samen maximaal 1000 tekens bevatten.");
    return value;
  }
  function directForm(item) {
    return { vocabulary: "vocabulary_direct", verb: "verb_conjugation", grammar_rule: "grammar_rule", number: "numbers", phrase: "phrase_direct", sound_rule: "spelling" }[item.type];
  }
  function variantForm(variant, index) {
    if (variant.kind === "revision" && variant.scoring === "integrative") return "revision";
    if (variant.kind === "revision") return "revision_other";
    if (variant.scope_kind === "mixed" && variant.kind === "grammar") return "grammar_mixed";
    if (variant.kind === "grammar") return "grammar_context";
    if (variant.kind === "conjugation") return "verb_context";
    if (variant.kind === "number") return "numbers";
    if (variant.kind === "spelling") return "spelling";
    if (variant.kind === "translate") return "vocabulary_direct";
    if (variant.kind === "context" || variant.kind === "actes") {
      const goals = engine.targetsForVariant(variant).map(function (id) { return index.get(id); });
      if (goals.length && goals.every(function (goal) { return goal && goal.type === "verb"; })) return "verb_context";
      if (goals.length && goals.every(function (goal) { return goal && goal.type === "vocabulary"; })) return "vocabulary_context";
      if (goals.length && goals.every(function (goal) { return goal && goal.type === "phrase"; })) return "phrase_context";
    }
    return null;
  }
  function candidates(items, bank, course, scope) {
    if (scope) {
      const revisionScope = /^Action/i.test(scope.top_category || "");
      return engine.eligibleVariants(bank, course, scope, revisionScope ? undefined : items.map(function (item) { return item.id; }))
        .filter(function (variant) { return variantForm(variant, engine.itemIndex(course)); });
    }
    const ids = new Set(items.map(function (item) { return item.id; }));
    const index = engine.itemIndex(course);
    const trajectories = new Set((course.trajectories || []).filter(function (trajectory) {
      return (trajectory.items || []).some(function (item) { return ids.has(item.id); });
    }).map(function (trajectory) { return trajectory.trajectory; }));
    const mixed = new Set(items.filter(function (item) { return item.type === "grammar_rule"; }).map(function (item) { return item.category; })).size > 1;
    return (bank.variants || []).filter(function (variant) {
      const targets = engine.targetsForVariant(variant);
      // This bank entry asks for the lexical infinitive "cuisiner" from a
      // situation. It is not offered as a grammar form in the task creator.
      return variant.id !== "T1-GRAM-AIMER-022" && trajectories.has(variant.trajectory) &&
        variant.evidence_policy !== "practice_only" && targets.length && targets.every(function (id) { return ids.has(id); }) &&
        engine.matchesScope(variant, ids, !mixed && variant.kind !== "revision") &&
        (!variant.required_subsection || items.every(function (item) { return item.subsection === variant.required_subsection; })) &&
        variantForm(variant, index);
    });
  }
  function options(items, bank, course, scope) {
    const counts = new Map();
    const revisionScope = /^Action/i.test(scope && scope.top_category || "");
    items.forEach(function (item) {
      const key = directForm(item);
      // Direct "complete the grammar rule" drills are deliberately not offered.
      // Grammar is practised through curated application/context variants instead.
      if (!key || revisionScope || key === "grammar_rule") return;
      if (!counts.has(key)) counts.set(key, { key: key, variantCount: 0, courseCount: 0 });
      counts.get(key).courseCount += key === "verb_conjugation" ? (item.conjugations || []).reduce(function (count, row) {
        return count + String(row.subject).split("/").length;
      }, 0) : 1;
    });
    const index = engine.itemIndex(course);
    candidates(items, bank, course, scope).forEach(function (variant) {
      const key = variantForm(variant, index);
      if (!counts.has(key)) counts.set(key, { key: key, variantCount: 0, courseCount: 0 });
      counts.get(key).variantCount += 1;
    });
    return Object.keys(labels).filter(function (key) {
      return counts.has(key) && (counts.get(key).variantCount || counts.get(key).courseCount);
    }).map(function (key) { return counts.get(key); });
  }
  function available(items, bank, course, scope) {
    return options(items, bank, course, scope).map(function (option) { return option.key; });
  }
  function normalizeForms(forms) {
    const expanded = [];
    (forms || []).forEach(function (key) {
      if (key === "grammar_rule") {
        // Backwards compatibility for already-published tasks: old rule drills
        // transparently become real grammar application questions.
        expanded.push("grammar_context", "grammar_mixed");
      } else expanded.push(key);
    });
    return Array.from(new Set(expanded));
  }
  function plan(item, items, bank, course, forms, round) {
    forms = normalizeForms(forms);
    if (item.type === "number" && forms.includes("numbers")) return { direct: "numbers" };
    const index = engine.itemIndex(course);
    const variants = candidates(items, bank, course).filter(function (variant) {
      return forms.includes(variantForm(variant, index)) && engine.targetsForVariant(variant).includes(item.id);
    });
    // Each permanent goal still has one round anchor. Exercise variants never
    // add goals or alter the existing round selection.
    const categories = Array.from(new Set(variants.map(function (variant) { return variantForm(variant, index); })));
    if (forms.includes(directForm(item))) categories.unshift(directForm(item));
    const category = categories[((round || 1) - 1) % categories.length];
    if (category === directForm(item)) return { direct: category };
    const matching = variants.filter(function (variant) { return variantForm(variant, index) === category; });
    if (matching.length) return { variant: matching[((round || 1) - 1) % matching.length] };
    return forms.includes(directForm(item)) ? { direct: directForm(item) } : null;
  }
  function pool(items, bank, course, forms, scope) {
    forms = normalizeForms(forms);
    const index = engine.itemIndex(course);
    const revisionScope = /^Action/i.test(scope && scope.top_category || "");
    const entries = candidates(items,bank,course,scope).filter(function (variant) {
      return forms.includes(variantForm(variant,index));
    }).map(function (variant) { return { variant: variant, targetIds: engine.targetsForVariant(variant) }; });
    if (!revisionScope) items.forEach(function (item) {
      const key = directForm(item);
      if (key !== "grammar_rule" && forms.includes(key)) entries.push({ direct: key, item: item, targetIds: [item.id] });
    });
    return entries;
  }
  function entryKey(entry) {
    return entry.variant ? "v:" + entry.variant.id : "d:" + entry.direct + ":" + (entry.item && entry.item.id || "");
  }
  function selectEntries(entries, size, preferredIds) {
    const unique = Array.from(new Map((entries || []).map(function (entry) { return [entryKey(entry), entry]; })).values());
    if (size === "all" || size == null) return unique;
    const limit = Math.max(0, Math.min(unique.length, Number(size) || 0));
    if (!limit) return [];
    const chosen = [];
    const covered = new Set();
    const order = Array.isArray(preferredIds) && preferredIds.length ? preferredIds :
      Array.from(new Set(unique.flatMap(function (entry) { return entry.targetIds || []; })));
    order.some(function (id) {
      if (chosen.length >= limit) return true;
      if (covered.has(id)) return false;
      const options = unique.filter(function (entry) { return !chosen.includes(entry) && (entry.targetIds || []).includes(id); })
        .sort(function (a,b) {
          const aNew=(a.targetIds||[]).filter(function (target) {return !covered.has(target);}).length;
          const bNew=(b.targetIds||[]).filter(function (target) {return !covered.has(target);}).length;
          return bNew-aNew;
        });
      if (!options.length) return false;
      chosen.push(options[0]);
      (options[0].targetIds || []).forEach(function (target) { covered.add(target); });
      return false;
    });
    unique.forEach(function (entry) { if (chosen.length < limit && !chosen.includes(entry)) chosen.push(entry); });
    return chosen;
  }
  return { labels: labels, read: read, write: write, options: options, available: available, plan: plan, candidates: candidates, variantForm: variantForm, pool: pool, selectEntries: selectEntries, normalizeForms: normalizeForms };
});
