const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const scriptSources = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map(function (match) { return match[1]; });
const expectedOrder = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "./config.js",
  "./supabase-client.js",
  "./student-identity.js",
  "./sync-manager.js",
  "./app.js"
];

expectedOrder.forEach(function (expected, index) {
  const position = scriptSources.findIndex(function (source) { return source === expected || source.startsWith(expected + "?"); });
  assert.ok(position >= 0, expected + " ontbreekt");
  if (index) {
    const previous = scriptSources.findIndex(function (source) {
      return source === expectedOrder[index - 1] || source.startsWith(expectedOrder[index - 1] + "?");
    });
    assert.ok(position > previous, expected + " staat in de verkeerde volgorde");
  }
});

function harness(options) {
  const storage = new Map();
  const createCalls = [];
  const rpcCalls = [];
  let initializationFailures = options.initializationFailures || 0;
  const windowObject = {
    MON_PARCOURS_CONFIG: options.config || {},
    crypto: { randomUUID() { return "11111111-1111-4111-8111-111111111111"; } },
    addEventListener() {}
  };
  if (options.library) {
    windowObject.supabase = {
      createClient(url, key, clientOptions) {
        createCalls.push({ url: url, key: key, options: clientOptions });
        if (initializationFailures > 0) {
          initializationFailures -= 1;
          throw new Error("tijdelijke initialisatiefout");
        }
        return {
          async rpc(functionName, parameters) {
            rpcCalls.push({ functionName: functionName, parameters: parameters });
            return { data: { online: true }, error: null };
          }
        };
      }
    };
  }
  const context = vm.createContext({
    console,
    window: windowObject,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
      removeItem(key) { storage.delete(key); }
    },
    setTimeout: function () { return 1; },
    clearTimeout() {},
    Date,
    Map,
    JSON,
    Object,
    Array,
    String,
    Boolean,
    Math
  });
  vm.runInContext(fs.readFileSync("supabase-client.js", "utf8"), context, { filename: "supabase-client.js" });
  return { context: context, window: windowObject, storage: storage, createCalls: createCalls, rpcCalls: rpcCalls };
}

(async function () {
  const config = {
    supabaseUrl: "https://schoolproject.supabase.co",
    supabasePublishableKey: "sb_publishable_test-key-12345678901234567890"
  };
  const online = harness({ config: config, library: true });
  assert.equal(online.window.MonParcoursSupabase.isConfigured(), true);
  assert.equal(online.window.MonParcoursSupabase.isConfigured(), true);
  assert.equal(online.createCalls.length, 1, "de browserclient moet worden hergebruikt");
  assert.equal(online.createCalls[0].url, config.supabaseUrl);
  assert.equal(online.createCalls[0].key, config.supabasePublishableKey);
  assert.equal(online.createCalls[0].options, undefined, "createClient moet hetzelfde bewezen tweeargumentenpad gebruiken");
  assert.deepEqual(await online.window.MonParcoursSupabase.rpc("verify_student_identity", { p_class_code: "KLAS1A" }), { online: true });
  assert.equal(online.rpcCalls[0].functionName, "verify_student_identity");

  vm.runInContext(fs.readFileSync("student-identity.js", "utf8"), online.context, { filename: "student-identity.js" });
  assert.equal(online.window.StudentIdentity.isRemoteAvailable(), true);

  const withoutLibrary = harness({ config: config, library: false });
  assert.equal(withoutLibrary.window.MonParcoursSupabase.isConfigured(), false);
  await assert.rejects(withoutLibrary.window.MonParcoursSupabase.rpc("verify_student_identity", {}), /SUPABASE_NOT_CONFIGURED/);
  vm.runInContext(fs.readFileSync("student-identity.js", "utf8"), withoutLibrary.context, { filename: "student-identity.js" });
  vm.runInContext(fs.readFileSync("sync-manager.js", "utf8"), withoutLibrary.context, { filename: "sync-manager.js" });
  assert.equal(withoutLibrary.window.StudentIdentity.getCurrentStudentIdentity().provider, "local");
  assert.equal(withoutLibrary.window.StudentIdentity.isRemoteAvailable(), false);
  withoutLibrary.window.MonParcoursSync.enqueueSession({
    client_session_id: "offline-session",
    identity_provider: "local",
    identity_subject: "local-device",
    session: { client_session_id: "offline-session" },
    attempts: []
  });
  const offlineResult = await withoutLibrary.window.MonParcoursSync.flush();
  assert.equal(offlineResult.sent, 0);
  assert.equal(JSON.parse(withoutLibrary.storage.get("monParcoursSyncQueueV1")).length, 1);

  const withoutConfig = harness({ config: {}, library: true });
  assert.equal(withoutConfig.window.MonParcoursSupabase.isConfigured(), false);
  assert.equal(withoutConfig.createCalls.length, 0);
  await assert.rejects(withoutConfig.window.MonParcoursSupabase.rpc("verify_student_identity", {}), /SUPABASE_NOT_CONFIGURED/);

  const retryAfterFailure = harness({ config: config, library: true, initializationFailures: 1 });
  assert.equal(retryAfterFailure.window.MonParcoursSupabase.isConfigured(), false, "een tijdelijke fout moet lokale fallback activeren");
  assert.equal(retryAfterFailure.window.MonParcoursSupabase.isConfigured(), true, "een eerdere fout mag een latere initialisatie niet blokkeren");
  assert.equal(retryAfterFailure.createCalls.length, 2, "na een mislukte initialisatie moet opnieuw worden geprobeerd");

  console.log("SUPABASE-BROWSERCLIENT-REGRESSIE GESLAAGD");
  console.log("CDN-volgorde, createClient-configuratie, online beschikbaarheid en veilige lokale fallback gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
