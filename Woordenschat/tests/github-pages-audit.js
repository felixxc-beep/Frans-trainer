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
const appScripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map(function (match) { return match[1]; });
const supabaseCdn = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const localScripts = appScripts.filter(function (appScript) { return appScript !== supabaseCdn; });
const dataUrl = script.match(/const DATA_URL = "([^"]+)"/)[1];
const assets = [stylesheet].concat(localScripts, dataUrl);

assert.ok(appScripts.includes(supabaseCdn), "Supabase browserlibrary ontbreekt");
assert.ok(appScripts.indexOf(supabaseCdn) < appScripts.findIndex(function (src) { return src.startsWith("./supabase-client.js"); }));

assets.forEach(function (asset) {
  assert.ok(asset.startsWith("./"), asset + " moet expliciet relatief zijn");
  assert.equal(asset.startsWith("/"), false, asset + " mag niet vanaf de domeinroot beginnen");
  assert.equal(/^[a-z]+:/i.test(asset), false, asset + " mag geen absoluut URL-schema hebben");
});

const projectBase = new URL("https://voorbeeld.github.io/frans-trainer/");
assert.equal(new URL(stylesheet, projectBase).pathname, "/frans-trainer/styles.css");
localScripts.forEach(function (appScript) {
  assert.ok(new URL(appScript, projectBase).pathname.startsWith("/frans-trainer/"));
});
assert.equal(new URL(dataUrl, projectBase).pathname, "/frans-trainer/data/course.json");

[html, script, styles, json].forEach(function (content) {
  assert.equal(/(?:^|[^A-Za-z])[A-Za-z]:[\\/]/m.test(content), false, "Een absoluut lokaal Windows-pad is gevonden");
  assert.equal(/file:\/\//i.test(content), false, "Een file://-pad is gevonden");
});

assert.equal(/(?:WebSocket|EventSource|XMLHttpRequest|\/api\/)/.test(script), false, "Eigen serverafhankelijkheid gevonden");
assert.equal(/fetch\s*\(\s*(?!DATA_URL)/.test(script), false, "Onverwachte request in de trainerkern gevonden");
assert.ok(fs.readFileSync(path.join(root, "supabase-client.js"), "utf8").includes("window.supabase.createClient"));
assert.ok(script.includes("localStorage.getItem(STORAGE_KEY)"));
assert.ok(script.includes("localStorage.setItem(STORAGE_KEY"));
assert.ok(script.includes("localStorage.removeItem(STORAGE_KEY)"));
assert.equal(fs.existsSync(path.join(root, "package.json")), false, "Een buildmanifest is niet nodig voor deze statische app");

JSON.parse(json);

console.log("GITHUB PAGES AUDIT GESLAAGD");
console.log("index.html staat in de root");
console.log("CSS, JavaScript en JSON blijven onder /frans-trainer/");
console.log("Geen lokale absolute paden, buildstap of eigen backend; Supabase blijft optioneel");
console.log("localStorage blijft browserlokaal beschikbaar");
