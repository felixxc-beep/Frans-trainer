const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sql = fs.readFileSync("supabase/phase11-curated-variants.sql", "utf8");
const verificationSql = fs.readFileSync("supabase/phase11-verification.sql", "utf8");
const sentenceSql = fs.readFileSync("supabase/phase12-report-reliability.sql", "utf8");
assert.match(sql, /create table public\.practice_question_submissions/i);
assert.match(sql, /unique \(student_id, client_submission_id\)/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /force row level security/i);
assert.match(sql, /set search_path = ''/i);
assert.match(sql, /create function public\.curated_sync_version\(\)/i);
assert.match(sql, /create or replace function public\.ingest_practice_bundle\(/i);
assert.match(sql, /create or replace function public\.get_class_activity_monitor\(/i);
assert.match(sql, /get_class_activity_monitor_pre_curated_impl/i);
assert.match(sql, /count\(distinct \(session_id,variant_id\)\)::integer from questions/i);
assert.match(sql, /'attempt_count',greatest\(0,\(v_row->>'attempt_count'\)::integer-v_evidence_attempts\+v_question_attempts\)/i);
assert.match(sql, /'independent_correct',greatest\(0,\(v_row->>'independent_correct'\)::integer-v_evidence_correct\+v_question_correct\)/i);
assert.match(sql, /practice_question_submissions from public, anon, authenticated, service_role/i);
assert.doesNotMatch(sql, /submitted_answer/i);
assert.match(verificationSql, /rls_enabled_ok/i);
assert.match(verificationSql, /no_anon_select_ok/i);
assert.match(verificationSql, /teacher_monitor_ok/i);
assert.doesNotMatch(verificationSql, /\b(?:insert|update|delete|alter|create|drop)\b\s+(?:into\s+)?(?:public|private)\./i,
  "phase-11 verification stays read-only");
assert.match(sentenceSql, /create function public\.assignment_sentence_sync_version\(\)/);

const store = new Map();
const calls = [];
let capability = false;
let sentenceCapability = false;
let serial = 0;
const context = vm.createContext({
  console, setTimeout(callback) { /* Tests flush explicitly. */ },
  window: {
    MonParcoursSupabase: {
      isConfigured() { return true; },
      async rpc(name, payload) {
        calls.push({ name, payload });
        if (name === "curated_sync_version") {
          if (!capability) throw new Error("Could not find function public.curated_sync_version");
          return 1;
        }
        if (name === "assignment_sentence_sync_version") {
          if (!sentenceCapability) throw new Error("Could not find function public.assignment_sentence_sync_version");
          return 1;
        }
        return { accepted: true };
      }
    },
    StudentIdentity: {
      getCurrentStudentIdentity() { return { verified: true, provider: "school_email", subject: "student-1" }; },
      getSyncCredential() { return "token-1"; }
    },
    crypto: { randomUUID() { serial += 1; return "00000000-0000-4000-8000-" + String(serial).padStart(12, "0"); } },
    addEventListener() {}
  },
  localStorage: {
    getItem(key) { return store.get(key) || null; },
    setItem(key, value) { store.set(key, value); }
  }
});
vm.runInContext(fs.readFileSync("sync-manager.js", "utf8"), context);
const sync = context.window.MonParcoursSync;
const curated = { client_session_id: "c1", identity_subject: "student-1", session: {
  client_session_id: "c1", exercise_key: "curated-grammar", question_count: 1, attempt_count: 1,
  question_submissions: [{ client_submission_id: "q1", variant_id: "T6-HOM-A-007", was_correct: false }]
}, attempts: [{ client_attempt_id: "a1" }, { client_attempt_id: "a2" }] };
const legacy = { client_session_id: "l1", identity_subject: "student-1", session: {
  client_session_id: "l1", exercise_key: "vocab-nl-fr", question_count: 1, attempt_count: 1
}, attempts: [{ client_attempt_id: "a3" }] };
sync.enqueueSession(curated);
sync.enqueueSession(legacy);
(async () => {
  const first = await sync.flush();
  assert.equal(first.sent, 1, "legacy session remains synchronizable");
  assert.equal(first.pending, 1, "curated session stays queued before migration");
  assert.deepEqual(calls.map((call) => call.name), ["ingest_practice_bundle", "curated_sync_version"]);
  capability = true;
  const second = await sync.flush();
  assert.equal(second.sent, 1);
  assert.equal(second.pending, 0);
  assert.equal(calls.at(-1).name, "ingest_practice_bundle");
  assert.equal(calls.at(-1).payload.p_session.question_submissions[0].client_submission_id, "q1");
  assert.equal((await sync.flush()).sent, 0, "empty outbox does not resubmit");
  const sentence = { client_session_id: "s1", identity_subject: "student-1", session: {
    client_session_id: "s1", exercise_key: "assignment-mixed", assignment_round_number: 1,
    question_count: 1, attempt_count: 1,
    question_submissions: [{ client_submission_id: "q2", variant_id: "T1-REV-005",
      item_id: "uf1-item-000076", was_correct: false }]
  }, attempts: [] };
  sync.enqueueSession(sentence);
  assert.equal((await sync.flush()).pending, 1, "zinnenopdracht blijft lokaal tot fase 12 beschikbaar is");
  assert.equal(calls.at(-1).name, "assignment_sentence_sync_version");
  sentenceCapability = true;
  assert.equal((await sync.flush()).pending, 0, "dezelfde sessie synchroniseert later zonder dubbele inzending");
  assert.equal(calls.at(-1).payload.p_session.question_submissions[0].client_submission_id, "q2");
  console.log("CURATED SYNC GESLAAGD: migratiecheck, veilige queue-fallback, idempotente inzendings-ID en legacy-sync.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
