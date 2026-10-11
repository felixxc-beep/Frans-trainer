const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("../exercise-variants.js");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const originalCourse = JSON.stringify(course);
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json", "utf8"));
const studentCss = fs.readFileSync("styles.css", "utf8");
const studentApp = fs.readFileSync("app.js", "utf8");
const ids = new Set(course.trajectories.flatMap((trajectory) => trajectory.items.map((item) => item.id)));

assert.deepEqual(engine.validateBank(bank, course), { variants: 1712, permanentItems: 1036 });
assert.equal(new Set(bank.variants.map((variant) => variant.id)).size, bank.variants.length);
assert.ok(!bank.variants.some((variant) => variant.id === "T6-VOC-CTX-046" || variant.id === "T3-REV-033"));
for (const variant of bank.variants) {
  const question = engine.compileVariant(variant, course);
  assert.ok(question.stableItemIds.every((id) => ids.has(id)), variant.id + " target exists");
  assert.ok(Number.isInteger(variant.source_line) && variant.source_line > 0, variant.id + " has source provenance");
  const answer = variant.scoring === "multi_gap" ? variant.gaps.map((gap) => gap.accepted_answers[0]) : variant.accepted_answers[0];
  assert.equal(engine.grade(question, answer).correct, true, variant.id + " model answer accepted");
  if (variant.scoring === "multi_gap" && variant.evidence_policy !== "practice_only")
    assert.equal(engine.grade(question, answer).evidence.length, variant.gaps.length, variant.id + " per-gap evidence");
  if (variant.scoring === "integrative")
    assert.equal(engine.grade(question, "onjuist").evidence.length, 0, variant.id + " no blanket negative evidence");
}
assert.equal(JSON.stringify(course), originalCourse, "curated compilation never changes course items");
const byId = (id) => bank.variants.find((variant) => variant.id === id);
for (const [id, answer] of [
  ["T1-VERB-CTX-061", "traînes"], ["T1-VERB-CTX-062", "traîne"],
  ["T1-VERB-CTX-063", "traînent"], ["T1-VOC-CTX-071", "traîner"]
]) assert.equal(engine.grade(engine.compileVariant(byId(id), course), answer).correct, true,
  id + " accepts the traditional spelling explicitly authorized by the master spec");
assert.deepEqual(byId("T4-ACT-MOVE-018").accepted_answers, ["Chouette !", "Super !", "Top !", "Génial !"]);
assert.equal(engine.grade(engine.compileVariant(byId("T6-HOM-A-007"), course), ["a", "à"]).correct, true);
assert.deepEqual(byId("T6-HOM-A-007").gaps.map((gap) => gap.targets[0]), ["uf1-item-001030", "uf1-item-001031"]);
assert.equal(byId("T5-POSS-MIX-004").accepted_answers[0], "Tes");
assert.equal(byId("T6-Q-ECQW-008").accepted_answers[0], "Qui est-ce que tu vois ?");
assert.equal(byId("T4-PR-020").accepted_answers[0], "viennent de finir");
assert.equal(byId("T1-VERB-SUBJ-001").evidence_policy, "practice_only");
assert.ok(!/Doelantwoord|Overige antwoorden|Technische notitie/i.test(byId("T2-REV-030").prompt),
  "source notes and the age model answer are not shown inside the mini-dialogue");
assert.equal(byId("T2-REV-030").context, "Leeftijd: 12 jaar", "the open age gap has a neutral numerical cue");
assert.equal(byId("T2-REV-030").gaps[1].targets[0], "uf1-item-000267", "age maps to the twelve number item");
assert.deepEqual(byId("T2-REV-030").gaps.slice(2).map((gap) => gap.targets[0]),
  ["uf1-item-000276", "uf1-item-000276", "uf1-item-000278", "uf1-item-000278"],
  "pas and jamais evidence is not mixed");
assert.equal(byId("T2-REV-020").gaps[1].targets[0], "uf1-item-000279", "de after negation uses the article rule");
assert.equal(byId("T2-REV-029").gaps[2].targets[0], "uf1-item-000277", "ne ... plus is not ne ... pas");
assert.deepEqual(byId("T3-REV-026").targets, ["uf1-item-000469"], "46 does not map to zero");
assert.deepEqual(byId("T3-REV-027").targets, ["uf1-item-000496"], "73 maps to its permanent number");
assert.equal(byId("T3-REV-031").gaps[1].targets[0], "uf1-item-000354", "on y va uses its phrase target");
assert.equal(byId("T4-REV-034").gaps[1].targets[0], "uf1-item-000693", "future proche is not a prior Trajet phrase");
assert.deepEqual(byId("T5-REV-009").targets, ["uf1-item-000848", "uf1-item-000857"],
  "ont pris supports passé composé and its irregular participle");
assert.deepEqual(byId("T6-REV-012").targets, ["uf1-item-001006", "uf1-item-001009"],
  "Tu manges quoi? is not an est-ce que question");
assert.equal(byId("T6-REV-034").gaps[0].targets[0], "uf1-item-000990", "mixed-group agreement has its own goal");
for (const [id, alternative] of [
  ["T3-REV-029", "soixante-dix"], ["T4-REV-026", "soixante-dix-neuf"],
  ["T6-REV-027", "soixante-dix-huit-mille-huit-cent-quatorze"],
  ["T6-REV-029", "dix-neuf-cent-quatre-vingt-dix-neuf"]
]) assert.equal(engine.grade(engine.compileVariant(byId(id), course), alternative).correct, true,
  id + " accepts the documented regional number form");
assert.ok(bank.variants.some((variant) => variant.prompt.includes("\n")), "mini-dialogue prompts are present");
assert.match(studentApp, /question\.prompt\.includes\("\\n"\) \? ' is-dialogue'/,
  "mini-dialogues use the compact dialogue presentation");
assert.match(studentCss, /\.question-prompt\.is-dialogue[^}]*white-space:\s*pre-line/,
  "mini-dialogue line breaks remain visible");

const app = { innerHTML: "", focus() {} };
const storage = new Map();
const context = vm.createContext({
  console, setTimeout, clearTimeout,
  document: { visibilityState: "visible", addEventListener() {}, querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector === "#app") return app;
      if (selector === "#settings-dialog" || selector === "#identity-dialog") return { showModal() {}, close() {} };
      if (selector === "#identityButton") return { addEventListener() {} };
      if (selector === "#strict-accents") return { checked: true, disabled: false };
      return null;
    } },
  window: { MonParcoursExerciseVariants: engine,
    MonParcoursMastery: require("../mastery.js"),
    MonParcoursVerbMastery: require("../verb-mastery.js"),
    StudentIdentity: { getCurrentStudentIdentity() { return {
      provider: "school_email", subject: "11111111-1111-4111-8111-111111111111", verified: true, displayName: "Test"
    }; } },
    addEventListener() {}, scrollTo() {} },
  localStorage: { getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
  fetch: async (url) => ({ ok: true, json: async () => structuredClone(url.includes("exercise-variants") ? bank : course) })
});
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

setImmediate(() => {
  const covered = new Set();
  for (let t = 0; t < 6; t += 1) {
    context.trajectoryIndex = t;
    vm.runInContext("state.trajectoryIndex = trajectoryIndex", context);
    const trajectory = course.trajectories[t];
    for (const unit of trajectory.units) {
      context.unitOrder = unit.order;
      vm.runInContext("state.selectedUnitOrder = unitOrder; state.selectedScope = { title: currentUnit().title }", context);
      const active = vm.runInContext("curatedVariantsForUnit(currentTrajectory(), currentUnit())", context);
      active.forEach((variant) => covered.add(variant.id));
      if (active.length) {
        const keys = vm.runInContext("curatedKeysForScope()", context);
        assert.ok(keys.length, trajectory.trajectory + " / " + unit.title + " offers a curated choice");
        vm.runInContext("renderSetup()", context);
        assert.match(app.innerHTML, /name="exercise"/, trajectory.trajectory + " / " + unit.title + " has a setup form");
        assert.ok(keys.every((key) => app.innerHTML.includes('value="' + key + '"')),
          trajectory.trajectory + " / " + unit.title + " lists every curated exercise kind");
        for (const key of keys) {
          context.exerciseKey = key;
          assert.equal(vm.runInContext("availableQuestionCount(exerciseKey)", context),
            vm.runInContext("questionsForSetup(exerciseKey, 10).length", context));
        }
      }
      if (unit.top_category === "Comment dire ?") assert.equal(active.length, 0, "audio-only sound rules stay inactive");
    }
  }
  assert.equal(covered.size, bank.variants.length, "every curated variant is reachable from its Trajet unit");
  vm.runInContext("state.trajectoryIndex=5; state.selectedUnitOrder=6; state.selectedScope={title:'A, à / ou, où / la, là'}; renderUnit()", context);
  assert.match(app.innerHTML, /data-action="choose-scope"/, "T6 homophones have a start action");
  assert.match(app.innerHTML, /data-subsection="A, à \/ ou, où \/ la, là"/, "written homophones can start from their own subsection");
  assert.doesNotMatch(app.innerHTML, /Alleen cursusinfo/, "active written homophones are not mislabeled as course information");
  assert.match(app.innerHTML, /Orthographe/, "T6 written homophones are presented as spelling, not pronunciation");
  assert.ok(vm.runInContext("curatedVariantsForScope('curated-spelling').length", context) >= 21);
  vm.runInContext("renderSetup()", context);
  assert.match(app.innerHTML, /value="curated-spelling"/, "T6 written homophones are selectable as spelling");
  for (let t = 0; t < 6; t += 1) {
    context.trajectoryIndex = t;
    vm.runInContext("state.trajectoryIndex=trajectoryIndex", context);
    const revision = course.trajectories[t].units.find((unit) => /^Action/i.test(unit.top_category));
    context.unitOrder = revision.order;
    vm.runInContext("state.selectedUnitOrder=unitOrder; state.selectedScope={title:currentUnit().title}; renderUnit()", context);
    assert.match(app.innerHTML, /data-action="choose-scope"/, "Révision has a start action in Trajet " + (t + 1));
    assert.match(app.innerHTML, /scope-all-button tone-revision/, "Révision has a consistent neutral accent");
    assert.ok(vm.runInContext("curatedVariantsForScope('curated-revision').length", context) >= 30);
    vm.runInContext("renderSetup()", context);
    assert.match(app.innerHTML, /value="curated-revision"/, "Révision enters the standard 10/20/30/all setup");
    assert.doesNotMatch(app.innerHTML, /setup-total">0 \+/, "Révision total never starts with zero legacy items");
    assert.match(app.innerHTML, /radio-card tone-revision/, "Révision choice is visually distinct without hiding its label");
    assert.match(app.innerHTML, /Révision du trajet/);
    assert.match(app.innerHTML, /Alles door elkaar/);
    assert.match(app.innerHTML, /data-mode="learn"/);
    assert.match(app.innerHTML, /data-mode="practice"/);
    assert.match(app.innerHTML, /data-mode="test"/);
    const revisions = vm.runInContext("questionsForSetup('curated-revision', 10)", context);
    for (const size of [10, 20, 30, revisions.length]) {
      context.requestedSize = size;
      const selected = vm.runInContext("selectQuestions(questionsForSetup('curated-revision', requestedSize), requestedSize)", context);
      assert.equal(selected.length, size, "Révision session size in Trajet " + (t + 1));
      assert.equal(new Set(selected.map((question) => question.variantId)).size, size,
        "Révision starts without duplicate variants in Trajet " + (t + 1));
    }
  }
  vm.runInContext("state.trajectoryIndex=0; state.selectedUnitOrder=1; state.selectedScope={title:currentUnit().title}; renderSetup()", context);
  assert.match(app.innerHTML, /<details class="more-exercises">/, "legacy reverse directions remain accessible but secondary");
  assert.match(app.innerHTML, /value="vocab-fr-nl"/, "existing reverse-direction exercises are preserved");
  assert.match(app.innerHTML, /value="curated-context"/, "context remains a main exercise choice");
  const mainChoicesHtml = app.innerHTML.split('<details class="more-exercises">')[0];
  assert.match(mainChoicesHtml, /value="vocab-nl-fr"/, "translate remains a main vocabulary choice");
  assert.match(mainChoicesHtml, /value="curated-context"/, "context remains a main vocabulary choice");
  assert.doesNotMatch(mainChoicesHtml, /value="vocab-fr-nl"/, "reverse direction is not a third main vocabulary choice");
  assert.match(studentCss, /\.question-card\.tone-revision[^}]*border-top/);
  for (const mode of ["learn", "practice", "test"]) {
    context.summaryMode = mode;
    vm.runInContext("state.session = { mode: summaryMode, exerciseKey: 'curated-revision', title: 'Révision'," +
      "question_count: 1, available_count: 30, attempt_count: 2, active_duration_seconds: 42," +
      "identity_verified: true, answered_variant_ids: ['T1-REV-001'], sync_attempts: []," +
      "questions: [], index: 1, results: [{correct: true, question: {}, answer: ''}] }; renderSummary()", context);
    assert.match(app.innerHTML, /42 s/, "active time remains visible in " + mode);
    assert.equal(app.innerHTML.includes('class="score-ring"'), mode === "test",
      "only Se tester receives a percentage score; guided and practice attempts are not reported as 100% correct");
  }
  console.log("MASTER CONTENT FASEBLOK 2 GESLAAGD: 1.712 varianten, 6 Trajets, mappings, antwoorden, per-gat-evidence en navigatie.");
});
