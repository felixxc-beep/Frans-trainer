(function () {
  "use strict";

  let cachedClient = null;
  let cachedUrl = "";
  let cachedPublishableKey = "";

  function readConfig() {
    const source = window.MON_PARCOURS_CONFIG || {};
    return {
      url: String(source.supabaseUrl || "").trim(),
      publishableKey: String(source.supabasePublishableKey || "").trim()
    };
  }

  function clearCachedClient() {
    cachedClient = null;
    cachedUrl = "";
    cachedPublishableKey = "";
  }

  function getClient() {
    const config = readConfig();
    const createClient = window.supabase && window.supabase.createClient;

    if (!config.url || !config.publishableKey || typeof createClient !== "function") {
      clearCachedClient();
      return null;
    }

    if (cachedClient && cachedUrl === config.url && cachedPublishableKey === config.publishableKey) {
      return cachedClient;
    }

    clearCachedClient();
    try {
      const client = window.supabase.createClient(config.url, config.publishableKey);
      if (!client) return null;
      cachedClient = client;
      cachedUrl = config.url;
      cachedPublishableKey = config.publishableKey;
    } catch (error) {
      clearCachedClient();
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("Supabase-client kon niet worden geïnitialiseerd; lokale modus blijft actief.", error);
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
