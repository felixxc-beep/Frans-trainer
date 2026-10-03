(function (root, factory) {
  const api = factory(root && root.MonParcoursMastery || (typeof require === "function" ? require("./mastery.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursAssignments = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (mastery) {
  "use strict";

  function progress(assignment, records, now) {
    const ids = Array.from(new Set((assignment.item_ids || []).filter(Boolean)));
    const items = ids.map(function (id) { return { id: id }; });
    const summary = mastery.calculateMasterySummary(items, records || new Map());
    const target = Number(assignment.target_acquired_percentage || 80);
    const acquiredPercentage = summary.total ? Math.round(summary.acquired * 100 / summary.total) : 0;
    const reached = summary.total > 0 && summary.practiced === summary.total && summary.acquired * 100 >= target * summary.total;
    const completedAt = assignment.completed_at || null;
    const overdue = assignment.due_at && new Date(assignment.due_at).getTime() < new Date(now || Date.now()).getTime();
    return Object.assign({}, summary, {
      target: target,
      acquiredPercentage: acquiredPercentage,
      reachedLocally: reached,
      completedAt: completedAt,
      status: completedAt ? "completed" : overdue ? "late" : summary.practiced ? "in_progress" : "not_started"
    });
  }

  function prioritizedItems(items, records) {
    return (items || []).map(function (item, index) {
      const evidence = mastery.getItemMastery(item.id, records || new Map());
      const rank = evidence.status === "new" ? 0 : evidence.status === "learning" ? 1 : 2;
      return { item: item, rank: rank, level: evidence.level, index: index };
    }).sort(function (left, right) {
      return left.rank - right.rank || left.level - right.level || left.index - right.index;
    }).map(function (row) { return row.item; });
  }

  function selectItems(items, records, count) {
    const ordered = prioritizedItems(items, records);
    return ordered.slice(0, count === "all" ? ordered.length : Math.max(0, Number(count) || 0));
  }

  function scopeItems(course, path) {
    const trajectory = (course.trajectories || []).find(function (row) { return row.trajectory === path.trajectory; });
    if (!trajectory) return [];
    return (trajectory.items || []).filter(function (item) {
      return (!path.top_category || item.top_category === path.top_category) &&
        (!path.lesson || item.lesson === path.lesson) &&
        (!path.block || item.block === path.block) &&
        (!path.subsection || item.subsection === path.subsection) &&
        (!path.category || item.category === path.category) && item.type !== "sound_rule";
    });
  }

  function numberedRanges(length) {
    const ranges = [];
    for (let start = 1; start <= length; start += 20) ranges.push({ start: start, end: Math.min(length, start + 19) });
    return ranges;
  }

  return { progress: progress, prioritizedItems: prioritizedItems, selectItems: selectItems, scopeItems: scopeItems, numberedRanges: numberedRanges };
});
