(function () {
  "use strict";

  function readConfig() {
    const source = window.MON_PARCOURS_CONFIG || {};
    return {
      url: String(source.supabaseUrl || "").trim().replace(/\/+$/, ""),
      anonKey: String(source.supabasePublishableKey || source.supabaseAnonKey || "").trim()
    };
  }

  function isConfigured() {
    const config = readConfig();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) && config.anonKey.length > 20;
  }

  async function rpc(functionName, parameters) {
    if (!isConfigured()) throw new Error("SUPABASE_NOT_CONFIGURED");
    if (!/^[a-z][a-z0-9_]+$/.test(functionName)) throw new Error("INVALID_RPC_NAME");
    const config = readConfig();
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
    try {
      const headers = {
        apikey: config.anonKey,
        "Content-Type": "application/json"
      };
      if (!config.anonKey.startsWith("sb_publishable_")) headers.Authorization = "Bearer " + config.anonKey;
      const response = await fetch(config.url + "/rest/v1/rpc/" + functionName, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(parameters || {}),
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) {
        const error = new Error("SUPABASE_RPC_FAILED");
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) return null;
      return response.json();
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  window.MonParcoursSupabase = Object.freeze({
    isConfigured: isConfigured,
    rpc: rpc
  });
})();
