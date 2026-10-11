// Build the static, curated exercise bank from the user-supplied master spec.
// Usage: node scripts/import-master-variants.js <master-spec.md>
// This is an offline authoring tool; the GitHub Pages app only loads the JSON.
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../exercise-variants.js");

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Pass the master spec Markdown path as the first argument.");
const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);
const course = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/course.json"), "utf8"));
const byTrajet = new Map(course.trajectories.map((trajectory, index) => [index + 1, trajectory.items]));
const idPattern = /^T([1-6])-[A-Z0-9-]+-\d{3}$/;
const clean = (value) => String(value || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/\*\*/g, "").replace(/`/g, "").trim();
const norm = (value) => clean(value).normalize("NFC").toLocaleLowerCase("fr")
  .replace(/[’‘]/g, "'").replace(/\s+/g, " ").replace(/[.!?]+$/g, "").trim();
const atom = (value) => norm(value).replace(/^(un|une|des|le|la|les|du|de la|au|aux)\s+|^(l'|de l')/, "")
  .replace(/\s*\([^)]*\)\s*/g, " ").trim();
const numberItem = (t) => byTrajet.get(t).find((item) => item.type === "number" && item.dynamic_range);
const grammar = (t) => byTrajet.get(t).filter((item) => item.type === "grammar_rule");
const unique = (items) => [...new Set(items.filter(Boolean).map((item) => typeof item === "string" ? item : item.id))];
const explicitTargets = {
  "T1-EXP-014": "uf1-item-000028", "T1-EXP-015": "uf1-item-000545",
  "T1-EXP-016": "uf1-item-000545", "T1-EXP-018": "uf1-item-000551",
  "T1-EXP-019": "uf1-item-000021", "T1-EXP-020": "uf1-item-000028",
  "T2-EXP-001": "uf1-item-000168", "T5-EXP-003": "uf1-item-000804"
};
const findItems = (t, type, predicate) => byTrajet.get(t).filter((item) => item.type === type && predicate(item));
const firstId = (items) => items.length ? items[0].id : null;
const target = (t, type, predicate) => firstId(findItems(t, type, predicate));
const wholeAnswer = (value) => [clean(value)].filter(Boolean);
const alternatives = (value, id) => {
  const answer = clean(value);
  if (id === "T6-Q-DOUBLE-001") return ["Tu as un match quand ?", "Quand est-ce que tu as un match ?"];
  if (id === "T4-ACT-MOVE-018" || id === "T6-QW-MEAN-008") return answer.split(/\s+\/\s+/).map(clean);
  if (answer.includes("(e)")) return [answer.replace(/\(e\)/g, ""), answer.replace(/\(e\)/g, "e")];
  if (/\?\s*\/\s*[^/]+\?$/.test(answer) || /\.\s*\/\s*[^/]+\.$/.test(answer)) return answer.split(/\s+\/\s+/).map(clean);
  return wholeAnswer(answer);
};

function lexicalTargets(t, answer, kind, prompt) {
  const phrase = norm(answer);
  const a = atom(answer);
  const own = byTrajet.get(t);
  if (kind === "actes") {
    if (t === 1 && phrase === "j'ai douze ans") return ["uf1-item-000526"];
    if (t === 1 && phrase === "il a douze ans") return ["uf1-item-000549"];
    const phrases = own.filter((item) => item.type === "phrase");
    const exact = phrases.filter((item) => [item.fr].concat(item.accepted_answers || []).some((form) => norm(form) === phrase));
    if (exact.length) return unique(exact.slice(0, 2));
    const exactVocabulary = own.find((item) => item.type === "vocabulary" &&
      [item.fr].concat(item.accepted_answers || []).some((form) => norm(form) === phrase));
    if (exactVocabulary) return [exactVocabulary.id];
    const stop = new Set(["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "est", "sont", "une", "des", "les", "dans", "avec", "pour", "que", "qui", "lors", "cette", "comme", "emma", "lucas", "hugo", "lina", "julie", "marc", "paul", "marie", "lola", "pierre", "anne"]);
    const words = (value) => norm(value).match(/[\p{L}]+/gu)?.filter((word) => word.length > 2 && !stop.has(word)) || [];
    const answerWords = words(answer);
    const person = phrase.match(/^(je|j'|tu|il|elle|nous|vous|ils|elles)\b/);
    const scored = phrases.map((item) => {
      const lexical = words(item.fr).reduce((sum, word) => sum +
        (answerWords.includes(word) ? Math.min(word.length, 10) : 0), 0);
      return { item, lexical, score: lexical + (lexical && person && norm(item.fr).startsWith(person[1]) ? 4 : 0) };
    })
      .sort((left, right) => right.score - left.score);
    if (scored[0] && scored[0].lexical >= 4) return [scored[0].item.id];
    const vocabulary = own.find((item) => item.type === "vocabulary" &&
      words(item.fr).some((word) => answerWords.includes(word)));
    return vocabulary ? [vocabulary.id] : [];
  }
  const vocabulary = own.filter((item) => item.type === "vocabulary");
  const exact = vocabulary.filter((item) => atom(item.fr) === a || norm(item.fr) === phrase ||
    (item.accepted_answers || []).some((form) => atom(form) === a));
  if (exact.length) {
    const promptNorm = norm(prompt);
    const scored = exact.map((item) => ({ item, score:
      (promptNorm.includes("basket") && norm(item.fr).includes("basket") ? 1 : 0) +
      (promptNorm.includes("chaussure") && norm(item.nl).includes("schoen") ? 2 : 0) +
      (promptNorm.includes("paniers") && norm(item.nl).includes("basketbal") ? 2 : 0) }));
    scored.sort((left, right) => right.score - left.score);
    return [scored[0].item.id];
  }
  const allEarlier = [...Array(t)].flatMap((_, index) => byTrajet.get(index + 1));
  const related = allEarlier.filter((item) => item.type === "vocabulary" &&
    (atom(item.fr) === a || atom(item.fr).replace(/s$/, "") === a.replace(/s$/, "") ||
      (a.length >= 5 && atom(item.fr).length >= 5 && atom(item.fr).slice(0, 4) === a.slice(0, 4))));
  if (related.length) return [related.sort((left, right) =>
    (own.includes(right) ? 1 : 0) - (own.includes(left) ? 1 : 0))[0].id];
  const vocabularyPhrase = allEarlier.find((item) => item.type === "vocabulary" &&
    a.length >= 4 && atom(item.fr).includes(a) && atom(item.fr).length <= a.length + 12);
  if (vocabularyPhrase) return [vocabularyPhrase.id];
  if (t === 3 && a === "vêtements") return ["uf1-item-000292"]; // le magasin (de vêtements)
  const verbForm = allEarlier.find((item) => item.type === "verb" &&
    (item.conjugations || []).some((row) => norm(row.form).split(" ").at(-1) === a));
  if (verbForm) return [verbForm.id];
  const phraseContaining = allEarlier.find((item) => item.type === "phrase" && a.length >= 4 && norm(item.fr).includes(a));
  if (phraseContaining) return [phraseContaining.id];
  const phraseItem = own.find((item) => item.type === "phrase" &&
    [item.fr].concat(item.accepted_answers || []).some((form) => norm(form) === phrase));
  if (phraseItem) return [phraseItem.id];
  const verb = own.find((item) => item.type === "verb" && norm(item.infinitive) === a);
  return verb ? [verb.id] : [];
}

// These source sections are lexical/communicative, not grammar. Never let the
// generic grammar fallback attach them to an unrelated grammar_rule item.
function focusedContextTargets(t, id, answer) {
  if (t === 3 && id.startsWith("T3-VILL-")) {
    const matches = findItems(3, "phrase", (item) =>
      [item.fr].concat(item.accepted_answers || []).some((form) => norm(form) === norm(answer)));
    return matches.length === 1 ? [matches[0].id] : [];
  }
  if (t === 4 && id.startsWith("T4-TRSP-CTX-")) {
    const ids = ["000629", "000630", "000631", "000632", "000633", "000634", "000635",
      "000636", "000637", "000638", "000639", "000640", "000641", "000642", "000643"];
    const itemId = "uf1-item-" + ids[Number(id.slice(-3)) - 1];
    return byTrajet.get(4).some((item) => item.id === itemId && item.type === "vocabulary") ? [itemId] : [];
  }
  if (t === 5 && id.startsWith("T5-PREP-")) {
    const ids = ["000766", "000767", "000768", "000769", "000771", "000770",
      "000773", "000772", "000774", "000775", "000764", "000763"];
    const itemId = "uf1-item-" + ids[Number(id.slice(-3)) - 1];
    return byTrajet.get(5).some((item) => item.id === itemId && item.type === "vocabulary") ? [itemId] : [];
  }
  return null;
}

function infinitiveChoices(t, infinitive) {
  const verb = byTrajet.get(t).find((item) => item.type === "verb" && norm(item.infinitive) === norm(infinitive));
  if (!verb) throw new Error("No course verb for infinitive-form exercise: " + infinitive);
  const tu = (verb.conjugations || []).find((row) => norm(row.subject) === "tu");
  const il = (verb.conjugations || []).find((row) => norm(row.subject).startsWith("il/elle/on"));
  if (!tu || !il) throw new Error("Missing course conjugations for " + infinitive);
  const choices = [infinitive, tu.form.replace(/^tu\s+/i, ""), il.form.replace(/^il\/elle\/on\s+/i, "")];
  if (new Set(choices.map(norm)).size !== 3) throw new Error("Non-distinct form choices for " + infinitive);
  return choices.join(" / ");
}

function classifyVariant(t, suffix) {
  if (suffix.startsWith("VOC") || suffix === "SIGN" ||
      t === 4 && suffix === "TRSP-CTX" || t === 5 && suffix === "PREP") return "context";
  if (suffix.startsWith("EXP") || suffix.startsWith("ACT") || suffix.startsWith("PRES") ||
      suffix.startsWith("FAM") || t === 3 && suffix === "VILL") return "actes";
  if (suffix.startsWith("VERB") || suffix === "FP" || suffix === "PR" ||
      suffix.startsWith("PC") || suffix.startsWith("PP") || suffix.startsWith("TENSE")) return "conjugation";
  if (suffix.startsWith("REV")) return "revision";
  if (suffix.startsWith("NUM")) return "number";
  if (suffix.startsWith("HOM")) return "spelling";
  if (suffix.startsWith("GRAM") || suffix.startsWith("POSS") ||
      suffix.startsWith("AUX") || suffix.startsWith("Q-") || suffix.startsWith("QW")) return "grammar";
  throw new Error("No explicit exercise classification for " + t + "/" + suffix);
}

function verbTargets(t, prompt, answer, id) {
  const infinitive = [...prompt.matchAll(/\(([^)]+)\)/g)].map((match) => norm(match[1]));
  const verb = byTrajet.get(t).find((item) => item.type === "verb" && infinitive.includes(norm(item.infinitive)));
  if (verb) return [verb.id];
  if (t <= 3 && infinitive.some((name) => name.includes("rendre visite"))) {
    const visit = byTrajet.get(t).find((item) => item.type === "verb" && norm(item.infinitive).includes("rendre"));
    if (visit) return [visit.id];
  }
  if (t === 1 && id.includes("VERB-MIX")) return [target(1, "verb", (item) =>
    item.infinitive === (/^(ai|as|a|avons|avez|ont)$/.test(norm(answer)) ? "avoir" : "être"))];
  if (t === 1 && id.includes("VERB-SUBJ")) return [target(1, "verb", (item) => item.infinitive === "être")];
  if (t === 4) {
    const derived = grammar(4).find((item) => infinitive.some((name) => norm(item.prompt).startsWith(name + ":")));
    if (derived) return [derived.id];
    const tense = /(^T4-FP-|futur proche)/i.test(id + " " + prompt) ? "le futur proche" : "le passé récent";
    return [target(4, "grammar_rule", (item) => item.category === tense)];
  }
  if (t === 5) {
    const irregular = grammar(5).find((item) => infinitive.some((name) => norm(item.prompt).endsWith("van " + name)));
    if (irregular) return [irregular.id];
    const group = infinitive[0] && infinitive[0].endsWith("er") ? "-ER" : infinitive[0] && infinitive[0].endsWith("re") ? "-RE" : "-IR";
    return [target(5, "grammar_rule", (item) => item.prompt && item.prompt.includes(group)) || grammar(5)[0].id];
  }
  if (t === 6) {
    if (id.includes("TENSE-MIX")) {
      const a = norm(answer);
      if (/\b(vais|vas|va|allons|allez|vont)\b/.test(a) && /\b\w+er\b/.test(a)) return ["uf1-item-000693"];
      if (/\b(viens|vient|venons|venez|viennent)\b.*\bde\b/.test(a)) return ["uf1-item-000695"];
      if (/^(ai|as|a|avons|avez|ont)\b/.test(a)) return ["uf1-item-000848"];
      if (/^(est|sont|suis|sommes|êtes)\b/.test(a)) return ["uf1-item-000987"];
      const presentVerb = [...Array(t)].flatMap((_, index) => byTrajet.get(index + 1)).find((item) =>
        item.type === "verb" && infinitive.includes(norm(item.infinitive)));
      if (presentVerb) return [presentVerb.id];
    }
    if (id.includes("PC-AGR")) return ["uf1-item-000989"];
    if (id.includes("PC-ETRE") && Number(id.slice(-3)) >= 16) return ["uf1-item-000989"];
    const participle = grammar(6).find((item) => infinitive.some((name) => norm(item.prompt).endsWith("van " + name)));
    if (participle) return [participle.id];
    return [grammar(6)[0].id];
  }
  return [];
}

function conjugationPerson(prompt, answer, item) {
  const before = norm(prompt.split("___")[0]).split(/[.!?\n]/).at(-1).trim();
  if (/\b(et moi|moi et)\b/.test(before)) return "nous";
  if (/\b(et toi|toi et)\b/.test(before)) return "vous";
  if (/^(je|j')\b/.test(before)) return "je";
  if (/^tu\b/.test(before)) return "tu";
  if (/^nous\b/.test(before)) return "nous";
  if (/^vous\b/.test(before)) return "vous";
  if (/^(ils|elles|les|mes|ses|des)\b/.test(before) || /\bet\b/.test(before)) return "ils";
  if (/^(il|elle|on)\b/.test(before)) return "il";
  const form = norm(answer);
  const matches = (item.conjugations || []).filter((entry) =>
    norm(entry.form).split(" ").at(-1) === form || norm(entry.form).replace(/^j'/, "") === form);
  if (matches.length === 1) {
    const subject = norm(matches[0].subject);
    if (/^(je|j')/.test(subject)) return "je";
    if (subject === "tu" || subject === "nous" || subject === "vous") return subject;
    if (subject.startsWith("ils")) return "ils";
    return "il";
  }
  return "il";
}

function grammarTarget(t, id, prompt, answer) {
  const a = norm(answer), p = norm(prompt), group = id.split("-").slice(1, -1).join("-");
  if (t === 1) {
    if (group.includes("SUBJ")) return target(1, "verb", (item) => item.infinitive === "être");
    if (group.includes("AIM") || group.includes("INF")) return target(1, "grammar_rule", (item) => item.category.includes("regel na aimer") &&
      (/^(le|la|l'|les|du|de la|des)$/.test(a) ? item.prompt.includes("zelfstandig") : item.prompt.includes("werkwoord")));
    return target(1, "grammar_rule", (item) => norm(item.answer) === a) || grammar(1)[0].id;
  }
  if (t === 2) {
    const name = group.includes("PLUS") ? "ne ... plus" : group.includes("JAMAIS") ? "ne ... jamais" :
      group.includes("ETRE") ? "négation avec être" : group.includes("ART") || group.includes("DE") ? "article après négation" :
      p.includes("encore") || a.includes("plus") ? "ne ... plus" : p.includes("souvent") || a.includes("jamais") ? "ne ... jamais" :
      "ne ... pas";
    return target(2, "grammar_rule", (item) => item.category === name);
  }
  if (t === 3) {
    const contract = grammar(3).find((item) => norm(item.answer) === a && item.category.startsWith("article contracté"));
    if (contract) return contract.id;
    const verb = grammar(3).find((item) => norm(item.answer) === a && item.category === "verbes + à");
    if (verb) return verb.id;
    const prep = grammar(3).find((item) => norm(item.answer) === a && item.category === "prépositions + de");
    if (prep) return prep.id;
    return grammar(3)[0].id;
  }
  if (t === 4) {
    if (group === "FP" || group.includes("FUT")) return grammar(4)[0].id;
    if (group === "PR" || group.includes("REC")) return grammar(4)[2].id;
    const base = [...prompt.matchAll(/\(([^)]+)\)/g)].map((match) => norm(match[1]));
    const specific = grammar(4).find((item) => item.category === "formes / exceptions du féminin" &&
      (base.some((value) => norm(item.prompt).endsWith("de " + value)) ||
       norm(item.answer) === a || norm(item.answer) + "s" === a));
    if (specific) return specific.id;
    if (group.includes("PLUR") || group === "GRAM-PL" || /\b(les|des|mes|tes|ses|nos|vos|leurs)\b/.test(p)) {
      const ruleId = a.endsWith("aux") ? "uf1-item-000717" : a.endsWith("eaux") ? "uf1-item-000716" :
        a.endsWith("x") ? "uf1-item-000715" : a.endsWith("s") && p.includes(a.replace(/s$/, "")) ? "uf1-item-000714" :
        "uf1-item-000713";
      return ruleId;
    }
    if (a.endsWith("onne")) return "uf1-item-000710";
    if (a.endsWith("elle")) return "uf1-item-000711";
    if (a.endsWith("ère")) return "uf1-item-000712";
    if (a.endsWith("ve")) return "uf1-item-000709";
    if (a.endsWith("se")) return "uf1-item-000708";
    return target(4, "grammar_rule", (item) => item.category === "le féminin de l’adjectif");
  }
  if (t === 5) {
    if (group.includes("POSS")) {
      const fixed = grammar(5).filter((item) => item.category === "adjectifs possessifs" && norm(item.answer) === a);
      if (fixed.length) return fixed[0].id;
      return grammar(5).find((item) => item.category.startsWith("Attention"))?.id;
    }
    return verbTargets(5, prompt, answer, id)[0];
  }
  if (t === 6) {
    if (group.startsWith("AUX-MIX")) return /^(ai|as|a|avons|avez|ont)\b/.test(a) ? "uf1-item-000848" : "uf1-item-000987";
    if (group.startsWith("HOM-A")) return target(6, "sound_rule", (item) => norm(item.spelling) === a) || target(6, "sound_rule", (item) => item.spelling === "a");
    if (group.startsWith("HOM-OU")) return target(6, "sound_rule", (item) => norm(item.spelling) === a) || target(6, "sound_rule", (item) => item.spelling === "ou");
    if (group.startsWith("HOM-LA")) return target(6, "sound_rule", (item) => norm(item.spelling) === a) || target(6, "sound_rule", (item) => item.spelling === "la");
    if (group.startsWith("QW")) {
      const word = (prompt.match(/`([^`]+)`/) || [])[1] || (prompt.match(/\b(qui|quoi|quand|où|comment|combien|pourquoi|quel|quelle|quels|à quelle heure)\b/i) || [])[0];
      return target(6, "grammar_rule", (item) => item.category === "les mots interrogatifs" &&
        (word ? norm(item.prompt).includes(norm(word)) : norm(item.answer) === a)) || "uf1-item-001010";
    }
    if (group.startsWith("Q-QQ")) return "uf1-item-001009";
    if (group.startsWith("Q-ECQW")) return "uf1-item-001008";
    if (group.startsWith("Q-ECQ")) return "uf1-item-001007";
    if (group.startsWith("Q-INTW")) return "uf1-item-001006";
    if (group.startsWith("Q-INT")) return "uf1-item-001005";
    if (group.startsWith("Q-DOUBLE")) return "uf1-item-001005";
    if (group.startsWith("SIGN")) return lexicalTargets(6, answer, "context", prompt)[0];
    return verbTargets(6, prompt, answer, id)[0];
  }
  return null;
}

function grammarGapTarget(t, id, prompt, answer, index) {
  const before = prompt.split("___")[index] || "";
  if (t === 1 && /^T1-GRAM-(ALL|MIX)-/.test(id) &&
      /(?:aime|aimes|aimons|aimez|aiment|adore|adores|adorons|adorez|adorent|déteste|détestes|détestons|détestez|détestent)\s*$/i.test(before))
    return grammarTarget(1, "T1-GRAM-AIMER-001", prompt, answer);
  if (t === 2 && /^T2-GRAM-ART-/.test(id) && prompt.includes("→") && index === 0) {
    if (/^(un|une|des)$/i.test(answer)) return grammarTarget(1, "T1-GRAM-IND-001", prompt, answer);
    if (/^(le|la|l’|les)$/i.test(answer)) return grammarTarget(1, "T1-GRAM-DEF-001", prompt, answer);
  }
  return grammarTarget(t, id, prompt, answer);
}

function revisionTargets(t, prompt, answers, id) {
  const text = norm(answers.join(" "));
  // A complete Révision sentence can support several established goals, but
  // never an incidental word selected by the lexical fallback below.
  const exact = {
    "T1-REV-006": ["uf1-item-000010"],
    "T2-REV-009": ["uf1-item-000248"],
    "T2-REV-013": ["uf1-item-000276", "uf1-item-000279"],
    "T2-REV-014": ["uf1-item-000276", "uf1-item-000280"],
    "T2-REV-015": ["uf1-item-000208"],
    "T4-REV-002": ["uf1-item-000639"],
    "T4-REV-006": ["uf1-item-000683"],
    "T4-REV-015": ["uf1-item-000717"],
    "T5-REV-006": ["uf1-item-000848"],
    "T5-REV-008": ["uf1-item-000848", "uf1-item-000856"],
    "T5-REV-009": ["uf1-item-000848", "uf1-item-000857"],
    "T5-REV-010": ["uf1-item-000848", "uf1-item-000858"],
    "T6-REV-003": ["uf1-item-000766"],
    "T6-REV-004": ["uf1-item-000956"],
    "T6-REV-012": ["uf1-item-001006", "uf1-item-001009"],
    "T6-REV-015": ["uf1-item-001005"],
    "T6-REV-OLD-006": ["uf1-item-000872"]
  }[id];
  if (exact) return exact;
  if (id && id.startsWith("T6-REV-OLD-")) {
    const number = Number(id.slice(-3));
    if (number <= 4) return [number === 4 ? "uf1-item-000126" : grammarTarget(3, id, prompt, answers[0])];
    if (number <= 8) return [grammarTarget(5, "T5-POSS-MIX-001", prompt, answers[0])];
    return [grammarTarget(2, "T2-GRAM-MIX-001", prompt, answers[0])];
  }
  const normalRevision = id && id.match(/^T[1-6]-REV-(\d{3})$/);
  const revisionNumber = normalRevision ? Number(normalRevision[1]) : 0;
  if (normalRevision && t === 3 && revisionNumber >= 26 && revisionNumber <= 30) {
    const number = Number((answers[0].match(/^\d+$/) || prompt.match(/\b\d+\b/) || [])[0]);
    const item = byTrajet.get(3).find((candidate) => candidate.type === "number" && Number(candidate.nl) === number);
    return item ? [item.id] : [];
  }
  if (normalRevision && t >= 3 && revisionNumber >= 26 && revisionNumber <= 30) {
    const number = numberItem(t) || byTrajet.get(t).find((item) => item.type === "number");
    if (number) return [number.id];
  }
  if (normalRevision && t === 3 && revisionNumber >= 20 && revisionNumber <= 25)
    return [grammarTarget(3, id, prompt, answers[0])];
  if (normalRevision && t === 4 && revisionNumber >= 21 && revisionNumber <= 25)
    return [grammarTarget(4, "T4-GRAM-MIX-001", prompt, answers[0])];
  if (normalRevision && t === 5 && revisionNumber >= 22 && revisionNumber <= 25)
    return [grammarTarget(5, "T5-POSS-MIX-001", prompt, answers[0])];
  if (normalRevision && t === 6 && revisionNumber >= 21 && revisionNumber <= 23) {
    const word = text === "où" ? "où" : text === "pourquoi" ? "pourquoi" : "quoi";
    return [target(6, "grammar_rule", (item) => item.category === "les mots interrogatifs" &&
      norm(item.prompt).endsWith(" " + word))];
  }
  if (normalRevision && t === 6 && (revisionNumber === 24 || revisionNumber === 25))
    return [target(6, "sound_rule", (item) => norm(item.spelling) === norm(answers[0].split(/\s*·\s*/)[0]))];
  if (normalRevision && t === 3 && revisionNumber >= 16 && revisionNumber <= 19) {
    const infinitive = { 16: "aller", 17: "venir", 18: "attendre", 19: "retenir" }[revisionNumber];
    return [target(3, "verb", (item) => item.infinitive === infinitive)];
  }
  if (normalRevision && t === 3 && revisionNumber === 15) return ["uf1-item-000511"];
  if (normalRevision && t === 4 && revisionNumber === 1) return ["uf1-item-000632"];
  if (normalRevision && t === 4 && revisionNumber === 2)
    return [target(4, "vocabulary", (item) => norm(item.fr).includes("métro"))];
  if (normalRevision && t === 4 && revisionNumber >= 16 && revisionNumber <= 20) {
    if (revisionNumber === 16) return ["uf1-item-000693"];
    if (revisionNumber === 17) return ["uf1-item-000677"];
    const infinitive = { 18: "mettre", 19: "apprendre", 20: "promettre" }[revisionNumber];
    return [target(4, "verb", (item) => item.infinitive === infinitive) ||
      target(4, "grammar_rule", (item) => norm(item.prompt).startsWith(infinitive + ":"))];
  }
  if (normalRevision && t === 5 && revisionNumber >= 19 && revisionNumber <= 21)
    return ["uf1-item-000848"];
  if (normalRevision && t === 5 && revisionNumber === 18) return ["uf1-item-000766"];
  if (normalRevision && t === 6 && revisionNumber >= 18 && revisionNumber <= 20)
    return [revisionNumber === 18 ? "uf1-item-001003" : "uf1-item-000989"];
  if (t === 6 && /\b(est|sont)\s+\p{L}+(?:es?|s)\b/u.test(text) && /\b(hier|arriv|all|rentr|tomb)/.test(text))
    return ["uf1-item-000989"];
  if (t === 6 && /\b(est|sont)\s+(arriv|all|rentr|tomb)/.test(text)) return ["uf1-item-000987"];
  if (t === 6 && /\?/.test(answers[0]) && /^(tu|qu'|qui|que|quoi|quand|où|comment|pourquoi|quel|quelle|à quelle heure|est-ce)/.test(text))
    return [text.includes("est-ce que") ? "uf1-item-001008" : "uf1-item-001006"];
  if (t >= 2 && /\b(ne|n')\b.*\b(pas|plus|jamais)\b/.test(text))
    return [grammarTarget(2, "T2-GRAM-MIX-001", prompt, answers[0])];
  if (t === 4 && /\b(vais|vas|va|allons|allez|vont)\s+[a-zéèêîïôû]+(er|ir|re)\b/.test(text)) return ["uf1-item-000693"];
  if (t === 4 && /\bviens|vient|venons|venez|viennent\b.*\bde\b/.test(text)) return ["uf1-item-000695"];
  if (t === 4) {
    const derived = grammar(4).find((item) => item.category === "même conjugaison" &&
      text.includes(norm(item.prompt).split(":")[0].slice(0, 5)));
    if (derived) return [derived.id];
    const adjective = grammar(4).find((item) => item.category === "formes / exceptions du féminin" &&
      text.includes(norm(item.answer)));
    if (adjective) return [adjective.id];
  }
  if (t === 5 && /\b(ai|as|a|avons|avez|ont)\b\s+\p{L}+(é|i|u)\b/u.test(text)) return ["uf1-item-000848"];
  const candidates = [...Array(t)].flatMap((_, index) => byTrajet.get(index + 1))
    .filter((item) => item.type === "vocabulary" || item.type === "phrase" || item.type === "verb");
  const scored = candidates.map((item) => {
    const term = atom(item.fr || item.infinitive || "");
    const word = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { item, score: term.length >= 4 && new RegExp("(^|[^\\p{L}])" + word + "($|[^\\p{L}])", "u").test(text) ? term.length : 0 };
  }).filter((row) => row.score > 0).sort((left, right) => right.score - left.score);
  if (scored.length) return unique(scored.slice(0, 3).map((row) => row.item));
  const verbMatch = [...Array(t)].flatMap((_, index) => byTrajet.get(index + 1))
    .filter((item) => item.type === "verb")
    .map((item) => ({ item, score: (item.conjugations || []).reduce((max, row) => {
      const form = norm(row.form).split(" ").at(-1);
      return form && form.length >= 4 && text.includes(form) ? Math.max(max, form.length) : max;
    }, 0) }))
    .filter((row) => row.score).sort((left, right) => right.score - left.score);
  if (verbMatch.length) return [verbMatch[0].item.id];
  const acte = lexicalTargets(t, answers[0], "actes", prompt);
  if (acte.length) return acte;
  const grammarItem = grammar(t)[0];
  return grammarItem ? [grammarItem.id] : [byTrajet.get(t).find((item) => item.type === "vocabulary").id];
}

function gapTargets(t, id, prompt, answer, index) {
  const a = norm(answer);
  const exact = {
    "T2-REV-020": [null, "uf1-item-000279"],
    "T2-REV-021": [null, "uf1-item-000279"],
    "T2-REV-029": [null, null, "uf1-item-000277", null],
    "T2-REV-030": ["uf1-item-000125", "uf1-item-000267", "uf1-item-000276",
      "uf1-item-000276", "uf1-item-000278", "uf1-item-000278"],
    "T3-REV-031": [null, "uf1-item-000354"],
    "T4-REV-034": [null, "uf1-item-000693"],
    "T6-REV-034": ["uf1-item-000990", "uf1-item-000989", "uf1-item-000989"]
  }[id];
  if (exact && exact[index]) return [exact[index]];
  if (id === "T6-REV-035") {
    const word = a === "combien de" ? "combien" : a;
    const interrogative = target(6, "grammar_rule", (item) => item.category === "les mots interrogatifs" &&
      norm(item.prompt).includes(word));
    if (interrogative) return [interrogative];
  }
  if (["T6-REV-024", "T6-REV-025", "T6-REV-036"].includes(id)) {
    const hom = target(6, "sound_rule", (item) => norm(item.spelling) === a);
    if (hom) return [hom];
  }
  if (id === "T4-REV-035") return [["uf1-item-000724"], ["uf1-item-000728"], ["uf1-item-000713"]][index];
  if (id === "T5-REV-034") return [["uf1-item-000695"], ["uf1-item-000848"], ["uf1-item-000693"]][index];
  if (id === "T6-REV-031" && index === 2) return ["uf1-item-000951"];
  if (id === "T6-REV-031" && index === 3) return ["uf1-item-000943"];
  if (t >= 2 && /^(ne|n'|pas|plus|jamais)$/.test(a)) {
    const parts = prompt.split("___");
    const nearby = norm((parts[index] || "") + " " + (parts[index + 1] || ""));
    const category = a === "plus" || nearby.includes("encore") ? "ne ... plus" :
      a === "jamais" || nearby.includes("souvent") ? "ne ... jamais" : "ne ... pas";
    return [target(2, "grammar_rule", (item) => item.category === category)];
  }
  if (t >= 5 && /^(mon|ma|mes|ton|ta|tes|son|sa|ses|notre|nos|votre|vos|leur|leurs)$/.test(a)) {
    const possessive = target(5, "grammar_rule", (item) => item.category === "adjectifs possessifs" && norm(item.answer) === a);
    if (possessive) return [possessive];
  }
  if (t >= 3 && /^(au|aux|du|de la|de l'|à la|à l'|des)$/.test(a)) {
    const contracted = grammar(3).find((item) => item.category.startsWith("article contracté") && norm(item.answer) === a);
    if (contracted) return [contracted.id];
  }
  if (t >= 1 && /^(un|une|des|le|la|l'|les)$/.test(a)) {
    const article = grammar(1).find((item) => norm(item.answer) === a);
    if (article) return [article.id];
  }
  const infinitive = [...Array(t)].flatMap((_, i) => byTrajet.get(i + 1)).find((item) =>
    item.type === "verb" && norm(item.infinitive) === a);
  if (infinitive) return [infinitive.id];
  const form = [...Array(t)].flatMap((_, i) => byTrajet.get(i + 1)).find((item) => item.type === "verb" &&
    (item.conjugations || []).some((entry) =>
      norm(entry.form).split(" ").at(-1) === a || norm(entry.form).replace(/^j'/, "") === a));
  if (form) return [form.id];
  if (t === 4 && /^(nouvelle|blanche|dangereuse|sportives|roux|originales)$/.test(a))
    return [grammarTarget(4, "T4-GRAM-MIX-001", prompt, answer)];
  if (t === 5 && a === "à droite") return ["uf1-item-000766"];
  const lexical = lexicalTargets(t, answer, "context", prompt);
  if (lexical.length) return lexical;
  if (t >= 6) {
    const participle = grammar(6).find((item) => item.category === "verbes conjugués avec être" &&
      a.startsWith(norm(item.answer)));
    if (participle) return [participle.id];
  }
  if (t >= 5) {
    const participle = grammar(5).find((item) => item.category === "participes passés irréguliers" &&
      a.endsWith(norm(item.answer)));
    if (participle) return [participle.id];
  }
  if (/^[\d\s]+$/.test(a) || /^(zéro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|quarante|cinquante|soixante|septante|quatre-vingt|nonante|cent|mille)/.test(a)) {
    const number = numberItem(t) || [...byTrajet.get(t)].find((item) => item.type === "number");
    if (number) return [number.id];
  }
  return revisionTargets(t, prompt, [answer], id).slice(0, 1);
}

const rows = [];
let heading = "";
let subheading = "";
let header = [];
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i].trim();
  if (/^#{1,3}\s/.test(line)) {
    const text = clean(line.replace(/^#+\s*/, ""));
    if (line.startsWith("# ")) { heading = text; subheading = ""; }
    else subheading = text;
  }
  if (!line.startsWith("|")) { header = []; continue; }
  const cells = line.slice(1, -1).split("|").map(clean);
  if (cells[0] === "ID") { header = cells; continue; }
  if (!idPattern.test(cells[0] || "")) continue;
  rows.push({ id: cells[0], cells, header: header.slice(), heading, subheading, line: i + 1 });
}

const variants = [];
const unresolved = [];
for (const row of rows) {
  const { id, cells, header, line } = row;
  const t = Number(id[1]);
  const suffix = id.split("-").slice(1, -1).join("-");
  let prompt = cells[1] || "";
  let answer = cells[cells.length - 1] || "";
  let level;
  if (header[1] === "Niveau") { level = Number(cells[1]); prompt = cells[2]; answer = cells[3]; }
  if (header[header.length - 1] === "Mapping/opmerking" || header[header.length - 1] === "Regel") answer = cells[cells.length - 2];
  if (id === "T5-POSS-MIX-004") { prompt = "___ parents travaillent trop. (jouw)"; answer = "Tes"; }
  if (id === "T6-Q-ECQW-008") { prompt = "Vraag wie jij ziet."; answer = "Qui est-ce que tu vois ?"; }
  if (id === "T4-PR-020") {
    prompt = "Le cours est terminé : ils ___ le cours. (finir)";
    answer = "viennent de finir";
  }
  const regionalAlternatives = {
    "T3-REV-029": ["septante", "soixante-dix"],
    "T4-REV-026": ["septante-neuf", "soixante-dix-neuf"],
    "T6-REV-027": ["septante-huit-mille-huit-cent-quatorze", "soixante-dix-huit-mille-huit-cent-quatorze"],
    "T6-REV-029": ["dix-neuf-cent-nonante-neuf", "dix-neuf-cent-quatre-vingt-dix-neuf"]
  };
  if (id === "T6-VOC-CTX-046") continue; // ordinateur has no permanent course target.
  let accepted = header.includes("Antwoord 1") ? cells.slice(2, 4) : alternatives(answer, id);
  if (regionalAlternatives[id]) accepted = regionalAlternatives[id];
  // De master spec noemt uitdrukkelijk de traditionele spelling van trainer.
  if (t === 1 && /^(trainer|traine|traines|trainons|trainez|trainent)$/.test(answer))
    accepted = unique(accepted.concat(accepted.map((form) => form.replace("trai", "traî"))));
  let kind = classifyVariant(t, suffix);
  if (header.includes("Nederlands")) kind = "revision";
  const gaps = (prompt.match(/___/g) || []).length;
  const parts = answer.split(/\s*·\s*/).map(clean);
  const multi = gaps > 1 && parts.length === gaps;
  let targets;
  if (kind === "number") targets = [numberItem(t)?.id || byTrajet.get(t).find((item) => item.type === "number")?.id];
  else if (kind === "context" || kind === "actes") targets = focusedContextTargets(t, id, answer) || lexicalTargets(t, answer, kind, prompt);
  else if (kind === "conjugation") targets = verbTargets(t, prompt, answer, id);
  else if (kind === "grammar" || kind === "spelling") targets = [grammarTarget(t, id, prompt, answer)];
  else targets = revisionTargets(t, prompt, accepted, id);
  if (explicitTargets[id]) targets = [explicitTargets[id]];
  targets = unique(targets);
  if (!targets.length) unresolved.push({ id, prompt, answer, line });
  if (kind === "grammar" && t === 1 && suffix === "GRAM-AIMER") {
    const infinitives = (multi ? parts : [answer]).filter((part) =>
      byTrajet.get(1).some((item) => item.type === "verb" && norm(item.infinitive) === norm(part)));
    if (infinitives.length) prompt += " (" + infinitives.map((form) => infinitiveChoices(1, form)).join(" ; ") + ")";
  }
  if (kind === "grammar" && t === 1 && (suffix === "GRAM-ALL" || suffix === "GRAM-MIX")) {
    const infinitives = parts.filter((part) =>
      byTrajet.get(1).some((item) => item.type === "verb" && norm(item.infinitive) === norm(part)));
    if (infinitives.length) prompt += " (" + infinitives.map((form) => infinitiveChoices(1, form)).join(" ; ") + ")";
  }
  if (kind === "grammar" && t === 3 && suffix.startsWith("GRAM") && targets.length === 1) {
    const rule = byTrajet.get(3).find((item) => item.id === targets[0]);
    if (rule && /^(à|de) \+ /.test(rule.prompt || "")) prompt += " (" + rule.prompt + ")";
  }
  if (kind === "grammar" && t === 2 && suffix === "GRAM-MIX") {
    const form = /\bjamais\b/.test(norm(answer)) ? "ne ... jamais" :
      /\bplus\b/.test(norm(answer)) ? "ne ... plus" : "ne ... pas";
    prompt += " (" + form + ")";
  }
  if (kind === "grammar" && t === 2 && suffix === "GRAM-ART" && !prompt.includes("→"))
    prompt += " (ne ... pas)";
  if (kind === "grammar" && t === 5 && suffix === "POSS-VOTRE" &&
      Number(id.slice(-3)) >= 4 && !/\([^)]*\)/.test(prompt)) prompt += " (jullie/uw)";
  if (kind === "grammar" && t === 6 && suffix.startsWith("Q-") && !gaps) {
    const method = suffix === "Q-DOUBLE" ? "intonation ou est-ce que" :
      suffix.startsWith("Q-ECQ") ? "est-ce que" :
      suffix.startsWith("Q-INT") ? "intonation" : "";
    if (method && !prompt.includes("(" + method + ")")) prompt += " (" + method + ")";
  }
  const variant = { id, trajectory: "Trajet " + t, kind,
    scoring: multi ? "multi_gap" : kind === "revision" && !gaps ? "integrative" : "single",
    prompt, source_line: line };
  if (level) variant.level = level;
  if (kind === "revision" && !gaps) variant.instruction = "Schrijf de volledige Franse zin";
  if (kind === "actes" && !gaps) variant.instruction = "Schrijf de volledige Franse zin";
  if (kind === "conjugation") variant.instruction = "Vervoeg het werkwoord";
  if (kind === "number") variant.instruction = /chiffres/i.test(prompt) ? "Schrijf het cijfer" : "Schrijf het getal in het Frans";
  if (kind === "grammar" && t === 1 && suffix === "GRAM-AIMER")
    variant.instruction = prompt.includes(" / ") ? "Kies de infinitief na aimer, adorer of détester" :
      "Vul het bepaald lidwoord na aimer, adorer of détester in";
  if (kind === "grammar" && t === 1 && suffix === "GRAM-IND") variant.instruction = "Vul het onbepaald lidwoord in";
  if (kind === "grammar" && t === 1 && suffix === "GRAM-DEF") variant.instruction = "Vul het bepaald lidwoord in";
  if (kind === "grammar" && t === 1 && suffix === "GRAM-CORR")
    variant.instruction = "Verbeter de zin volgens de grammaticale regel";
  if (kind === "grammar" && t === 1 && (suffix === "GRAM-ALL" || suffix === "GRAM-MIX"))
    variant.instruction = prompt.includes(" / ") ?
      "Kies lidwoorden volgens de context en de infinitief uit de opties" :
      "Gebruik onbepaald bij introductie, bepaald bij herhaling of na aimer";
  if (kind === "grammar" && t === 2 && suffix.startsWith("GRAM"))
    variant.instruction = suffix === "GRAM-ART" ? "Let op het lidwoord na de ontkenning" :
      suffix === "GRAM-PAS" || suffix === "GRAM-ETRE" ?
      "Maak de zin ontkennend met ne ... pas" : suffix === "GRAM-JAM" ?
      "Maak de zin ontkennend met ne ... jamais" : suffix === "GRAM-PLUS" ?
      "Maak de zin ontkennend met ne ... plus" : "Kies de ontkenning die bij de betekenis past";
  if (kind === "grammar" && t === 3 && suffix.startsWith("GRAM"))
    variant.instruction = "Vorm het juiste lidwoord met à of de";
  if (kind === "grammar" && t === 5 && suffix.startsWith("POSS"))
    variant.instruction = "Gebruik het bezittelijk voornaamwoord van de aangeduide persoon";
  if (kind === "grammar" && t === 6 && suffix.startsWith("Q-") && !gaps)
    variant.instruction = suffix === "Q-DOUBLE" ? "Schrijf een volledige vraag" :
      "Schrijf de volledige vraag in de gevraagde vorm";
  if (kind === "spelling") variant.instruction = "Kies de juiste schrijfwijze";
  if (multi) {
    variant.gaps = parts.map((part, index) => ({ id: "gap-" + (index + 1), accepted_answers: [part],
      targets: kind === "grammar" ? [grammarGapTarget(t, id, prompt, part, index)] :
        kind === "spelling" ? [grammarTarget(t, id, prompt, part)] : gapTargets(t, id, prompt, part, index) }));
    if (variant.gaps.some((gap) => !gap.targets[0])) unresolved.push({ id, prompt, answer, line, gap: true });
  } else { variant.accepted_answers = accepted; variant.targets = targets; }
  if (kind === "conjugation" && targets.some((itemId) => byTrajet.get(t).some((item) => item.id === itemId && item.type === "verb")))
    variant.exercise_key = "verb-fr-conj";
  if (variant.exercise_key === "verb-fr-conj") {
    const verb = byTrajet.get(t).find((item) => item.id === targets[0]);
    variant.item_variant = conjugationPerson(prompt, answer, verb);
  }
  if (id.startsWith("T1-VERB-SUBJ-")) variant.evidence_policy = "practice_only";
  if (id.startsWith("T6-Q-DOUBLE-")) variant.evidence_policy = "practice_only";
  if (kind === "grammar" && /\?\s*$/.test(answer) && suffix.startsWith("Q-")) variant.requires_question_mark = true;
  variants.push(variant);
}

// Non-tabular, explicitly authored mini-dialogues / short texts.
for (let i = 0; i < lines.length; i += 1) {
  const match = lines[i].match(/^###\s+(T[1-6]-[A-Z0-9-]+-\d{3})\b/);
  if (!match || variants.some((variant) => variant.id === match[1])) continue;
  const id = match[1], t = Number(id[1]);
  if (id === "T3-REV-033") continue; // The source explicitly says its first gap is ambiguous without a fixed cue.
  const body = [];
  let answerLine = "";
  for (let j = i + 1; j < lines.length && !/^#{1,3}\s|^---\s*$/.test(lines[j]); j += 1) {
    const line = lines[j].trim();
    if (/^(Doelantwoord(?:\s+voor[^:]*)?|Overige antwoorden|Technische notitie):/i.test(line)) break;
    if (/^Antwoorden?:/i.test(line)) {
      answerLine = line.replace(/^Antwoorden?:\s*/i, "");
      if (!answerLine) answerLine = clean(lines[j + 1]);
      break;
    }
    if (line) body.push(clean(line));
  }
  if (id === "T2-REV-030") answerLine = "a · douze ans · n’ · pas · ne · jamais";
  if (!answerLine) { unresolved.push({ id, line: i + 1, reason: "no mini-dialogue answers" }); continue; }
  const prompt = body.join("\n");
  const parts = answerLine.split(/\s*·\s*/).map(clean);
  const gapCount = (prompt.match(/___/g) || []).length;
  if (gapCount !== parts.length) { unresolved.push({ id, line: i + 1, reason: "mini-dialogue gap mismatch", gapCount, parts }); continue; }
  const gaps = parts.map((part, index) => ({ id: "gap-" + (index + 1), accepted_answers: [part],
    targets: gapTargets(t, id, prompt, part, index) }));
  const variant = { id, trajectory: "Trajet " + t, kind: id.includes("REV") ? "revision" : "grammar",
    scoring: "multi_gap", prompt, gaps, source_line: i + 1 };
  if (id === "T2-REV-030") variant.context = "Leeftijd: 12 jaar";
  variants.push(variant);
}

variants.sort((left, right) => left.id.localeCompare(right.id, "en"));
if (unresolved.length) {
  console.error(unresolved.map((row) => row.id + (row.gap ? "/gap" : "") + (row.reason ? ": " + row.reason : "")).join("\n"));
  throw new Error(unresolved.length + " variants have no defensible mapping or parse.");
}
const bank = { version: 1, source: "Mon-parcours-master-content-spec-T1-T6.md", variants };
engine.validateBank(bank, course);
fs.writeFileSync(path.join(__dirname, "../data/exercise-variants.json"), JSON.stringify(bank, null, 2) + "\n");
console.log(JSON.stringify({ tableRows: rows.length, variants: variants.length,
  byTrajet: Object.fromEntries([1, 2, 3, 4, 5, 6].map((t) => [t, variants.filter((variant) => variant.trajectory === "Trajet " + t).length])) }, null, 2));
