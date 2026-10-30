const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const feedbackJs = fs.readFileSync("phrase-feedback.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const course = JSON.parse(fs.readFileSync("data/course.json", "utf8"));
const root = {};
vm.runInNewContext(feedbackJs, { window: root });
const feedback = root.MonParcoursPhraseFeedback;
assert.equal(typeof feedback.hint, "function");

const phrase = function (suffix) {
  const item = course.trajectories[0].items.find(function (entry) {
    return entry.id === "uf1-item-" + suffix;
  });
  assert.ok(item);
  return { item: item, prompt: item.nl, answers: item.accepted_answers, variantScoring: "single" };
};

const checks = [
  ["000522", "Je m'appelle [nom].", "haakjes"],
  ["000538", "je suis en classe", "echte klas"],
  ["000537", "tu es dans quel classe", "quel/quelle"],
  ["000535", "non je déteste jouer le foot", "jouer"],
  ["000549", "elle est 12 ans", "avoir"],
  ["000542", "oui c'est ma premiere leçon", "accenten"],
  ["000545", "tu t'appelles Yana", "hij/zij"],
  ["000531", "je joue", "volledige zin"]
];
checks.forEach(function ([id, answer, clue]) {
  const hint = feedback.hint(phrase(id), answer, 1, 1, "practice");
  assert.ok(hint && hint.fr && hint.nl);
  assert.match(hint.nl.toLowerCase(), new RegExp(clue.toLowerCase()));
});

const padel = phrase("000531");
assert.match(feedback.hint(padel,"je joue",2,1,"practice").nl,/Mogelijk begin:/);
assert.match(feedback.hint(padel,"je joue",3,1,"practice").nl,/voorbeeldzin/);
assert.doesNotMatch(feedback.hint(padel,"je joue",3,2,"practice").nl,/voorbeeldzin/);
assert.doesNotMatch(feedback.hint(padel,"je joue",3,1,"test").nl,/voorbeeldzin/);
assert.equal(feedback.hint({ item: { type: "verb" }, answers: ["habite"] }, "habitie", 1, 1, "practice"), null);
assert.match(app, /MonParcoursPhraseFeedback\.hint\(/);
assert.match(app, /dir="ltr" autocomplete="off" autocorrect="off"/);
assert.match(css, /#answer-input, \.gap-answer-list input \{ direction: ltr; text-align: left;/);
assert.ok(html.indexOf("phrase-feedback.js") > 0);
assert.ok(html.indexOf("phrase-feedback.js") < html.indexOf("app.js"));
assert.match(html, /styles\.css\?v=20261030-1/);

const alternatives = {
  "000527": "Où habitez-vous ?",
  "000544": "Quel est son nom ?",
  "000547": "Son nom de famille est [nom].",
  "000548": "Quel âge a-t-elle ?",
  "000550": "Où habite-t-elle ?",
  "000553": "Elle adore danser.",
  "000554": "Il aime le foot.",
  "000560": "Elle est gentille.",
  "000564": "En quelle classe est-il ?"
};
Object.entries(alternatives).forEach(function ([id, answer]) {
  assert.ok(phrase(id).answers.includes(answer), "Missing valid variant " + id);
});
assert.ok(!phrase("000537").answers.includes("Tu es dans quel classe ?"));
assert.ok(phrase("000556").answers.includes("Il aime les jeux vidéo."));
console.log("ZINSFEEDBACK-REGRESSIE OK: " + checks.length + " diagnoses, 4 stages, 9 accepted alternatives.");
