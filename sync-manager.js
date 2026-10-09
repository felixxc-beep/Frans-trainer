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

  function enqueueIssueReport(snapshot) {
    if (!snapshot || !snapshot.identity_subject || !snapshot.report || !snapshot.report.client_report_id) return false;
    const queue = readQueue();
    if (queue.some(function (entry) { return entry.kind === "item_report" &&
      entry.client_report_id === snapshot.report.client_report_id; })) return true;
    queue.push({ kind: "item_report", client_report_id: snapshot.report.client_report_id,
      identity_subject: snapshot.identity_subject, report: snapshot.report,
      revision: createId(), retry_count: 0, queued_at: new Date().toISOString() });
    saveQueue(queue);
    scheduleFlush();
    return true;
  }

  function sameEntry(left, right) {
    return left.kind === "item_report" ? right.kind === "item_report" &&
      right.client_report_id === left.client_report_id : right.client_session_id === left.client_session_id;
  }

  function canSyncEntry(entry, identity) {
    return identity && identity.verified === true && identity.provider !== "local" && entry.identity_subject === identity.subject;
  }

  async function flush() {
    if (flushing || !window.MonParcoursSupabase || !window.MonParcoursSupabase.isConfigured() || !window.StudentIdentity) return { sent: 0, pending: readQueue().length };
    const identity = window.StudentIdentity.getCurrentStudentIdentity();
    const credential = window.StudentIdentity.getSyncCredential();
    if (!credential || !identity.verified || identity.provider === "local") return { sent: 0, pending: readQueue().length };
    flushing = true;
    let sent = 0;
    let newerRevisionPending = false;
    let failed = false;
    try {
      const candidates = readQueue().filter(function (entry) { return canSyncEntry(entry, identity); });
      for (const candidate of candidates) {
        try {
          if (candidate.kind === "item_report") {
            await window.MonParcoursSupabase.rpc("report_assignment_item", {
              p_identity_token: credential, p_payload: candidate.report
            });
          } else {
            await window.MonParcoursSupabase.rpc("ingest_practice_bundle", {
              p_identity_token: credential,
              p_session: candidate.session,
              p_attempts: candidate.attempts
            });
          }
          const latest = readQueue();
          const match = latest.findIndex(function (entry) { return sameEntry(candidate, entry); });
          if (match >= 0 && latest[match].revision === candidate.revision) {
            latest.splice(match, 1);
            saveQueue(latest);
          } else if (match >= 0) newerRevisionPending = true;
          sent += 1;
        } catch (error) {
          const latest = readQueue();
          const index = latest.findIndex(function (entry) { return sameEntry(candidate, entry); });
          if (index >= 0 && latest[index].revision === candidate.revision) {
            latest[index].retry_count = (latest[index].retry_count || 0) + 1;
            latest[index].last_failed_at = new Date().toISOString();
            saveQueue(latest);
          }
          failed = true;
          break;
        }
      }
    } finally {
      flushing = false;
    }
    if (sent && window.dispatchEvent && typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("monparcours:sync-complete", { detail: { sent: sent } }));
    }
    if (newerRevisionPending || !failed && sent && readQueue().some(function (entry) { return canSyncEntry(entry, identity); })) scheduleFlush();
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
    enqueueIssueReport: enqueueIssueReport,
    flush: flush,
    scheduleFlush: scheduleFlush,
    getStatus: getStatus,
    createId: createId
  });
})();
