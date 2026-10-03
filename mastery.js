(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursMastery = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STATUS = Object.freeze({ NEW: "new", LEARNING: "learning", ACQUIRED: "acquired" });
  const INDEPENDENT_MODES = new Set(["practice", "test"]);

  function keyFor(itemId, itemVariant) {
    return String(itemId || "") + "\u001f" + String(itemVariant || "");
  }

  function emptyRecord(itemId, itemVariant) {
    return {
      itemId: String(itemId || ""),
      itemVariant: String(itemVariant || ""),
      practicedAttempts: 0,
      independentAttempts: 0,
      independentCorrect: 0,
      independentSessionIds: new Set(),
      independentSessionCount: 0,
      latestIndependentAt: "",
      latestIndependentCorrect: null
    };
  }

  function isAtLeastAsRecent(candidate, current) {
    if (!current) return true;
    const candidateTime = Date.parse(candidate);
    const currentTime = Date.parse(current);
    if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) return candidateTime >= currentTime;
    return String(candidate) >= String(current);
  }

  function asRecord(row) {
    const record = emptyRecord(row.item_id || row.itemId, row.item_variant || row.itemVariant);
    record.practicedAttempts = Number(row.practiced_attempts == null ? row.practicedAttempts : row.practiced_attempts) || 0;
    record.independentAttempts = Number(row.independent_attempts == null ? row.independentAttempts : row.independent_attempts) || 0;
    record.independentCorrect = Number(row.independent_correct == null ? row.independentCorrect : row.independent_correct) || 0;
    const sessionIds = row.independent_session_ids || row.independentSessionIds || [];
    record.independentSessionIds = new Set(Array.isArray(sessionIds) ? sessionIds.filter(Boolean).map(String) : []);
    record.independentSessionCount = Math.max(
      Number(row.independent_session_count == null ? row.independentSessionCount : row.independent_session_count) || 0,
      record.independentSessionIds.size
    );
    record.latestIndependentAt = String(row.latest_independent_at || row.latestIndependentAt || "");
    const latest = row.latest_independent_correct == null ? row.latestIndependentCorrect : row.latest_independent_correct;
    record.latestIndependentCorrect = latest == null ? null : Boolean(latest);
    return record;
  }

  function getMasteryStatus(record) {
    const value = record ? asRecord(record) : emptyRecord("", "");
    if (value.practicedAttempts < 1) return STATUS.NEW;
    const rate = value.independentAttempts ? value.independentCorrect / value.independentAttempts : 0;
    return value.independentCorrect >= 3 &&
      rate >= 0.75 &&
      value.independentSessionCount >= 2 &&
      value.latestIndependentCorrect === true
      ? STATUS.ACQUIRED
      : STATUS.LEARNING;
  }

  function addAttempt(records, attempt) {
    const ids = Array.from(new Set([attempt.item_id].concat(attempt.equivalent_item_ids || []).filter(Boolean).map(String)));
    const variant = String(attempt.item_variant || "");
    ids.forEach(function (itemId) {
      const key = keyFor(itemId, variant);
      const record = records.get(key) || emptyRecord(itemId, variant);
      record.practicedAttempts += 1;
      if (INDEPENDENT_MODES.has(attempt.mode)) {
        record.independentAttempts += 1;
        if (attempt.was_correct === true) record.independentCorrect += 1;
        const sessionId = String(attempt.client_session_id || attempt.session_id || "");
        if (sessionId) record.independentSessionIds.add(sessionId);
        record.independentSessionCount = Math.max(record.independentSessionCount, record.independentSessionIds.size);
        const at = String(attempt.created_at || "");
        if (isAtLeastAsRecent(at, record.latestIndependentAt)) {
          record.latestIndependentAt = at;
          record.latestIndependentCorrect = attempt.was_correct === true;
        }
      }
      records.set(key, record);
    });
  }

  function mergeMasterySources(serverRows, localAttempts, acceptedAttemptIds, legacyRows) {
    const records = new Map();
    (serverRows || []).forEach(function (row) {
      const record = asRecord(row);
      records.set(keyFor(record.itemId, record.itemVariant), record);
    });
    (legacyRows || []).forEach(function (row) {
      const incoming = asRecord(row);
      const key = keyFor(incoming.itemId, incoming.itemVariant);
      if (!records.has(key)) records.set(key, incoming);
      else if (incoming.practicedAttempts > 0) records.get(key).practicedAttempts = Math.max(1, records.get(key).practicedAttempts);
    });
    const accepted = new Set((acceptedAttemptIds || []).map(String));
    const seen = new Set();
    (localAttempts || []).forEach(function (attempt) {
      const attemptId = String(attempt.client_attempt_id || "");
      if ((attemptId && accepted.has(attemptId)) || (attemptId && seen.has(attemptId))) return;
      if (attemptId) seen.add(attemptId);
      addAttempt(records, attempt);
    });
    return records;
  }

  function combineItemRecords(records, itemId) {
    const combined = emptyRecord(itemId, "");
    records.forEach(function (record) {
      if (record.itemId !== itemId) return;
      combined.practicedAttempts += record.practicedAttempts;
      combined.independentAttempts += record.independentAttempts;
      combined.independentCorrect += record.independentCorrect;
      record.independentSessionIds.forEach(function (id) { combined.independentSessionIds.add(id); });
      combined.independentSessionCount = Math.max(combined.independentSessionCount, record.independentSessionCount, combined.independentSessionIds.size);
      if (record.latestIndependentAt && isAtLeastAsRecent(record.latestIndependentAt, combined.latestIndependentAt)) {
        combined.latestIndependentAt = record.latestIndependentAt;
        combined.latestIndependentCorrect = record.latestIndependentCorrect;
      }
    });
    return combined;
  }

  function isDynamicNumber(item) {
    return item && item.type === "number" && item.dynamic_range === true && Array.isArray(item.range) && item.range.length === 2;
  }

  function roundedPercentages(counts, total) {
    if (!total) return { new: 0, learning: 0, acquired: 0 };
    const names = [STATUS.NEW, STATUS.LEARNING, STATUS.ACQUIRED];
    const raw = names.map(function (name) { return { name: name, value: counts[name] * 100 / total }; });
    const result = {};
    let used = 0;
    raw.forEach(function (entry) { result[entry.name] = Math.floor(entry.value); used += result[entry.name]; });
    raw.sort(function (left, right) { return (right.value - Math.floor(right.value)) - (left.value - Math.floor(left.value)); });
    for (let index = 0; index < 100 - used; index += 1) result[raw[index % raw.length].name] += 1;
    return result;
  }

  function calculateMasterySummary(items, records) {
    const counts = { new: 0, learning: 0, acquired: 0 };
    const seen = new Set();
    (items || []).forEach(function (item) {
      const itemId = String(item && item.id || "");
      if (!itemId || seen.has(itemId)) return;
      seen.add(itemId);
      if (isDynamicNumber(item)) {
        const minimum = Number(item.range[0]);
        const maximum = Number(item.range[1]);
        const total = Math.max(0, maximum - minimum + 1);
        let practiced = 0;
        records.forEach(function (record) {
          if (record.itemId !== itemId || record.itemVariant === "") return;
          const numericVariant = Number(record.itemVariant);
          if (!Number.isInteger(numericVariant) || numericVariant < minimum || numericVariant > maximum) return;
          const status = getMasteryStatus(record);
          counts[status] += 1;
          practiced += 1;
        });
        counts.new += Math.max(0, total - practiced);
        return;
      }
      const variants = item && item.type === "verb" && Array.isArray(item.conjugations)
        ? Array.from(new Set(item.conjugations.map(function (entry) { return String(entry && entry.subject || ""); }).filter(Boolean)))
        : [];
      counts[getMasteryStatus(records.get(keyFor(itemId, "")))] += 1;
      variants.forEach(function (variant) {
        counts[getMasteryStatus(records.get(keyFor(itemId, variant)))] += 1;
      });
    });
    const total = counts.new + counts.learning + counts.acquired;
    return {
      total: total,
      practiced: counts.learning + counts.acquired,
      new: counts.new,
      learning: counts.learning,
      acquired: counts.acquired,
      percentages: roundedPercentages(counts, total)
    };
  }

  function getMasteryCounts(items, records) {
    const summary = calculateMasterySummary(items, records);
    return { new: summary.new, learning: summary.learning, acquired: summary.acquired };
  }

  return {
    STATUS: STATUS,
    keyFor: keyFor,
    getMasteryStatus: getMasteryStatus,
    mergeMasterySources: mergeMasterySources,
    calculateMasterySummary: calculateMasterySummary,
    getMasteryCounts: getMasteryCounts
  };
});
