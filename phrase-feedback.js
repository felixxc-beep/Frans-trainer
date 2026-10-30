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

  const PLACEHOLDER_INFO = Object.freeze({
    nom: { nl: "naam", fr: "un vrai nom", example: "Emma" },
    "âge": { nl: "leeftijd", fr: "un âge concret", example: "12" },
    classe: { nl: "klas", fr: "une classe concrète", example: "1A" },
    groupe: { nl: "groep", fr: "un groupe concret", example: "A" },
    lieu: { nl: "plaats", fr: "un lieu concret", example: "Turnhout" }
  });

  function placeholderInfo(token) {
    const key = normal(token).replace(/^\[|\]$/g, "");
    return Object.assign({ key: key, nl: "informatie", fr: "une information concrète", example: "..." },
      PLACEHOLDER_INFO[key] || {});
  }

  function readableFrench(token) {
    return String(token || "").replace(/'/g, "’");
  }

  // Detect the precise case where the learner wrote the complete sentence frame,
  // but left out the required concrete value represented by one [placeholder].
  function missingPlaceholder(question, rawAnswer) {
    const actual = normal(rawAnswer);
    let issue = null;
    (question.answers || []).some(function (variant) {
      if (typeof variant !== "string") return false;
      const tokens = normal(variant).match(/\S+/gu) || [];
      const slotIndexes = [];
      tokens.forEach(function (token, index) {
        if (/^\[[^\]]+\]$/.test(token)) slotIndexes.push(index);
      });
      if (slotIndexes.length !== 1) return false;
      const slotIndex = slotIndexes[0];
      const fixed = tokens.filter(function (_, index) { return index !== slotIndex; });
      if (actual !== fixed.join(" ")) return false;
      const before = tokens.slice(0, slotIndex);
      const after = tokens.slice(slotIndex + 1);
      const info = placeholderInfo(tokens[slotIndex]);
      let nl;
      if (info.key === "nom" && !after.length && /m'appelle$/.test(before.join(" "))) {
        nl = "Er ontbreekt een echte naam aan het einde: schrijf bijvoorbeeld je eigen voornaam achter je m’appelle.";
      } else if (!after.length) {
        nl = "Er ontbreekt een echte " + info.nl + " aan het einde. Schrijf bijvoorbeeld " +
          info.example + " achter " + readableFrench(before[before.length - 1]) + ".";
      } else if (!before.length) {
        nl = "Er ontbreekt een echte " + info.nl + " aan het begin. Schrijf bijvoorbeeld " +
          info.example + " voor " + readableFrench(after[0]) + ".";
      } else {
        nl = "Er ontbreekt een echte " + info.nl + " tussen " +
          readableFrench(before[before.length - 1]) + " en " + readableFrench(after[0]) +
          ". Vul daar bijvoorbeeld " + info.example + " in.";
      }
      const fr = "Il manque " + info.fr + (after.length ?
        " à l’endroit indiqué. Ajoute par exemple « " + info.example + " »." :
        " à la fin. Ajoute par exemple « " + info.example + " ».");
      issue = {
        index: before.length,
        label: info.nl,
        nl: nl,
        fr: fr
      };
      return true;
    });
    return issue;
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
    const missingSlot = missingPlaceholder(question, rawAnswer);
    let fr, nl;
    if (missingSlot) {
      fr = missingSlot.fr;
      nl = missingSlot.nl;
    } else if (/\[[^\]]+\]/.test(value) || /(?:m'appelle|nom de famille est|prénom c'est)\s+(?:nom|naam)$/.test(value)) {
      const literalSlot = value.match(/\[[^\]]+\]/);
      const literalInfo = placeholderInfo(literalSlot ? literalSlot[0] : "[nom]");
      fr = "Remplace le texte entre crochets par " + literalInfo.fr + ", par exemple « " + literalInfo.example + " ».";
      nl = "Vervang de tekst tussen haakjes door een echte " + literalInfo.nl +
        ", bijvoorbeeld " + literalInfo.example + ". Neem de haakjes niet over.";
    } else if (/\[(?:klas|groep)\]/i.test(prompt) && /(?:en classe|dans le groupe|en groupe|dans la classe)$/.test(value)) {
      fr = "Il manque la classe ou le groupe concret. Ta phrase doit être complète.";
      nl = "Je mist nog een echte klas of groep. Schrijf de volledige zin.";
    } else if (/^(?:hij\/zij|hoe heet hij\/zij|hoe oud is hij\/zij|waar woont hij\/zij|in welke klas zit hij\/zij)/.test(prompt)
        && /^(?:je|j'|tu)\b/.test(value)) {
      fr = "Le sujet doit être « il » ou « elle », pas « je » ou « tu ».";
      nl = "Let op wie je bedoelt: het gaat over hij/zij, niet over ik of jij.";
    } else if (/\b(?:il|elle)\/(?:il|elle)\b/.test(value)) {
      fr = "Choisis un seul pronom dans ta phrase : « il » ou « elle », sans barre oblique.";
      nl = "Kies één voornaamwoord: il of elle. Schrijf geen il/elle met een schuine streep in je antwoord.";
    } else if (/\b(?:t'appelle|m'appelle)\b/.test(value) &&
        /\b(?:s'appelle|son nom)\b/.test(expected)) {
      fr = "Avec « s'appeler », le pronom réfléchi change selon le sujet : me, te ou se.";
      nl = "Bij s'appeler verandert het wederkerend voornaamwoord met het onderwerp: me, te of se.";
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
    if (mistakes >= 2 && !missingSlot) {
      const prefix = answers[closest].trim().split(/\s+/).slice(0, 2).join(" ");
      if (prefix && !prefix.includes("[")) {
        fr += " Début possible : <strong>" + html(prefix) + " …</strong>";
        nl += " Mogelijk begin: <strong>" + html(prefix) + " …</strong>";
      }
    }
    if (mistakes >= 3 && !missingSlot && Number(roundNumber) === 1 && mode !== "test") {
      const example = answers[closest].replace(/\[nom\]/g, "Emma").replace(/\[âge\]/g, "12")
        .replace(/\[classe\]/g, "1AB").replace(/\[groupe\]/g, "A").replace(/\[lieu\]/g, "Turnhout");
      fr += " Exemple à étudier : <strong>" + html(example) + "</strong> Recommence avec tes propres informations.";
      nl += " Bekijk de voorbeeldzin: <strong>" + html(example) + "</strong> Oefen hem straks opnieuw met je eigen gegevens.";
    }
    return { fr: fr, nl: nl };
  }


  // Native text inputs cannot mark individual words. Display an annotated,
  // HTML-escaped copy of the student's exact answer directly below the input.
  // When errors cannot be located confidently, leave the answer unmarked.
  function annotatedAnswer(question, rawAnswer) {
    if (!question || !question.item || question.item.type !== "phrase" ||
        typeof rawAnswer !== "string" || !rawAnswer.trim()) return "";
    const entered = rawAnswer.trim().match(/\S+/gu) || [];
    const variants = (question.answers || []).filter(function (answer) {
      return typeof answer === "string" && answer.trim();
    });
    const cleaned = function (token) {
      return normal(token).replace(/^[.!?,;:]+|[.!?,;:]+$/g, "");
    };
    const slotIssue = missingPlaceholder(question, rawAnswer);
    if (slotIssue) {
      const annotated = entered.map(html);
      annotated.splice(slotIssue.index, 0,
        '<span class="phrase-missing phrase-missing-slot" aria-label="' +
        html(slotIssue.label + ' ontbreekt hier') + '">[' + html(slotIssue.label) + ' ontbreekt]</span>');
      return '<div class="phrase-answer-review"><strong>Jouw antwoord:</strong>' +
        '<p class="phrase-answer-words" dir="ltr" lang="fr">' + annotated.join(" ") + '</p>' +
        '<p class="phrase-slot-instruction"><strong>Wat moet je doen?</strong> ' +
        html(slotIssue.nl) + '</p></div>';
    }
    const actual = entered.map(cleaned);
    function same(actualWord, expectedWord) {
      // A concrete value for a model [slot] is not a misspelled word.
      if (/^\[[^\]]+\]$/.test(expectedWord))
        return Boolean(actualWord && !/^\[[^\]]+\]$/.test(actualWord));
      return actualWord === expectedWord;
    }
    function compare(target) {
      const expected = (target.match(/\S+/gu) || []).map(cleaned);
      const m = actual.length, n = expected.length;
      if (!m || !n || m > 55 || n > 55) return null;
      const dp = Array.from({ length: m + 1 }, function () { return new Array(n + 1).fill(0); });
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + (same(actual[i - 1], expected[j - 1]) ? 0 : 1),
          dp[i - 1][j] + 1, dp[i][j - 1] + 1
        );
      }
      const wrong = new Set(), missing = [];
      let matched = 0, i = m, j = n;
      while (i || j) {
        const exact = i && j && same(actual[i - 1], expected[j - 1]) &&
          dp[i][j] === dp[i - 1][j - 1];
        if (exact) {
          matched++; i--; j--;
        } else if (j && dp[i][j] === dp[i][j - 1] + 1) {
          // Prefer a real missing position over a substitution when both paths tie.
          missing.push(i); j--;
        } else if (i && j && dp[i][j] === dp[i - 1][j - 1] + 1) {
          wrong.add(i - 1); i--; j--;
        } else if (i) {
          wrong.add(i - 1); i--;
        } else break;
      }
      return { errors: dp[m][n], matched, wrong, missing };
    }
    let best = null;
    variants.forEach(function (variant) {
      const comparison = compare(variant);
      if (comparison && (!best || comparison.errors < best.errors ||
          comparison.errors === best.errors && comparison.matched > best.matched)) best = comparison;
    });
    const reliable = best && best.errors > 0 && best.errors <= 2 &&
      best.matched >= 2 && best.matched >= Math.ceil(entered.length * .5);
    const wrong = reliable ? best.wrong : new Set();
    const missing = reliable ? new Set(best.missing) : new Set();
    const sentence = entered.map(function (token, index) {
      const absent = missing.has(index) ?
        '<span class="phrase-missing" aria-label="Hier ontbreekt mogelijk iets">…</span> ' : "";
      return absent + (wrong.has(index) ?
        '<mark class="phrase-word-check">' + html(token) + '</mark>' : html(token));
    }).join(" ") + (missing.has(entered.length) ?
      ' <span class="phrase-missing" aria-label="Hier ontbreekt mogelijk iets">…</span>' : "");
    return '<div class="phrase-answer-review"><strong>Jouw antwoord:</strong>' +
      '<p class="phrase-answer-words" dir="ltr" lang="fr">' + sentence + '</p>' +
      (reliable ? '<small>Onderstreept = nakijken · … = er ontbreekt mogelijk iets.</small>' : '') +
      '</div>';
  }

  root.MonParcoursPhraseFeedback = Object.freeze({ hint: hint, annotatedAnswer: annotatedAnswer });
})(typeof window !== "undefined" ? window : globalThis);
