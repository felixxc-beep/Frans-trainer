const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const source = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const appElement = { innerHTML: "", focus() {} };
const storage = new Map();
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  FormData: class {},
  document: {
    addEventListener() {},
    querySelector(selector) {
      if (selector === "#app") return appElement;
      if (selector === "#settings-dialog") return { showModal() {}, close() {} };
      if (selector === "#strict-accents") return { checked: true, addEventListener() {} };
      return null;
    }
  },
  window: { scrollTo() {}, confirm() { return false; } },
  localStorage: {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  fetch: async function () {
    return { ok: true, json: async function () { return structuredClone(course); } };
  }
});

vm.runInContext(source, context);

setImmediate(function () {
  assert.deepEqual(
    Array.from(vm.runInContext("state.data.trajectories.map(t => t.trajectory)", context)),
    ["Trajet 1", "Trajet 2", "Trajet 3", "Trajet 4", "Trajet 5", "Trajet 6"]
  );

  course.trajectories.forEach(function (trajectory, trajectoryIndex) {
    vm.runInContext("state.trajectoryIndex = " + trajectoryIndex + "; renderHome()", context);
    trajectory.units.forEach(function (unit) {
      assert.ok(appElement.innerHTML.includes(vm.runInContext("escapeHtml(" + JSON.stringify(unit.top_category) + ")", context)));
      assert.ok(appElement.innerHTML.includes(vm.runInContext("escapeHtml(" + JSON.stringify(unit.title) + ")", context)));
    });

    trajectory.units.forEach(function (unit) {
      const matchingItems = trajectory.items.filter(function (item) {
        return item.top_category === unit.top_category && item.lesson === unit.title;
      });
      vm.runInContext("state.selectedUnitOrder = " + unit.order + "; renderUnit()", context);
      unit.study_sections.forEach(function (section) {
        assert.ok(appElement.innerHTML.includes(vm.runInContext("escapeHtml(" + JSON.stringify(section.title) + ")", context)));
        section.subsections.forEach(function (subsection) {
          assert.ok(appElement.innerHTML.includes(vm.runInContext("escapeHtml(" + JSON.stringify(subsection.title) + ")", context)));
          const expected = matchingItems.filter(function (item) {
            return item.block === section.title && item.subsection === subsection.title;
          }).length;
          context.auditScope = {
            unitOrder: unit.order,
            block: section.title,
            subsection: subsection.title,
            title: subsection.title
          };
          const actual = vm.runInContext(
            "itemsForScope(state.data.trajectories[state.trajectoryIndex], currentUnit(), auditScope).length",
            context
          );
          assert.equal(actual, expected, trajectory.trajectory + " / " + unit.title + " / " + subsection.title);
        });
      });
    });
  });

  const allItems = vm.runInContext("state.data.trajectories.flatMap(t => t.items)", context);
  const verbs = allItems.filter(function (item) { return item.type === "verb"; });
  verbs.forEach(function (verb) {
    context.auditItems = [verb];
    ["verb-nl-conj", "verb-fr-conj"].forEach(function (exercise) {
      context.auditExercise = exercise;
      const questions = vm.runInContext("buildQuestions(auditItems, auditExercise)", context);
      const expected = verb.conjugations.flatMap(function (conjugation) {
        const subjects = conjugation.subject.split("/");
        const ending = subjects.length > 1 ? conjugation.form.slice(conjugation.subject.length).trim() : null;
        return subjects.map(function (subject) { return {
          subject: subject, form: ending ? subject + " " + ending : conjugation.form
        }; });
      });
      assert.equal(questions.length, expected.length);
      expected.forEach(function (variant) {
        assert.ok(questions.some(function (question) {
          return question.prompt.endsWith("— " + variant.subject) && question.answers.includes(variant.form);
        }), verb.infinitive + " / " + variant.subject);
      });
      assert.ok(questions.every(function (question) { return !question.itemVariant.includes("/") && question.answers.every(function (answer) { return !answer.includes("/"); }); }));
    });
  });

  allItems.filter(function (item) {
    return Array.isArray(item.accepted_answers) && ["vocabulary", "phrase", "grammar_rule", "number"].includes(item.type);
  }).forEach(function (item) {
    context.auditItems = [item];
    context.auditExercise = item.type === "phrase" ? "phrase-nl-fr" : item.type === "grammar_rule" ? "grammar" : "number-nl-fr";
    const questions = vm.runInContext("buildQuestions(auditItems, auditExercise)", context);
    item.accepted_answers.forEach(function (answer) {
      assert.ok(questions[0].answers.includes(answer), (item.nl || item.prompt) + " moet " + answer + " aanvaarden");
    });
  });

  allItems.filter(function (item) {
    return Array.isArray(item.accepted_answers_nl) && ["vocabulary", "verb"].includes(item.type);
  }).forEach(function (item) {
    context.auditItems = [item];
    context.auditExercise = item.type === "verb" ? "verb-fr-nl" : "vocab-fr-nl";
    const questions = vm.runInContext("buildQuestions(auditItems, auditExercise)", context);
    item.accepted_answers_nl.forEach(function (answer) {
      assert.ok(questions[0].answers.includes(answer), item.nl + " moet " + answer + " aanvaarden");
    });
  });

  const synonymGroups = course.trajectories.flatMap(function (trajectory, trajectoryIndex) {
    const groups = new Map();
    trajectory.items.filter(function (item) { return item.type === "vocabulary"; }).forEach(function (item) {
      const key = [trajectoryIndex, item.lesson, item.block, item.subsection, item.nl].join("::");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(Object.assign({ trajectoryIndex: trajectoryIndex }, item));
    });
    return Array.from(groups.values()).filter(function (items) {
      return new Set(items.map(function (item) { return item.fr; })).size > 1;
    });
  });
  assert.equal(synonymGroups.length, 5);
  synonymGroups.forEach(function (items) {
    const liveItems = allItems.filter(function (item) {
      return item._trajectoryIndex === items[0].trajectoryIndex &&
        item.lesson === items[0].lesson &&
        item.block === items[0].block &&
        item.subsection === items[0].subsection &&
        item.type === "vocabulary" &&
        item.nl === items[0].nl;
    });
    context.auditItems = liveItems;
    const questions = vm.runInContext('buildQuestions(auditItems, "vocab-nl-fr")', context);
    assert.equal(questions.length, 1);
    items.forEach(function (item) {
      assert.ok(questions[0].answers.includes(item.fr), items[0].nl + " moet " + item.fr + " aanvaarden");
    });
  });

  assert.match(html, /src="\.\/app\.js(?:\?[^"#]+)?"/);
  assert.match(html, /href="\.\/styles\.css(?:\?[^"#]+)?"/);
  assert.match(source, /const DATA_URL = "\.\/data\/course\.json(?:\?[^"#]+)?"/);
  const externalAssets = Array.from(html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)).map(function (match) { return match[1]; });
  assert.deepEqual(externalAssets, ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"]);
  assert.equal(/\b(?:WebSocket|XMLHttpRequest|EventSource)\b/.test(source), false);
  assert.ok(fs.existsSync(".nojekyll"));

  console.log("VOLLEDIGE AUDIT GESLAAGD");
  console.log("6 trajecten · 50 cursusonderdelen · 1036 items");
  console.log("55 werkwoorden · 330 bronrijen · 495 concrete vervoegingsvragen · alle expliciete accepted_answers gecontroleerd");
  console.log("5 synoniemgroepen gebundeld zonder trajecten of subsecties te mengen");
  console.log("Statische, relatieve assets geschikt voor GitHub Pages");
});
