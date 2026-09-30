(function () {
  "use strict";

  const QUEUE_KEY = "monParcoursSyncQueueV1";
  let flushing = false;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
  }

  function readQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      return [];
    }
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function enqueueSession(snapshot) {
    if (!snapshot || !snapshot.client_session_id || !snapshot.identity_subject) return false;
    const revision = createId();
    const queue = readQueue();
    const existingIndex = queue.findIndex(function (entry) {
      return entry.client_session_id === snapshot.client_session_id;
    });
    const entry = {
      client_session_id: snapshot.client_session_id,
      identity_provider: snapshot.identity_provider,
      identity_subject: snapshot.identity_subject,
      session: snapshot.session,
      attempts: snapshot.attempts || [],
      revision: revision,
      retry_count: existingIndex >= 0 ? queue[existingIndex].retry_count || 0 : 0,
      queued_at: new Date().toISOString()
    };
    if (existingIndex >= 0) queue[existingIndex] = entry;
    else queue.push(entry);
    saveQueue(queue);
    scheduleFlush();
    return true;
  }

  function canSyncEntry(entry, identity) {
    return identity && identity.provider === "school_code" && entry.identity_provider === identity.provider && entry.identity_subject === identity.subject;
  }

  async function flush() {
    if (flushing || !window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured() || !window.StudentIdentity) return { sent: 0, pending: readQueue().length };
    const identity = window.StudentIdentity.getCurrentStudentIdentity();
    const credential = window.StudentIdentity.getSyncCredential();
    if (!credential || identity.provider !== "school_code") return { sent: 0, pending: readQueue().length };
    flushing = true;
    let sent = 0;
    try {
      const candidates = readQueue().filter(function (entry) { return canSyncEntry(entry, identity); });
      for (const candidate of candidates) {
        try {
          await window.MonParcoursSupabase.rpc("ingest_practice_bundle", {
            p_identity_token: credential,
            p_session: candidate.session,
            p_attempts: candidate.attempts
          });
          const latest = readQueue();
          const index = latest.findIndex(function (entry) { return entry.client_session_id === candidate.client_session_id; });
          if (index >= 0 && latest[index].revision === candidate.revision) {
            latest.splice(index, 1);
            saveQueue(latest);
          }
          sent += 1;
        } catch (error) {
          const latest = readQueue();
          const index = latest.findIndex(function (entry) { return entry.client_session_id === candidate.client_session_id; });
          if (index >= 0 && latest[index].revision === candidate.revision) {
            latest[index].retry_count = (latest[index].retry_count || 0) + 1;
            latest[index].last_failed_at = new Date().toISOString();
            saveQueue(latest);
          }
          break;
        }
      }
    } finally {
      flushing = false;
    }
    return { sent: sent, pending: readQueue().length };
  }

  function scheduleFlush() {
    setTimeout(function () { flush(); }, 0);
  }

  function getStatus() {
    const identity = window.StudentIdentity ? window.StudentIdentity.getCurrentStudentIdentity() : null;
    const queue = readQueue();
    return {
      configured: Boolean(window.MonParcoursSupabase && window.MonParcoursSupabase.isConfigured()),
      pending: queue.filter(function (entry) { return !identity || entry.identity_subject === identity.subject; }).length,
      totalPending: queue.length,
      flushing: flushing
    };
  }

  if (window.addEventListener) window.addEventListener("online", scheduleFlush);

  window.MonParcoursSync = Object.freeze({
    enqueueSession: enqueueSession,
    flush: flush,
    scheduleFlush: scheduleFlush,
    getStatus: getStatus,
    createId: createId
  });
})();
