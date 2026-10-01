const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

["teacher.html", "teacher.css", "teacher.js"].forEach(function (file) {
  assert.ok(fs.existsSync(file), file + " ontbreekt");
});

const html = fs.readFileSync("teacher.html", "utf8");
const source = fs.readFileSync("teacher.js", "utf8");
const css = fs.readFileSync("teacher.css", "utf8");
const scriptSources = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map(function (match) { return match[1]; });
const expectedScripts = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "./config.js",
  "./supabase-client.js",
  "./teacher.js"
];

expectedScripts.forEach(function (expected, index) {
  const position = scriptSources.findIndex(function (item) { return item === expected || item.startsWith(expected + "?"); });
  assert.ok(position >= 0, expected + " ontbreekt in teacher.html");
  if (index) {
    const previous = scriptSources.findIndex(function (item) { return item === expectedScripts[index - 1] || item.startsWith(expectedScripts[index - 1] + "?"); });
    assert.ok(position > previous, expected + " staat in de verkeerde volgorde");
  }
});

assert.match(html, /id="loginForm"/);
assert.match(html, /type="email"/);
assert.match(html, /type="password"/);
assert.match(html, /id="logoutButton"/);
assert.match(html, /id="periodFilter"/);
assert.match(html, /id="trajectoryFilter"/);
assert.match(html, /id="modeFilter"/);
assert.match(html, /\.\/teacher\.css/);
assert.doesNotMatch(html, /(?:href|src)="\/(?!\/)/, "lokale assets moeten onder een GitHub Pages-subpad werken");
assert.doesNotMatch(html, /registreren|account aanmaken/i, "er mag geen registratie-interface zijn");

assert.match(source, /auth\.signInWithPassword/);
assert.match(source, /auth\.getSession/);
assert.match(source, /auth\.onAuthStateChange/);
assert.match(source, /auth\.signOut/);
assert.match(source, /if \(!session \|\| !session\.user\)/, "dashboarddata mag niet zonder sessie laden");
assert.match(source, /Moeilijke leerstof/);
assert.match(source, /Moeilijk voor deze leerling/);
assert.match(source, /Sessiegeschiedenis/);
assert.match(source, /Geen moeilijke leerstof/);
assert.match(source, /Geen leerlingen/);
assert.match(source, /Geen recente activiteit/);
assert.match(css, /@media \(max-width:/, "dashboard moet mobiel bruikbaar zijn");

const frontend = html + "\n" + source + "\n" + css;
assert.doesNotMatch(frontend, /service[_-]?role/i);
assert.doesNotMatch(frontend, /secret[_-]?key/i);
const resultColumnBlock = source.slice(source.indexOf("const TABLE_COLUMNS"), source.indexOf("const MANAGEMENT_COLUMNS"));
assert.doesNotMatch(resultColumnBlock, /student_code/i, "normale resultaatqueries mogen geen leerlingcodes laden");
assert.match(source, /MANAGEMENT_COLUMNS[\s\S]*student_code/i, "leerlingcodes mogen uitsluitend via de beheerquery beschikbaar zijn");
assert.doesNotMatch(frontend, /submitted_answer/i, "ingevoerde antwoorden horen niet in fase 3");
assert.doesNotMatch(resultColumnBlock, /owner_id/i, "resultaatqueries mogen owner_id niet nodig hebben");
assert.doesNotMatch(source, /\.eq\(["']owner_id["']/i, "RLS bepaalt het eigenaarschap; de frontend filtert niet op owner_id");
assert.match(source, /owner_id:\s*user\.id/, "een nieuwe klas krijgt de ingelogde gebruiker mee; RLS valideert dit server-side");

const createCalls = [];
const windowObject = {
  MON_PARCOURS_TEACHER_TEST: true,
  MON_PARCOURS_CONFIG: {
    supabaseUrl: "https://schoolproject.supabase.co",
    supabasePublishableKey: "sb_publishable_teacher-test-1234567890"
  },
  supabase: {
    createClient(url, key) {
      createCalls.push({ url, key });
      return { auth: {}, from() {} };
    }
  }
};
const context = vm.createContext({ window: windowObject, console, Intl, Date, Set, Map, Promise, Object, Array, String, Number, Math });
vm.runInContext(source, context, { filename: "teacher.js" });
const api = windowObject.MonParcoursTeacher;
assert.ok(api, "testbare dashboardmodule ontbreekt");

const teacherClient = api.createTeacherClient();
assert.ok(teacherClient);
assert.equal(createCalls.length, 1);
assert.equal(createCalls[0].url, windowObject.MON_PARCOURS_CONFIG.supabaseUrl);
assert.equal(createCalls[0].key, windowObject.MON_PARCOURS_CONFIG.supabasePublishableKey);

const course = {
  trajectories: [
    {
      trajectory: "Trajet 8",
      items: [
        { id: "uf1-item-vocab", type: "vocabulary", trajectory: "genegeerd", top_category: "Atelier Parole", lesson: "Les", block: "À retenir", subsection: "On découvre !", nl: "de buitenwijk", fr: "la banlieue" },
        { id: "uf1-item-phrase", type: "phrase", top_category: "Atelier Parole", lesson: "Les", block: "À retenir", subsection: "Actes de parole", nl: "Hoe heet je?", fr: "Comment tu t’appelles ?", accepted_answers: ["Comment tu t’appelles ?", "Tu t’appelles comment ?"] },
        { id: "uf1-item-number", type: "number", top_category: "Chiffres et lettres", lesson: "De 0 à 100", block: "À retenir", subsection: "Nombres", dynamic_range: true, range: [0, 100] }
      ]
    }
  ]
};
const courseIndex = api.buildCourseIndex(course);
assert.equal(courseIndex["uf1-item-vocab"].trajectory, "Trajet 8", "Trajets moeten uit course.json komen en niet hardcoded zijn");
assert.equal(courseIndex["uf1-item-phrase"].answers.length, 2);
assert.equal(api.describeItem({ item_id: "uf1-item-vocab", correct_answers: [] }, courseIndex).title, "la banlieue — de buitenwijk");

const classes = [{ id: "class-a", name: "Testklas", is_active: true }];
const students = [{ id: "student-a", class_id: "class-a", display_name: "Testleerling", is_active: true }];
const sessions = [
  { id: "session-old", student_id: "student-a", trajectory: "Trajet 8", mode: "learn", question_count: 10, started_at: "2026-08-01T10:00:00Z", finished_at: "2026-08-01T10:10:00Z" },
  { id: "session-new", student_id: "student-a", trajectory: "Trajet 8", mode: "practice", question_count: 20, started_at: "2026-09-28T10:00:00Z", finished_at: "2026-09-28T10:20:00Z" },
  { id: "session-other", student_id: "student-a", trajectory: "Trajet 9", mode: "test", question_count: 5, started_at: "2026-09-29T10:00:00Z", finished_at: "2026-09-29T10:10:00Z" }
];
const attempts = [
  { id: "a1", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-vocab", item_variant: "", was_correct: false, created_at: "2026-09-28T10:01:00Z", correct_answers: ["la banlieue"] },
  { id: "a2", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-vocab", item_variant: "", was_correct: false, created_at: "2026-09-28T10:02:00Z", correct_answers: ["la banlieue"] },
  { id: "a3", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-vocab", item_variant: "", was_correct: true, created_at: "2026-09-28T10:03:00Z", correct_answers: ["la banlieue"] },
  { id: "n17a", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-number", item_variant: "17", was_correct: false, created_at: "2026-09-28T10:04:00Z", correct_answers: ["dix-sept"] },
  { id: "n17b", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-number", item_variant: "17", was_correct: true, created_at: "2026-09-28T10:05:00Z", correct_answers: ["dix-sept"] },
  { id: "n83a", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-number", item_variant: "83", was_correct: false, created_at: "2026-09-28T10:06:00Z", correct_answers: ["quatre-vingt-trois"] },
  { id: "n83b", session_id: "session-new", student_id: "student-a", item_id: "uf1-item-number", item_variant: "83", was_correct: false, created_at: "2026-09-28T10:07:00Z", correct_answers: ["quatre-vingt-trois"] },
  { id: "other", session_id: "session-other", student_id: "student-a", item_id: "uf1-item-phrase", item_variant: "", was_correct: true, created_at: "2026-09-29T10:01:00Z", correct_answers: ["Comment tu t’appelles ?"] }
];
const raw = { classes, students, sessions, attempts };

const lastSeven = api.filterDataset(raw, { period: "7", trajectory: "all", mode: "all" }, "2026-10-01T12:00:00Z");
assert.equal(lastSeven.sessions.length, 2, "periodefilter werkt niet");
const trajectoryFiltered = api.filterDataset(raw, { period: "all", trajectory: "Trajet 9", mode: "all" }, "2026-10-01T12:00:00Z");
assert.equal(trajectoryFiltered.sessions.length, 1, "Trajetfilter werkt niet");
assert.equal(trajectoryFiltered.attempts.length, 1);
const modeFiltered = api.filterDataset(raw, { period: "all", trajectory: "all", mode: "practice" }, "2026-10-01T12:00:00Z");
assert.equal(modeFiltered.sessions.length, 1, "modusfilter werkt niet");
assert.equal(modeFiltered.attempts.length, 7);

const summary = api.summarize(modeFiltered.sessions, modeFiltered.attempts);
assert.equal(summary.questions, 20, "question_count moet uniek geselecteerde vragen optellen");
assert.equal(summary.attempts, 7, "attempt_count moet werkelijke pogingen tellen");
assert.equal(summary.correct, 2);
assert.equal(summary.incorrect, 5);
assert.equal(summary.accuracy, 29, "percentage moet op was_correct van pogingen steunen");
assert.equal(api.classOverview(modeFiltered, classes[0]).attempts, 7);
assert.equal(api.studentOverview(modeFiltered, students[0]).questions, 20);

const difficult = api.difficultItems(modeFiltered.attempts, courseIndex);
assert.equal(difficult.length, 3, "vocabulaire en beide getalvarianten moeten afzonderlijk moeilijk zijn");
assert.ok(difficult.some(function (group) { return group.itemVariant === "17"; }));
assert.ok(difficult.some(function (group) { return group.itemVariant === "83"; }));
assert.notEqual(difficult.find(function (group) { return group.itemVariant === "17"; }).key, difficult.find(function (group) { return group.itemVariant === "83"; }).key);
assert.equal(difficult[0].itemVariant, "83", "hoogste foutpercentage moet eerst komen");
assert.equal(api.describeItem(attempts[3], courseIndex).title, "Getal 17");
assert.equal(api.describeItem(attempts[3], courseIndex).answer, "dix-sept");

const queryCalls = [];
const tableData = { classes, students, practice_sessions: sessions, practice_attempts: attempts };
const rlsClient = {
  from(table) {
    queryCalls.push({ table, columns: null, range: null });
    const call = queryCalls[queryCalls.length - 1];
    return {
      select(columns) {
        call.columns = columns;
        return {
          async range(from, to) {
            call.range = [from, to];
            return { data: tableData[table], error: null };
          }
        };
      }
    };
  }
};

(async function () {
  const loaded = await api.loadRlsDataset(rlsClient);
  assert.equal(loaded.classes.length, 1);
  assert.deepEqual(queryCalls.map(function (call) { return call.table; }).sort(), ["classes", "practice_attempts", "practice_sessions", "students"]);
  queryCalls.forEach(function (call) {
    assert.deepEqual(call.range, [0, 999], "elke query moet efficiënt gepagineerd zijn");
    assert.doesNotMatch(call.columns, /code|submitted|owner|sync_token/i, "query bevat een geheim of overbodig eigenaarsveld");
  });
  console.log("FASE 3 LEERKRACHTENDASHBOARD-REGRESSIE GESLAAGD");
  console.log("Authflow, RLS-queries, klas/leerling/sessie-aggregaties, filters, cursusmapping, privacy en number-varianten gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
