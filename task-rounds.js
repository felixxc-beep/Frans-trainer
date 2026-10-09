(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursTaskRounds = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MINIMUM_REVIEW_FRACTION = 0.33;

  function uniqueIds(ids) {
    return Array.from(new Set((ids || []).filter(Boolean).map(String)));
  }

  function roundComplete(round) {
    return Boolean(round && round.selected_item_ids.length &&
      round.selected_item_ids.every(function (id) { return round.items[id] && round.items[id].completed_at; }));
  }

  function selectReview(itemIds, previousRounds, random) {
    const ids = uniqueIds(itemIds);
    const rounds = previousRounds || [];
    const previous = rounds[rounds.length - 1];
    const earlier = rounds.slice(0, -1);
    const previousWrong = new Set(Object.keys(previous && previous.items || {}).filter(function (id) {
      return Number(previous.items[id].wrong_count || 0) > 0;
    }));
    const earlierWrongCount = function (id) {
      return earlier.reduce(function (count, round) { return count + Number(round.items[id] && round.items[id].wrong_count || 0); }, 0);
    };
    const consulted = new Set(Object.keys(rounds[0] && rounds[0].items || {}).filter(function (id) {
      return rounds[0].items[id].consulted === true;
    }));
    const selected = ids.filter(function (id) { return previousWrong.has(id); });
    const reasons = Object.fromEntries(selected.map(function (id) { return [id, "previous_round_error"]; }));
    const minimum = Math.ceil(ids.length * MINIMUM_REVIEW_FRACTION);
    const earlierCandidates = ids.filter(function (id) { return !reasons[id] && earlierWrongCount(id) > 0; })
      .sort(function (left, right) { return earlierWrongCount(right) - earlierWrongCount(left); });
    const consultedCandidates = ids.filter(function (id) { return !reasons[id] && !earlierWrongCount(id) && consulted.has(id); });
    [
      [earlierCandidates, "historically_difficult"],
      [consultedCandidates, "consulted"]
    ].forEach(function (group) {
      group[0].forEach(function (id) {
        if (selected.length < minimum) { selected.push(id); reasons[id] = group[1]; }
      });
    });
    const lastRandom = new Set(previous && previous.random_sample_item_ids || []);
    const choices = ids.filter(function (id) { return !reasons[id]; });
    const draw = typeof random === "function" ? random : Math.random;
    const shuffled = choices.map(function (id) { return { id: id, value: draw() }; })
      .sort(function (left, right) { return Number(lastRandom.has(left.id)) - Number(lastRandom.has(right.id)) || left.value - right.value; });
    for (const row of shuffled) {
      if (selected.length >= minimum) break;
      selected.push(row.id);
      reasons[row.id] = "random_sample";
    }
    return { selected_item_ids: selected, selection_reasons: reasons,
      random_sample_item_ids: selected.filter(function (id) { return reasons[id] === "random_sample"; }) };
  }

  function createRound(assignment, rounds, random) {
    const number = (rounds || []).length + 1;
    const ids = uniqueIds(assignment.item_ids);
    const chosen = number <= 2
      ? { selected_item_ids: ids, selection_reasons: Object.fromEntries(ids.map(function (id) { return [id, "full_round"]; })), random_sample_item_ids: [] }
      : selectReview(ids, rounds, random);
    return { number: number, selected_item_ids: chosen.selected_item_ids,
      random_sample_item_ids: chosen.random_sample_item_ids, selection_reasons: chosen.selection_reasons,
      items: Object.fromEntries(chosen.selected_item_ids.map(function (id) {
        return [id, { wrong_count: 0, consulted: false, completed_at: null }];
      })) };
  }

  function currentRound(assignment, rounds) {
    const required = Math.min(4, Math.max(1, Number(assignment.required_rounds || 1)));
    const existing = rounds || [];
    for (const round of existing) if (!roundComplete(round)) return round;
    if (existing.length >= required) return null;
    return createRound(assignment, existing);
  }

  function markAttempt(round, itemId, correct, at) {
    if (!round || !round.items[itemId] || round.items[itemId].completed_at) return false;
    if (correct) round.items[itemId].completed_at = at || new Date().toISOString();
    else round.items[itemId].wrong_count += 1;
    return true;
  }

  function markConsulted(round, itemId) {
    if (!round || round.number !== 1 || !round.items[itemId]) return false;
    round.items[itemId].consulted = true;
    return true;
  }

  function progress(assignment, rounds) {
    const required = Math.min(4, Math.max(1, Number(assignment.required_rounds || 1)));
    const active = currentRound(assignment, rounds);
    const completed = !active && (rounds || []).length >= required;
    const selected = active ? active.selected_item_ids : [];
    const done = selected.filter(function (id) { return active.items[id] && active.items[id].completed_at; }).length;
    return { required: required, round: active ? active.number : required, selected: selected.length,
      done: done, remaining: selected.length - done, completed: completed };
  }

  return { MINIMUM_REVIEW_FRACTION: MINIMUM_REVIEW_FRACTION, selectReview: selectReview,
    createRound: createRound, currentRound: currentRound, roundComplete: roundComplete,
    markAttempt: markAttempt, markConsulted: markConsulted, progress: progress };
});
