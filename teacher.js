(function () {
  "use strict";

  const PAGE_SIZE = 1000;
  const MODE_LABELS = { learn: "Leren", practice: "Oefenen", test: "Test jezelf" };
  const TABLE_COLUMNS = Object.freeze({
    classes: "id,name,is_active,created_at",
    students: "id,class_id,display_name,is_active,created_at",
    practice_sessions: "id,student_id,client_session_id,trajectory,top_category,lesson,block,subsection,exercise_key,mode,question_count,attempt_count,correct_count,incorrect_count,started_at,finished_at",
    practice_attempts: "id,session_id,student_id,item_id,item_variant,item_type,trajectory,top_category,lesson,block,subsection,exercise_key,mode,correct_answers,was_correct,attempt_number,created_at"
  });

  const state = {
    client: null,
    user: null,
    course: null,
    courseIndex: Object.create(null),
    raw: emptyDataset(),
    filters: { period: "all", trajectory: "all", mode: "all" },
    route: { view: "dashboard", classId: null, studentId: null },
    loading: false,
    loadSequence: 0
  };

  function emptyDataset() {
    return { classes: [], students: [], sessions: [], attempts: [] };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function percentage(correct, total) {
    return total ? Math.round((Number(correct || 0) / total) * 100) : 0;
  }

  function modeLabel(mode) {
    return MODE_LABELS[mode] || mode || "Onbekend";
  }

  function formatDate(value, includeTime) {
    if (!value) return "Nog geen activiteit";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Onbekende datum";
    return new Intl.DateTimeFormat("nl-BE", includeTime === false ? {
      day: "2-digit", month: "2-digit", year: "numeric"
    } : {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function latestDate(rows, fields) {
    let latest = null;
    asArray(rows).forEach(function (row) {
      asArray(fields).forEach(function (field) {
        const time = row[field] ? new Date(row[field]).getTime() : NaN;
        if (!Number.isNaN(time) && (latest === null || time > latest)) latest = time;
      });
    });
    return latest === null ? null : new Date(latest).toISOString();
  }

  function itemAnswers(item) {
    if (!item) return [];
    if (asArray(item.accepted_answers).length) return item.accepted_answers.slice();
    if (item.fr) return [item.fr];
    if (item.answer) return [item.answer];
    if (item.sound && item.example_fr) return [item.sound + " — " + item.example_fr];
    if (item.sound) return [item.sound];
    return [];
  }

  function buildCourseIndex(course) {
    const index = Object.create(null);
    asArray(course && course.trajectories).forEach(function (trajectory) {
      asArray(trajectory.items).forEach(function (item) {
        if (!item.id) return;
        index[item.id] = {
          id: item.id,
          type: item.type || "",
          trajectory: trajectory.trajectory || "",
          top_category: item.top_category || "",
          lesson: item.lesson || "",
          block: item.block || "",
          subsection: item.subsection || "",
          category: item.category || "",
          nl: item.nl || item.prompt || "",
          fr: item.fr || item.answer || "",
          infinitive: item.infinitive || "",
          spelling: item.spelling || "",
          sound: item.sound || "",
          range: item.range || null,
          answers: itemAnswers(item),
          conjugations: asArray(item.conjugations).slice()
        };
      });
    });
    return index;
  }

  function courseTrajectories(course, sessions) {
    const values = [];
    asArray(course && course.trajectories).forEach(function (trajectory) {
      if (trajectory.trajectory && values.indexOf(trajectory.trajectory) < 0) values.push(trajectory.trajectory);
    });
    asArray(sessions).forEach(function (session) {
      if (session.trajectory && values.indexOf(session.trajectory) < 0) values.push(session.trajectory);
    });
    return values;
  }

  function filterDataset(raw, filters, nowValue) {
    const source = raw || emptyDataset();
    const now = nowValue ? new Date(nowValue).getTime() : Date.now();
    const days = filters.period === "7" ? 7 : filters.period === "30" ? 30 : null;
    const threshold = days ? now - days * 24 * 60 * 60 * 1000 : null;
    const sessions = asArray(source.sessions).filter(function (session) {
      const sessionTime = new Date(session.finished_at || session.started_at || 0).getTime();
      if (threshold !== null && (Number.isNaN(sessionTime) || sessionTime < threshold)) return false;
      if (filters.trajectory !== "all" && session.trajectory !== filters.trajectory) return false;
      if (filters.mode !== "all" && session.mode !== filters.mode) return false;
      return true;
    });
    const sessionIds = new Set(sessions.map(function (session) { return session.id; }));
    return {
      classes: asArray(source.classes).slice(),
      students: asArray(source.students).slice(),
      sessions: sessions,
      attempts: asArray(source.attempts).filter(function (attempt) { return sessionIds.has(attempt.session_id); })
    };
  }

  function summarize(sessions, attempts) {
    const attemptRows = asArray(attempts);
    const correct = attemptRows.filter(function (attempt) { return attempt.was_correct === true; }).length;
    return {
      sessions: asArray(sessions).length,
      questions: asArray(sessions).reduce(function (sum, session) { return sum + Number(session.question_count || 0); }, 0),
      attempts: attemptRows.length,
      correct: correct,
      incorrect: attemptRows.length - correct,
      accuracy: percentage(correct, attemptRows.length),
      lastActivity: latestDate(sessions, ["finished_at", "started_at"])
    };
  }

  function classOverview(data, classRow) {
    const students = data.students.filter(function (student) { return student.class_id === classRow.id; });
    const studentIds = new Set(students.map(function (student) { return student.id; }));
    const sessions = data.sessions.filter(function (session) { return studentIds.has(session.student_id); });
    const attempts = data.attempts.filter(function (attempt) { return studentIds.has(attempt.student_id); });
    return Object.assign({
      classRow: classRow,
      students: students,
      activeStudents: students.filter(function (student) { return student.is_active !== false; }).length
    }, summarize(sessions, attempts));
  }

  function studentOverview(data, student) {
    const sessions = data.sessions.filter(function (session) { return session.student_id === student.id; });
    const attempts = data.attempts.filter(function (attempt) { return attempt.student_id === student.id; });
    return Object.assign({ student: student, sessionRows: sessions, attemptRows: attempts }, summarize(sessions, attempts));
  }

  function difficultItems(attempts, courseIndex) {
    const groups = Object.create(null);
    asArray(attempts).forEach(function (attempt) {
      const variant = attempt.item_variant == null ? "" : String(attempt.item_variant);
      const key = String(attempt.item_id || "") + "\u001f" + variant;
      if (!groups[key]) groups[key] = { key: key, itemId: attempt.item_id, itemVariant: variant, attempts: 0, wrong: 0, sample: attempt };
      groups[key].attempts += 1;
      if (attempt.was_correct !== true) groups[key].wrong += 1;
      if (new Date(attempt.created_at || 0).getTime() > new Date(groups[key].sample.created_at || 0).getTime()) groups[key].sample = attempt;
    });
    return Object.keys(groups).map(function (key) {
      const group = groups[key];
      group.wrongPercentage = percentage(group.wrong, group.attempts);
      group.info = describeItem(group.sample, courseIndex);
      return group;
    }).filter(function (group) {
      return group.attempts >= 2 && group.wrongPercentage >= 40;
    }).sort(function (left, right) {
      return right.wrongPercentage - left.wrongPercentage || right.attempts - left.attempts || String(left.itemId).localeCompare(String(right.itemId));
    });
  }

  function describeItem(attempt, courseIndex) {
    const item = courseIndex && courseIndex[attempt.item_id];
    const fallbackAnswers = asArray(attempt.correct_answers).map(String);
    const variant = attempt.item_variant == null ? "" : String(attempt.item_variant);
    if (!item) {
      return {
        title: attempt.prompt || attempt.item_id || "Onbekend cursusitem",
        answer: fallbackAnswers.join(", "),
        path: [attempt.trajectory, attempt.top_category, attempt.lesson, attempt.block, attempt.subsection].filter(Boolean).join(" › "),
        variant: variant
      };
    }
    let title = item.nl || item.fr || item.infinitive || item.spelling || item.id;
    let answers = item.answers.slice();
    if (item.type === "vocabulary") title = [item.fr, item.nl].filter(Boolean).join(" — ");
    if (item.type === "phrase") title = item.nl || item.fr;
    if (item.type === "verb") {
      title = [item.infinitive, item.nl].filter(Boolean).join(" — ");
      const conjugation = item.conjugations.find(function (entry) { return String(entry.subject) === variant; });
      if (conjugation) answers = [conjugation.form];
    }
    if (item.type === "number" && variant) title = "Getal " + variant;
    if (item.type === "sound_rule") title = [item.spelling, item.sound].filter(Boolean).join(" → ");
    if (!answers.length) answers = fallbackAnswers;
    return {
      title: title,
      answer: answers.join(", "),
      path: [item.trajectory, item.top_category, item.lesson, item.block, item.subsection].filter(Boolean).join(" › "),
      variant: variant
    };
  }

  function sessionStats(session, attempts) {
    const rows = asArray(attempts).filter(function (attempt) { return attempt.session_id === session.id; });
    const summary = summarize([session], rows);
    if (!rows.length) {
      summary.attempts = Number(session.attempt_count || 0);
      summary.correct = Number(session.correct_count || 0);
      summary.incorrect = Number(session.incorrect_count || 0);
      summary.accuracy = percentage(summary.correct, summary.attempts);
    }
    return summary;
  }

  async function fetchAll(client, table, columns) {
    const rows = [];
    let from = 0;
    while (true) {
      const result = await client.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      const page = asArray(result.data);
      Array.prototype.push.apply(rows, page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }

  async function loadRlsDataset(client) {
    const results = await Promise.all([
      fetchAll(client, "classes", TABLE_COLUMNS.classes),
      fetchAll(client, "students", TABLE_COLUMNS.students),
      fetchAll(client, "practice_sessions", TABLE_COLUMNS.practice_sessions),
      fetchAll(client, "practice_attempts", TABLE_COLUMNS.practice_attempts)
    ]);
    return { classes: results[0], students: results[1], sessions: results[2], attempts: results[3] };
  }

  function statCard(label, value, note) {
    return '<article class="stat-card"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(value) + '</strong>' + (note ? '<span>' + escapeHtml(note) + '</span>' : "") + '</article>';
  }

  function emptyState(title, text) {
    return '<div class="empty-state"><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(text) + '</p></div>';
  }

  function breadcrumbs(parts) {
    return '<nav class="breadcrumbs" aria-label="Kruimelpad">' + parts.map(function (part, index) {
      const separator = index ? '<span aria-hidden="true">/</span>' : "";
      return separator + (part.action ? '<button type="button" data-action="' + escapeHtml(part.action) + '"' + (part.id ? ' data-id="' + escapeHtml(part.id) + '"' : "") + '>' + escapeHtml(part.label) + '</button>' : '<strong>' + escapeHtml(part.label) + '</strong>');
    }).join("") + '</nav>';
  }

  function renderSummaryCards(data) {
    const summary = summarize(data.sessions, data.attempts);
    const activeClasses = data.classes.filter(function (row) { return row.is_active !== false; }).length;
    const activeStudents = data.students.filter(function (row) { return row.is_active !== false; }).length;
    return '<section class="stat-grid" aria-label="Overzichtscijfers">' +
      statCard("Klassen", activeClasses, "actief") +
      statCard("Leerlingen", activeStudents, "actief") +
      statCard("Sessies", summary.sessions, "geselecteerde periode") +
      statCard("Pogingen", summary.attempts, "inclusief herhalingen") +
      statCard("Correct", summary.accuracy + "%", summary.correct + " van " + summary.attempts + " pogingen") +
      '</section>';
  }

  function renderDashboard(data) {
    const cards = data.classes.map(function (classRow) {
      const overview = classOverview(data, classRow);
      return '<button class="class-card" type="button" data-action="view-class" data-id="' + escapeHtml(classRow.id) + '">' +
        '<span class="class-card-head"><span><h3>' + escapeHtml(classRow.name) + '</h3><span class="muted">Laatste activiteit: ' + escapeHtml(formatDate(overview.lastActivity)) + '</span></span><span class="pill">' + overview.activeStudents + ' leerlingen</span></span>' +
        '<span class="class-metrics"><span><strong>' + overview.sessions + '</strong>sessies</span><span><strong>' + overview.attempts + '</strong>pogingen</span><span><strong>' + overview.accuracy + '%</strong>correct</span></span>' +
        '</button>';
    }).join("");
    return renderSummaryCards(data) + '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">Mijn klassen</p><h2>Klassenoverzicht</h2></div></div>' + (cards ? '<div class="class-grid">' + cards + '</div>' : emptyState("Nog geen klassen", "Supabase gaf voor dit leerkrachtenaccount geen klassen terug.")) + '</section>';
  }

  function renderDifficult(groups, title) {
    if (!groups.length) return '<section class="panel"><h3>' + escapeHtml(title) + '</h3>' + emptyState("Geen moeilijke leerstof", "Er zijn binnen deze filters geen items met minstens 2 pogingen en 40% fout.") + '</section>';
    return '<section class="panel"><h3>' + escapeHtml(title) + '</h3><ul class="difficult-list">' + groups.slice(0, 20).map(function (group) {
      return '<li class="difficult-item"><strong>' + escapeHtml(group.info.title) + '</strong>' +
        (group.info.answer ? '<span class="answer-line">→ ' + escapeHtml(group.info.answer) + '</span>' : "") +
        '<span>' + escapeHtml(group.info.path) + (group.info.variant ? ' · variant ' + escapeHtml(group.info.variant) : "") + '</span>' +
        '<span class="difficult-score">' + group.wrong + ' fout / ' + group.attempts + ' pogingen — ' + group.wrongPercentage + '% fout</span></li>';
    }).join("") + '</ul></section>';
  }

  function renderClassDetail(data, classId) {
    const classRow = data.classes.find(function (row) { return row.id === classId; });
    if (!classRow) return emptyState("Klas niet gevonden", "Deze klas valt niet binnen de huidige RLS-resultaten.");
    const overview = classOverview(data, classRow);
    const studentIds = new Set(overview.students.map(function (student) { return student.id; }));
    const classAttempts = data.attempts.filter(function (attempt) { return studentIds.has(attempt.student_id); });
    const rows = overview.students.map(function (student) {
      const result = studentOverview(data, student);
      return '<tr><td><button class="link-button" type="button" data-action="view-student" data-id="' + escapeHtml(student.id) + '">' + escapeHtml(student.display_name || "Naamloze leerling") + '</button></td><td>' + result.sessions + '</td><td>' + result.attempts + '</td><td>' + result.accuracy + '%</td><td>' + escapeHtml(formatDate(result.lastActivity)) + '</td></tr>';
    }).join("");
    const recent = overview.students.length ? data.sessions.filter(function (session) { return studentIds.has(session.student_id); }).sort(function (left, right) { return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at); }).slice(0, 8) : [];
    const studentById = Object.create(null);
    overview.students.forEach(function (student) { studentById[student.id] = student; });
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: classRow.name }]) +
      '<div class="page-heading"><div><p class="eyebrow">Klasdetail</p><h2>' + escapeHtml(classRow.name) + '</h2><p class="muted">' + overview.activeStudents + ' actieve leerlingen</p></div></div>' +
      '<section class="stat-grid">' + statCard("Leerlingen", overview.activeStudents, "actief") + statCard("Sessies", overview.sessions) + statCard("Vragen", overview.questions, "uniek geselecteerd") + statCard("Pogingen", overview.attempts, "incl. herhalingen") + statCard("Correct", overview.accuracy + "%") + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><h2>Leerlingen</h2><p>Klik op een leerling voor sessies en moeilijke items.</p></div></div>' +
      (rows ? '<div class="table-wrap"><table><thead><tr><th>Leerling</th><th>Sessies</th><th>Pogingen</th><th>Correct</th><th>Laatste oefening</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : emptyState("Geen leerlingen", "Supabase gaf voor deze klas geen leerlingen terug.")) + '</section>' +
      '<div class="two-column section-block"><section class="panel"><h3>Recente activiteit</h3>' + (recent.length ? '<ul class="activity-list">' + recent.map(function (session) {
        const student = studentById[session.student_id];
        return '<li class="activity-item"><strong>' + escapeHtml(student && student.display_name || "Naamloze leerling") + ' · ' + escapeHtml(modeLabel(session.mode)) + '</strong><span>' + escapeHtml([session.trajectory, session.top_category, session.lesson].filter(Boolean).join(" › ")) + '</span><span>' + escapeHtml(formatDate(session.finished_at || session.started_at)) + '</span></li>';
      }).join("") + '</ul>' : emptyState("Geen recente activiteit", "Binnen de gekozen filters zijn geen sessies gevonden.")) + '</section>' + renderDifficult(difficultItems(classAttempts, state.courseIndex), "Moeilijke leerstof") + '</div>';
  }

  function renderSessionCard(session, attempts) {
    const stats = sessionStats(session, attempts);
    const sessionAttempts = attempts.filter(function (attempt) { return attempt.session_id === session.id; }).sort(function (left, right) { return new Date(left.created_at) - new Date(right.created_at); });
    const path = [session.trajectory, session.top_category, session.lesson, session.block, session.subsection].filter(Boolean).join(" › ");
    const details = sessionAttempts.length ? '<ul class="attempt-list">' + sessionAttempts.map(function (attempt) {
      const info = describeItem(attempt, state.courseIndex);
      return '<li><span class="attempt-mark' + (attempt.was_correct ? "" : " wrong") + '" aria-label="' + (attempt.was_correct ? "Juist" : "Fout") + '">' + (attempt.was_correct ? "✓" : "!") + '</span><span class="attempt-copy"><strong>' + escapeHtml(info.title) + '</strong>' + (info.answer ? '<span>Modelantwoord: ' + escapeHtml(info.answer) + '</span>' : "") + (info.variant ? '<span>Variant: ' + escapeHtml(info.variant) + '</span>' : "") + '</span><span>Poging ' + Number(attempt.attempt_number || 1) + '</span></li>';
    }).join("") + '</ul>' : emptyState("Geen pogingsdetails", "Voor deze sessie gaf Supabase geen afzonderlijke pogingen terug.");
    return '<details class="session-card"><summary><span class="session-title"><strong>' + escapeHtml(modeLabel(session.mode)) + ' · ' + escapeHtml(session.trajectory) + '</strong><span>' + escapeHtml(formatDate(session.finished_at || session.started_at)) + '</span></span><span class="session-metric"><small>Vragen</small><strong>' + Number(session.question_count || 0) + '</strong></span><span class="session-metric"><small>Pogingen</small><strong>' + stats.attempts + '</strong></span><span class="session-metric"><small>Juist / fout</small><strong>' + stats.correct + ' / ' + stats.incorrect + '</strong></span><span class="session-metric"><small>Correct</small><strong>' + stats.accuracy + '%</strong></span></summary><div class="session-detail"><p class="muted">' + escapeHtml(path) + '</p>' + details + '</div></details>';
  }

  function renderStudentDetail(data, studentId) {
    const student = data.students.find(function (row) { return row.id === studentId; });
    if (!student) return emptyState("Leerling niet gevonden", "Deze leerling valt niet binnen de huidige RLS-resultaten.");
    const classRow = data.classes.find(function (row) { return row.id === student.class_id; });
    const overview = studentOverview(data, student);
    const sessions = overview.sessionRows.slice().sort(function (left, right) { return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at); });
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: classRow ? classRow.name : "Klas", action: "view-class", id: student.class_id }, { label: student.display_name || "Naamloze leerling" }]) +
      '<div class="page-heading"><div><p class="eyebrow">Leerlingdetail</p><h2>' + escapeHtml(student.display_name || "Naamloze leerling") + '</h2><p class="muted">' + escapeHtml(classRow ? classRow.name : "Onbekende klas") + ' · laatste activiteit ' + escapeHtml(formatDate(overview.lastActivity)) + '</p></div></div>' +
      '<section class="stat-grid">' + statCard("Sessies", overview.sessions) + statCard("Vragen", overview.questions, "uniek geselecteerd") + statCard("Pogingen", overview.attempts, "incl. herhalingen") + statCard("Juist / fout", overview.correct + " / " + overview.incorrect) + statCard("Correct", overview.accuracy + "%") + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><h2>Sessiegeschiedenis</h2><p>Open een sessie voor itemdetails en modelantwoorden.</p></div></div><div class="session-list">' + (sessions.length ? sessions.map(function (session) { return renderSessionCard(session, overview.attemptRows); }).join("") : emptyState("Nog geen sessies", "Binnen de gekozen filters zijn voor deze leerling geen sessies gevonden.")) + '</div></section>' +
      '<section class="section-block">' + renderDifficult(difficultItems(overview.attemptRows, state.courseIndex), "Moeilijk voor deze leerling") + '</section>';
  }

  function currentFilteredData() {
    return filterDataset(state.raw, state.filters);
  }

  function renderCurrent() {
    const content = document.querySelector("#dashboardContent");
    if (!content || !state.user) return;
    const data = currentFilteredData();
    if (state.route.view === "class") content.innerHTML = renderClassDetail(data, state.route.classId);
    else if (state.route.view === "student") content.innerHTML = renderStudentDetail(data, state.route.studentId);
    else content.innerHTML = renderDashboard(data);
  }

  function populateFilters() {
    const trajectorySelect = document.querySelector("#trajectoryFilter");
    const modeSelect = document.querySelector("#modeFilter");
    const trajectories = courseTrajectories(state.course, state.raw.sessions);
    const modes = Array.from(new Set(state.raw.sessions.map(function (session) { return session.mode; }).filter(Boolean)));
    trajectorySelect.innerHTML = '<option value="all">Alle Trajets</option>' + trajectories.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    modeSelect.innerHTML = '<option value="all">Alle modi</option>' + modes.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(modeLabel(value)) + '</option>'; }).join("");
    if (trajectories.indexOf(state.filters.trajectory) < 0) state.filters.trajectory = "all";
    if (modes.indexOf(state.filters.mode) < 0) state.filters.mode = "all";
    trajectorySelect.value = state.filters.trajectory;
    modeSelect.value = state.filters.mode;
  }

  function showLogin(message) {
    state.user = null;
    state.raw = emptyDataset();
    state.route = { view: "dashboard", classId: null, studentId: null };
    document.querySelector("#authView").hidden = false;
    document.querySelector("#dashboardView").hidden = true;
    document.querySelector("#accountArea").hidden = true;
    document.querySelector("#dashboardContent").innerHTML = "";
    document.querySelector("#loginMessage").textContent = message || "";
  }

  function displayNameForUser(user) {
    const metadata = user && user.user_metadata || {};
    const name = metadata.full_name || metadata.name || "";
    if (name && user.email) return name + " · " + user.email;
    return name || user.email || "Leerkracht";
  }

  async function showDashboardForSession(session, forceReload) {
    if (!session || !session.user) {
      showLogin();
      return;
    }
    const sameUser = state.user && state.user.id === session.user.id;
    state.user = session.user;
    document.querySelector("#authView").hidden = true;
    document.querySelector("#dashboardView").hidden = false;
    document.querySelector("#accountArea").hidden = false;
    document.querySelector("#accountLabel").textContent = displayNameForUser(session.user);
    document.querySelector("#loginMessage").textContent = "";
    if (sameUser && state.loading && !forceReload) return;
    if (sameUser && !forceReload && state.raw.classes.length + state.raw.students.length + state.raw.sessions.length + state.raw.attempts.length > 0) {
      renderCurrent();
      return;
    }
    const sequence = ++state.loadSequence;
    state.loading = true;
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Resultaten worden veilig geladen…</p></section>';
    try {
      const dataset = await loadRlsDataset(state.client);
      if (sequence !== state.loadSequence || !state.user) return;
      state.raw = dataset;
      populateFilters();
      renderCurrent();
    } catch (error) {
      if (sequence !== state.loadSequence) return;
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Dashboard kon niet worden geladen.</strong><p>Controleer je verbinding en de RLS-toegang in Supabase en probeer opnieuw.</p></div>';
    } finally {
      if (sequence === state.loadSequence) state.loading = false;
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const message = document.querySelector("#loginMessage");
    const formData = new FormData(form);
    submit.disabled = true;
    message.textContent = "Aanmelden…";
    try {
      const result = await state.client.auth.signInWithPassword({
        email: String(formData.get("email") || "").trim(),
        password: String(formData.get("password") || "")
      });
      if (result.error) throw result.error;
      if (!state.user || state.user.id !== result.data.session.user.id) {
        await showDashboardForSession(result.data.session, true);
      }
      form.reset();
    } catch (error) {
      message.textContent = "Aanmelden mislukt. Controleer je e-mailadres en wachtwoord.";
    } finally {
      submit.disabled = false;
    }
  }

  async function handleLogout() {
    const button = document.querySelector("#logoutButton");
    button.disabled = true;
    try {
      const result = await state.client.auth.signOut();
      if (result.error) throw result.error;
      showLogin();
    } catch (error) {
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Afmelden is niet gelukt.</strong><p>Probeer opnieuw.</p></div>';
    } finally {
      button.disabled = false;
    }
  }

  function handleContentClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "view-dashboard") state.route = { view: "dashboard", classId: null, studentId: null };
    if (action === "view-class") state.route = { view: "class", classId: target.dataset.id, studentId: null };
    if (action === "view-student") {
      const student = state.raw.students.find(function (row) { return row.id === target.dataset.id; });
      state.route = { view: "student", classId: student && student.class_id || null, studentId: target.dataset.id };
    }
    renderCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFilters() {
    state.filters = {
      period: document.querySelector("#periodFilter").value,
      trajectory: document.querySelector("#trajectoryFilter").value,
      mode: document.querySelector("#modeFilter").value
    };
    renderCurrent();
  }

  async function loadCourse() {
    try {
      const response = await fetch("./data/course.json");
      if (!response.ok) throw new Error("COURSE_LOAD_FAILED");
      state.course = await response.json();
      state.courseIndex = buildCourseIndex(state.course);
    } catch (error) {
      state.course = { trajectories: [] };
      state.courseIndex = Object.create(null);
    }
  }

  function createTeacherClient() {
    const config = window.MON_PARCOURS_CONFIG || {};
    const url = String(config.supabaseUrl || "").trim();
    const key = String(config.supabasePublishableKey || "").trim();
    if (!url || !key || !window.supabase || typeof window.supabase.createClient !== "function") return null;
    return window.supabase.createClient(url, key);
  }

  async function init() {
    state.client = createTeacherClient();
    document.querySelector("#loginForm").addEventListener("submit", handleLogin);
    document.querySelector("#logoutButton").addEventListener("click", handleLogout);
    document.querySelector("#refreshButton").addEventListener("click", function () {
      if (state.user) showDashboardForSession({ user: state.user }, true);
    });
    document.querySelector("#filterBar").addEventListener("change", handleFilters);
    document.querySelector("#dashboardContent").addEventListener("click", handleContentClick);
    if (!state.client) {
      document.querySelector("#loginMessage").textContent = "Supabase is niet geconfigureerd. De leerlingentool blijft wel lokaal bruikbaar.";
      document.querySelector('#loginForm button[type="submit"]').disabled = true;
      return;
    }
    await loadCourse();
    const initial = await state.client.auth.getSession();
    if (initial.error) showLogin("De bestaande sessie kon niet worden gecontroleerd. Meld opnieuw aan.");
    else await showDashboardForSession(initial.data.session, false);
    state.client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        showLogin();
        return;
      }
      if (session && session.user && (!state.user || state.user.id !== session.user.id)) {
        Promise.resolve().then(function () { return showDashboardForSession(session, false); });
      }
    });
  }

  window.MonParcoursTeacher = Object.freeze({
    buildCourseIndex: buildCourseIndex,
    filterDataset: filterDataset,
    summarize: summarize,
    classOverview: classOverview,
    studentOverview: studentOverview,
    difficultItems: difficultItems,
    describeItem: describeItem,
    sessionStats: sessionStats,
    percentage: percentage,
    loadRlsDataset: loadRlsDataset,
    createTeacherClient: createTeacherClient,
    tableColumns: TABLE_COLUMNS
  });

  if (!window.MON_PARCOURS_TEACHER_TEST) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
