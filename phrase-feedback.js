(function (root) {
  "use strict";

  // Guidance for typed Actes de parole, not a fuzzy correct-answer checker.
  // This file never changes grading or gives points to an incorrect answer.
  function normal(value) {
    return String(value || "").normalize("NFC").toLocaleLowerCase("fr")
      .replace(/[’‘`´]/g, "'")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
      .replace(/[,:;]/g, " ").replace(/\s+/g, " ")
      .replace(/[.!?]+\s*$/g, "").trim();
  }

  function html(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function wordDistance(left, right) {
    const a = left.split(/\s+/), b = right.split(/\s+/);
    const row = b.map(function (_, i) { return i + 1; });
    row.unshift(0);
    a.forEach(function (value, index) {
      let previous = row[0]; row[0] = index + 1;
      b.forEach(function (other, j) {
        const diagonal = previous;
        previous = row[j+1];
        row[j+1] = Math.min(row[j+1] + 1, row[j] + 1, diagonal + (value === other ? 0 : 1));
      });
    });
    return row[b.length];
  }

  function hint(question, rawAnswer, wrongCount, roundNumber, mode) {
    if (!question || !question.item || question.item.type !== "phrase" ||
        question.variantScoring === "multi_gap" || typeof rawAnswer !== "string") return null;
    const value = normal(rawAnswer);
    if (!value) return null;
    const answers = (question.answers || []).filter(function (answer) {
      return typeof answer === "string" && answer.trim();
    });
    if (!answers.length) return null;
    const patterns = answers.map(normal);
    const closest = patterns.reduce(function (best, answer, i) {
      return wordDistance(value, answer) < wordDistance(value, patterns[best]) ? i : best;
    }, 0);
    const expected = patterns[closest];
    const prompt = String(question.prompt || "").toLocaleLowerCase("nl");
    let fr, nl;
    if (/\[[^\]]+\]/.test(value) || /(?:m'appelle|nom de famille est|prénom c'est)\s+(?:nom|naam)$/.test(value)) {
      fr = "Remplace le texte entre crochets par une vraie information.";
      nl = "Vul een echte naam, leeftijd, klas, groep of plaats in. Neem [nom], [âge] of andere haakjes niet letterlijk over.";
    } else if (/\[(?:klas|groep)\]/i.test(prompt) && /(?:en classe|dans le groupe|en groupe|dans la classe)$/.test(value)) {
      fr = "Il manque la classe ou le groupe concret. Ta phrase doit être complète.";
      nl = "Je mist nog een echte klas of groep. Schrijf de volledige zin.";
    } else if (/^(?:hij\/zij|hoe heet hij\/zij|hoe oud is hij\/zij|waar woont hij\/zij|in welke klas zit hij\/zij)/.test(prompt)
        && /^(?:je|j'|tu)\b/.test(value)) {
      fr = "Le sujet doit être « il » ou « elle », pas « je » ou « tu ».";
      nl = "Let op wie je bedoelt: het gaat over hij/zij, niet over ik of jij.";
    } else if (/\bquel\b.*\bclasse\b|\bquelle\b.*\bgroupe\b/.test(value)) {
      fr = "« Classe » est féminin, « groupe » est masculin. Vérifie quel/quelle.";
      nl = "Controleer quel/quelle: classe is vrouwelijk, groupe is mannelijk.";
    } else if (/\bjouer (?:le|la|les) (?:foot|football|basket|padel)\b/.test(value)) {
      fr = "Après « jouer » et un sport, vérifie la préposition « à » et l'article.";
      nl = "Bij jouer + een sport gebruik je à met het juiste lidwoord, niet zomaar le/la.";
    } else if (/\b(?:est|es|suis)\b.*\b(?:ans|âge)\b/.test(value) &&
        /\b(?:ai|as|a)\b.*\b(?:ans|âge)\b/.test(expected)) {
      fr = "Pour l'âge, il faut « avoir », pas « être ».";
      nl = "Bij een leeftijd gebruik je avoir, niet être. Vervoeg het voor het juiste onderwerp.";
    } else if (patterns.some(function (answer) {
      return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
        answer.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    })) {
      fr = "Ta phrase est presque correcte : vérifie les accents.";
      nl = "Je zin is bijna juist. Controleer de Franse accenten.";
    } else if (value.split(/\s+/).length < Math.max(2, Math.ceil(expected.split(/\s+/).length * .6))) {
      fr = "Ta réponse est incomplète. Écris une phrase avec un sujet, un verbe conjugué et les informations demandées.";
      nl = "Je antwoord is te kort: schrijf een volledige zin met onderwerp, vervoegd werkwoord en alle gevraagde informatie.";
    } else if (/\b(?:dans|en|au|aux|de|à|a)\b/.test(value)) {
      fr = "Regarde bien les prépositions, articles et petits mots de liaison.";
      nl = "Controleer de voorzetsels, lidwoorden en andere kleine woorden.";
    } else {
      fr = "Contrôle le sujet, la conjugaison, le vocabulaire et l'ordre des mots.";
      nl = "Controleer het onderwerp (je/tu/il/elle), de vervoeging, woordenschat en woordvolgorde.";
    }

    const mistakes = Math.max(1, Number(wrongCount || 1));
    if (mistakes >= 2) {
      const prefix = answers[closest].trim().split(/\s+/).slice(0, 2).join(" ");
      if (prefix && !prefix.includes("[")) {
        fr += " Début possible : <strong>" + html(prefix) + " …</strong>";
        nl += " Mogelijk begin: <strong>" + html(prefix) + " …</strong>";
      }
    }
    if (mistakes >= 3 && Number(roundNumber) === 1 && mode !== "test") {
      const example = answers[closest].replace(/\[nom\]/g, "Emma").replace(/\[âge\]/g, "12")
        .replace(/\[classe\]/g, "1AB").replace(/\[groupe\]/g, "A").replace(/\[lieu\]/g, "Turnhout");
      fr += " Exemple à étudier : <strong>" + html(example) + "</strong> Recommence avec tes propres informations.";
      nl += " Bekijk de voorbeeldzin: <strong>" + html(example) + "</strong> Oefen hem straks opnieuw met je eigen gegevens.";
    }
    return { fr: fr, nl: nl };
  }

  root.MonParcoursPhraseFeedback = Object.freeze({ hint: hint });
})(typeof window !== "undefined" ? window : globalThis);
