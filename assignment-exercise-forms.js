(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursAssignmentForms = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DEFINITIONS = Object.freeze([
    { key: "vocab_direct", group: "Woordenschat", label: "Direct vertalen", type: "vocabulary", direct: "vocab-nl-fr" },
    { key: "vocab_context", group: "Woordenschat", label: "En contexte / In een zin", type: "vocabulary", kind: "context" },
    { key: "verb_conjugation", group: "Werkwoorden", label: "Conjugeren", type: "verb", direct: "verb-nl-conj" },
    { key: "verb_context", group: "Werkwoorden", label: "Dans une phrase / In een zin", type: "verb", kind: "conjugation" },
    { key: "grammar_rule", group: "Grammatica", label: "Regel herkennen of aanvullen", type: "grammar_rule", direct: "grammar" },
    { key: "grammar_context", group: "Grammatica", label: "Grammaire en contexte", type: "grammar_rule", kind: "grammar", scopeKind: "focused" },
    { key: "grammar_mixed", group: "Grammatica", label: "Gemengde grammatica", type: "grammar_rule", kind: "grammar", scopeKind: "mixed" },
    { key: "phrase_direct", group: "Zinnen", label: "Volledige zin vertalen", type: "phrase", direct: "phrase-nl-fr" },
    { key: "actes_context", group: "Zinnen", label: "Actes de parole / In een situatie", type: "phrase", kind: "actes" },
    { key: "number_direct", group: "Getallen", label: "Getal naar Frans", type: "number", direct: "number-nl-fr", staticOnly: true },
    { key: "number_dynamic", group: "Getallen", label: "Dynamische getallen binnen het bereik", type: "number", direct: "number-nl-fr", dynamicOnly: true },
    { key: "spelling_context", group: "Spelling", label: "Schrijfwijze in context", type: "sound_rule", kind: "spelling" },
    { key: "revision_integrative", group: "Révision", label: "Volledige NL → FR-zinnen", kind: "revision", scoring: "integrative" }
  ]);
  const BY_KEY = new Map(DEFINITIONS.map(function (form) { return [form.key, form]; }));
  const DEFAULT_KEYS = Object.freeze(["vocab_direct", "verb_conjugation", "grammar_rule", "phrase_direct", "number_direct", "number_dynamic", "spelling_context"]);

  function definition(key) { return BY_KEY.get(key) || null; }
  function isDynamicNumber(item) { return item && item.type === "number" && item.dynamic_range === true && Array.isArray(item.range); }
  function supportsDirect(form, item) {
    return Boolean(form && form.direct && item && item.type === form.type &&
      (!form.staticOnly || !isDynamicNumber(item)) && (!form.dynamicOnly || isDynamicNumber(item)) &&
      (form.key !== "verb_conjugation" || Array.isArray(item.conjugations) && item.conjugations.length));
  }
  function variantsForItem(key, item, selectedItems, bank, engine, scope) {
    const form = definition(key);
    if (!form || !form.kind || !item || !engine || !Array.isArray(bank && bank.variants)) return [];
    const selected = new Map((selectedItems || []).map(function (entry) { return [entry.id, entry]; }));
    const grammarCategories = new Set((selectedItems || []).filter(function (entry) {
      return entry.type === "grammar_rule";
    }).map(function (entry) { return entry.category; }));
    if (form.type && item.type !== form.type) return [];
    if (key === "grammar_mixed" && (scope && (scope.category || scope.subsection) || grammarCategories.size < 2)) return [];
    return bank.variants.filter(function (variant) {
      if (variant.kind !== form.kind || form.scoring && variant.scoring !== form.scoring ||
          form.scopeKind && variant.scope_kind !== form.scopeKind ||
          variant.evidence_policy === "practice_only") return false;
      if (scope && scope.trajectory && variant.trajectory !== scope.trajectory) return false;
      if (variant.required_subsection && scope && scope.subsection && variant.required_subsection !== scope.subsection) return false;
      const targets = engine.targetsForVariant(variant);
      return targets[0] === item.id && targets.every(function (id) { return selected.has(id); });
    });
  }
  function availableForms(items, bank, engine, scope) {
    return DEFINITIONS.map(function (form) {
      const covered = (items || []).filter(function (item) {
        return supportsDirect(form, item) || variantsForItem(form.key, item, items, bank, engine, scope).length;
      });
      if (!covered.length) return null;
      const variantCount = form.kind ? covered.reduce(function (total, item) {
        return total + variantsForItem(form.key, item, items, bank, engine, scope).length;
      }, 0) : 0;
      return Object.assign({}, form, { coveredItemIds: covered.map(function (item) { return item.id; }), variantCount: variantCount });
    }).filter(Boolean);
  }
  function uncoveredItemIds(items, keys, bank, engine, scope) {
    const selected = new Set(keys || []);
    return (items || []).filter(function (item) {
      return !DEFINITIONS.some(function (form) {
        if (!selected.has(form.key)) return false;
        if (supportsDirect(form, item)) return true;
        return variantsForItem(form.key, item, items, bank, engine, scope).some(function (variant) {
          return engine.targetsForVariant(variant).length === 1;
        });
      });
    }).map(function (item) { return item.id; });
  }
  return { DEFINITIONS: DEFINITIONS, DEFAULT_KEYS: DEFAULT_KEYS, definition: definition,
    supportsDirect: supportsDirect, variantsForItem: variantsForItem,
    availableForms: availableForms, uncoveredItemIds: uncoveredItemIds };
});
