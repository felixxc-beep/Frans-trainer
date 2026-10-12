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
    numbers: "Getallen · Nombres dynamiques / Dynamische getallen",
    phrase_direct: "Zinnen · Traduire / Direct vertalen",
    spelling: "Spelling · Homophones / Schriftelijke homofonen"
  };
  function read(instructions) {
    const text = String(instructions || "");
    const start = text.lastIndexOf(marker);
    if (start < 0 || !text.endsWith("]")) return { text: text, forms: null };
    try {
      const forms = JSON.parse(text.slice(start + marker.length, -1));
      if (!Array.isArray(forms) || !forms.length || forms.some(function (key) { return !Object.hasOwn(labels, key); })) throw Error("Invalid policy");
      return { text: text.slice(0, start), forms: Array.from(new Set(forms)) };
    } catch (_) { return { text: text, forms: null }; }
  }
  function write(text, forms) {
    const keys = Array.from(new Set(forms));
    if (!keys.length || keys.some(function (key) { return !Object.hasOwn(labels, key); })) throw Error("Kies minstens één oefenvorm.");
    const value = String(text || "").trim() + marker + JSON.stringify(keys) + "]";
    if (Array.from(value).length > 1000) throw Error("Verkort de instructies: instructies en oefenkeuzes mogen samen maximaal 1000 tekens bevatten.");
    return value;
  }
  function directForm(item) {
    return { vocabulary: "vocabulary_direct", verb: "verb_conjugation", grammar_rule: "grammar_rule", number: "numbers", phrase: "phrase_direct", sound_rule: "spelling" }[item.type];
  }
  function variantForm(variant, index) {
    if (variant.kind === "revision" && variant.scoring === "integrative") return "revision";
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
    }
    return null;
  }
  function candidates(items, bank, course) {
    const ids = new Set(items.map(function (item) { return item.id; }));
    const index = engine.itemIndex(course);
    const mixed = new Set(items.filter(function (item) { return item.type === "grammar_rule"; }).map(function (item) { return item.category; })).size > 1;
    return (bank.variants || []).filter(function (variant) {
      const targets = engine.targetsForVariant(variant);
      return variant.evidence_policy !== "practice_only" && targets.length && targets.every(function (id) { return ids.has(id); }) &&
        engine.matchesScope(variant, ids, !mixed && variant.kind !== "revision") &&
        (!variant.required_subsection || items.every(function (item) { return item.subsection === variant.required_subsection; })) &&
        variantForm(variant, index);
    });
  }
  function available(items, bank, course) {
    const keys = new Set(items.map(directForm).filter(Boolean));
    const index = engine.itemIndex(course);
    candidates(items, bank, course).forEach(function (variant) { keys.add(variantForm(variant, index)); });
    return Object.keys(labels).filter(function (key) { return keys.has(key); });
  }
  function plan(item, items, bank, course, forms, round) {
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
  return { labels: labels, read: read, write: write, available: available, plan: plan, candidates: candidates, variantForm: variantForm };
});
