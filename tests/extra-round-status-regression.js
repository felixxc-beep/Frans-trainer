const assert = require("node:assert/strict");
const fs = require("node:fs");
const roundsApi = require("../task-rounds.js");

const app = fs.readFileSync("app.js", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
const home = fs.readFileSync("index.html", "utf8");
const teacherHtml = fs.readFileSync("teacher.html", "utf8");

function part(from, until) {
  const start = app.indexOf(from);
  const end = app.indexOf(until, start + from.length);
  assert.ok(start >= 0 && end > start, "Missing JavaScript helper: " + from);
  return app.slice(start, end);
}
const itemIds = Array.from({ length: 12 }, (_, i) => "uf1-item-" + String(i + 1).padStart(6, "0"));
const task = { id: "task-1", status: "published", completion_strategy: "rounds",
  item_ids: itemIds, required_rounds: 3, released_rounds: 2 };
const first = roundsApi.createRound(task, [], () => 0.5);
first.selected_item_ids.forEach(id => roundsApi.markAttempt(first, id, true));
const second = roundsApi.createRound(task, [first], () => 0.5);
second.selected_item_ids.forEach(id => roundsApi.markAttempt(second, id, true));
const completedRounds = [first, second];

const waiting = roundsApi.progress(task, completedRounds);
assert.equal(waiting.waitingForRelease, true, "Two finished rounds should wait for release of third");
assert.equal(waiting.completed, false, "Unreleased extra round is not completion");
assert.equal(waiting.required, 3);

const assignmentProgress = new Function("window", "currentMasteryRecords", "currentVerbEvidence", "roundsForAssignment",
  part("function assignmentProgress(", "\nfunction assignmentDue(") + "\nreturn assignmentProgress;")(
  { MonParcoursAssignments: { progress: () => ({ status: "completed" }) },
    MonParcoursTaskRounds: roundsApi }, () => [], () => [], () => completedRounds
);
const p = assignmentProgress(task);
assert.equal(p.status, "waiting_release", "A new round must override old green completed state");

const cardStatus = new Function(
  part("function roundCardStatus(", "\nfunction assignmentDisplayPriority(") + "\nreturn roundCardStatus;")();
const pendingCard = cardStatus(p);
assert.equal(pendingCard.className, "in-progress", "Waiting for release should be amber, never green");
assert.match(pendingCard.nl, /Wacht op vrijgave/);

const assignmentBuckets = new Function("state","assignmentIsExpired","assignmentProgress",
  part("function assignmentBuckets(", "\nfunction assignmentCourseLabel(") + "\nreturn assignmentBuckets;")(
  { assignments: { items: [task] } }, () => false, assignmentProgress
);
const groups = assignmentBuckets();
assert.equal(groups.active.length, 1, "Waiting must appear among non-finished tasks");
assert.equal(groups.done.length, 0, "Unreleased round must not appear in completed tasks");

const roundHtml = new Function("uiText", "escapeAttr",
  part("function roundTrackerHtml(", "\nfunction assignmentShortProgress(") +
  "\nreturn roundStatusHtml;")(
  (_, nl) => nl, value => String(value)
);
const htmlWaiting = roundHtml(waiting, false, true, 0, false);
assert.match(htmlWaiting,/Taak nog niet afgerond/);
assert.match(htmlWaiting,/volgende ronde moet nog vrijgegeven/);
assert.doesNotMatch(htmlWaiting,/round-complete-label/);

const released = { ...task, released_rounds: 3 };
const newRound = roundsApi.progress(released, completedRounds);
assert.equal(newRound.waitingForRelease, false, "After release, the third round becomes available");
assert.equal(newRound.completed, false);
assert.equal(assignmentProgress(released).status, "in_progress");

const third = roundsApi.createRound(released, completedRounds, () => 0.5);
third.selected_item_ids.forEach(id => roundsApi.markAttempt(third, id, true));
assert.equal(roundsApi.progress(released, [...completedRounds,third]).completed, true);
assert.equal(cardStatus({status:"completed"}).className,"complete", "All rounds complete stays green");

assert.match(app,/document.visibilityState === "visible"[\s\S]*refreshStudentAssignments\(\)/,
  "Returning to a pupil tab must refresh added/released rounds");
assert.match(teacher,/Let op:[\s\S]*meer rondes ingesteld dan vrijgegeven/);
assert.match(teacher,/Ronde '[\s\S]*vrijgeven/);
assert.match(home,/app\.js\?v=20261110-round-status-1/);
assert.match(teacherHtml,/teacher\.js\?v=20261110-round-status-1/);
console.log("EXTRA-RONDE-STATUS OK: pending = amber/open, release = available, completion = green.");
