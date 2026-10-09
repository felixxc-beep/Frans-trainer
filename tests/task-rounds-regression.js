const assert = require("node:assert/strict");
const fs = require("node:fs");
const rounds = require("../task-rounds.js");
const items = Array.from({ length: 24 }, (_, index) => "uf1-item-" + String(index + 1).padStart(6, "0"));

function assignment(required) { return { item_ids: items, required_rounds: required }; }
function complete(round) { round.selected_item_ids.forEach(id => rounds.markAttempt(round, id, true, "2026-10-09T12:00:00Z")); }
function seeded() { let n = 0; return () => (n++ * 0.61803398875) % 1; }

const one = rounds.createRound(assignment(1), [], seeded());
assert.equal(one.selected_item_ids.length, 24, "A: eerste ronde bevat alle 24 items");
assert.equal(rounds.progress(assignment(1), [one]).completed, false);
complete(one);
assert.equal(rounds.progress(assignment(1), [one]).completed, true, "A: 1 ronde voltooit na 24/24");
assert.equal(rounds.progress(assignment(2), [one]).completed, false, "B: na ronde 1 van 2 nog niet klaar");
const two = rounds.createRound(assignment(2), [one], seeded());
assert.deepEqual(two.selected_item_ids, items, "B: ronde 2 is weer volledig");
complete(two);
assert.equal(rounds.progress(assignment(2), [one, two]).completed, true, "B: 2/2 voltooit");
assert.equal(rounds.createRound(assignment(3), [one, two], seeded()).selected_item_ids.length, 8,
  "C/D: 24 × 0,33 wordt naar boven afgerond op 8");

function scenario(wrongCount, consulted) {
  const first = rounds.createRound(assignment(3), [], seeded());
  if (consulted) rounds.markConsulted(first, items[23]);
  complete(first);
  const second = rounds.createRound(assignment(3), [first], seeded());
  second.selected_item_ids.slice(0, wrongCount).forEach(id => rounds.markAttempt(second, id, false));
  complete(second);
  return [first, second];
}
const six = rounds.createRound(assignment(3), scenario(6, false), seeded());
assert.equal(six.selected_item_ids.length, 8, "E: 6 moeilijke + 2 sample");
assert.ok(items.slice(0, 6).every(id => six.selected_item_ids.includes(id)));
assert.equal(six.random_sample_item_ids.length, 2);
const ten = rounds.createRound(assignment(3), scenario(10, false), seeded());
assert.equal(ten.selected_item_ids.length, 10, "F: 33% is minimum, niet maximum");
assert.ok(items.slice(0, 10).every(id => ten.selected_item_ids.includes(id)));
const consulted = rounds.createRound(assignment(3), scenario(0, true), seeded());
assert.equal(consulted.selection_reasons[items[23]], "consulted", "G: opzoeken krijgt prioriteit");
const history = scenario(0, false);
const third = rounds.createRound(assignment(4), history, seeded());
complete(third);
const fourth = rounds.createRound(assignment(4), history.concat(third), seeded());
assert.equal(fourth.selected_item_ids.length, 8, "ronde 4 herhaalt minimaal 33%");
assert.equal(fourth.random_sample_item_ids.filter(id => third.random_sample_item_ids.includes(id)).length, 0,
  "opeenvolgende steekproeven spreiden waar mogelijk over andere items");
assert.equal(rounds.markConsulted(two, items[0]), false, "H: Consulter bestaat alleen in ronde 1");

const retry = rounds.createRound(assignment(1), [], seeded());
rounds.markAttempt(retry, items[0], false);
assert.equal(retry.items[items[0]].completed_at, null, "I/J: fout voltooit niet");
assert.equal(retry.items[items[0]].wrong_count, 1);
rounds.markAttempt(retry, items[0], true);
assert.ok(retry.items[items[0]].completed_at, "J: latere zelfstandige correctie voltooit");
rounds.markAttempt(retry, items[0], true);
assert.equal(retry.items[items[0]].wrong_count, 1, "één item telt hoogstens eenmaal voltooid");
const persisted = JSON.parse(JSON.stringify(six));
assert.deepEqual(persisted.selected_item_ids, six.selected_item_ids, "K: serialiseerbare reviewset blijft vast");

const app = fs.readFileSync("app.js", "utf8");
const sql = fs.readFileSync("supabase/phase9-task-rounds.sql", "utf8");
const teacher = fs.readFileSync("teacher.js", "utf8");
assert.match(app, /assignment\.completion_strategy === "rounds"/);
assert.match(app, /requeueRoundQuestion\(question\)/);
assert.match(app, /data-action=\\?"consult-round/);
assert.match(sql, /when mastery_strategy = 'item_mastery' then 'legacy_mastery'/i, "L: bestaande itemtaken blijven legacy");
assert.match(sql, /if completion='rounds' then/i);
assert.match(sql, /previous round incomplete/i);
assert.match(sql, /attempt outside round/i);
assert.match(sql, /pa\.was_correct and pa\.mode='practice'/i, "completion volgt alleen op zelfstandige correcte poging");
assert.match(sql, /alter table public\.assignment_rounds force row level security/i);
assert.match(sql, /alter table public\.assignment_round_items force row level security/i);
assert.match(sql, /revoke all on public\.assignment_rounds,public\.assignment_round_items from public,anon,authenticated/i);
assert.match(sql, /security definer set search_path = ''/i);
assert.doesNotMatch(sql, /grant select on public\.assignment_round/i);
assert.match(teacher, /Aantal rondes/);
assert.match(teacher, /verb-nl-conj/, "N: concrete werkwoorditems mogen vervoegingen oefenen");
assert.match(sql, /v_strategy not in \('legacy_mastery','rounds','verb_rule_mastery'/i, "M: regelstrategie blijft apart");
assert.doesNotMatch(sql, /delete from public\.assignment_completions|drop table public\.practice_attempts/i);
console.log("ADAPTIEVE-RONDES-REGRESSIE GESLAAGD");
