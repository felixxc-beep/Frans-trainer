(function () {
  "use strict";

  let cachedClient = null;
  let cachedSignature = "";

  function readConfig() {
    const source = window.MON_PARCOURS_CONFIG || {};
    return {
      url: String(source.supabaseUrl || "").trim().replace(/\/+$/, ""),
      anonKey: String(source.supabasePublishableKey || source.supabaseAnonKey || "").trim()
    };
  }

  function validConfig(config) {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) && config.anonKey.length > 20;
  }

  function getClient() {
    const config = readConfig();
    const signature = config.url + "\n" + config.anonKey;
    if (signature !== cachedSignature) {
      cachedClient = null;
      cachedSignature = signature;
    }
    if (!validConfig(config) || !window.supabase || typeof window.supabase.createClient !== "function") return null;
    if (!cachedClient) {
      try {
        cachedClient = window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });
      } catch (error) {
        cachedClient = null;
      }
    }
    return cachedClient;
  }

  function isConfigured() {
    return Boolean(getClient());
  }

  async function rpc(functionName, parameters) {
    if (!/^[a-z][a-z0-9_]+$/.test(functionName)) throw new Error("INVALID_RPC_NAME");
    const client = getClient();
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const result = await client.rpc(functionName, parameters || {});
    if (result && result.error) {
      const error = new Error("SUPABASE_RPC_FAILED");
      error.status = result.error.status || result.error.code || null;
      throw error;
    }
    return result ? result.data : null;
  }

  window.MonParcoursSupabase = Object.freeze({
    isConfigured: isConfigured,
    rpc: rpc
  });
})();
