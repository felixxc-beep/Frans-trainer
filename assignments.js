(function (root, factory) {
  const api = factory(root && root.MonParcoursMastery || (typeof require === "function" ? require("./mastery.js") : null),
    root && root.MonParcoursVerbMastery || (typeof require === "function" ? require("./verb-mastery.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonParcoursAssignments = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis, function (mastery, verbMastery) {
  "use strict";

  function progress(assignment, records, now, verbAttempts) {
    const strategy = assignment.mastery_strategy || "item_mastery";
    if (strategy !== "item_mastery" && verbMastery) return verbProgress(assignment, strategy, verbAttempts || [], now);
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

  function verbProgress(assignment, strategy, attempts, now) {
    const target = Number(assignment.target_acquired_percentage || 80);
    const requirements = Array.isArray(assignment.requirements) ? assignment.requirements : [];
    const goals = requirements.map(function (requirement) {
      const result = verbMastery.calculate(requirement.reference_id, attempts);
      const required = Number(requirement.target_percentage || target);
      const reached = requirement.requirement_type === "verb_rule_mastery"
        ? verbMastery.meetsTarget(result, required) : result.status === "acquired";
      return Object.assign({}, result, { requirementType: requirement.requirement_type, target: required, reached: reached });
    });
    const total = goals.length;
    const practiced = goals.filter(function (goal) { return goal.attempts > 0; }).length;
    const acquired = goals.filter(function (goal) { return goal.status === "acquired"; }).length;
    const reached = strategy === "irregular_verb_mastery"
      ? total > 0 && acquired * 100 >= target * total
      : total > 0 && goals.every(function (goal) { return goal.reached; });
    const overdue = assignment.due_at && new Date(assignment.due_at).getTime() < new Date(now || Date.now()).getTime();
    return { strategy: strategy, goals: goals, total: total, practiced: practiced, acquired: acquired,
      masteryLevel: total ? Math.round(goals.reduce(function (sum, goal) { return sum + goal.level; }, 0) / total) : 0,
      target: target, reachedLocally: reached, acquiredPercentage: total ? Math.round(acquired * 100 / total) : 0,
      completedAt: assignment.completed_at || null,
      status: assignment.completed_at ? "completed" : overdue ? "late" : practiced ? "in_progress" : "not_started" };
  }

  function prioritizedItems(items, records) {
    return (items || []).map(function (item, index) {
      const evidence = mastery.getItemMastery(item.id, records || new Map());
      const rank = evidence.status === "new" ? 0 : evidence.status === "learning" ? 1 : 2;
      return { item: item, rank: rank, recentWrong: evidence.latestIndependentCorrect === false ? 0 : 1,
        level: evidence.level, index: index };
    }).sort(function (left, right) {
      return left.rank - right.rank || left.recentWrong - right.recentWrong || left.level - right.level || left.index - right.index;
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
