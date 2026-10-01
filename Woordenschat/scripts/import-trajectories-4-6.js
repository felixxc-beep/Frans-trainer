const fs = require("node:fs");

const coursePath = "data/course.json";
const sourcePaths = process.argv.slice(2);
const expectedTrajectories = ["Trajet 4", "Trajet 5", "Trajet 6"];
const supportedTypes = new Set(["vocabulary", "phrase", "verb", "grammar_rule", "number", "sound_rule"]);

if (sourcePaths.length !== 3) {
  throw new Error("Gebruik: node scripts/import-trajectories-4-6.js <trajet4.json> <trajet5.json> <trajet6.json>");
}

const course = JSON.parse(fs.readFileSync(coursePath, "utf8"));
const existingItems = course.trajectories.flatMap(function (trajectory) { return trajectory.items || []; });
const existingIds = new Set(existingItems.map(function (item) { return item.id; }));
if (existingItems.length !== 565 || existingIds.size !== 565) throw new Error("Onverwachte bestaande cursusstatus");
for (let number = 1; number <= 565; number += 1) {
  const id = "uf1-item-" + String(number).padStart(6, "0");
  if (!existingIds.has(id)) throw new Error("Bestaande ID ontbreekt: " + id);
}
if (course.trajectories.some(function (trajectory) { return expectedTrajectories.includes(trajectory.trajectory); })) {
  throw new Error("Trajet 4–6 zijn al aanwezig; import afgebroken");
}

let nextId = 566;
function assignId(item) {
  const copy = JSON.parse(JSON.stringify(item));
  if (!supportedTypes.has(copy.type)) throw new Error("Niet-ondersteund itemtype: " + copy.type);
  copy.id = "uf1-item-" + String(nextId).padStart(6, "0");
  nextId += 1;
  return copy;
}

function numberSpecItem(source, spec) {
  const numberUnit = source.units.find(function (unit) {
    return unit.top_category === spec.top_category && unit.title === spec.lesson;
  });
  if (!numberUnit || !numberUnit.study_sections.length || !numberUnit.study_sections[0].subsections.length) {
    throw new Error(source.trajectory + ": getallenstructuur ontbreekt");
  }
  const section = numberUnit.study_sections[0];
  const subsection = section.subsections[0];
  return Object.assign({}, JSON.parse(JSON.stringify(spec)), {
    top_category: spec.top_category,
    lesson: spec.lesson,
    block: section.title,
    subsection: subsection.title,
    category: "nombres",
    type: "number",
    dynamic_range: true
  });
}

const imported = sourcePaths.map(function (sourcePath, index) {
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (source.trajectory !== expectedTrajectories[index]) {
    throw new Error("Verwacht " + expectedTrajectories[index] + ", kreeg " + source.trajectory);
  }
  if (!Array.isArray(source.units) || !Array.isArray(source.items) || !Array.isArray(source.number_specs)) {
    throw new Error(source.trajectory + ": ongeldig bronpakket");
  }
  const items = source.items.map(assignId);
  source.number_specs.forEach(function (spec) { items.push(assignId(numberSpecItem(source, spec))); });
  return {
    course: source.course,
    trajectory: source.trajectory,
    structure_priority: true,
    units: JSON.parse(JSON.stringify(source.units)),
    items: items
  };
});

course.trajectories.push.apply(course.trajectories, imported);
fs.writeFileSync(coursePath, JSON.stringify(course, null, 2) + "\n");

console.log(imported.map(function (trajectory) {
  return trajectory.trajectory + ": " + trajectory.items.length + " items";
}).join("\n"));
console.log("Nieuwe ID-reeks: uf1-item-000566–uf1-item-" + String(nextId - 1).padStart(6, "0"));
