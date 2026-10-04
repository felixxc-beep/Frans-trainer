const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const verb = require("../verb-mastery.js");
const mastery = require("../mastery.js");
const assignments = require("../assignments.js");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const allItems = course.trajectories.flatMap(t => t.items);
const allVerbs = allItems.filter(i => i.type === "verb");
assert.equal(allItems.length, 1036);
assert.equal(allVerbs.length, 55);
assert.equal(allVerbs.filter(i => verb.classification(i.id)?.ruleId === "present_er").length, 22);
assert.equal(allVerbs.filter(i => verb.classification(i.id)?.kind === "irregular").length, 16);
assert.ok(allVerbs.every(i => verb.classification(i.id)), "alle bestaande verb-ID's zijn expliciet geclassificeerd");
assert.equal(verb.classification("uf1-item-000410").kind, "irregular", "aller mag niet door zijn -er-uitgang regular worden");
assert.deepEqual(["je", "j’", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"].map(verb.canonicalPerson),
  ["je", "je", "tu", "il", "il", "il", "nous", "vous", "ils", "ils"]);

const erIds = ["uf1-item-000102", "uf1-item-000103", "uf1-item-000104"];
const persons = ["je", "tu", "il", "nous", "vous", "ils"];
function attempt(id, person, session, correct = true, key = "verb-fr-conj", index = 0) {
  return { client_attempt_id: `${id}-${person}-${session}-${index}`, item_id: id, item_variant: person,
    client_session_id: session, exercise_key: key, mode: "practice", was_correct: correct,
    created_at: new Date(Date.UTC(2026, 9, 3, 10, 0, index)).toISOString() };
}
const narrow = Array.from({ length: 100 }, (_, index) => attempt(erIds[index % 3], index % 2 ? "je" : "tu", index % 2 ? "s2" : "s1", true, "verb-fr-conj", index));
const narrowGoal = verb.calculate("present_er", narrow);
assert.equal(narrowGoal.persons, 2);
assert.ok(narrowGoal.level < 80, "100% juist op alleen je/tu mag geen 80% regelmastery opleveren");
assert.equal(narrowGoal.status, "learning");
assert.equal(verb.meetsTarget(narrowGoal, 80), false);
const oneVerb = persons.concat(["je", "tu"]).map((person, index) => attempt(erIds[0], person, index < 4 ? "s1" : "s2", true, "verb-fr-conj", index));
assert.equal(verb.calculate("present_er", oneVerb).verbs, 1);
assert.equal(verb.calculate("present_er", oneVerb).status, "learning");
assert.equal(verb.meetsTarget(verb.calculate("present_er", oneVerb), 80), false);
const complete = persons.concat(["je", "tu"]).map((person, index) => attempt(erIds[index % 3], person, index < 4 ? "s1" : "s2", true, "verb-fr-conj", index));
const fullGoal = verb.calculate("present_er", complete);
assert.equal(fullGoal.status, "acquired");
assert.equal(fullGoal.level, 100);
assert.equal(fullGoal.persons, 6);
assert.equal(fullGoal.verbs, 3);
assert.equal(verb.calculate("present_er", complete.concat(attempt(erIds[0], "je", "s3", false, "verb-fr-conj", 99))).status, "learning", "laatste fout verbreekt Acquis");
const recognitionAfterError = complete.concat(
  attempt(erIds[0], "je", "s3", false, "verb-fr-conj", 99),
  attempt(erIds[0], "rule:present_er:je", "s3", true, "verb-rule-recognition", 100));
assert.equal(verb.calculate("present_er", recognitionAfterError).status, "learning", "een herkende uitgang herstelt niet de laatste foutieve vervoeging");
const weakConjugation = complete.concat(Array.from({ length: 9 }, (_, index) =>
  attempt(erIds[0], "je", "s3", false, "verb-fr-conj", 100 + index)));
const boostedByRecognition = weakConjugation.concat(Array.from({ length: 60 }, (_, index) =>
  attempt(erIds[0], "rule:present_er:je", "s4", true, "verb-rule-recognition", 200 + index)));
assert.equal(verb.calculate("present_er", boostedByRecognition).status, "learning", "regelherkenning mag zwakke vervoegingsaccuracy niet verbergen");
const learnOnly = complete.map(row => ({ ...row, mode: "learn" }));
assert.equal(verb.calculate("present_er", learnOnly).level, 0);
const recognitionOnly = persons.map((person, index) => attempt(erIds[0], "rule:present_er:" + person, "s1", true, "verb-rule-recognition", index));
assert.equal(verb.calculate("present_er", recognitionOnly).persons, 0, "herkenning vervangt geen toegepaste vervoeging");
assert.ok(verb.calculate("present_er", recognitionOnly).level > 0, "regelherkenning telt wel als beginnende evidence");
const etre = persons.concat(["je", "tu"]).map((person, index) => attempt("uf1-item-000124", person, index < 4 ? "s1" : "s2", true, "verb-fr-conj", index));
assert.equal(verb.calculate("uf1-item-000124", etre).status, "acquired");
assert.equal(verb.calculate("uf1-item-000125", etre).level, 0, "être versterkt avoir niet");
const ruleTask = { mastery_strategy: "verb_rule_mastery", item_ids: erIds, target_acquired_percentage: 80,
  requirements: [{ requirement_type: "verb_rule_mastery", reference_id: "present_er", target_percentage: 80 }] };
assert.equal(assignments.progress(ruleTask, new Map(), undefined, complete).reachedLocally, true);
assert.equal(assignments.progress(ruleTask, new Map(), undefined, narrow).reachedLocally, false);
const irregularTask = { mastery_strategy: "irregular_verb_mastery", item_ids: ["uf1-item-000124", "uf1-item-000125"], target_acquired_percentage: 80,
  requirements: ["uf1-item-000124", "uf1-item-000125"].map(id => ({ requirement_type: "irregular_verb_mastery", reference_id: id, target_percentage: 80 })) };
assert.equal(assignments.progress(irregularTask, new Map(), undefined, etre).reachedLocally, false);
const avoir = persons.concat(["je", "tu"]).map((person, index) => attempt("uf1-item-000125", person, index < 4 ? "s1" : "s2", true, "verb-fr-conj", index));
assert.equal(assignments.progress(irregularTask, new Map(), undefined, etre.concat(avoir)).reachedLocally, true);
const mixedTask = { ...irregularTask, mastery_strategy: "mixed_verb_mastery", requirements: ruleTask.requirements.concat(irregularTask.requirements) };
assert.equal(assignments.progress(mixedTask, new Map(), undefined, complete.concat(etre)).reachedLocally, false);
assert.equal(assignments.progress(mixedTask, new Map(), undefined, complete.concat(etre, avoir)).reachedLocally, true);
assert.equal(assignments.progress({ item_ids: [erIds[0]], target_acquired_percentage: 80 }, new Map()).strategy, undefined,
  "bestaande taken zonder strategie blijven item_mastery");

const appElement = { innerHTML: "", focus() {} };
const context = vm.createContext({ console, setTimeout, clearTimeout, Date, Intl,
  document: { visibilityState: "visible", addEventListener() {}, querySelector(selector) {
    if (selector === "#app") return appElement;
    if (selector === "#strict-accents") return { checked: true, disabled: false };
    return null;
  } },
  window: { MonParcoursMastery: mastery, MonParcoursVerbMastery: verb, MonParcoursAssignments: assignments,
    StudentIdentity: { getCurrentStudentIdentity() { return { provider: "school_email", subject: "student-1", verified: true }; }, getSyncCredential() { return "token"; } },
    MonParcoursSupabase: { isConfigured() { return false; } },
    MonParcoursSync: { createId() { return "00000000-0000-4000-8000-000000000001"; }, enqueueSession() {}, scheduleFlush() {} },
    addEventListener() {}, scrollTo() {}, performance: { now() { return 0; } } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  fetch: async () => ({ ok: true, json: async () => structuredClone(course) }) });
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);
setImmediate(function () {
  vm.runInContext("state.mastery.localAttempts=[{client_attempt_id:'legacy-orphan',item_id:'uf1-item-000102',item_variant:'je',exercise_key:'verb-fr-conj',mode:'practice',was_correct:true}]; state.verbEvidence.local=[];", context);
  assert.equal(vm.runInContext("currentVerbEvidence().length", context), 0, "oude lokale pogingen zonder leerlingidentiteit mogen niet overspringen");
  vm.runInContext("state.trajectoryIndex=0; state.selectedUnitOrder=3; renderUnit()", context);
  assert.match(appElement.innerHTML, /Réguliers/);
  assert.match(appElement.innerHTML, /Irréguliers/);
  assert.match(appElement.innerHTML, /data-goal-id="present_er"/);
  assert.match(appElement.innerHTML, /data-item-id="uf1-item-000124"/);
  assert.match(appElement.innerHTML, /data-item-id="uf1-item-000125"/);
  const recognition = vm.runInContext("buildQuestions(state.data.trajectories[0].items.filter(i=>i.category==='verbes en -ER'),'verb-rule-recognition')", context);
  assert.equal(recognition.length, 6);
  assert.ok(recognition.every(q => q.itemVariant.startsWith("rule:present_er:")));
  assert.equal(vm.runInContext("buildQuestions(state.data.trajectories[0].items.filter(i=>i.category==='verbes en -ER'),'verb-fr-conj').length", context), 198);
  assert.equal(vm.runInContext("taskQuestionsForItems([state.data.trajectories[0].items.find(i=>i.id==='uf1-item-000102')],'assignment-mixed')[0].exerciseKey", context),
    "verb-nl-inf", "oude item-mastery-taken met werkwoorden moeten het infinitief als leeritem oefenen");
  context.ruleTask = { ...ruleTask, id: "00000000-0000-4000-8000-000000000002", title: "Règle -ER", status: "published",
    item_ids: course.trajectories[0].items.filter(i => i.category === "verbes en -ER").map(i => i.id) };
  vm.runInContext("state.assignments.items=[ruleTask]; launchAssignment(ruleTask.id)", context);
  assert.equal(vm.runInContext("state.session.mode", context), "practice", "regel-taak start direct zelfstandig");
  const questions = vm.runInContext("state.session.questions", context);
  assert.equal(questions.length, 20);
  assert.equal(questions.filter(q => q.exerciseKey === "verb-rule-recognition").length, 4);
  assert.equal(questions.filter(q => q.exerciseKey !== "verb-rule-recognition").length, 16);
  assert.ok(questions.every(q => !q.prompt.includes("il/elle/on") && !q.prompt.includes("ils/elles")));
  assert.ok(new Set(questions.map(q => verb.canonicalPerson(q.itemVariant.startsWith("rule:") ? q.itemVariant.split(":")[2] : q.itemVariant))).size >= 6);
  const sql = fs.readFileSync("supabase/phase7b-verb-mastery.sql", "utf8");
  assert.match(sql, /create table public\.assignment_requirements/);
  assert.match(sql, /create function private\.verb_goal_progress/);
  assert.match(sql, /create function public\.get_student_verb_evidence/);
  assert.match(sql, /alter table public\.assignment_requirements force row level security/);
  assert.match(sql, /conjugation_accuracy/);
  assert.match(sql, /'ordering',ar\.ordering/);
  assert.doesNotMatch(sql, /submitted_answer|service_role\s+to/i);
  console.log("FASE 7B WERKWOORDMASTERYREGRESSIE GESLAAGD");
});
