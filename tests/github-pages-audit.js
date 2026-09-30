const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const script = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const json = fs.readFileSync(path.join(root, "data", "course.json"), "utf8");

assert.equal(path.dirname(indexPath), root, "index.html moet in de projectroot staan");
assert.ok(fs.existsSync(path.join(root, ".nojekyll")), ".nojekyll ontbreekt");

const stylesheet = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)[1];
const appScript = html.match(/<script[^>]+src="([^"]+)"/)[1];
const dataUrl = script.match(/const DATA_URL = "([^"]+)"/)[1];
const assets = [stylesheet, appScript, dataUrl];

assets.forEach(function (asset) {
  assert.ok(asset.startsWith("./"), asset + " moet expliciet relatief zijn");
  assert.equal(asset.startsWith("/"), false, asset + " mag niet vanaf de domeinroot beginnen");
  assert.equal(/^[a-z]+:/i.test(asset), false, asset + " mag geen absoluut URL-schema hebben");
});

const projectBase = new URL("https://voorbeeld.github.io/frans-trainer/");
assert.equal(new URL(stylesheet, projectBase).pathname, "/frans-trainer/styles.css");
assert.equal(new URL(appScript, projectBase).pathname, "/frans-trainer/app.js");
assert.equal(new URL(dataUrl, projectBase).pathname, "/frans-trainer/data/course.json");

[html, script, styles, json].forEach(function (content) {
  assert.equal(/(?:^|[^A-Za-z])[A-Za-z]:[\\/]/m.test(content), false, "Een absoluut lokaal Windows-pad is gevonden");
  assert.equal(/file:\/\//i.test(content), false, "Een file://-pad is gevonden");
});

assert.equal(/(?:WebSocket|EventSource|XMLHttpRequest|\/api\/)/.test(script), false, "Backendafhankelijkheid gevonden");
assert.equal(/fetch\s*\(\s*(?!DATA_URL)/.test(script), false, "Onverwachte netwerkrequest gevonden");
assert.ok(script.includes("localStorage.getItem(STORAGE_KEY)"));
assert.ok(script.includes("localStorage.setItem(STORAGE_KEY"));
assert.ok(script.includes("localStorage.removeItem(STORAGE_KEY)"));
assert.equal(fs.existsSync(path.join(root, "package.json")), false, "Een buildmanifest is niet nodig voor deze statische app");

JSON.parse(json);

console.log("GITHUB PAGES AUDIT GESLAAGD");
console.log("index.html staat in de root");
console.log("CSS, JavaScript en JSON blijven onder /frans-trainer/");
console.log("Geen lokale absolute paden, buildstap of backend");
console.log("localStorage blijft browserlokaal beschikbaar");
