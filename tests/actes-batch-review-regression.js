const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("app.js", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));

function part(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Codefragment ontbreekt: " + start);
  return source.slice(a, b);
}

const evaluate = new Function(
  part(app, "function normalizeAnswer(", "\nfunction recordAttempt(") +
  part(app, "function normalizedPhrasePunctuation(", "\nfunction splitAnswerArticle(") +
  part(app, "function answerList(", "\nfunction dutchAnswers(") +
  "\nfunction unique(a) { return Array.from(new Set(a)); }\nreturn { isCorrect, answerList };"
)();

const items = course.trajectories[0].items;
const cases = [
  ["523", "Quel est votre nom de famille ?", true],
  ["525", "Quel âge as-tu ?", true],
  ["525", "Tu as quelle âge ?", false],
  ["526", "J'ai 12 ans.", true],
  ["526", "J'ai [âge] ans.", false],
  ["528", "Je vis à Dinant, en Belgique", true],
  ["531", "J'aime beaucoup jouer au padel", true],
  ["531", "J'aime jouer padel", false],
  ["532", "Je joue aux jeux vidéo", true],
  ["533", "Aimez-vous le sport ?", true],
  ["533", "vous aimez le sport?", true],
  ["534", "Oui,j'adore la danse classique", true],
  ["534", "Oui j'adore la danse classique", true],
  ["534", "Oui j'adore le danse classique", false],
  ["535", "Non, je déteste jouer au football", true],
  ["535", "Non, je déteste le football", true],
  ["537", "En quelle classe es-tu ?", true],
  ["537", "tu es dans quel classe", false],
  ["539", "Tu es dans quelle group?", false],
  ["541", "Êtes-vous nouveau ?", true],
  ["541", "Tu es nouevou", false],
  ["542", "Oui, c'est ma première leçon", true],
  ["552", "Quels sont ses passe-temps ?", true],
  ["557", "Il aime envoyer des messages à ses ami(e)s", true],
  ["559", "Elle est amusante", true],
  ["563", "Elle est sérieux", false]
];
for (const [suffix, answer, expected] of cases) {
  const item = items.find(function (value) { return value.id === "uf1-item-" + suffix.padStart(6, "0"); });
  assert.ok(item, suffix);
  const graded = evaluate.isCorrect(answer, evaluate.answerList(item.fr, item), true);
  assert.equal(graded, expected, suffix + " " + answer);
}
assert.match(app, /const DATA_URL = ".+20261030-t2-1"/);
assert.match(html, /teacher\.js\?v=20261030-t2-1/);
assert.match(teacher, /data-action="queue-item-report"/);
assert.match(teacher, /data-action="commit-report-selections"/);
assert.doesNotMatch(teacher, /data-action="resolve-item-report"/);

const view = { innerHTML: "", querySelector() { return null; } };
const dom = {
  querySelector(selector) {
    return selector === "#dashboardContent" ? view : selector === "#filterBar" ? { hidden: false } : null;
  },
  querySelectorAll() { return []; }
};
let confirmations = 0;
const windowObject = {
  MON_PARCOURS_TEACHER_TEST: true,
  scrollY: 465,
  scrollTo() { throw Error("Report selection unexpectedly scrolled."); },
  confirm() { confirmations += 1; return true; }
};
vm.runInNewContext(teacher, { window: windowObject, document: dom, console, Date, Intl });
const state = windowObject.MonParcoursTeacherTestState;
const api = windowObject.MonParcoursTeacherTaskTest;
state.user = { id: "owner" };
state.teacherProfile = { role: "teacher", is_active: true };
state.route.view = "tasks"; // Isolates the RPC behavior from the detail-page renderer.
state.tasks.selectedId = "task1";
state.tasks.list = [{ id: "task1", created_by_teacher_id: "owner", completion_strategy: "rounds" }];
state.tasks.reports = [
  { id: "one", status: "pending" },
  { id: "two", status: "pending" },
  { id: "three", status: "pending" }
];
let rpcWrites = 0;
state.client = { async rpc(name, args) {
  if (name === "resolve_assignment_item_report") {
    rpcWrites += 1;
    return args.p_report_id === "two" ? { error: { message: "temporary failure" } } : { data: { status: args.p_decision } };
  }
  if (name === "get_teacher_assignment_detail") return { data: [] };
  if (name === "get_teacher_assignment_reports") return { data: state.tasks.reports };
  throw Error("Unexpected RPC: " + name);
}};
function click(action, id, decision) {
  return api.handleContentClick({ target: { closest() { return { dataset: { action, id, decision } }; } } });
}
(async function () {
  await click("queue-item-report", "one", "approved");
  await click("queue-item-report", "two", "rejected");
  await click("queue-item-report", "three", "approved");
  assert.equal(api.queuedReportDecisions().length, 3);
  assert.equal(rpcWrites, 0, "Making choices must not save or reload the task.");
  await click("queue-item-report", "three", "approved");
  assert.equal(api.queuedReportDecisions().length, 2, "Clicking again unselects the decision.");
  await click("queue-item-report", "three", "approved");
  await click("commit-report-selections");
  assert.equal(confirmations, 1);
  assert.equal(rpcWrites, 3);
  assert.equal(api.queuedReportDecisions().length, 1);
  assert.equal(state.tasks.reportDecisions.two, "rejected", "Failed entries remain queued.");
  assert.equal(state.tasks.reports[0].status, "approved");
  assert.equal(state.tasks.reports[1].status, "pending");
  assert.match(state.tasks.message, /2 beoordelingen opgeslagen/);
  console.log("BATCH-MELDINGEN EN ACTES-ALTERNATIEVEN: OK (" + cases.length + " zinnen, 3 RPCs)");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
