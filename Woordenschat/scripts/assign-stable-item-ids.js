const fs = require("node:fs");

const coursePath = "data/course.json";
const course = JSON.parse(fs.readFileSync(coursePath, "utf8"));
const items = course.trajectories.flatMap((trajectory) => trajectory.items || []);
const existingIds = new Set();
let highestNumber = 0;

for (const item of items) {
  if (!item.id) continue;
  if (existingIds.has(item.id)) throw new Error("Dubbele permanente item-ID: " + item.id);
  existingIds.add(item.id);
  const match = /^uf1-item-(\d{6})$/.exec(item.id);
  if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
}

let assigned = 0;
for (const item of items) {
  if (item.id) continue;
  do {
    highestNumber += 1;
    item.id = "uf1-item-" + String(highestNumber).padStart(6, "0");
  } while (existingIds.has(item.id));
  existingIds.add(item.id);
  assigned += 1;
}

fs.writeFileSync(coursePath, JSON.stringify(course, null, 2) + "\n");
console.log(assigned + " nieuwe permanente item-ID's toegekend; bestaande ID's bleven ongewijzigd.");
