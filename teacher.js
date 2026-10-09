(function () {
  "use strict";

  const PAGE_SIZE = 1000;
  const MODE_LABELS = { learn: "Leren", practice: "Oefenen", test: "Test jezelf" };
  const TABLE_COLUMNS = Object.freeze({
    classes: "id,name,is_active,created_at",
    students: "id,class_id,display_name,is_active,created_at",
    practice_sessions: "id,student_id,client_session_id,trajectory,top_category,lesson,block,subsection,exercise_key,mode,question_count,attempt_count,correct_count,incorrect_count,active_duration_seconds,started_at,finished_at",
    practice_attempts: "id,session_id,student_id,item_id,equivalent_item_ids,item_variant,item_type,trajectory,top_category,lesson,block,subsection,exercise_key,mode,correct_answers,was_correct,attempt_number,created_at"
  });
  const MANAGEMENT_COLUMNS = Object.freeze({
    classes: "id,name,class_code,is_active,created_at,updated_at",
    students: "id,class_id,display_name,school_email,student_code,is_active,created_at,updated_at"
  });
  const ACCESS_COLUMNS = Object.freeze({
    teachers: "auth_user_id,email,display_name,role,is_active,created_at,updated_at",
    class_teachers: "class_id,teacher_id,created_at"
  });
  const STUDENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const ACTIVE_NOW_THRESHOLD_SECONDS = 180;
  const STUCK_MIN_ATTEMPTS = 5;
  const STUCK_ACCURACY_PERCENT = 40;
  const MONITOR_REFRESH_MS = 30000;
  const MASTERY_REFRESH_MS = 5 * 60 * 1000;

  const state = {
    client: null,
    user: null,
    teacherProfile: null,
    course: null,
    courseIndex: Object.create(null),
    raw: emptyDataset(),
    filters: { period: "today", trajectory: "all", mode: "all", classId: "all", studentId: "all", studentStatus: "active", category: "all", subsection: "all", assignmentId: "all" },
    monitorSort: "auto",
    monitorQuickFilter: "all",
    monitor: { rows: [], error: "", loading: false, pending: false, masteryByStudent: Object.create(null), masteryRefreshedAt: 0 },
    analyticsLoaded: false,
    studentVerbGoals: Object.create(null),
    studentVerbGoalsError: false,
    lastRefreshedAt: null,
    autoRefreshTimer: null,
    route: { view: "dashboard", classId: null, studentId: null },
    management: { loaded: false, classes: [], students: [], selectedClassId: null, studentStatus: "active", generatedCode: "", createdStudents: [], message: "", messageIsError: false },
    teacherAdmin: { loaded: false, teachers: [], assignments: [], classes: [], editingTeacherId: null, message: "", messageIsError: false },
    tasks: { loaded: false, list: [], detail: [], reports: [], selectedId: null, draft: null, filter: "all",
      ownerFilter: "mine", archiveOpen: false, archiveFilters: { classId: "all", creatorId: "all", period: "all", query: "" },
      message: "", error: false },
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

  function currentTeacherIsAdmin() {
    return Boolean(state.teacherProfile && state.teacherProfile.is_active === true && state.teacherProfile.role === "admin");
  }

  function percentage(correct, total) {
    return total ? Math.round((Number(correct || 0) / total) * 100) : 0;
  }

  function formatActiveDuration(value) {
    if (value === null || value === undefined || value === "") return "—";
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    if (seconds < 60) return seconds + " s";
    if (seconds < 3600) return Math.floor(seconds / 60) + " min " + String(seconds % 60).padStart(2, "0") + " s";
    return Math.floor(seconds / 3600) + " u " + String(Math.floor((seconds % 3600) / 60)).padStart(2, "0") + " min";
  }

  function formatMonitorDuration(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    if (!seconds) return "0 min";
    if (seconds < 60) return "< 1 min";
    if (seconds < 3600) return Math.floor(seconds / 60) + " min";
    return Math.floor(seconds / 3600) + " u " + String(Math.floor((seconds % 3600) / 60)).padStart(2, "0") + " min";
  }

  function exerciseIdentity(attempt) {
    return String(attempt.session_id || "") + "\u001e" + String(attempt.item_id || "") + "\u001f" + String(attempt.item_variant == null ? "" : attempt.item_variant);
  }

  function completedExerciseCount(attempts) {
    return new Set(asArray(attempts).map(exerciseIdentity)).size;
  }

  function normalizeClassCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeSchoolEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validateSchoolEmail(value, allowEmpty) {
    const email = normalizeSchoolEmail(value);
    if (!email && allowEmpty) return { valid: true, email: null };
    if (!/^[^@\s]+@camposturnhout\.be$/.test(email) || email.length > 254) {
      return { valid: false, message: "Gebruik een geldig adres dat eindigt op @camposturnhout.be." };
    }
    return { valid: true, email: email };
  }

  function suggestSchoolEmail(displayName) {
    const parts = String(displayName || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/).map(function (part) {
      return part.replace(/[^a-z0-9]/g, "");
    }).filter(Boolean);
    if (parts.length < 2) return "";
    const familyName = parts[parts.length - 1];
    const givenNames = parts.slice(0, -1).join("");
    return familyName + givenNames + "@camposturnhout.be";
  }

  function validateClassInput(name, code) {
    const normalizedName = String(name || "").trim();
    const normalizedCode = normalizeClassCode(code);
    if (!normalizedName || normalizedName.length > 80) return { valid: false, message: "Geef een klasnaam van maximaal 80 tekens." };
    if (!/^[A-Z0-9-]{2,20}$/.test(normalizedCode)) return { valid: false, message: "De klascode moet 2–20 tekens bevatten: hoofdletters, cijfers of een streepje." };
    return { valid: true, name: normalizedName, code: normalizedCode };
  }

  function generateStudentCode(length, cryptoObject) {
    const size = Math.max(12, Number(length || 12));
    const secureCrypto = cryptoObject || window.crypto;
    if (!secureCrypto || typeof secureCrypto.getRandomValues !== "function") throw new Error("SECURE_RANDOM_UNAVAILABLE");
    let result = "";
    const limit = 256 - (256 % STUDENT_CODE_ALPHABET.length);
    while (result.length < size) {
      const bytes = new Uint8Array((size - result.length) * 2);
      secureCrypto.getRandomValues(bytes);
      for (let index = 0; index < bytes.length && result.length < size; index += 1) {
        if (bytes[index] < limit) result += STUDENT_CODE_ALPHABET[bytes[index] % STUDENT_CODE_ALPHABET.length];
      }
    }
    return result;
  }

  function parseBulkNames(value) {
    const seen = new Set();
    return String(value || "").split(/\r?\n/).map(function (name) { return name.trim(); }).filter(function (name) {
      const key = name.toLocaleLowerCase("nl-BE");
      if (!name || name.length > 80 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseBulkStudents(value) {
    const seen = new Set();
    return String(value || "").split(/\r?\n/).map(function (line) {
      const parts = line.split(";");
      const name = String(parts.shift() || "").trim();
      const suppliedEmail = normalizeSchoolEmail(parts.join(";"));
      return { name: name, schoolEmail: suppliedEmail || suggestSchoolEmail(name) };
    }).filter(function (student) {
      const key = student.name.toLocaleLowerCase("nl-BE");
      if (!student.name || student.name.length > 80 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function protectCsvValue(value) {
    const text = String(value == null ? "" : value);
    return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
  }

  function csvCell(value) {
    return '"' + protectCsvValue(value).replace(/"/g, '""') + '"';
  }

  function makeCsv(headers, rows) {
    const lines = [headers.map(csvCell).join(";")];
    asArray(rows).forEach(function (row) { lines.push(row.map(csvCell).join(";")); });
    return "\uFEFF" + lines.join("\r\n");
  }

  function downloadCsv(filename, headers, rows) {
    const blob = new Blob([makeCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function modeLabel(mode) {
    return MODE_LABELS[mode] || mode || "Onbekend";
  }

  function formatDate(value, includeTime) {
    if (!value) return "Nog geen activiteit";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Onbekende datum";
    return new Intl.DateTimeFormat("nl-BE", includeTime === false ? {
      timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric"
    } : {
      timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function brusselsDateParts(value) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  }

  function brusselsMidnight(parts, shiftDays) {
    const midnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day + shiftDays);
    const timezone = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Brussels", timeZoneName: "shortOffset" })
      .formatToParts(new Date(midnightUtc)).find(function (part) { return part.type === "timeZoneName"; });
    const offset = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(timezone && timezone.value || "");
    const offsetMinutes = offset ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] || 0)) : 0;
    return midnightUtc - offsetMinutes * 60000;
  }

  function relativeActivity(value, nowValue) {
    if (!value) return "—";
    const time = new Date(value).getTime();
    const now = new Date(nowValue || Date.now()).getTime();
    if (!Number.isFinite(time)) return "—";
    const elapsed = Math.max(0, Math.floor((now - time) / 60000));
    if (elapsed < 1) return "nu";
    if (elapsed < 60) return elapsed + " min geleden";
    const today = brusselsDateParts(now), activity = brusselsDateParts(time);
    const clock = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(new Date(time));
    if (activity.year === today.year && activity.month === today.month && activity.day === today.day) return "vandaag " + clock;
    const yesterday = brusselsDateParts(brusselsMidnight(today, -1) + 12 * 3600000);
    if (activity.year === yesterday.year && activity.month === yesterday.month && activity.day === yesterday.day) return "gisteren " + clock;
    return formatDate(value);
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

  function periodBounds(period, nowValue) {
    const now = new Date(nowValue || Date.now());
    const end = now.getTime();
    if (period === "15m" || period === "30m" || period === "60m") {
      return { start: end - Number(period.slice(0, -1)) * 60 * 1000, end: end };
    }
    if (period === "today" || period === "yesterday") {
      const parts = brusselsDateParts(end);
      const today = brusselsMidnight(parts, 0);
      return period === "today"
        ? { start: today, end: end }
        : { start: brusselsMidnight(parts, -1), end: today };
    }
    if (period === "7" || period === "30") return { start: end - Number(period) * 24 * 60 * 60 * 1000, end: end };
    return { start: null, end: null };
  }

  function dateWithinBounds(value, bounds) {
    if (bounds.start === null) return true;
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time >= bounds.start && time < bounds.end;
  }

  function filterDataset(raw, filters, nowValue) {
    const source = raw || emptyDataset();
    const classId = filters.classId || "all";
    const studentId = filters.studentId || "all";
    const studentStatus = filters.studentStatus || "active";
    const category = filters.category || "all";
    const subsection = filters.subsection || "all";
    const bounds = periodBounds(filters.period, nowValue);
    const students = asArray(source.students).filter(function (student) {
      if (classId !== "all" && student.class_id !== classId) return false;
      if (studentId !== "all" && student.id !== studentId) return false;
      if (studentStatus === "active" && student.is_active === false) return false;
      if (studentStatus === "inactive" && student.is_active !== false) return false;
      return true;
    });
    const studentIds = new Set(students.map(function (student) { return student.id; }));
    const classes = asArray(source.classes).filter(function (classRow) {
      return classId === "all" ? (studentId === "all" || students.some(function (student) { return student.class_id === classRow.id; })) : classRow.id === classId;
    });
    const recentAttemptSessionIds = new Set(asArray(source.attempts).filter(function (attempt) {
      return studentIds.has(attempt.student_id) && dateWithinBounds(attempt.created_at, bounds);
    }).map(function (attempt) { return attempt.session_id; }));
    const sessions = asArray(source.sessions).filter(function (session) {
      if (!studentIds.has(session.student_id)) return false;
      if (!dateWithinBounds(session.finished_at || session.started_at, bounds) && !recentAttemptSessionIds.has(session.id)) return false;
      if (filters.trajectory !== "all" && session.trajectory !== filters.trajectory) return false;
      if (filters.mode !== "all" && session.mode !== filters.mode) return false;
      if (category !== "all" && session.top_category !== category) return false;
      if (subsection !== "all" && session.subsection !== subsection) return false;
      return true;
    });
    const sessionIds = new Set(sessions.map(function (session) { return session.id; }));
    return {
      classes: classes,
      students: students,
      sessions: sessions,
      attempts: asArray(source.attempts).filter(function (attempt) {
        return sessionIds.has(attempt.session_id) && dateWithinBounds(attempt.created_at, bounds);
      })
    };
  }

  function summarize(sessions, attempts) {
    const sessionRows = asArray(sessions);
    const attemptRows = asArray(attempts);
    const correct = attemptRows.filter(function (attempt) { return attempt.was_correct === true; }).length;
    const measuredSessions = sessionRows.filter(function (session) { return session.active_duration_seconds !== null && session.active_duration_seconds !== undefined; });
    return {
      sessions: sessionRows.length,
      questions: sessionRows.reduce(function (sum, session) { return sum + Number(session.question_count || 0); }, 0),
      exercisesMade: completedExerciseCount(attemptRows),
      attempts: attemptRows.length,
      correct: correct,
      incorrect: attemptRows.length - correct,
      accuracy: percentage(correct, attemptRows.length),
      activeDurationSeconds: measuredSessions.reduce(function (sum, session) { return sum + Math.max(0, Number(session.active_duration_seconds || 0)); }, 0),
      hasMeasuredDuration: measuredSessions.length > 0,
      lastActivity: latestDate(sessionRows.concat(attemptRows), ["created_at", "finished_at", "started_at"])
    };
  }

  function classMonitor(data, classId, nowValue) {
    const students = asArray(data.students).filter(function (student) { return student.class_id === classId && student.is_active !== false; });
    return students.map(function (student) {
      const overview = studentOverview(data, student);
      const unfinished = overview.sessionRows.some(function (session) { return !session.finished_at; });
      const recent = overview.lastActivity && new Date(nowValue || Date.now()).getTime() - new Date(overview.lastActivity).getTime() <= ACTIVE_NOW_THRESHOLD_SECONDS * 1000;
      return Object.assign({}, overview, {
        status: unfinished && recent ? "Bezig" : overview.exercisesMade > 0 ? "Geoefend" : "Nog niet gestart"
      });
    });
  }

  function sortClassMonitor(rows, sortValue) {
    const statusOrder = { "Nog niet gestart": 0, "Bezig": 1, "Geoefend": 2 };
    const sort = sortValue === "auto" ? "status" : sortValue;
    return asArray(rows).slice().sort(function (left, right) {
      if (sort === "name") return String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "last") return new Date(right.lastActivity || 0) - new Date(left.lastActivity || 0) || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "made") return right.exercisesMade - left.exercisesMade || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "time") return right.activeDurationSeconds - left.activeDurationSeconds || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "correct") return (right.attempts ? right.accuracy : -1) - (left.attempts ? left.accuracy : -1) || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "mastery") return Number(right.masteryPercentage || 0) - Number(left.masteryPercentage || 0) || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      if (sort === "task") return Number(right.activeAssignmentCount || 0) - Number(left.activeAssignmentCount || 0) || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
      return statusOrder[left.status] - statusOrder[right.status] || String(left.student.display_name || "").localeCompare(String(right.student.display_name || ""), "nl");
    });
  }

  function normalizeMonitorRows(rows, nowValue, masteryCache) {
    const now = new Date(nowValue || Date.now()).getTime();
    return asArray(rows).map(function (row) {
      const lastActivity = row.last_activity_at || null;
      const recent = lastActivity && Math.abs(now - new Date(lastActivity).getTime()) <= ACTIVE_NOW_THRESHOLD_SECONDS * 1000;
      const exercisesMade = Number(row.unique_exercises || 0);
      const independentAttempts = Number(row.independent_attempts || 0);
      const independentCorrect = Number(row.independent_correct || 0);
      const currentMastery = row.current_mastery_percentage == null
        ? masteryCache && masteryCache[row.student_id] : Number(row.current_mastery_percentage);
      return {
        student: { id: row.student_id, class_id: row.class_id, display_name: row.display_name },
        status: row.is_active === false ? "Inactief" : recent && row.recent_open_session ? "Bezig" : exercisesMade ? "Geoefend" : "Nog niet gestart",
        exercisesMade: exercisesMade,
        attempts: Number(row.attempt_count || 0),
        activeDurationSeconds: Number(row.active_seconds || 0),
        lastActivity: lastActivity,
        accuracy: independentAttempts ? percentage(independentCorrect, independentAttempts) : null,
        independentAttempts: independentAttempts,
        independentCorrect: independentCorrect,
        masteryPercentage: currentMastery == null ? null : Number(currentMastery),
        activeAssignmentCount: Number(row.active_assignment_count || 0),
        activeAssignment: row.active_assignment || null,
        mayBeStuck: independentAttempts >= STUCK_MIN_ATTEMPTS && percentage(independentCorrect, independentAttempts) < STUCK_ACCURACY_PERCENT
      };
    });
  }

  function monitorSummary(rows) {
    const values = asArray(rows);
    const attempts = values.reduce(function (sum, row) { return sum + row.independentAttempts; }, 0);
    const correct = values.reduce(function (sum, row) { return sum + row.independentCorrect; }, 0);
    return { total: values.length, practiced: values.filter(function (row) { return row.exercisesMade > 0; }).length,
      idle: values.filter(function (row) { return row.status === "Nog niet gestart"; }).length,
      active: values.filter(function (row) { return row.status === "Bezig"; }).length,
      exercises: values.reduce(function (sum, row) { return sum + row.exercisesMade; }, 0),
      activeSeconds: values.reduce(function (sum, row) { return sum + row.activeDurationSeconds; }, 0),
      accuracy: attempts ? percentage(correct, attempts) : null };
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

  function classOverviewRows(data, classId) {
    return data.students.filter(function (student) { return student.class_id === classId; }).map(function (student) {
      const stats = studentOverview(data, student);
      return [student.display_name || "Naamloze leerling", stats.sessions, stats.questions, stats.exercisesMade, stats.attempts, stats.correct, stats.incorrect, stats.accuracy + "%", stats.hasMeasuredDuration ? stats.activeDurationSeconds : "", stats.hasMeasuredDuration ? formatActiveDuration(stats.activeDurationSeconds) : "Niet gemeten", formatDate(stats.lastActivity)];
    });
  }

  function studentSessionRows(data, studentId) {
    return data.sessions.filter(function (session) { return session.student_id === studentId; }).sort(function (left, right) {
      return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at);
    }).map(function (session) {
      const stats = sessionStats(session, data.attempts);
      return [formatDate(session.finished_at || session.started_at), session.finished_at ? "Voltooid" : "Onvoltooid", modeLabel(session.mode), session.trajectory || "", session.top_category || "", session.lesson || "", session.block || "", session.subsection || "", Number(session.question_count || 0), stats.exercisesMade, stats.attempts, stats.correct, stats.incorrect, stats.accuracy + "%", session.active_duration_seconds == null ? "" : Number(session.active_duration_seconds), formatActiveDuration(session.active_duration_seconds)];
    });
  }

  function difficultItemRows(data, courseIndex, classId, studentId) {
    const classById = Object.create(null);
    data.classes.forEach(function (row) { classById[row.id] = row; });
    return data.students.filter(function (student) {
      if (classId && student.class_id !== classId) return false;
      if (studentId && student.id !== studentId) return false;
      return true;
    }).reduce(function (rows, student) {
      const attempts = data.attempts.filter(function (attempt) { return attempt.student_id === student.id; });
      difficultItems(attempts, courseIndex).forEach(function (group) {
        const item = courseIndex[group.itemId] || {};
        const classRow = classById[student.class_id];
        rows.push([student.display_name || "Naamloze leerling", classRow && classRow.name || "", group.info.title, group.info.answer, item.trajectory || group.sample.trajectory || "", item.top_category || group.sample.top_category || "", group.itemVariant, group.attempts, group.wrong, group.wrongPercentage + "%"]);
      });
      return rows;
    }, []);
  }

  function studentCodeRows(management, classId) {
    const classById = Object.create(null);
    management.classes.forEach(function (row) { classById[row.id] = row; });
    return management.students.filter(function (student) { return !classId || student.class_id === classId; }).map(function (student) {
      const classRow = classById[student.class_id];
      return [student.display_name || "Naamloze leerling", classRow && classRow.class_code || "", student.school_email || "", student.student_code || ""];
    });
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

  async function loadDashboardBase(client) {
    const results = await Promise.all([
      fetchAll(client, "classes", TABLE_COLUMNS.classes),
      fetchAll(client, "students", TABLE_COLUMNS.students)
    ]);
    return { classes: results[0], students: results[1], sessions: [], attempts: [] };
  }

  async function fetchClassMonitor(client, filters, includeMastery, nowValue) {
    const bounds = periodBounds(filters.period, nowValue);
    const result = await client.rpc("get_class_activity_monitor", {
      p_class_id: filters.classId === "all" ? null : filters.classId,
      p_period_start: bounds.start == null ? null : new Date(bounds.start).toISOString(),
      p_period_end: bounds.end == null ? null : new Date(bounds.end).toISOString(),
      p_trajectory: filters.trajectory === "all" ? null : filters.trajectory,
      p_mode: filters.mode === "all" ? null : filters.mode,
      p_category: filters.category === "all" ? null : filters.category,
      p_subsection: filters.subsection === "all" ? null : filters.subsection,
      p_assignment_id: !filters.assignmentId || filters.assignmentId === "all" ? null : filters.assignmentId,
      p_student_status: filters.studentStatus || "active",
      p_include_mastery: Boolean(includeMastery && filters.classId !== "all")
    });
    if (result.error) throw result.error;
    return asArray(result.data);
  }

  async function refreshMonitor(forceMastery, shouldRender) {
    if (!state.client || !state.user) return false;
    if (state.monitor.loading) { state.monitor.pending = true; return false; }
    const selectedFilters = Object.assign({}, state.filters);
    const missingMastery = selectedFilters.classId !== "all" && state.raw.students.some(function (student) {
      return student.class_id === selectedFilters.classId && student.is_active !== false && state.monitor.masteryByStudent[student.id] == null;
    });
    const includeMastery = Boolean(forceMastery || missingMastery || Date.now() - state.monitor.masteryRefreshedAt >= MASTERY_REFRESH_MS);
    state.monitor.loading = true;
    try {
      const rows = await fetchClassMonitor(state.client, selectedFilters, includeMastery);
      if (!state.user || JSON.stringify(selectedFilters) !== JSON.stringify(state.filters)) return false;
      rows.forEach(function (row) {
        if (row.current_mastery_percentage != null) state.monitor.masteryByStudent[row.student_id] = Number(row.current_mastery_percentage);
      });
      if (includeMastery && selectedFilters.classId !== "all") state.monitor.masteryRefreshedAt = Date.now();
      state.monitor.rows = normalizeMonitorRows(rows, Date.now(), state.monitor.masteryByStudent);
      state.monitor.error = "";
      state.lastRefreshedAt = new Date();
      populateFilters();
      if (shouldRender !== false && ["dashboard", "classes"].includes(state.route.view)) renderCurrent();
      return true;
    } catch (error) {
      state.monitor.error = "De klasmonitor kon niet worden vernieuwd. Controleer je verbinding en of fase 8 in Supabase is uitgevoerd.";
      if (shouldRender !== false && ["dashboard", "classes"].includes(state.route.view)) renderCurrent();
      return false;
    } finally {
      state.monitor.loading = false;
      if (state.monitor.pending && state.user) {
        state.monitor.pending = false;
        Promise.resolve().then(function () { return refreshMonitor(true); });
      }
    }
  }

  async function ensureAnalyticsData() {
    if (state.analyticsLoaded) return true;
    const dataset = await loadRlsDataset(state.client);
    if (!state.user) return false;
    state.raw = dataset;
    state.analyticsLoaded = true;
    populateFilters();
    return true;
  }

  async function openClassDetail(id) {
    state.route = { view: "class", classId: id, studentId: null };
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Klasdetails worden geladen…</p></section>';
    try { if (await ensureAnalyticsData()) renderCurrent(); }
    catch (error) { document.querySelector("#dashboardContent").innerHTML = '<div class="error-state">Klasdetails konden niet worden geladen. Probeer opnieuw.</div>'; }
  }

  async function openStudentDetail(id) {
    const student = state.raw.students.find(function (row) { return row.id === id; });
    if (!student) return;
    state.route = { view: "student", classId: student.class_id, studentId: id };
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Leerlingdetails worden geladen…</p></section>';
    try {
      await ensureAnalyticsData();
      const detail = await loadStudentDetailExtras(state.client, state.filters, student);
      const classRows = detail.classRows;
      classRows.forEach(function (row) { if (row.current_mastery_percentage != null) state.monitor.masteryByStudent[row.student_id] = Number(row.current_mastery_percentage); });
      const byId = new Map(state.monitor.rows.map(function (row) { return [row.student.id, row]; }));
      normalizeMonitorRows(classRows, Date.now(), state.monitor.masteryByStudent).forEach(function (row) { byId.set(row.student.id, row); });
      state.monitor.rows = Array.from(byId.values());
      state.studentVerbGoals[id] = detail.verbGoals;
      state.studentVerbGoalsError = detail.verbError;
      renderCurrent();
    } catch (error) {
      console.error("[Klasmonitor] Leerlingdetail laden mislukt", { code: error && error.code, message: error && error.message, details: error && error.details });
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state">Leerlingdetails konden niet worden geladen. Probeer opnieuw.</div>';
    }
  }

  async function loadStudentDetailExtras(client, filters, student) {
    const goalPromise = Promise.resolve()
      .then(function () { return client.rpc("get_teacher_student_verb_goals", { p_student_id: student.id }); })
      .catch(function (error) { return { error: error }; });
    const [classRows, goalResult] = await Promise.all([
      fetchClassMonitor(client, Object.assign({}, filters, { classId: student.class_id }), true),
      goalPromise
    ]);
    if (goalResult.error) {
      console.error("[Klasmonitor] Werkwoorddoelen niet beschikbaar", { code: goalResult.error.code, message: goalResult.error.message, details: goalResult.error.details });
    }
    return { classRows: classRows, verbGoals: goalResult.error ? [] : asArray(goalResult.data), verbError: Boolean(goalResult.error) };
  }

  async function loadManagementDataset(client) {
    const results = await Promise.all([
      fetchAll(client, "classes", MANAGEMENT_COLUMNS.classes),
      fetchAll(client, "students", MANAGEMENT_COLUMNS.students)
    ]);
    return { classes: results[0], students: results[1] };
  }

  async function loadTeacherProfile(client, userId) {
    const result = await client.from("teachers").select(ACCESS_COLUMNS.teachers).eq("auth_user_id", userId).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function loadTeacherAdminDataset(client) {
    const results = await Promise.all([
      fetchAll(client, "teachers", ACCESS_COLUMNS.teachers),
      fetchAll(client, "class_teachers", ACCESS_COLUMNS.class_teachers),
      fetchAll(client, "classes", MANAGEMENT_COLUMNS.classes)
    ]);
    return { teachers: results[0], assignments: results[1], classes: results[2] };
  }

  async function updateTeacherAccess(client, input) {
    const result = await client.rpc("admin_update_teacher_access", {
      p_teacher_id: input.teacherId,
      p_display_name: input.displayName,
      p_role: input.role,
      p_is_active: input.isActive,
      p_class_ids: asArray(input.classIds)
    });
    if (result.error) throw result.error;
    return result.data;
  }

  function ensureAuthenticatedUser(user) {
    if (!user || !user.id) throw new Error("AUTH_REQUIRED");
  }

  async function createClassRecord(client, user, input, existingClasses) {
    ensureAuthenticatedUser(user);
    const validation = validateClassInput(input.name, input.classCode);
    if (!validation.valid) throw new Error(validation.message);
    if (asArray(existingClasses).some(function (row) { return normalizeClassCode(row.class_code) === validation.code; })) throw new Error("Deze klascode bestaat al binnen je eigen klassen.");
    const result = await client.from("classes").insert({ owner_id: user.id, name: validation.name, class_code: validation.code, is_active: true }).select(MANAGEMENT_COLUMNS.classes).single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function updateClassRecord(client, classId, patch) {
    const update = {};
    if (Object.prototype.hasOwnProperty.call(patch, "name")) {
      const name = String(patch.name || "").trim();
      if (!name || name.length > 80) throw new Error("Geef een geldige klasnaam.");
      update.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "is_active")) update.is_active = Boolean(patch.is_active);
    const result = await client.from("classes").update(update).eq("id", classId).select(MANAGEMENT_COLUMNS.classes).single();
    if (result.error) throw result.error;
    return result.data;
  }

  function generateUniqueStudentCodes(count, existingCodes, cryptoObject) {
    const used = new Set(asArray(existingCodes).map(function (value) { return String(value).toUpperCase(); }));
    const result = [];
    while (result.length < count) {
      const code = generateStudentCode(12, cryptoObject);
      if (!used.has(code)) {
        used.add(code);
        result.push(code);
      }
    }
    return result;
  }

  async function createStudentRecords(client, classId, names, existingCodes, cryptoObject, preferredCodes, existingEmails) {
    const students = asArray(names).map(function (entry) {
      if (entry && typeof entry === "object") return { name: String(entry.name || "").trim(), schoolEmail: normalizeSchoolEmail(entry.schoolEmail) };
      const name = String(entry || "").trim();
      return { name: name, schoolEmail: suggestSchoolEmail(name) };
    }).filter(function (student) { return Boolean(student.name); });
    if (!classId) throw new Error("Kies eerst een klas.");
    if (!students.length) throw new Error("Geef minstens één leerlingnaam.");
    if (students.some(function (student) { return student.name.length > 80; })) throw new Error("Een leerlingnaam mag maximaal 80 tekens bevatten.");
    students.forEach(function (student) {
      const validation = validateSchoolEmail(student.schoolEmail, true);
      if (!validation.valid) throw new Error(student.name + ": " + validation.message);
      student.schoolEmail = validation.email;
    });
    const usedEmails = new Set(asArray(existingEmails).map(normalizeSchoolEmail).filter(Boolean));
    students.forEach(function (student) {
      if (!student.schoolEmail) return;
      if (usedEmails.has(student.schoolEmail)) throw new Error("Deze schoolmail bestaat al: " + student.schoolEmail);
      usedEmails.add(student.schoolEmail);
    });
    const used = new Set(asArray(existingCodes).map(function (value) { return String(value).toUpperCase(); }));
    let codes = asArray(preferredCodes).slice(0, students.length);
    const preferredValid = codes.length === students.length && codes.every(function (code) {
      return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12,64}$/.test(String(code)) && !used.has(String(code));
    });
    if (!preferredValid) codes = generateUniqueStudentCodes(students.length, existingCodes, cryptoObject);
    const records = students.map(function (student, index) { return { class_id: classId, display_name: student.name, school_email: student.schoolEmail, student_code: codes[index], is_active: true }; });
    const result = await client.from("students").insert(records).select(MANAGEMENT_COLUMNS.students);
    if (result.error) throw result.error;
    return asArray(result.data);
  }

  async function updateStudentRecord(client, studentId, patch) {
    const update = {};
    if (Object.prototype.hasOwnProperty.call(patch, "display_name")) {
      const name = String(patch.display_name || "").trim();
      if (!name || name.length > 80) throw new Error("Geef een geldige leerlingnaam.");
      update.display_name = name;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "is_active")) update.is_active = Boolean(patch.is_active);
    if (Object.prototype.hasOwnProperty.call(patch, "student_code")) {
      if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12,64}$/.test(String(patch.student_code || ""))) throw new Error("De nieuwe leerlingcode is ongeldig.");
      update.student_code = patch.student_code;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "school_email")) {
      const validation = validateSchoolEmail(patch.school_email, true);
      if (!validation.valid) throw new Error(validation.message);
      update.school_email = validation.email;
    }
    const result = await client.from("students").update(update).eq("id", studentId).select(MANAGEMENT_COLUMNS.students).single();
    if (result.error) throw result.error;
    return result.data;
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
      statCard("Oefeningen gemaakt", summary.exercisesMade, "werkelijk beantwoorde vragen") +
      statCard("Pogingen", summary.attempts, "inclusief herhalingen") +
      statCard("Correct", summary.accuracy + "%", summary.correct + " van " + summary.attempts + " pogingen") +
      statCard("Actieve oefentijd", summary.hasMeasuredDuration ? formatActiveDuration(summary.activeDurationSeconds) : "—", summary.hasMeasuredDuration ? "alleen gemeten sessies" : "nog niet gemeten") +
      '</section>';
  }

  function renderClassCards(data) {
    return data.classes.map(function (classRow) {
      const overview = classOverview(data, classRow);
      return '<button class="class-card" type="button" data-action="view-class" data-id="' + escapeHtml(classRow.id) + '">' +
        '<span class="class-card-head"><span><h3>' + escapeHtml(classRow.name) + '</h3><span class="muted">Laatste activiteit: ' + escapeHtml(formatDate(overview.lastActivity)) + '</span></span><span class="pill">' + overview.activeStudents + ' leerlingen</span></span>' +
        '<span class="class-metrics"><span><strong>' + overview.sessions + '</strong>sessies</span><span><strong>' + overview.exercisesMade + '</strong>gemaakt</span><span><strong>' + overview.attempts + '</strong>pogingen</span><span><strong>' + overview.accuracy + '%</strong>correct</span><span><strong>' + escapeHtml(overview.hasMeasuredDuration ? formatActiveDuration(overview.activeDurationSeconds) : "—") + '</strong>actieve tijd</span></span>' +
        '</button>';
    }).join("");
  }

  function periodLabel(period) {
    return { "15m": "laatste 15 minuten", "30m": "laatste 30 minuten", "60m": "laatste 60 minuten", today: "vandaag", yesterday: "gisteren", "7": "laatste 7 dagen", "30": "laatste 30 dagen", all: "alles" }[period] || "gekozen periode";
  }

  function renderClassMonitor(classRow, sourceRows, quickFilter) {
    const allRows = asArray(sourceRows || state.monitor.rows).filter(function (row) { return row.student.class_id === classRow.id; });
    const summary = monitorSummary(allRows);
    const activeQuickFilter = quickFilter || state.monitorQuickFilter;
    const shown = allRows.filter(function (row) {
      return activeQuickFilter === "all" || activeQuickFilter === "idle" && row.status === "Nog niet gestart" ||
        activeQuickFilter === "active" && row.status === "Bezig";
    });
    const rows = sortClassMonitor(shown, state.monitorSort);
    const sortOptions = { auto: "Nog niet gestart eerst", status: "Status", name: "Naam", last: "Laatste activiteit", made: "Oefeningen", time: "Actieve tijd", correct: "Correct %", mastery: "Beheersing", task: "Taakstatus" };
    const rowHtml = rows.map(function (row) {
      const task = row.activeAssignment;
      const taskText = row.activeAssignmentCount > 1 ? row.activeAssignmentCount + " actieve taken" : task ? task.title : "—";
      const taskMeta = task ? (task.mastery_percentage == null ? "" : " · " + Number(task.mastery_percentage) + "%") : "";
      return '<tr class="monitor-row" tabindex="0" data-action="view-student" data-id="' + escapeHtml(row.student.id) + '">' +
        '<td><strong>' + escapeHtml(row.student.display_name || "Naamloze leerling") + '</strong></td>' +
        '<td><span class="monitor-status status-' + row.status.toLowerCase().replace(/\s+/g, "-") + '">' + escapeHtml(row.status) + '</span>' +
        (row.mayBeStuck ? '<small class="stuck-hint" title="Veel foute zelfstandige pogingen in deze periode.">Mogelijk vastgelopen</small>' : '') + '</td>' +
        '<td>' + row.exercisesMade + '</td><td>' + escapeHtml(formatMonitorDuration(row.activeDurationSeconds)) + '</td>' +
        '<td title="' + escapeHtml(row.lastActivity ? formatDate(row.lastActivity) : "") + '">' + escapeHtml(relativeActivity(row.lastActivity)) + '</td>' +
        '<td>' + (row.accuracy == null ? "—" : row.accuracy + "%") + '</td>' +
        '<td title="Huidige beheersing; niet beperkt tot deze periode">' + (row.masteryPercentage == null ? "—" : row.masteryPercentage + "%") + '</td>' +
        '<td>' + (task ? '<button class="monitor-task-link" type="button" data-action="monitor-task" data-id="' + escapeHtml(task.id) + '">' + escapeHtml(taskText) + escapeHtml(taskMeta) + '</button>' : '—') + '</td></tr>';
    }).join("");
    return (state.monitor.error ? '<p class="monitor-error" role="alert">' + escapeHtml(state.monitor.error) + '</p>' : '') +
      '<section class="monitor-panel"><div class="section-heading monitor-heading"><div><p class="eyebrow">Klasmonitor · ' + escapeHtml(periodLabel(state.filters.period)) + '</p><h2>' + escapeHtml(classRow.name) + '</h2></div>' +
      '<div class="monitor-controls"><button class="small-button" type="button" data-action="export-monitor">Exporteer klasweergave</button><label class="monitor-sort"><span>Sorteer</span><select id="monitorSort">' + Object.entries(sortOptions).map(function (entry) {
        return '<option value="' + entry[0] + '"' + (state.monitorSort === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>';
      }).join("") + '</select></label></div></div>' +
      '<section class="monitor-summary" aria-label="Klassamenvatting"><span><strong>' + summary.practiced + ' / ' + summary.total + '</strong> geoefend</span><span><strong>' + summary.idle + '</strong> nog niet gestart</span><span><strong>' + summary.active + '</strong> bezig</span><span><strong>' + summary.exercises + '</strong> oefeningen</span><span><strong>' + escapeHtml(formatMonitorDuration(summary.activeSeconds)) + '</strong> actieve tijd*</span><span><strong>' + (summary.accuracy == null ? '—' : summary.accuracy + '%') + '</strong> correct</span></section>' +
      '<div class="monitor-quick-filters"><button type="button" data-action="monitor-quick" data-value="all" aria-pressed="' + (activeQuickFilter === 'all') + '">Alle leerlingen</button><button type="button" data-action="monitor-quick" data-value="idle" aria-pressed="' + (activeQuickFilter === 'idle') + '">Nog niet gestart</button><button type="button" data-action="monitor-quick" data-value="active" aria-pressed="' + (activeQuickFilter === 'active') + '">Bezig</button></div>' +
      (rowHtml ? '<div class="table-wrap"><table class="monitor-table"><thead><tr><th>Leerling</th><th>Status</th><th>Oefeningen</th><th>Actieve tijd*</th><th>Laatst actief</th><th>Correct</th><th>Huidige mastery</th><th>Taak</th></tr></thead><tbody>' + rowHtml + '</tbody></table></div>' : emptyState("Geen leerlingen in deze weergave", "Pas de snelfilter aan of wacht op activiteit.")) +
      '<p class="monitor-footnote">* Actieve seconden worden aan de startperiode van een sessie toegerekend; een sessie over een periodegrens kan niet exact worden opgesplitst.</p>' +
      '<p class="refresh-note">Laatst vernieuwd: ' + escapeHtml(state.lastRefreshedAt ? new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(state.lastRefreshedAt) : "—") + '</p></section>';
  }

  function renderDashboard(data) {
    const selectedClass = state.raw.classes.find(function (row) { return row.id === state.filters.classId; });
    const cards = state.raw.classes.filter(function (row) { return row.is_active !== false; }).map(function (classRow) {
      const summary = monitorSummary(state.monitor.rows.filter(function (row) { return row.student.class_id === classRow.id; }));
      return '<button class="class-card monitor-class-card" type="button" data-action="select-monitor-class" data-id="' + escapeHtml(classRow.id) + '"><strong>' + escapeHtml(classRow.name) + '</strong><span>' + summary.practiced + ' / ' + summary.total + ' geoefend · ' + summary.exercises + ' oefeningen · ' + escapeHtml(formatMonitorDuration(summary.activeSeconds)) + ' actief</span></button>';
    }).join("");
    const analysis = state.analyticsLoaded ? renderSummaryCards(data) : '<button class="button button-secondary" type="button" data-action="load-analysis">Analyse laden</button>';
    if (selectedClass) {
      return renderClassMonitor(selectedClass) + '<details class="secondary-analytics"><summary>Analyse</summary>' + analysis + '<div class="section-block"><button class="button button-secondary" type="button" data-action="view-class" data-id="' + escapeHtml(selectedClass.id) + '">Open volledige klasdetails</button></div></details>';
    }
    return (state.monitor.error ? '<p class="monitor-error" role="alert">' + escapeHtml(state.monitor.error) + '</p>' : '') +
      '<section class="monitor-intro"><p class="eyebrow">Klasmonitor · ' + escapeHtml(periodLabel(state.filters.period)) + '</p><h2>Kies een klas</h2><p class="muted">Open een klas voor de live leerlingmonitor.</p></section>' +
      '<section class="section-block compact-section"><div class="section-heading"><div><h2>Mijn klassen</h2></div></div>' + (cards ? '<div class="class-grid">' + cards + '</div>' : emptyState("Nog geen klassen", "Supabase gaf voor dit leerkrachtenaccount geen klassen terug.")) +
      '<p class="refresh-note">Laatst vernieuwd: ' + escapeHtml(state.lastRefreshedAt ? new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(state.lastRefreshedAt) : '—') + '</p></section>' +
      '<details class="secondary-analytics"><summary>Analyse</summary>' + analysis + '</details>';
  }

  function renderClassesPage(data) {
    const cards = state.raw.classes.filter(function (row) { return row.is_active !== false; }).map(function (classRow) {
      const summary = monitorSummary(state.monitor.rows.filter(function (row) { return row.student.class_id === classRow.id; }));
      return '<button class="class-card monitor-class-card" type="button" data-action="select-monitor-class" data-id="' + escapeHtml(classRow.id) + '"><strong>' + escapeHtml(classRow.name) + '</strong><span>' + summary.practiced + ' / ' + summary.total + ' geoefend · ' + summary.exercises + ' oefeningen · ' + escapeHtml(formatMonitorDuration(summary.activeSeconds)) + ' actief</span></button>';
    }).join("");
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: "Klassen" }]) + '<div class="page-heading"><div><p class="eyebrow">Klasmonitor</p><h2>Klassen</h2><p class="muted">Open een klas voor de leerlingmonitor.</p></div></div>' + (cards ? '<div class="class-grid">' + cards + '</div>' : emptyState("Nog geen klassen", "Maak je eerste klas aan onder Beheer."));
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
      return '<tr><td><button class="link-button" type="button" data-action="view-student" data-id="' + escapeHtml(student.id) + '">' + escapeHtml(student.display_name || "Naamloze leerling") + '</button></td><td>' + result.sessions + '</td><td>' + result.exercisesMade + '</td><td>' + result.attempts + '</td><td>' + result.accuracy + '%</td><td>' + escapeHtml(result.hasMeasuredDuration ? formatActiveDuration(result.activeDurationSeconds) : "—") + '</td><td>' + escapeHtml(formatDate(result.lastActivity)) + '</td></tr>';
    }).join("");
    const recent = overview.students.length ? data.sessions.filter(function (session) { return studentIds.has(session.student_id); }).sort(function (left, right) { return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at); }).slice(0, 8) : [];
    const studentById = Object.create(null);
    overview.students.forEach(function (student) { studentById[student.id] = student; });
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: classRow.name }]) +
      '<div class="page-heading"><div><p class="eyebrow">Klasdetail</p><h2>' + escapeHtml(classRow.name) + '</h2><p class="muted">' + overview.activeStudents + ' actieve leerlingen</p></div><div class="export-actions"><button class="button button-secondary" type="button" data-action="export-class" data-id="' + escapeHtml(classRow.id) + '">Klasoverzicht CSV</button><button class="button button-secondary" type="button" data-action="export-difficult-class" data-id="' + escapeHtml(classRow.id) + '">Moeilijke items CSV</button></div></div>' +
      '<section class="stat-grid">' + statCard("Leerlingen", overview.activeStudents, "actief") + statCard("Sessies", overview.sessions) + statCard("Oefeningen gemaakt", overview.exercisesMade, "werkelijk beantwoord") + statCard("Pogingen", overview.attempts, "incl. herhalingen") + statCard("Correct", overview.accuracy + "%") + statCard("Actieve oefentijd", overview.hasMeasuredDuration ? formatActiveDuration(overview.activeDurationSeconds) : "—", overview.hasMeasuredDuration ? "alleen gemeten sessies" : "nog niet gemeten") + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><h2>Leerlingen</h2><p>Klik op een leerling voor sessies en moeilijke items.</p></div></div>' +
      (rows ? '<div class="table-wrap"><table><thead><tr><th>Leerling</th><th>Sessies</th><th>Gemaakt</th><th>Pogingen</th><th>Correct</th><th>Actieve tijd</th><th>Laatste oefening</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : emptyState("Geen leerlingen", "Supabase gaf voor deze klas geen leerlingen terug.")) + '</section>' +
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
    return '<details class="session-card"><summary><span class="session-title"><strong>' + escapeHtml(modeLabel(session.mode)) + ' · ' + escapeHtml(session.trajectory) + '</strong><span>' + escapeHtml(formatDate(session.finished_at || session.started_at)) + ' · ' + (session.finished_at ? "Voltooid" : "Onvoltooid") + '</span></span><span class="session-metric"><small>Geselecteerd</small><strong>' + Number(session.question_count || 0) + '</strong></span><span class="session-metric"><small>Gemaakt</small><strong>' + stats.exercisesMade + '</strong></span><span class="session-metric"><small>Pogingen</small><strong>' + stats.attempts + '</strong></span><span class="session-metric"><small>Correct</small><strong>' + stats.accuracy + '%</strong></span><span class="session-metric"><small>Actieve tijd</small><strong>' + escapeHtml(formatActiveDuration(session.active_duration_seconds)) + '</strong></span></summary><div class="session-detail"><p class="muted">' + escapeHtml(path) + '</p><p><strong>Juist / fout:</strong> ' + stats.correct + ' / ' + stats.incorrect + '</p>' + details + '</div></details>';
  }

  function renderStudentDetail(data, studentId) {
    const student = data.students.find(function (row) { return row.id === studentId; });
    if (!student) return emptyState("Leerling niet gevonden", "Deze leerling valt niet binnen de huidige RLS-resultaten.");
    const classRow = data.classes.find(function (row) { return row.id === student.class_id; });
    const overview = studentOverview(data, student);
    const independent = overview.attemptRows.filter(function (attempt) { return attempt.mode === "practice" || attempt.mode === "test"; });
    const independentAccuracy = independent.length ? percentage(independent.filter(function (attempt) { return attempt.was_correct === true; }).length, independent.length) : null;
    const mastery = state.monitor.masteryByStudent[studentId];
    const monitorRow = state.monitor.rows.find(function (row) { return row.student.id === studentId; });
    const task = monitorRow && monitorRow.activeAssignment;
    const periodExercises = monitorRow ? monitorRow.exercisesMade : overview.exercisesMade;
    const periodSeconds = monitorRow ? monitorRow.activeDurationSeconds : overview.activeDurationSeconds;
    const periodAccuracy = monitorRow ? monitorRow.accuracy : independentAccuracy;
    const verbGoals = asArray(state.studentVerbGoals[studentId]).filter(function (goal) { return Number(goal.attempts || 0) > 0; });
    const sessions = overview.sessionRows.slice().sort(function (left, right) { return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at); });
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: classRow ? classRow.name : "Klas", action: "view-class", id: student.class_id }, { label: student.display_name || "Naamloze leerling" }]) +
      '<div class="page-heading"><div><p class="eyebrow">Leerlingdetail · ' + escapeHtml(periodLabel(state.filters.period)) + '</p><h2>' + escapeHtml(student.display_name || "Naamloze leerling") + ' · ' + escapeHtml(classRow ? classRow.name : "Onbekende klas") + '</h2></div><div class="export-actions"><button class="button button-secondary" type="button" data-action="export-student" data-id="' + escapeHtml(student.id) + '">Sessies CSV</button><button class="button button-secondary" type="button" data-action="export-difficult-student" data-id="' + escapeHtml(student.id) + '">Moeilijke items CSV</button></div></div>' +
      '<section class="monitor-summary student-summary" aria-label="Leerlingoverzicht"><span><strong>' + periodExercises + '</strong> oefeningen</span><span><strong>' + escapeHtml(formatMonitorDuration(periodSeconds)) + '</strong> actieve tijd*</span><span><strong>' + (periodAccuracy == null ? '—' : periodAccuracy + '%') + '</strong> correct zelfstandig</span><span><strong>' + escapeHtml(monitorRow ? relativeActivity(monitorRow.lastActivity) : relativeActivity(overview.lastActivity)) + '</strong> laatst actief</span><span title="Huidige beheersing; niet beperkt tot deze periode"><strong>' + (mastery == null ? '—' : mastery + '%') + '</strong> huidige mastery</span><span><strong>' + escapeHtml(task ? task.title + ' · ' + Number(task.mastery_percentage || 0) + '%' : 'Geen actieve taak') + '</strong> actieve taak</span></section>' +
      '<p class="monitor-footnote">* De monitor rekent actieve sessieseconden toe aan de periode waarin de sessie begon.</p>' +
      (state.studentVerbGoalsError ? '<p class="monitor-error" role="status">Werkwoordbeheersing is tijdelijk niet beschikbaar. De overige leerlinggegevens blijven zichtbaar.</p>' : '') +
      (verbGoals.length ? '<section class="section-block"><h3>Werkwoordbeheersing · huidige staat</h3><div class="verb-analysis">' + verbGoals.map(function (goal) {
        const item = state.courseIndex[goal.goal_id];
        const label = item ? item.infinitive : goal.goal_id === 'present_er' ? 'Verbes en -ER' : goal.goal_id === 'present_ir_finir' ? 'Verbes du type finir' : goal.goal_id === 'present_re' ? 'Verbes en -RE' : goal.goal_id;
        return '<span><strong>' + escapeHtml(label) + '</strong> ' + Number(goal.level || 0) + '% · ' + Number(goal.persons || 0) + '/6 persoonsgroepen · ' + Number(goal.conjugation_accuracy ?? goal.accuracy ?? 0) + '% juist</span>';
      }).join('') + '</div></section>' : '') +
      '<details class="secondary-analytics"><summary>Analyse · ' + escapeHtml(periodLabel(state.filters.period)) + '</summary><section class="stat-grid">' + statCard("Sessies", overview.sessions) + statCard("Oefeningen gemaakt", overview.exercisesMade, "werkelijk beantwoord") + statCard("Pogingen", overview.attempts, "incl. herhalingen") + statCard("Juist / fout", overview.correct + " / " + overview.incorrect) + statCard("Correct", overview.attempts ? overview.accuracy + "%" : "—") + statCard("Actieve oefentijd", overview.hasMeasuredDuration ? formatActiveDuration(overview.activeDurationSeconds) : "—") + '</section></details>' +
      '<section class="section-block"><div class="section-heading"><div><h2>Sessiegeschiedenis</h2><p>Open een sessie voor itemdetails en modelantwoorden.</p></div></div><div class="session-list">' + (sessions.length ? sessions.map(function (session) { return renderSessionCard(session, overview.attemptRows); }).join("") : emptyState("Nog geen sessies", "Binnen de gekozen filters zijn voor deze leerling geen sessies gevonden.")) + '</div></section>' +
      '<section class="section-block">' + renderDifficult(difficultItems(overview.attemptRows, state.courseIndex), "Moeilijk voor deze leerling") + '</section>';
  }

  function studentMasterySummary(attempts) {
    if (!window.MonParcoursMastery || !state.course) return null;
    const items = asArray(state.course.trajectories).reduce(function (all, trajectory) {
      return all.concat(asArray(trajectory.items));
    }, []);
    const localAttempts = asArray(attempts).map(function (attempt) {
      return Object.assign({}, attempt, {
        client_attempt_id: attempt.id,
        client_session_id: attempt.session_id
      });
    });
    const records = window.MonParcoursMastery.mergeMasterySources([], localAttempts, [], []);
    return window.MonParcoursMastery.calculateMasterySummary(items, records);
  }

  function renderCreatedStudents(classRow) {
    if (!state.management.createdStudents.length || !classRow) return "";
    const cards = state.management.createdStudents.map(function (student) {
      return '<div class="share-card"><h3>' + escapeHtml(student.display_name) + '</h3><p>Klascode: <span class="code-value">' + escapeHtml(classRow.class_code) + '</span><br>Schoolmail: <strong>' + escapeHtml(student.school_email || "Nog niet ingesteld") + '</strong><br>Fallback-leerlingcode: <span class="code-value">' + escapeHtml(student.student_code) + '</span></p><div class="share-actions"><button class="small-button" type="button" data-action="copy-student-data" data-id="' + escapeHtml(student.id) + '">Kopieer gegevens</button></div></div>';
    }).join("");
    const bulkRows = state.management.createdStudents.map(function (student) {
      return '<tr><td>' + escapeHtml(student.display_name) + '</td><td><span class="code-value">' + escapeHtml(classRow.class_code) + '</span></td><td>' + escapeHtml(student.school_email || "Nog niet ingesteld") + '</td><td><span class="code-value">' + escapeHtml(student.student_code) + '</span></td><td><button class="small-button" type="button" data-action="copy-student-data" data-id="' + escapeHtml(student.id) + '">Kopieer gegevens</button></td></tr>';
    }).join("");
    const result = state.management.createdStudents.length === 1 ? '<div class="management-stack">' + cards + '</div>' : '<div class="table-wrap"><table><thead><tr><th>Leerling</th><th>Klascode</th><th>Schoolmail</th><th>Fallbackcode</th><th>Actie</th></tr></thead><tbody>' + bulkRows + '</tbody></table></div>';
    return '<section class="section-block"><div class="section-heading"><div><h2>Nieuwe leerlinggegevens</h2><p>Deel deze gegevens via een veilig kanaal.</p></div><button class="button button-secondary" type="button" data-action="export-created-codes">Download als CSV</button></div><p class="privacy-warning"><strong>Behandel leerlingcodes als wachtwoorden.</strong> Deel ze alleen met de juiste leerling.</p>' + result + '</section>';
  }

  function renderManagement() {
    const management = state.management;
    const selectedClass = management.classes.find(function (row) { return row.id === management.selectedClassId; }) || management.classes[0] || null;
    if (selectedClass && selectedClass.id !== management.selectedClassId) management.selectedClassId = selectedClass.id;
    if (!management.generatedCode) {
      try { management.generatedCode = generateStudentCode(); } catch (error) { management.generatedCode = ""; }
    }
    const classList = management.classes.map(function (row) {
      return '<div class="management-class" aria-current="' + (selectedClass && row.id === selectedClass.id ? "true" : "false") + '"><button type="button" data-action="manage-class" data-id="' + escapeHtml(row.id) + '"><strong>' + escapeHtml(row.name) + '</strong><span>' + escapeHtml(row.class_code) + ' · ' + (row.is_active === false ? "inactief" : "actief") + '</span></button></div>';
    }).join("");
    let detail = emptyState("Kies of maak een klas", "Daarna kun je leerlingen toevoegen en codes beheren.");
    if (selectedClass) {
      const allStudents = management.students.filter(function (student) { return student.class_id === selectedClass.id; });
      const shownStudents = allStudents.filter(function (student) {
        if (management.studentStatus === "active") return student.is_active !== false;
        if (management.studentStatus === "inactive") return student.is_active === false;
        return true;
      });
      const studentRows = shownStudents.map(function (student) {
        return '<tr><td><strong>' + escapeHtml(student.display_name || "Naamloze leerling") + '</strong><br><span class="pill">' + (student.is_active === false ? "Inactief" : "Actief") + '</span><div class="row-actions"><button class="small-button" type="button" data-action="edit-student-name" data-id="' + escapeHtml(student.id) + '">Naam aanpassen</button></div></td><td><strong>' + escapeHtml(student.school_email || "Nog geen schoolmail") + '</strong><div class="row-actions"><button class="small-button" type="button" data-action="edit-student-email" data-id="' + escapeHtml(student.id) + '">' + (student.school_email ? "Schoolmail aanpassen" : "Schoolmail toevoegen") + '</button></div></td><td><details><summary>Fallbackcode tonen</summary><span class="code-value">' + escapeHtml(student.student_code) + '</span><div class="row-actions"><button class="small-button" type="button" data-action="copy-student-code" data-id="' + escapeHtml(student.id) + '">Kopieer code</button><button class="small-button warning" type="button" data-action="regenerate-student-code" data-id="' + escapeHtml(student.id) + '">Nieuwe code</button></div></details></td><td><button class="small-button" type="button" data-action="toggle-student-active" data-id="' + escapeHtml(student.id) + '">' + (student.is_active === false ? "Activeren" : "Deactiveren") + '</button></td></tr>';
      }).join("");
      const classPanel = currentTeacherIsAdmin()
        ? '<section class="panel"><h2>' + escapeHtml(selectedClass.name) + '</h2><form class="management-form" data-form="update-class"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Klasnaam</span><input name="name" maxlength="80" value="' + escapeHtml(selectedClass.name) + '" required></label><label><span>Klascode</span><input value="' + escapeHtml(selectedClass.class_code) + '" readonly></label><label><span>Status</span><select name="is_active"><option value="true"' + (selectedClass.is_active === false ? "" : " selected") + '>Actief</option><option value="false"' + (selectedClass.is_active === false ? " selected" : "") + '>Inactief</option></select></label><button class="button button-primary" type="submit">Klas bijwerken</button><p class="muted">Deactiveren bewaart alle leerlingen en historische resultaten.</p></form></section>'
        : '<section class="panel"><h2>' + escapeHtml(selectedClass.name) + '</h2><p class="muted">Klascode: ' + escapeHtml(selectedClass.class_code) + ' · ' + (selectedClass.is_active === false ? "inactief" : "actief") + '</p><p>Je kunt leerlingen in deze toegewezen klas beheren. Alleen een admin beheert de klas zelf.</p></section>';
      detail = '<div class="management-stack">' + classPanel +
        '<section class="panel"><h3>Leerling toevoegen</h3><form class="management-form" data-form="add-student"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Naam</span><input name="display_name" maxlength="80" required></label><label><span>Schoolmail — controleer het voorstel</span><input name="school_email" type="email" placeholder="achternaamvoornaam@camposturnhout.be"></label><label><span>Automatisch gegenereerde fallbackcode</span><input name="generated_code" value="' + escapeHtml(management.generatedCode) + '" readonly></label><button class="button button-primary" type="submit">Leerling toevoegen</button></form></section>' +
        '<section class="panel"><h3>Meerdere leerlingen toevoegen</h3><form class="management-form" data-form="bulk-students"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Eén leerling per regel: Naam of Naam;schoolmail</span><textarea name="names" placeholder="Emma Janssens;janssensemma@camposturnhout.be&#10;Noah Peeters" required></textarea></label><div class="share-actions"><button class="button button-secondary" type="button" data-action="preview-bulk-emails">E-mailvoorstellen invullen</button><button class="button button-primary" type="submit">Leerlingen toevoegen</button></div></form></section>' +
        '<section class="panel"><div class="section-heading"><div><h3>Leerlingen</h3><p>' + allStudents.length + ' in deze klas</p></div><div class="export-actions"><select id="managementStudentStatus" aria-label="Filter leerlingstatus"><option value="active"' + (management.studentStatus === "active" ? " selected" : "") + '>Actief</option><option value="inactive"' + (management.studentStatus === "inactive" ? " selected" : "") + '>Inactief</option><option value="all"' + (management.studentStatus === "all" ? " selected" : "") + '>Alle</option></select><button class="small-button" type="button" data-action="export-codes" data-id="' + escapeHtml(selectedClass.id) + '">Login- en fallbackcodes CSV</button></div></div><p class="privacy-warning"><strong>Schoolmail is een persoonsgegeven; behandel de fallbackcode als een wachtwoord.</strong> Deze gegevens staan bewust alleen in Beheer.</p>' + (studentRows ? '<div class="table-wrap"><table><thead><tr><th>Leerling</th><th>Schoolmail</th><th>Fallbackcode</th><th>Status</th></tr></thead><tbody>' + studentRows + '</tbody></table></div>' : emptyState("Geen leerlingen in deze selectie", "Pas de statusfilter aan of voeg leerlingen toe.")) + '</section></div>';
    }
    const createClassPanel = currentTeacherIsAdmin() ? '<section class="panel"><h3>Nieuwe klas</h3><form class="management-form" data-form="create-class"><label><span>Klasnaam</span><input name="name" maxlength="80" placeholder="1AA" required></label><label><span>Klascode</span><input name="class_code" minlength="2" maxlength="20" pattern="[A-Za-z0-9-]{2,20}" placeholder="1AA" required></label><button class="button button-primary" type="submit">Klas aanmaken</button></form></section>' : "";
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: "Beheer" }]) + '<div class="page-heading"><div><p class="eyebrow">Administratie</p><h2>Klassen beheren</h2><p class="muted">Beheer leerlingen binnen de klassen waartoe je toegang hebt.</p></div></div><p id="managementMessage" class="management-message' + (management.messageIsError ? " error" : "") + '" aria-live="polite">' + escapeHtml(management.message) + '</p><div class="management-grid"><aside class="management-stack">' + createClassPanel + '<section class="panel"><h3>Mijn klassen</h3><div class="management-class-list">' + (classList || emptyState("Geen toegewezen klassen", "Vraag een admin om minstens één klas toe te wijzen.")) + '</div></section></aside><div>' + detail + renderCreatedStudents(selectedClass) + '</div></div>';
  }

  function renderTeachersPage() {
    if (!currentTeacherIsAdmin()) return emptyState("Geen toegang", "Alleen admins kunnen leerkrachten beheren.");
    const data = state.teacherAdmin;
    const assignmentsByTeacher = Object.create(null);
    data.assignments.forEach(function (row) {
      if (!assignmentsByTeacher[row.teacher_id]) assignmentsByTeacher[row.teacher_id] = new Set();
      assignmentsByTeacher[row.teacher_id].add(row.class_id);
    });
    const rows = data.teachers.map(function (teacher) {
      const assigned = assignmentsByTeacher[teacher.auth_user_id] || new Set();
      const classNames = data.classes.filter(function (classRow) { return assigned.has(classRow.id); }).map(function (classRow) { return classRow.name; });
      return '<tr><td><strong>' + escapeHtml(teacher.display_name || "Naamloze leerkracht") + '</strong><br><span class="muted">' + escapeHtml(teacher.email || "Geen e-mailadres") + '</span></td><td>' + escapeHtml(teacher.role === "admin" ? "Admin" : "Teacher") + '</td><td><span class="pill">' + (teacher.is_active ? "Actief" : "Inactief") + '</span></td><td>' + escapeHtml(classNames.join(", ") || "Geen") + '</td><td><button class="small-button" type="button" data-action="edit-teacher-access" data-id="' + escapeHtml(teacher.auth_user_id) + '">Bewerken</button></td></tr>';
    }).join("");
    const editing = data.teachers.find(function (teacher) { return teacher.auth_user_id === data.editingTeacherId; });
    let editor = "";
    if (editing) {
      const assigned = assignmentsByTeacher[editing.auth_user_id] || new Set();
      const classChoices = data.classes.map(function (classRow) {
        return '<label class="teacher-class-choice"><input type="checkbox" name="class_ids" value="' + escapeHtml(classRow.id) + '"' + (assigned.has(classRow.id) ? " checked" : "") + '><span><strong>' + escapeHtml(classRow.name) + '</strong><small>' + escapeHtml(classRow.class_code) + '</small></span></label>';
      }).join("");
      editor = '<article class="panel teacher-access-card"><form class="management-form" data-form="teacher-access"><input type="hidden" name="teacher_id" value="' + escapeHtml(editing.auth_user_id) + '"><div class="section-heading"><div><h3>' + escapeHtml(editing.display_name || editing.email || "Naamloze leerkracht") + '</h3><p>' + escapeHtml(editing.email || "Geen e-mailadres") + '</p></div><button class="small-button" type="button" data-action="close-teacher-editor">Sluiten</button></div><label><span>Weergavenaam</span><input name="display_name" maxlength="120" value="' + escapeHtml(editing.display_name || "") + '"></label><div class="teacher-access-fields"><label><span>Rol</span><select name="role"><option value="teacher"' + (editing.role === "teacher" ? " selected" : "") + '>Teacher</option><option value="admin"' + (editing.role === "admin" ? " selected" : "") + '>Admin</option></select></label><label><span>Status</span><select name="is_active"><option value="true"' + (editing.is_active ? " selected" : "") + '>Actief</option><option value="false"' + (editing.is_active ? "" : " selected") + '>Inactief</option></select></label></div><fieldset><legend>Toegewezen klassen</legend><div class="teacher-class-grid">' + (classChoices || '<p class="muted">Maak eerst een klas aan.</p>') + '</div></fieldset><button class="button button-primary" type="submit">Toegang opslaan</button></form></article>';
    }
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: "Leerkrachten" }]) + '<div class="page-heading"><div><p class="eyebrow">Administratie</p><h2>Leerkrachten</h2><p class="muted">Compact overzicht van accounts, rollen en klastoegang.</p></div></div><p id="teacherAdminMessage" class="management-message' + (data.messageIsError ? " error" : "") + '" aria-live="polite">' + escapeHtml(data.message) + '</p>' + (rows ? '<div class="table-wrap"><table><thead><tr><th>Leerkracht</th><th>Rol</th><th>Status</th><th>Klassen</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : emptyState("Nog geen leerkrachten", "Nodig eerst een collega uit via Supabase Authentication.")) + editor;
  }

  function currentFilteredData() {
    return filterDataset(state.raw, state.filters);
  }

  function taskDraftDefaults(source) {
    const first = asArray(state.course && state.course.trajectories)[0];
    return {
      id: source && source.id || null,
      title: source && source.title || "",
      instructions: source && source.instructions || "",
      due_at: source && source.due_at ? taskDeadlineLocal(source.due_at) : "",
      target_acquired_percentage: source && source.target_acquired_percentage || 80,
      mastery_strategy: source && source.mastery_strategy || "item_mastery",
      completion_strategy: source && source.completion_strategy || (source && source.id ? "legacy_mastery" : "rounds"),
      required_rounds: source && source.required_rounds || 3,
      item_verb_exercise_key: source && source.item_verb_exercise_key || "verb-nl-conj",
      verb_item_ids: source && source.mastery_strategy && source.mastery_strategy !== "item_mastery" ? asArray(source.item_ids).map(String) : null,
      status: source && source.status || "draft",
      class_ids: asArray(source && source.class_ids).map(String),
      trajectory: first && first.trajectory || "",
      top_category: "", lesson: "", block: "", subsection: "", category: "",
      range_start: 1, range_end: null,
      fixed_item_ids: source && source.id ? asArray(source.item_ids).map(String) : null
    };
  }

  function taskDeadlineLocal(value) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
    const map = Object.fromEntries(parts.map(function (part) { return [part.type, part.value]; }));
    return map.year + "-" + map.month + "-" + map.day + "T" + map.hour + ":" + map.minute;
  }

  function taskDeadlineUtc(value) {
    if (!value) return null;
    const desired = Date.parse(value + "Z");
    if (!Number.isFinite(desired)) throw new Error("Ongeldige deadline");
    let guess = desired;
    for (let index = 0; index < 3; index += 1) {
      const observed = Date.parse(taskDeadlineLocal(new Date(guess).toISOString()) + "Z");
      guess += desired - observed;
    }
    const result = new Date(guess).toISOString();
    if (taskDeadlineLocal(result) !== value) throw new Error("Dit tijdstip bestaat niet in Europe/Brussels wegens de uurwisseling.");
    return result;
  }

  function taskSuggestedTitle(draft) {
    const scope = draft.category || draft.subsection || draft.block || draft.lesson || draft.top_category || "Leerstof";
    const items = taskScopeItems(draft);
    const start = Math.max(1, Number(draft.range_start) || 1);
    const end = Math.min(items.length, Number(draft.range_end) || items.length);
    return draft.trajectory + " · " + scope + (items.length ? " " + start + "–" + end : "");
  }

  function taskScopeItems(draft) {
    if (draft.fixed_item_ids) return draft.fixed_item_ids.map(function (id) { return state.courseIndex[id]; }).filter(function (item) { return item && item.type !== "sound_rule"; });
    return window.MonParcoursAssignments.scopeItems(state.course || { trajectories: [] }, draft).filter(function (item) {
      return item && item.id && ["vocabulary", "verb", "phrase", "grammar_rule", "number"].includes(item.type);
    });
  }

  function taskSelectedItems(draft) {
    const items = taskScopeItems(draft);
    const start = Math.max(1, Number(draft.range_start) || 1);
    const end = Math.min(items.length, Number(draft.range_end) || items.length);
    const selected = items.slice(start - 1, end);
    if (draft.mastery_strategy === "irregular_verb_mastery" || draft.mastery_strategy === "mixed_verb_mastery") {
      const chosen = draft.verb_item_ids && new Set(draft.verb_item_ids);
      return selected.filter(function (item) {
        const type = window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(item.id);
        return !type || type.kind !== "irregular" || !chosen || chosen.has(item.id);
      });
    }
    return selected;
  }

  function taskStrategyChoices(items) {
    const api = window.MonParcoursVerbMastery;
    if (!api || !items.length || items.some(function (item) { return item.type !== "verb" || !api.classification(item.id); })) return ["item_mastery"];
    const kinds = new Set(items.map(function (item) { return api.classification(item.id).kind; }));
    if (kinds.size === 2) return ["item_mastery", "mixed_verb_mastery"];
    return kinds.has("regular") ? ["item_mastery", "verb_rule_mastery"] : ["item_mastery", "irregular_verb_mastery"];
  }

  function taskRequirements(draft, items) {
    if (draft.mastery_strategy === "item_mastery") return [];
    const api = window.MonParcoursVerbMastery;
    return api.goalsForItems(items).map(function (goalId, index) {
      return { requirement_type: goalId.startsWith("uf1-item-") ? "irregular_verb_mastery" : "verb_rule_mastery",
        reference_id: goalId, target_percentage: Number(draft.target_acquired_percentage), ordering: index + 1 };
    });
  }

  function taskSelect(name, label, values, selected) {
    return '<label><span>' + label + '</span><select name="' + name + '"><option value="">Alles</option>' + values.map(function (value) {
      return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
    }).join("") + '</select></label>';
  }

  function taskScopeChoices(draft, field) {
    const order = ["top_category", "lesson", "block", "subsection", "category"];
    const position = order.indexOf(field);
    const path = { trajectory: draft.trajectory };
    order.slice(0, position).forEach(function (key) { path[key] = draft[key]; });
    const values = new Set();
    const trajectory = asArray(state.course && state.course.trajectories).find(function (row) { return row.trajectory === draft.trajectory; });
    asArray(trajectory && trajectory.items).forEach(function (item) {
      if (!item.id || item.type === "sound_rule") return;
      if (order.slice(0, position).some(function (key) { return path[key] && item[key] !== path[key]; })) return;
      if (item[field]) values.add(item[field]);
    });
    return Array.from(values);
  }

  function taskLifecycle(task, now) {
    if (task.status === "draft") return "draft";
    if (task.status === "archived") return "archived";
    if (now == null && task.lifecycle_status) return task.lifecycle_status;
    const grace = Number(task.auto_archive_grace_days);
    const due = task.due_at ? new Date(task.due_at).getTime() : NaN;
    if (Number.isFinite(grace) && grace >= 0 && Number.isFinite(due)) {
      const today = now == null ? Date.now() : Number(now);
      return today <= due ? "active" : today <= due + grace * 86400000 ? "recent" : "archived";
    }
    return task.lifecycle_status || "active";
  }

  function taskOwnerName(task) {
    return task.created_by_teacher_id ? task.creator_name || "Naam onbekend" : "Legacy / onbekende maker";
  }

  function taskCalendarDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return NaN;
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = function (type) { return Number(parts.find(function (part) { return part.type === type; }).value); };
    return Date.UTC(get("year"), get("month") - 1, get("day"));
  }

  function taskDeadlineLabel(task, lifecycle, now) {
    if (!task.due_at) return "Geen deadline";
    const today = taskCalendarDay(now == null ? Date.now() : now);
    const due = taskCalendarDay(task.due_at);
    const days = Math.round((due - today) / 86400000);
    if (lifecycle === "recent" || lifecycle === "archived" && task.status !== "archived") {
      return days === -1 ? "Gisteren afgelopen" : days === 0 ? "Vandaag afgelopen" :
        Math.abs(days) + " dagen geleden afgelopen";
    }
    if (days === 0) return "Deadline vandaag";
    if (days === 1) return "Deadline morgen";
    return "Deadline " + formatDate(task.due_at, false);
  }

  function taskArchiveFilterRows(rows, filters, now) {
    return rows.filter(function (task) {
      if (filters.classId !== "all" && !asArray(task.class_ids).includes(filters.classId)) return false;
      if (filters.creatorId !== "all" && (task.created_by_teacher_id || "legacy") !== filters.creatorId) return false;
      if (filters.query && !String(task.title || "").toLocaleLowerCase("nl").includes(filters.query.toLocaleLowerCase("nl"))) return false;
      if (filters.period === "all") return true;
      const relevant = task.status === "archived" ? task.updated_at || task.due_at || task.created_at : task.due_at || task.created_at;
      const age = ((now == null ? Date.now() : Number(now)) - new Date(relevant).getTime()) / 86400000;
      return filters.period === "30" ? age <= 30 : filters.period === "90" ? age <= 90 : age > 90;
    });
  }

  function renderTaskOverviewRow(task, lifecycle, showOwner) {
    const completed = Number(task.completed_count || 0);
    const total = Number(task.student_count || 0);
    const own = Boolean(state.user && task.created_by_teacher_id === state.user.id);
    const classes = asArray(task.classes).map(function (row) { return row.name; }).join(", ") || "Geen toegankelijke klassen";
    const reports = Number(task.open_report_count || 0);
    return '<article class="task-overview-row' + (own ? ' is-own' : '') + (showOwner ? ' has-owner' : '') + '">' +
      '<div class="task-overview-name"><strong>' + escapeHtml(task.title) + '</strong>' +
        (showOwner && own ? '<small class="task-own-mark">Mijn taak</small>' : '') +
        '<small>' + escapeHtml(classes) + '</small></div>' +
      '<div class="task-overview-progress"><strong>' + completed + ' / ' + total + ' klaar</strong>' +
        '<span class="task-overview-bar" role="progressbar" aria-label="Leerlingen klaar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + completed + '"><i style="width:' + percentage(completed, total) + '%"></i></span>' +
        '<small>' + (total - completed) + ' niet klaar</small></div>' +
      '<div class="task-overview-meta"><span>' + escapeHtml(taskDeadlineLabel(task, lifecycle)) + '</span>' +
        (reports > 0 ? '<strong class="task-report-indicator">⚠ ' + reports + ' melding' + (reports === 1 ? '' : 'en') + '</strong>' : '') + '</div>' +
      (showOwner ? '<span class="task-overview-owner">Door ' + escapeHtml(taskOwnerName(task)) + '</span>' : '') +
      '<button class="small-button" type="button" data-action="open-task" data-id="' + escapeHtml(task.id) + '">Bekijken →</button></article>';
  }

  function renderTasksPage() {
    const all = state.tasks.list.filter(function (task) {
      return state.tasks.ownerFilter === "all" || task.created_by_teacher_id === (state.user && state.user.id);
    });
    const lifecycle = function (task) { return taskLifecycle(task); };
    const active = all.filter(function (task) { return lifecycle(task) === "active"; }).sort(function (left, right) {
      return (left.due_at ? new Date(left.due_at).getTime() : Infinity) - (right.due_at ? new Date(right.due_at).getTime() : Infinity) ||
        Number(right.open_report_count || 0) - Number(left.open_report_count || 0);
    });
    const recent = all.filter(function (task) { return lifecycle(task) === "recent"; }).sort(function (left, right) {
      return new Date(right.due_at).getTime() - new Date(left.due_at).getTime() ||
        Number(right.open_report_count || 0) - Number(left.open_report_count || 0);
    });
    const drafts = all.filter(function (task) { return lifecycle(task) === "draft"; });
    const archived = all.filter(function (task) { return lifecycle(task) === "archived"; }).sort(function (left, right) {
      return new Date(right.updated_at || right.due_at || right.created_at).getTime() -
        new Date(left.updated_at || left.due_at || left.created_at).getTime();
    });
    const showOwner = state.tasks.ownerFilter === "all";
    const group = function (title, rows, status) {
      return '<section class="section-block task-overview-group"><h3>' + title + ' (' + rows.length + ')</h3>' +
        (rows.length ? '<div class="task-overview-list">' + rows.map(function (task) { return renderTaskOverviewRow(task, status, showOwner); }).join("") + '</div>' :
          '<p class="muted">Geen taken in deze categorie.</p>') + '</section>';
    };
    const archiveFilters = state.tasks.archiveFilters;
    const classChoices = new Map();
    const creatorChoices = new Map();
    archived.forEach(function (task) {
      asArray(task.classes).forEach(function (row) { classChoices.set(row.id, row.name); });
      creatorChoices.set(task.created_by_teacher_id || "legacy", taskOwnerName(task));
    });
    const archiveRows = taskArchiveFilterRows(archived, archiveFilters);
    const graceDays = Number(state.tasks.list[0] && state.tasks.list[0].auto_archive_grace_days);
    const graceText = Number.isFinite(graceDays) ? graceDays + " dagen" : "tijdelijk";
    return '<div class="page-heading"><div><p class="eyebrow">Beheersing</p><h2>Taken</h2><p class="muted">Actuele taken eerst. Afgelopen taken blijven ' + graceText + ' zichtbaar voor opvolging.</p></div><button class="button button-primary" type="button" data-action="new-task">Nieuwe taak</button></div>' +
      (state.tasks.list.length && state.tasks.list.some(function (task) { return !task.lifecycle_status; }) ? '<p class="form-message">De slimme taaklevenscyclus is nog niet actief. Voer de aparte SQL-migratie uit; bestaande taken blijven beschikbaar.</p>' : '') +
      (state.tasks.message ? '<p class="form-message" role="alert">' + escapeHtml(state.tasks.message) + '</p>' : '') +
      '<nav class="task-owner-tabs" aria-label="Welke taken"><button type="button" data-action="task-owner-filter" data-value="mine" aria-pressed="' + (state.tasks.ownerFilter === "mine") + '">Mijn taken</button>' +
        '<button type="button" data-action="task-owner-filter" data-value="all" aria-pressed="' + showOwner + '">Alle taken</button></nav>' +
      (!all.length && !showOwner ? '<p class="muted">Je hebt nog geen eigen taken. Via Alle taken kun je taken van collega’s raadplegen.</p>' : '') +
      group("ACTIEF", active, "active") + group("RECENT AFGELOPEN", recent, "recent") + group("CONCEPTEN", drafts, "draft") +
      '<details class="section-block task-archive"' + (state.tasks.archiveOpen ? ' open' : '') + '><summary>GEARCHIVEERD (' + archived.length + ')</summary>' +
        '<form class="task-archive-filters" data-form="task-archive-filters"><label>Klas<select name="class_id"><option value="all">Alle klassen</option>' +
          Array.from(classChoices).map(function (entry) { return '<option value="' + escapeHtml(entry[0]) + '"' + (archiveFilters.classId === entry[0] ? ' selected' : '') + '>' + escapeHtml(entry[1]) + '</option>'; }).join("") + '</select></label>' +
        '<label>Maker<select name="creator_id"><option value="all">Alle makers</option>' +
          Array.from(creatorChoices).map(function (entry) { return '<option value="' + escapeHtml(entry[0]) + '"' + (archiveFilters.creatorId === entry[0] ? ' selected' : '') + '>' + escapeHtml(entry[1]) + '</option>'; }).join("") + '</select></label>' +
        '<label>Periode<select name="period"><option value="all">Alle periodes</option><option value="30"' + (archiveFilters.period === "30" ? ' selected' : '') + '>Laatste 30 dagen</option><option value="90"' + (archiveFilters.period === "90" ? ' selected' : '') + '>Laatste 90 dagen</option><option value="older"' + (archiveFilters.period === "older" ? ' selected' : '') + '>Ouder dan 90 dagen</option></select></label>' +
        '<label>Titel<input name="query" type="search" value="' + escapeHtml(archiveFilters.query) + '" placeholder="Zoek op titel"></label><button class="small-button" type="submit">Filteren</button></form>' +
        (archiveRows.length ? '<div class="task-overview-list">' + archiveRows.map(function (task) { return renderTaskOverviewRow(task, "archived", showOwner); }).join("") + '</div>' :
          '<p class="muted">Geen gearchiveerde taken voor deze filters.</p>') + '</details>';
  }

  function renderTaskEditor() {
    const draft = state.tasks.draft;
    if (!draft) return renderTasksPage();
    const scopeItems = taskScopeItems(draft);
    const selectedItems = taskSelectedItems(draft);
    const rangeItems = scopeItems.slice(Math.max(0, (Number(draft.range_start) || 1) - 1),
      Math.min(scopeItems.length, Number(draft.range_end) || scopeItems.length));
    const trajectories = asArray(state.course && state.course.trajectories).map(function (row) { return row.trajectory; });
    const ranges = window.MonParcoursAssignments.numberedRanges(scopeItems.length);
    const strategies = taskStrategyChoices(rangeItems);
    const strategyNames = { item_mastery: "Vocabulaire / losse leeritems", verb_rule_mastery: "Regel en vervoeging beheersen", irregular_verb_mastery: "Onregelmatige werkwoorden beheersen", mixed_verb_mastery: "Gemengd werkwoordblok: alle doelen" };
    const strategySelect = '<label><span>Wat moet de leerling beheersen?</span><select name="mastery_strategy">' + strategies.map(function (strategy) {
      return '<option value="' + strategy + '"' + (strategy === draft.mastery_strategy ? ' selected' : '') + '>' + strategyNames[strategy] + '</option>';
    }).join("") + '</select></label>';
    const irregularItems = rangeItems.filter(function (item) {
      const type = window.MonParcoursVerbMastery && window.MonParcoursVerbMastery.classification(item.id);
      return type && type.kind === "irregular";
    });
    const verbSelector = ["irregular_verb_mastery", "mixed_verb_mastery"].includes(draft.mastery_strategy) && irregularItems.length
      ? '<div class="task-class-grid">' + irregularItems.map(function (item) {
        return '<label class="task-class"><input type="checkbox" name="verb_item_ids" value="' + escapeHtml(item.id) + '"' + (!draft.verb_item_ids || draft.verb_item_ids.includes(item.id) ? ' checked' : '') + '><span>' + escapeHtml(item.infinitive) + ' · ' + escapeHtml(item.nl) + '</span></label>';
      }).join("") + '</div>' : "";
    const classChoices = state.raw.classes.filter(function (row) { return row.is_active !== false; }).map(function (row) {
      return '<label class="task-class"><input type="checkbox" name="class_ids" value="' + escapeHtml(row.id) + '"' + (draft.class_ids.includes(row.id) ? ' checked' : '') + '><span>' + escapeHtml(row.name) + '</span></label>';
    }).join("");
    return '<div class="page-heading"><div><p class="eyebrow">Taken</p><h2>' + (draft.id ? "Taak bewerken" : "Nieuwe taak") + '</h2></div><button class="button button-secondary" type="button" data-action="view-tasks">Terug</button></div>' +
      (state.tasks.message ? '<p class="form-message" role="alert">' + escapeHtml(state.tasks.message) + '</p>' : '') +
      '<form class="task-form management-form" data-form="task-editor">' +
      '<fieldset><legend>1 · Klassen</legend><div class="task-class-grid">' + (classChoices || '<p>Geen actieve klassen beschikbaar.</p>') + '</div></fieldset>' +
      '<fieldset><legend>2 · Cursusonderdeel</legend>' +
        (draft.fixed_item_ids ? '<p class="muted">Deze bestaande taak behoudt zijn vaste itemselectie. Maak een nieuwe taak voor een andere selectie.</p>' :
        '<div class="task-fields"><label><span>Trajet</span><select name="trajectory">' + trajectories.map(function (value) { return '<option value="' + escapeHtml(value) + '"' + (value === draft.trajectory ? ' selected' : '') + '>' + escapeHtml(value) + '</option>'; }).join("") + '</select></label>' +
        taskSelect("top_category", "Onderdeel", taskScopeChoices(draft, "top_category"), draft.top_category) +
        taskSelect("lesson", "Les / inhoud", taskScopeChoices(draft, "lesson"), draft.lesson) +
        taskSelect("block", "Blok", taskScopeChoices(draft, "block"), draft.block) +
        taskSelect("subsection", "Subsection", taskScopeChoices(draft, "subsection"), draft.subsection) +
        taskSelect("category", "Categorie", taskScopeChoices(draft, "category"), draft.category) + '</div>') + '</fieldset>' +
      '<fieldset><legend>3 · Itemselectie</legend><p>' + scopeItems.length + ' oefenbare items in dit onderdeel.</p><div class="task-fields">' + strategySelect + '</div>' + verbSelector +
        (draft.fixed_item_ids ? '' : '<div class="task-fields"><label><span>Van item</span><input name="range_start" type="number" min="1" max="' + scopeItems.length + '" value="' + draft.range_start + '"></label><label><span>Tot item</span><input name="range_end" type="number" min="1" max="' + scopeItems.length + '" value="' + (draft.range_end || scopeItems.length) + '"></label></div><div class="export-actions"><button class="small-button" type="button" data-action="task-range" data-start="1" data-end="' + scopeItems.length + '">Alle ' + scopeItems.length + '</button>' + ranges.map(function (range) { return '<button class="small-button" type="button" data-action="task-range" data-start="' + range.start + '" data-end="' + range.end + '">' + range.start + '–' + range.end + '</button>'; }).join("") + '</div>') +
        '<p><strong>Voorbeeld: ' + selectedItems.length + ' geselecteerd.</strong></p><ol class="task-preview">' + selectedItems.slice(0, 20).map(function (item) { return '<li>' + escapeHtml(item.nl || item.prompt || item.infinitive || item.id) + ' — ' + escapeHtml(item.fr || item.answer || item.infinitive || '') + '</li>'; }).join("") + '</ol>' + (selectedItems.length > 20 ? '<p>… en ' + (selectedItems.length - 20) + ' meer.</p>' : '') + '</fieldset>' +
      '<fieldset><legend>4 · Doel en deadline</legend><div class="task-fields"><label><span>Titel</span><input name="title" maxlength="160" required value="' + escapeHtml(draft.title) + '"></label><label><span>Deadline (optioneel, lokale tijd)</span><input name="due_at" type="datetime-local" value="' + escapeHtml(draft.due_at) + '"></label>' +
        (draft.mastery_strategy === "item_mastery" && draft.completion_strategy === "rounds" ?
          '<label><span>Aantal rondes</span><select name="required_rounds">' + [1,2,3,4].map(function (value) { return '<option value="' + value + '"' + (Number(draft.required_rounds) === value ? ' selected' : '') + '>' + value + '×</option>'; }).join("") + '</select></label>' :
          '<label><span>Doel: % ' + (draft.mastery_strategy === "verb_rule_mastery" ? "regelbeheersing" : "gekend") + '</span><input name="target_acquired_percentage" type="number" min="1" max="100" value="' + draft.target_acquired_percentage + '"></label>') + '</div>' +
        (draft.mastery_strategy === "item_mastery" && draft.completion_strategy === "rounds" ? '<p>1× = één volledige ronde · 2× = twee volledige rondes · 3× = twee volledige rondes + gerichte herhaling · 4× = twee volledige rondes + twee gerichte herhalingen.</p>' :
          '<div class="export-actions">' + [70,80,90,100].map(function (value) { return '<button class="small-button" type="button" data-action="task-target" data-value="' + value + '">' + value + '%</button>'; }).join("") + '</div><p>' + (draft.mastery_strategy === "item_mastery" ? "Bestaande legacy-taak: voltooiing blijft gebaseerd op het percentage gekend." : "Voltooiing volgt de bestaande werkwoorddoelen.") + '</p>') +
        (draft.mastery_strategy === "item_mastery" && draft.completion_strategy === "rounds" && selectedItems.some(function (item) { return item.type === "verb"; }) ?
          '<label><span>Werkwoordoefening</span><select name="item_verb_exercise_key"><option value="verb-nl-conj"' + (draft.item_verb_exercise_key === "verb-nl-conj" ? " selected" : "") + '>Nederlands → vervoeging</option><option value="verb-fr-conj"' + (draft.item_verb_exercise_key === "verb-fr-conj" ? " selected" : "") + '>Frans → vervoeging</option><option value="verb-nl-inf"' + (draft.item_verb_exercise_key === "verb-nl-inf" ? " selected" : "") + '>Nederlands → infinitief</option></select></label>' : '') +
        '<label><span>Instructies (optioneel)</span><textarea name="instructions" maxlength="1000">' + escapeHtml(draft.instructions) + '</textarea></label></fieldset>' +
      '<fieldset><legend>5 · Controleren en publiceren</legend><p>' + selectedItems.length + ' vaste permanente item-ID’s · ' + draft.class_ids.length + ' klassen · ' +
        (draft.mastery_strategy === "item_mastery" && draft.completion_strategy === "rounds" ? draft.required_rounds + ' rondes.' : 'doel ' + draft.target_acquired_percentage + '%.') +
        '</p><div class="export-actions">' + (draft.status === "draft" ? '<button class="button button-secondary" type="submit" name="task_status" value="draft">Concept opslaan</button>' : '') + '<button class="button button-primary" type="submit" name="task_status" value="published">' + (draft.status === "published" ? "Wijzigingen opslaan" : "Publiceren") + '</button></div></fieldset></form>';
  }

  function renderTaskDetail() {
    const task = state.tasks.list.find(function (row) { return row.id === state.tasks.selectedId; });
    if (!task) return renderTasksPage();
    const canManage = currentTeacherIsAdmin() || task.created_by_teacher_id === state.user.id;
    const editable = task.status !== "archived" && canManage;
    const rows = asArray(state.tasks.detail);
    const statusFor = function (row) {
      if (row.completed_at) return "completed";
      if (task.due_at && new Date(task.due_at) < new Date()) return "late";
      return task.completion_strategy === "rounds" ? row.round_progress ? "in_progress" : "not_started" :
        Number(row.progress && row.progress.practiced || 0) ? "in_progress" : "not_started";
    };
    const statuses = { completed: "Afgerond", late: "Te laat", in_progress: "Bezig", not_started: "Niet gestart" };
    const filteredRows = state.tasks.filter === "all" ? rows : rows.filter(function (row) { return statusFor(row) === state.tasks.filter; });
    const completedCount = rows.filter(function (row) { return row.completed_at; }).length;
    const startedCount = rows.filter(function (row) { return !row.completed_at && statusFor(row) === "in_progress"; }).length;
    const averageMastery = rows.length ? Math.round(rows.reduce(function (total, row) { return total + Number(row.progress && row.progress.mastery_level || 0); }, 0) / rows.length) : 0;
    const verbTask = task.mastery_strategy && task.mastery_strategy !== "item_mastery";
    const reports = asArray(state.tasks.reports);
    const reportSection = task.completion_strategy === "rounds" ?
      '<section class="task-report-section"><div class="section-heading"><div><h3>Probleemmeldingen</h3><p>Goedkeuren rondt dit item af zonder extra beheersingspunten; terugsturen geeft het item terug.</p></div><span class="task-report-badge">' + reports.length + ' wachtend</span></div>' +
      (state.tasks.message ? '<p class="task-report-message" role="status">' + escapeHtml(state.tasks.message) + '</p>' : '') +
      (reports.length ? '<div class="task-report-list">' + reports.map(function (report) {
        const courseItem = state.courseIndex[report.item_id];
        const model = courseItem && (courseItem.fr || courseItem.infinitive || courseItem.answer) || '';
        return '<article class="task-report-card"><div><strong>' + escapeHtml(report.student_name) + '</strong> · ' + escapeHtml(report.class_name) +
          ' · ronde ' + Number(report.round_number) + '<p class="muted">' + escapeHtml(formatDate(report.created_at)) + ' · ' + escapeHtml(report.item_id) + '</p></div>' +
          '<p><b>Prompt:</b> ' + escapeHtml(report.prompt) + '</p><p><b>Getypt:</b> ' + asArray(report.submitted_answers).map(escapeHtml).join(' / ') + '</p>' +
          '<p><b>Verwacht:</b> ' + asArray(report.accepted_answers).map(escapeHtml).join(' / ') + (model ? ' · model: ' + escapeHtml(model) : '') + '</p>' +
          '<p class="muted">' + escapeHtml(report.exercise_direction) + ' · opgezocht: ' + (report.consulted ? 'ja' : 'nee') + ' · app ' + escapeHtml(report.app_version || 'onbekend') + '</p>' +
          '<div class="export-actions"><button class="button button-primary" type="button" data-action="resolve-item-report" data-id="' + escapeHtml(report.id) + '" data-decision="approved">Goedkeuren</button><button class="button button-secondary" type="button" data-action="resolve-item-report" data-id="' + escapeHtml(report.id) + '" data-decision="rejected">Terugsturen</button></div></article>';
      }).join('') + '</div>' : '<p class="muted">Geen meldingen die op beoordeling wachten.</p>') + '</section>' : '';
    return '<div class="page-heading"><div><p class="eyebrow">Taak · ' + escapeHtml(taskLifecycle(task) === "recent" ? "Recent afgelopen" : taskLifecycle(task) === "archived" ? "Gearchiveerd" : taskLifecycle(task) === "draft" ? "Concept" : "Actief") + '</p><h2>' + escapeHtml(task.title) + '</h2><p class="muted">' + (verbTask ? asArray(task.requirements).length + ' werkwoorddoelen' : asArray(task.item_ids).length + ' items') + ' · ' + (task.completion_strategy === "rounds" ? task.required_rounds + ' rondes' : 'doel ' + task.target_acquired_percentage + '%') + ' · ' + escapeHtml(task.due_at ? formatDate(task.due_at) : "Geen deadline") + '</p></div><div class="export-actions"><button class="button button-secondary" type="button" data-action="view-tasks">Terug</button><button class="button button-secondary" type="button" data-action="export-task">CSV</button>' + (editable ? '<button class="button button-primary" type="button" data-action="edit-task">Bewerken</button>' + (task.status === "published" ? '<button class="button button-secondary" type="button" data-action="archive-task">Archiveren</button>' : '') : task.status === "archived" && canManage ? '<button class="button button-primary" type="button" data-action="restore-task">Herstellen</button>' : '') + '</div></div>' +
      (task.status === "archived" && canManage && taskLifecycle(Object.assign({}, task, { status: "published" }), Date.now()) === "archived" ? '<p class="muted">Na herstel blijft deze taak wegens de oorspronkelijke deadline in het archief. Pas de deadline daarna aan als je haar opnieuw actief wilt maken.</p>' : '') +
      (task.instructions ? '<p>' + escapeHtml(task.instructions) + '</p>' : '') +
      '<div class="task-summary"><span><strong>' + completedCount + '/' + rows.length + '</strong> afgerond</span><span><strong>' + startedCount + '</strong> bezig</span><span><strong>' + (rows.length - completedCount - startedCount) + '</strong> niet gestart</span><span><strong>' + averageMastery + '%</strong> gemiddelde beheersing</span></div>' + reportSection +
      '<label class="task-filter"><span>Status</span><select id="taskStatusFilter"><option value="all"' + (state.tasks.filter === "all" ? ' selected' : '') + '>Alle</option>' + Object.entries(statuses).map(function (entry) { return '<option value="' + entry[0] + '"' + (state.tasks.filter === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>'; }).join("") + '</select></label>' +
      '<div class="table-wrap"><table><thead><tr><th>Klas / leerling</th><th>Status</th><th>Geoefend</th><th>Beheersing</th><th>Gekend</th><th>Doel / rondes</th><th>Laatste activiteit</th><th>Actieve taaktijd</th></tr></thead><tbody>' + filteredRows.map(function (row) {
        const progress = row.progress || {};
        const round = row.round_progress;
        const status = statuses[statusFor(row)];
        const goalDetails = verbTask ? '<div class="task-goal-details">' + asArray(progress.goals).map(function (goal) {
          const courseItem = state.courseIndex[goal.goal_id];
          const label = courseItem ? courseItem.infinitive : goal.goal_id === "present_er" ? "Verbes en -ER" : goal.goal_id;
          return '<span>' + escapeHtml(label) + ': ' + Number(goal.level || 0) + '% · ' + Number(goal.persons || 0) + '/6 pers. · ' + Number(goal.conjugation_accuracy ?? goal.accuracy ?? 0) + '% juist · ' + Number(goal.verbs || 0) + ' ww. · ' + Number(goal.sessions || 0) + ' sessies · laatst ' + escapeHtml(goal.last_activity ? formatDate(goal.last_activity) : '—') + '</span>';
        }).join("") + '</div>' : "";
        return '<tr><td>' + escapeHtml(row.class_name) + ' · <strong>' + escapeHtml(row.student_name) + '</strong></td><td>' + status + (round ? ' · ronde ' + round.round_number + '/' + round.required_rounds + ' · ' + round.completed + '/' + round.total : '') + (row.completed_at ? ' · ' + escapeHtml(formatDate(row.completed_at)) : '') + '</td><td>' + Number(progress.practiced || 0) + '/' + Number(progress.total || 0) + '</td><td>' + Number(progress.mastery_level || 0) + '%' + goalDetails + '</td><td>' + Number(progress.acquired || 0) + '/' + Number(progress.total || 0) + ' · ' + (Number(progress.total || 0) ? Math.round(Number(progress.acquired || 0) * 100 / Number(progress.total)) : 0) + '%</td><td>' + (task.completion_strategy === "rounds" ? task.required_rounds + ' rondes' : task.target_acquired_percentage + '%') + '</td><td>' + escapeHtml(progress.last_activity ? formatDate(progress.last_activity) : "—") + '</td><td>' + formatActiveDuration(row.active_task_time) + '</td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function renderCurrent() {
    const content = document.querySelector("#dashboardContent");
    if (!content || !state.user) return;
    const data = currentFilteredData();
    document.querySelector("#filterBar").hidden = state.route.view === "management" || state.route.view === "teachers" || state.route.view.indexOf("task") === 0;
    if (state.route.view === "management") content.innerHTML = renderManagement();
    else if (state.route.view === "teachers") content.innerHTML = renderTeachersPage();
    else if (state.route.view === "tasks") content.innerHTML = renderTasksPage();
    else if (state.route.view === "task-detail") content.innerHTML = renderTaskDetail();
    else if (state.route.view === "task-editor") content.innerHTML = renderTaskEditor();
    else if (state.route.view === "classes") content.innerHTML = renderClassesPage(data);
    else if (state.route.view === "class") content.innerHTML = renderClassDetail(data, state.route.classId);
    else if (state.route.view === "student") content.innerHTML = renderStudentDetail(data, state.route.studentId);
    else content.innerHTML = renderDashboard(data);
    updateNavigation();
  }

  function populateFilters() {
    const trajectorySelect = document.querySelector("#trajectoryFilter");
    const modeSelect = document.querySelector("#modeFilter");
    const classSelect = document.querySelector("#classFilter");
    const studentSelect = document.querySelector("#studentFilter");
    const studentStatusSelect = document.querySelector("#studentStatusFilter");
    const categorySelect = document.querySelector("#categoryFilter");
    const subsectionSelect = document.querySelector("#subsectionFilter");
    const assignmentSelect = document.querySelector("#assignmentFilter");
    const trajectories = courseTrajectories(state.course, state.raw.sessions);
    const modes = ["learn", "practice", "test"];
    const courseItems = asArray(state.course && state.course.trajectories).flatMap(function (row) { return asArray(row.items); });
    const categories = Array.from(new Set(courseItems.map(function (item) { return item.top_category; }).concat(state.raw.sessions.map(function (session) { return session.top_category; })).filter(Boolean)));
    const subsections = Array.from(new Set(courseItems.map(function (item) { return item.subsection; }).concat(state.raw.sessions.map(function (session) { return session.subsection; })).filter(Boolean)));
    const availableStudents = state.raw.students.filter(function (student) { return state.filters.classId === "all" || student.class_id === state.filters.classId; });
    trajectorySelect.innerHTML = '<option value="all">Alle Trajets</option>' + trajectories.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    modeSelect.innerHTML = '<option value="all">Alle modi</option>' + modes.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(modeLabel(value)) + '</option>'; }).join("");
    classSelect.innerHTML = '<option value="all">Alle klassen</option>' + state.raw.classes.map(function (row) { return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.name) + '</option>'; }).join("");
    studentSelect.innerHTML = '<option value="all">Alle leerlingen</option>' + availableStudents.map(function (row) { return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.display_name || "Naamloze leerling") + '</option>'; }).join("");
    categorySelect.innerHTML = '<option value="all">Alle onderdelen</option>' + categories.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    subsectionSelect.innerHTML = '<option value="all">Alle subsections</option>' + subsections.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    if (assignmentSelect) assignmentSelect.innerHTML = '<option value="all">Alle taken</option>' + state.tasks.list.filter(function (task) { return task.status === "published"; }).map(function (task) {
      return '<option value="' + escapeHtml(task.id) + '">' + escapeHtml(task.title) + '</option>';
    }).join("");
    if (trajectories.indexOf(state.filters.trajectory) < 0) state.filters.trajectory = "all";
    if (modes.indexOf(state.filters.mode) < 0) state.filters.mode = "all";
    if (!state.raw.classes.some(function (row) { return row.id === state.filters.classId; })) state.filters.classId = "all";
    if (!availableStudents.some(function (row) { return row.id === state.filters.studentId; })) state.filters.studentId = "all";
    if (categories.indexOf(state.filters.category) < 0) state.filters.category = "all";
    if (subsections.indexOf(state.filters.subsection) < 0) state.filters.subsection = "all";
    if (!state.tasks.list.some(function (task) { return task.id === state.filters.assignmentId && task.status === "published"; })) state.filters.assignmentId = "all";
    trajectorySelect.value = state.filters.trajectory;
    modeSelect.value = state.filters.mode;
    classSelect.value = state.filters.classId;
    studentSelect.value = state.filters.studentId;
    studentStatusSelect.value = state.filters.studentStatus;
    categorySelect.value = state.filters.category;
    subsectionSelect.value = state.filters.subsection;
    if (assignmentSelect) assignmentSelect.value = state.filters.assignmentId;
  }

  function updateNavigation() {
    const current = state.route.view === "management" ? "view-management" : state.route.view === "teachers" ? "view-teachers" : state.route.view.indexOf("task") === 0 ? "view-tasks" : state.route.view === "dashboard" ? "view-dashboard" : "view-classes";
    document.querySelectorAll("#teacherNav [data-action]").forEach(function (button) {
      if (button.dataset.action === current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function isShortPeriod(period) {
    return period === "15m" || period === "30m" || period === "60m";
  }

  function clearAutoRefresh() {
    if (state.autoRefreshTimer) window.clearTimeout(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }

  function scheduleAutoRefresh() {
    clearAutoRefresh();
    if (!state.user || !["dashboard", "classes"].includes(state.route.view) || !isShortPeriod(state.filters.period)) return;
    state.autoRefreshTimer = window.setTimeout(async function () {
      state.autoRefreshTimer = null;
      if (document.hidden || state.loading || state.monitor.loading || !state.user || !["dashboard", "classes"].includes(state.route.view)) {
        scheduleAutoRefresh();
        return;
      }
      try {
        await refreshMonitor(false);
      } finally {
        scheduleAutoRefresh();
      }
    }, MONITOR_REFRESH_MS);
  }

  function showLogin(message) {
    clearAutoRefresh();
    state.user = null;
    state.teacherProfile = null;
    state.raw = emptyDataset();
    state.monitor = { rows: [], error: "", loading: false, pending: false, masteryByStudent: Object.create(null), masteryRefreshedAt: 0 };
    state.analyticsLoaded = false;
    state.studentVerbGoals = Object.create(null);
    state.studentVerbGoalsError = false;
    state.management = { loaded: false, classes: [], students: [], selectedClassId: null, studentStatus: "active", generatedCode: "", createdStudents: [], message: "", messageIsError: false };
    state.teacherAdmin = { loaded: false, teachers: [], assignments: [], classes: [], editingTeacherId: null, message: "", messageIsError: false };
    state.tasks = { loaded: false, list: [], detail: [], reports: [], selectedId: null, draft: null, filter: "all",
      ownerFilter: "mine", archiveOpen: false, archiveFilters: { classId: "all", creatorId: "all", period: "all", query: "" },
      message: "", error: false };
    state.route = { view: "dashboard", classId: null, studentId: null };
    document.querySelector("#authView").hidden = false;
    document.querySelector("#dashboardView").hidden = true;
    document.querySelector("#accountArea").hidden = true;
    document.querySelector("#teacherNav").hidden = true;
    document.querySelector("#teachersNavButton").hidden = true;
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
    document.querySelector("#dashboardView").hidden = true;
    document.querySelector("#teacherNav").hidden = true;
    let profile;
    try {
      profile = await loadTeacherProfile(state.client, session.user.id);
    } catch (error) {
      await state.client.auth.signOut();
      showLogin("Je leerkrachtenaccount kon niet veilig worden gecontroleerd. Probeer later opnieuw.");
      return;
    }
    if (!profile || profile.is_active !== true) {
      await state.client.auth.signOut();
      showLogin("Je leerkrachtenaccount heeft nog geen toegang. Neem contact op met de beheerder.");
      return;
    }
    const sameUser = state.user && state.user.id === session.user.id;
    if (!sameUser) {
      state.raw = emptyDataset();
      state.monitor = { rows: [], error: "", loading: false, pending: false, masteryByStudent: Object.create(null), masteryRefreshedAt: 0 };
      state.analyticsLoaded = false;
      state.studentVerbGoals = Object.create(null);
      state.studentVerbGoalsError = false;
      state.tasks = { loaded: false, list: [], detail: [], reports: [], selectedId: null, draft: null, filter: "all",
        ownerFilter: "mine", archiveOpen: false, archiveFilters: { classId: "all", creatorId: "all", period: "all", query: "" },
        message: "", error: false };
      state.management = { loaded: false, classes: [], students: [], selectedClassId: null, studentStatus: "active", generatedCode: "", createdStudents: [], message: "", messageIsError: false };
      state.teacherAdmin = { loaded: false, teachers: [], assignments: [], classes: [], editingTeacherId: null, message: "", messageIsError: false };
      state.filters.classId = "all";
      state.filters.studentId = "all";
      state.filters.assignmentId = "all";
    }
    state.user = session.user;
    state.teacherProfile = profile;
    document.querySelector("#authView").hidden = true;
    document.querySelector("#dashboardView").hidden = false;
    document.querySelector("#accountArea").hidden = false;
    document.querySelector("#teacherNav").hidden = false;
    document.querySelector("#accountLabel").textContent = (profile.display_name || profile.email || displayNameForUser(session.user)) + (profile.role === "admin" ? " · admin" : "");
    document.querySelector("#teachersNavButton").hidden = profile.role !== "admin";
    document.querySelector("#loginMessage").textContent = "";
    if (sameUser && state.loading && !forceReload) return;
    if (sameUser && !forceReload && state.raw.classes.length + state.raw.students.length > 0) {
      renderCurrent();
      scheduleAutoRefresh();
      return;
    }
    const sequence = ++state.loadSequence;
    state.loading = true;
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Resultaten worden veilig geladen…</p></section>';
    try {
      const dataset = await loadDashboardBase(state.client);
      if (sequence !== state.loadSequence || !state.user) return;
      state.raw = dataset;
      state.analyticsLoaded = false;
      const taskResult = await state.client.rpc("get_teacher_assignments");
      if (!taskResult.error) {
        state.tasks.list = asArray(taskResult.data);
        state.tasks.loaded = true;
      }
      populateFilters();
      await refreshMonitor(true, false);
      renderCurrent();
      scheduleAutoRefresh();
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

  async function openManagement(forceReload) {
    state.route = { view: "management", classId: null, studentId: null };
    document.querySelector("#filterBar").hidden = true;
    if (state.management.loaded && !forceReload) {
      renderCurrent();
      return;
    }
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Beheergegevens worden veilig geladen…</p></section>';
    updateNavigation();
    try {
      const data = await loadManagementDataset(state.client);
      state.management.classes = data.classes;
      state.management.students = data.students;
      state.management.loaded = true;
      if (!state.management.selectedClassId && data.classes.length) state.management.selectedClassId = data.classes[0].id;
      renderCurrent();
    } catch (error) {
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Beheer kon niet worden geladen.</strong><p>Controleer de authenticated grants en RLS-policies in Supabase.</p></div>';
    }
  }

  async function openTeachers(forceReload) {
    if (!currentTeacherIsAdmin()) return;
    state.route = { view: "teachers", classId: null, studentId: null };
    document.querySelector("#filterBar").hidden = true;
    if (state.teacherAdmin.loaded && !forceReload) {
      renderCurrent();
      return;
    }
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Leerkrachtentoegang wordt veilig geladen…</p></section>';
    updateNavigation();
    try {
      const data = await loadTeacherAdminDataset(state.client);
      state.teacherAdmin.teachers = data.teachers;
      state.teacherAdmin.assignments = data.assignments;
      state.teacherAdmin.classes = data.classes;
      state.teacherAdmin.loaded = true;
      state.teacherAdmin.editingTeacherId = null;
      renderCurrent();
    } catch (error) {
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Leerkrachten konden niet worden geladen.</strong><p>Alleen een actieve admin heeft toegang tot dit onderdeel.</p></div>';
    }
  }

  async function openTasks(forceReload) {
    state.route = { view: "tasks", classId: null, studentId: null };
    document.querySelector("#filterBar").hidden = true;
    if (state.tasks.loaded && !forceReload) return renderCurrent();
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Taken worden veilig geladen…</p></section>';
    updateNavigation();
    try {
      const result = await state.client.rpc("get_teacher_assignments");
      if (result.error) throw result.error;
      state.tasks.list = asArray(result.data);
      state.tasks.loaded = true;
      state.tasks.message = "";
      renderCurrent();
    } catch (error) {
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Taken konden niet worden geladen.</strong><p>Controleer je verbinding en of fase 7 in Supabase is uitgevoerd.</p></div>';
    }
  }

  async function openTaskDetail(id) {
    const task = state.tasks.list.find(function (row) { return row.id === id; });
    if (!task) return openTasks(true);
    state.tasks.selectedId = id;
    state.route = { view: "task-detail", classId: null, studentId: null };
    document.querySelector("#dashboardContent").innerHTML = '<section class="loading-state"><span class="loader" aria-hidden="true"></span><p>Leerlingvoortgang wordt geladen…</p></section>';
    updateNavigation();
    try {
      const [result, reportResult] = await Promise.all([
        state.client.rpc("get_teacher_assignment_detail", { p_assignment_id: id }),
        task.completion_strategy === "rounds" ? state.client.rpc("get_teacher_assignment_reports", { p_assignment_id: id }) : Promise.resolve({ data: [] })
      ]);
      if (result.error) throw result.error;
      state.tasks.detail = asArray(result.data);
      state.tasks.reports = reportResult.error ? [] : asArray(reportResult.data);
      state.tasks.message = reportResult.error ? "Probleemmeldingen zijn tijdelijk niet beschikbaar. Controleer de verbinding en of de aparte SQL-migratie is uitgevoerd; bestaande taakdetails blijven zichtbaar." : "";
      renderCurrent();
    } catch (error) {
      document.querySelector("#dashboardContent").innerHTML = '<div class="error-state"><strong>Taakdetails konden niet worden geladen.</strong><p>Probeer opnieuw.</p></div>';
    }
  }

  function updateTaskDraftFromForm(form) {
    const draft = state.tasks.draft;
    if (!draft || !form) return;
    ["title", "instructions", "due_at", "target_acquired_percentage", "mastery_strategy", "required_rounds", "item_verb_exercise_key", "trajectory", "top_category", "lesson", "block", "subsection", "category", "range_start", "range_end"].forEach(function (name) {
      const field = form.elements.namedItem(name);
      if (field) draft[name] = field.value;
    });
    draft.class_ids = Array.from(form.querySelectorAll('input[name="class_ids"]:checked')).map(function (field) { return field.value; });
    if (form.querySelector && form.querySelector('input[name="verb_item_ids"]')) draft.verb_item_ids = Array.from(form.querySelectorAll('input[name="verb_item_ids"]:checked')).map(function (field) { return field.value; });
  }

  async function saveTask(event, form) {
    event.preventDefault();
    updateTaskDraftFromForm(form);
    const draft = state.tasks.draft;
    const status = event.submitter && event.submitter.value || "draft";
    const items = taskSelectedItems(draft);
    if (!taskStrategyChoices(items).includes(draft.mastery_strategy)) {
      state.tasks.message = "Deze beheersingswijze past niet bij de geselecteerde werkwoorden.";
      return renderCurrent();
    }
    if (!draft.class_ids.length || !items.length || !draft.title.trim()) {
      state.tasks.message = "Kies minstens één klas en één item en vul een titel in.";
      return renderCurrent();
    }
    if (draft.mastery_strategy === "verb_rule_mastery" || draft.mastery_strategy === "mixed_verb_mastery") {
      const api = window.MonParcoursVerbMastery;
      const rules = taskRequirements(draft, items).filter(function (row) { return row.requirement_type === "verb_rule_mastery"; });
      if (rules.some(function (rule) { return items.filter(function (item) { return api.classification(item.id).ruleId === rule.reference_id; }).length < 3; })) {
        state.tasks.message = "Kies minstens drie verschillende werkwoorden per regeldoel.";
        return renderCurrent();
      }
    }
    let deadline;
    try { deadline = taskDeadlineUtc(draft.due_at); }
    catch (error) { state.tasks.message = error.message; return renderCurrent(); }
    const payload = {
      id: draft.id, title: draft.title.trim(), instructions: draft.instructions.trim(),
      due_at: deadline,
      target_acquired_percentage: Number(draft.target_acquired_percentage),
      mastery_strategy: draft.mastery_strategy,
      completion_strategy: draft.id && draft.completion_strategy !== "rounds" ? draft.completion_strategy :
        draft.mastery_strategy === "item_mastery" ? "rounds" : draft.mastery_strategy,
      required_rounds: Number(draft.required_rounds || 3),
      item_verb_exercise_key: draft.item_verb_exercise_key,
      requirements: taskRequirements(draft, items),
      class_ids: draft.class_ids, item_ids: items.map(function (item) { return item.id; }), status: status
    };
    const buttons = form.querySelectorAll('button[type="submit"]');
    buttons.forEach(function (button) { button.disabled = true; });
    try {
      const result = await state.client.rpc("save_assignment", { p_payload: payload });
      if (result.error) throw result.error;
      await openTasks(true);
      state.tasks.message = status === "published" ? "Taak gepubliceerd." : "Concept opgeslagen.";
      renderCurrent();
    } catch (error) {
      state.tasks.message = /scope locked/i.test(String(error.message)) ? "De itemselectie van deze taak is vergrendeld na leerlingactiviteit." :
        /regular rule needs at least three verbs/i.test(String(error.message)) ? "Kies minstens drie verschillende werkwoorden per regeldoel." :
        "Taak opslaan mislukt. Controleer je rechten en probeer opnieuw.";
      renderCurrent();
    }
  }

  async function reloadAfterManagementMutation(createdStudents) {
    const results = await Promise.all([loadManagementDataset(state.client), loadDashboardBase(state.client)]);
    state.management.classes = results[0].classes;
    state.management.students = results[0].students;
    state.management.loaded = true;
    state.management.generatedCode = "";
    if (createdStudents) state.management.createdStudents = createdStudents;
    state.raw = results[1];
    state.analyticsLoaded = false;
    state.monitor.masteryByStudent = Object.create(null);
    await refreshMonitor(true, false);
    populateFilters();
    renderCurrent();
  }

  function friendlyManagementError(error) {
    const message = String(error && error.message || "");
    if (/last active admin|laatste actieve admin/i.test(message)) return "De laatste actieve beheerder kan niet worden gedeactiveerd of gewijzigd naar leerkracht.";
    if (/duplicate|unique/i.test(message)) return "Deze klas- of leerlingcode bestaat al. Probeer opnieuw.";
    if (/row-level security|permission|policy/i.test(message)) return "Supabase heeft deze wijziging via RLS geweigerd.";
    return message && !/^[A-Z_]+$/.test(message) ? message : "De wijziging kon niet worden opgeslagen. Probeer opnieuw.";
  }

  async function handleManagementSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    if (form.dataset.form === "task-editor") return saveTask(event, form);
    if (form.dataset.form === "task-archive-filters") {
      event.preventDefault();
      const values = new FormData(form);
      state.tasks.archiveFilters = { classId: String(values.get("class_id") || "all"),
        creatorId: String(values.get("creator_id") || "all"), period: String(values.get("period") || "all"),
        query: String(values.get("query") || "").trim().slice(0, 160) };
      state.tasks.archiveOpen = true;
      renderCurrent();
      return;
    }
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    submit.disabled = true;
    const teacherAccessForm = form.dataset.form === "teacher-access";
    if (teacherAccessForm) {
      state.teacherAdmin.message = "Opslaan…";
      state.teacherAdmin.messageIsError = false;
    } else {
      state.management.message = "Opslaan…";
      state.management.messageIsError = false;
    }
    try {
      if (teacherAccessForm) {
        if (!currentTeacherIsAdmin()) throw new Error("Alleen admins kunnen leerkrachtentoegang wijzigen.");
        await updateTeacherAccess(state.client, {
          teacherId: String(values.get("teacher_id")),
          displayName: String(values.get("display_name") || ""),
          role: String(values.get("role") || "teacher"),
          isActive: values.get("is_active") === "true",
          classIds: values.getAll("class_ids").map(String)
        });
        const data = await loadTeacherAdminDataset(state.client);
        state.teacherAdmin.teachers = data.teachers;
        state.teacherAdmin.assignments = data.assignments;
        state.teacherAdmin.classes = data.classes;
        state.teacherAdmin.loaded = true;
        state.teacherAdmin.editingTeacherId = null;
        state.teacherAdmin.message = "Leerkrachtentoegang opgeslagen.";
        state.teacherAdmin.messageIsError = false;
        renderCurrent();
      } else if (form.dataset.form === "create-class") {
        if (!currentTeacherIsAdmin()) throw new Error("Alleen admins kunnen klassen aanmaken.");
        const created = await createClassRecord(state.client, state.user, { name: values.get("name"), classCode: values.get("class_code") }, state.management.classes);
        state.management.selectedClassId = created.id;
        state.management.createdStudents = [];
        state.management.message = "Klas aangemaakt.";
        await reloadAfterManagementMutation();
      } else if (form.dataset.form === "update-class") {
        if (!currentTeacherIsAdmin()) throw new Error("Alleen admins kunnen klassen wijzigen.");
        await updateClassRecord(state.client, String(values.get("class_id")), { name: values.get("name"), is_active: values.get("is_active") === "true" });
        state.management.message = "Klas bijgewerkt. Historische resultaten zijn behouden.";
        await reloadAfterManagementMutation();
      } else if (form.dataset.form === "add-student") {
        const existingCodes = state.management.students.map(function (student) { return student.student_code; });
        const existingEmails = state.management.students.map(function (student) { return student.school_email; });
        const createdStudents = await createStudentRecords(state.client, String(values.get("class_id")), [{ name: values.get("display_name"), schoolEmail: values.get("school_email") }], existingCodes, window.crypto, [values.get("generated_code")], existingEmails);
        state.management.message = "Leerling toegevoegd. Deel de code via een veilig kanaal.";
        await reloadAfterManagementMutation(createdStudents);
      } else if (form.dataset.form === "bulk-students") {
        const students = parseBulkStudents(values.get("names"));
        if (!students.length) throw new Error("Geef minstens één geldige leerlingnaam, één per regel.");
        if (students.length > 200) throw new Error("Voeg maximaal 200 leerlingen per keer toe.");
        const existingCodes = state.management.students.map(function (student) { return student.student_code; });
        const existingEmails = state.management.students.map(function (student) { return student.school_email; });
        const createdStudents = await createStudentRecords(state.client, String(values.get("class_id")), students, existingCodes, window.crypto, null, existingEmails);
        state.management.message = createdStudents.length + " leerlingen toegevoegd.";
        await reloadAfterManagementMutation(createdStudents);
      }
    } catch (error) {
      if (teacherAccessForm) {
        state.teacherAdmin.message = friendlyManagementError(error);
        state.teacherAdmin.messageIsError = true;
      } else {
        state.management.message = friendlyManagementError(error);
        state.management.messageIsError = true;
      }
      renderCurrent();
    } finally {
      submit.disabled = false;
    }
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function safeFilename(value) {
    return String(value || "export").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
  }

  function exportResult(action, id) {
    const data = currentFilteredData();
    const classRow = data.classes.find(function (row) { return row.id === id; }) || state.raw.classes.find(function (row) { return row.id === id; });
    const student = data.students.find(function (row) { return row.id === id; }) || state.raw.students.find(function (row) { return row.id === id; });
    if (action === "export-class" && classRow) {
      downloadCsv("klasoverzicht-" + safeFilename(classRow.name) + ".csv", ["Leerlingnaam", "Sessies", "Geselecteerde oefeningen", "Oefeningen gemaakt", "Pogingen", "Correct", "Fout", "Percentage correct", "Actieve tijd (seconden)", "Actieve tijd", "Laatste activiteit"], classOverviewRows(data, classRow.id));
    }
    if (action === "export-student" && student) {
      downloadCsv("sessies-" + safeFilename(student.display_name) + ".csv", ["Datum", "Status", "Modus", "Trajet", "Cursusonderdeel", "Les", "Blok", "Subsection", "Geselecteerd", "Oefeningen gemaakt", "Pogingen", "Correct", "Fout", "Percentage correct", "Actieve tijd (seconden)", "Actieve tijd"], studentSessionRows(data, student.id));
    }
    if (action === "export-difficult-class" && classRow) {
      downloadCsv("moeilijke-items-" + safeFilename(classRow.name) + ".csv", ["Leerling", "Klas", "Nederlandse prompt / item", "Frans modelantwoord", "Trajet", "Onderdeel", "Itemvariant", "Pogingen", "Fout", "Foutpercentage"], difficultItemRows(data, state.courseIndex, classRow.id, null));
    }
    if (action === "export-difficult-student" && student) {
      downloadCsv("moeilijke-items-" + safeFilename(student.display_name) + ".csv", ["Leerling", "Klas", "Nederlandse prompt / item", "Frans modelantwoord", "Trajet", "Onderdeel", "Itemvariant", "Pogingen", "Fout", "Foutpercentage"], difficultItemRows(data, state.courseIndex, null, student.id));
    }
  }

  async function handleContentClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action === "select-monitor-class") {
      state.filters.classId = id;
      state.filters.studentId = "all";
      state.monitorQuickFilter = "all";
      state.route = { view: "dashboard", classId: null, studentId: null };
      populateFilters();
      renderCurrent();
      await refreshMonitor(true);
      scheduleAutoRefresh();
      return;
    }
    if (action === "monitor-quick") {
      state.monitorQuickFilter = target.dataset.value || "all";
      renderCurrent();
      return;
    }
    if (action === "monitor-task") {
      if (!state.tasks.list.some(function (task) { return task.id === id; })) await openTasks(true);
      if (state.tasks.list.some(function (task) { return task.id === id; })) return openTaskDetail(id);
      return;
    }
    if (action === "load-analysis") {
      target.disabled = true;
      try { await ensureAnalyticsData(); renderCurrent(); }
      catch (error) { target.disabled = false; target.textContent = "Analyse laden mislukt · opnieuw proberen"; }
      return;
    }
    if (action === "export-monitor") {
      const classRow = state.raw.classes.find(function (row) { return row.id === state.filters.classId; });
      if (!classRow) return;
      const rows = sortClassMonitor(state.monitor.rows.filter(function (row) { return row.student.class_id === classRow.id &&
        (state.monitorQuickFilter === "all" || state.monitorQuickFilter === "idle" && row.status === "Nog niet gestart" || state.monitorQuickFilter === "active" && row.status === "Bezig"); }), state.monitorSort);
      downloadCsv("klasmonitor-" + safeFilename(classRow.name) + ".csv", ["Leerling", "Status", "Oefeningen", "Pogingen", "Actieve tijd (s, sessiestartperiode)", "Laatst actief", "Correct %", "Huidige mastery %", "Actieve taak"],
        rows.map(function (row) { return [row.student.display_name, row.status, row.exercisesMade, row.attempts, row.activeDurationSeconds, row.lastActivity || "", row.accuracy == null ? "" : row.accuracy, row.masteryPercentage == null ? "" : row.masteryPercentage, row.activeAssignmentCount > 1 ? row.activeAssignmentCount + " actieve taken" : row.activeAssignment && row.activeAssignment.title || ""]; }));
      return;
    }
    if (action === "view-tasks") {
      await openTasks(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "task-owner-filter") {
      if (target.dataset.value !== "mine" && target.dataset.value !== "all") return;
      state.tasks.ownerFilter = target.dataset.value;
      state.tasks.archiveOpen = false;
      state.tasks.archiveFilters = { classId: "all", creatorId: "all", period: "all", query: "" };
      renderCurrent();
      return;
    }
    if (action === "new-task") {
      state.tasks.draft = taskDraftDefaults();
      state.tasks.draft.autoTitle = taskSuggestedTitle(state.tasks.draft);
      state.tasks.draft.title = state.tasks.draft.autoTitle;
      state.tasks.message = "";
      state.route = { view: "task-editor", classId: null, studentId: null };
      renderCurrent();
      return;
    }
    if (action === "task-range" && state.tasks.draft) {
      updateTaskDraftFromForm(target.closest("form"));
      const wasAuto = state.tasks.draft.title === state.tasks.draft.autoTitle;
      state.tasks.draft.range_start = Number(target.dataset.start);
      state.tasks.draft.range_end = Number(target.dataset.end);
      state.tasks.draft.autoTitle = taskSuggestedTitle(state.tasks.draft);
      if (wasAuto) state.tasks.draft.title = state.tasks.draft.autoTitle;
      return renderCurrent();
    }
    if (action === "task-target" && state.tasks.draft) {
      updateTaskDraftFromForm(target.closest("form"));
      state.tasks.draft.target_acquired_percentage = Number(target.dataset.value);
      return renderCurrent();
    }
    if (action === "open-task") return openTaskDetail(id);
    if (action === "resolve-item-report") {
      const decision = target.dataset.decision;
      if (!state.tasks.reports.some(function (report) { return report.id === id; }) ||
        !["approved", "rejected"].includes(decision)) return;
      target.disabled = true;
      try {
        const result = await state.client.rpc("resolve_assignment_item_report", {
          p_report_id: id, p_decision: decision
        });
        if (result.error) throw result.error;
        const taskId = state.tasks.selectedId;
        await openTasks(true);
        await openTaskDetail(taskId);
        state.tasks.message = decision === "approved" ? "Melding goedgekeurd. Het item is afgerond zonder extra beheersingspunten." :
          "Melding afgewezen. Het item staat opnieuw klaar voor de leerling.";
        renderCurrent();
      } catch (error) {
        state.tasks.message = "Beoordeling niet opgeslagen. Controleer je verbinding en probeer opnieuw.";
        renderCurrent();
      }
      return;
    }
    if (action === "edit-task") {
      const task = state.tasks.list.find(function (row) { return row.id === state.tasks.selectedId; });
      if (!task || !(currentTeacherIsAdmin() || task.created_by_teacher_id === state.user.id)) return;
      state.tasks.draft = taskDraftDefaults(task);
      state.tasks.message = "";
      state.route = { view: "task-editor", classId: null, studentId: null };
      return renderCurrent();
    }
    if (action === "archive-task") {
      const task = state.tasks.list.find(function (row) { return row.id === state.tasks.selectedId; });
      if (!task || task.status !== "published" || !(currentTeacherIsAdmin() || task.created_by_teacher_id === state.user.id)) return;
      const beforeDeadline = !task.due_at || new Date(task.due_at).getTime() > Date.now();
      if (!window.confirm(beforeDeadline ? "Deze taak vóór de deadline archiveren? Leerlingen zien haar daarna niet meer als actieve taak. Historische resultaten blijven bewaard." :
        "Deze taak archiveren? Historische voltooiingen en resultaten blijven bewaard.")) return;
      const payload = { id: task.id, title: task.title, instructions: task.instructions, due_at: task.due_at,
        target_acquired_percentage: task.target_acquired_percentage, mastery_strategy: task.mastery_strategy || "item_mastery",
        completion_strategy: task.completion_strategy, required_rounds: task.required_rounds,
        item_verb_exercise_key: task.item_verb_exercise_key,
        requirements: task.requirements || [], class_ids: task.class_ids, item_ids: task.item_ids, status: "archived" };
      const result = await state.client.rpc("save_assignment", { p_payload: payload });
      if (result.error) { state.tasks.message = "Archiveren mislukt."; return renderCurrent(); }
      return openTasks(true);
    }
    if (action === "restore-task") {
      const task = state.tasks.list.find(function (row) { return row.id === state.tasks.selectedId; });
      if (!task || task.status !== "archived" || !(currentTeacherIsAdmin() || task.created_by_teacher_id === state.user.id)) return;
      const remainsArchived = taskLifecycle(Object.assign({}, task, { status: "published" }), Date.now()) === "archived";
      if (!window.confirm(remainsArchived ? "Herstellen zonder de deadline te wijzigen? Deze taak blijft wegens de oude deadline in het archief totdat je de deadline aanpast." :
        "Deze taak opnieuw publiceren met dezelfde deadline? Historische resultaten blijven behouden.")) return;
      const result = await state.client.rpc("restore_assignment", { p_assignment_id: task.id });
      if (result.error) { state.tasks.message = "Herstellen mislukt. Controleer je rechten en of de lifecycle-migratie is uitgevoerd."; return renderCurrent(); }
      await openTasks(true);
      return openTaskDetail(task.id);
    }
    if (action === "export-task") {
      const task = state.tasks.list.find(function (row) { return row.id === state.tasks.selectedId; });
      if (!task) return;
      downloadCsv("taak-" + safeFilename(task.title) + ".csv", ["Taak", "Klas", "Leerling", "Status", "Items geoefend", "Items totaal", "Beheersing %", "Gekend", "Gekend %", "Doel %", "Voltooid op", "Laatste activiteit", "Actieve taaktijd (s)", "Completion strategy", "Ronde", "Rondes vereist", "Ronde-items juist", "Ronde-items totaal"],
        asArray(state.tasks.detail).map(function (row) { const p = row.progress || {}; const r = row.round_progress || {}; const status = row.completed_at ? "Afgerond" : task.due_at && new Date(task.due_at) < new Date() ? "Te laat" : task.completion_strategy === "rounds" ? r.round_number ? "Bezig" : "Niet gestart" : Number(p.practiced || 0) ? "Bezig" : "Niet gestart"; return [task.title, row.class_name, row.student_name, status, p.practiced, p.total, p.mastery_level, p.acquired, Number(p.total || 0) ? Math.round(Number(p.acquired || 0) * 100 / Number(p.total)) : 0, task.completion_strategy === "rounds" ? "" : task.target_acquired_percentage, row.completed_at || "", p.last_activity || "", row.active_task_time || 0, task.completion_strategy || "legacy_mastery", r.round_number || "", r.required_rounds || (task.completion_strategy === "rounds" ? task.required_rounds : ""), r.completed || 0, r.total || 0]; }));
      return;
    }
    if (action === "view-teachers") {
      await openTeachers(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "edit-teacher-access") {
      state.teacherAdmin.editingTeacherId = id;
      state.teacherAdmin.message = "";
      state.teacherAdmin.messageIsError = false;
      renderCurrent();
      return;
    }
    if (action === "close-teacher-editor") {
      state.teacherAdmin.editingTeacherId = null;
      renderCurrent();
      return;
    }
    if (action === "view-management") {
      await openManagement(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "view-dashboard") state.route = { view: "dashboard", classId: null, studentId: null };
    if (action === "view-classes") {
      state.filters.classId = "all";
      state.filters.studentId = "all";
      state.route = { view: "classes", classId: null, studentId: null };
      populateFilters();
      await refreshMonitor(false, false);
    }
    if (action === "view-class") return openClassDetail(id);
    if (action === "view-student") return openStudentDetail(id);
    if (/^export-(?:class|student|difficult-class|difficult-student)$/.test(action)) {
      exportResult(action, id);
      return;
    }
    if (action === "manage-class") {
      state.management.selectedClassId = id;
      state.management.createdStudents = [];
      state.management.message = "";
      renderCurrent();
      return;
    }
    if (action === "preview-bulk-emails") {
      const form = target.closest("form");
      const textarea = form && form.querySelector('textarea[name="names"]');
      if (textarea) {
        const students = parseBulkStudents(textarea.value);
        textarea.value = students.map(function (student) { return student.name + ";" + (student.schoolEmail || ""); }).join("\n");
        state.management.message = "E-mailvoorstellen ingevuld. Controleer en pas uitzonderingen aan vóór je opslaat.";
        state.management.messageIsError = false;
        const message = document.querySelector("#managementMessage");
        if (message) message.textContent = state.management.message;
      }
      return;
    }
    if (action === "copy-student-code" || action === "copy-student-data") {
      const managedStudent = state.management.students.find(function (row) { return row.id === id; });
      const managedClass = managedStudent && state.management.classes.find(function (row) { return row.id === managedStudent.class_id; });
      if (managedStudent) {
        const copyValue = action === "copy-student-code" ? managedStudent.student_code : (managedStudent.display_name || "Naamloze leerling") + "\nKlascode: " + (managedClass && managedClass.class_code || "") + "\nSchoolmail: " + (managedStudent.school_email || "Nog niet ingesteld") + "\nFallback-leerlingcode: " + managedStudent.student_code;
        await copyText(copyValue);
        state.management.message = action === "copy-student-code" ? "Leerlingcode gekopieerd." : "Leerlinggegevens gekopieerd.";
        state.management.messageIsError = false;
        renderCurrent();
      }
      return;
    }
    if (action === "edit-student-email") {
      const managedStudent = state.management.students.find(function (row) { return row.id === id; });
      if (!managedStudent) return;
      const proposed = managedStudent.school_email || suggestSchoolEmail(managedStudent.display_name);
      const value = window.prompt("Schoolmail voor " + (managedStudent.display_name || "deze leerling") + ". Laat leeg om te verwijderen.", proposed);
      if (value === null) return;
      const validation = validateSchoolEmail(value, true);
      if (!validation.valid) {
        state.management.message = validation.message;
        state.management.messageIsError = true;
        renderCurrent();
        return;
      }
      const duplicate = validation.email && state.management.students.some(function (row) { return row.id !== id && normalizeSchoolEmail(row.school_email) === validation.email; });
      if (duplicate) {
        state.management.message = "Deze schoolmail is al aan een andere leerling gekoppeld.";
        state.management.messageIsError = true;
        renderCurrent();
        return;
      }
      try {
        await updateStudentRecord(state.client, id, { school_email: validation.email });
        state.management.message = validation.email ? "Schoolmail opgeslagen." : "Schoolmail verwijderd; leerlingcode-login blijft beschikbaar.";
        state.management.messageIsError = false;
        await reloadAfterManagementMutation();
      } catch (error) {
        state.management.message = friendlyManagementError(error);
        state.management.messageIsError = true;
        renderCurrent();
      }
      return;
    }
    if (action === "edit-student-name") {
      const managedStudent = state.management.students.find(function (row) { return row.id === id; });
      if (!managedStudent) return;
      const value = window.prompt("Naam van de leerling", managedStudent.display_name || "");
      if (value === null) return;
      try {
        await updateStudentRecord(state.client, id, { display_name: value });
        state.management.message = "Leerlingnaam opgeslagen.";
        state.management.messageIsError = false;
        await reloadAfterManagementMutation();
      } catch (error) {
        state.management.message = friendlyManagementError(error);
        state.management.messageIsError = true;
        renderCurrent();
      }
      return;
    }
    if (action === "toggle-student-active") {
      const managedStudent = state.management.students.find(function (row) { return row.id === id; });
      if (!managedStudent) return;
      try {
        await updateStudentRecord(state.client, id, { is_active: managedStudent.is_active === false });
        state.management.message = managedStudent.is_active === false ? "Leerling opnieuw geactiveerd." : "Leerling gedeactiveerd. Historische resultaten blijven bewaard.";
        state.management.messageIsError = false;
        await reloadAfterManagementMutation();
      } catch (error) {
        state.management.message = friendlyManagementError(error);
        state.management.messageIsError = true;
        renderCurrent();
      }
      return;
    }
    if (action === "regenerate-student-code") {
      const managedStudent = state.management.students.find(function (row) { return row.id === id; });
      if (!managedStudent || !window.confirm("Nieuwe code genereren? De oude leerlingcode en bestaande koppelingen werken daarna niet meer.")) return;
      try {
        const nextCode = generateUniqueStudentCodes(1, state.management.students.map(function (row) { return row.student_code; }), window.crypto)[0];
        await updateStudentRecord(state.client, id, { student_code: nextCode });
        state.management.message = "Nieuwe leerlingcode aangemaakt. Deel ze opnieuw met de leerling.";
        state.management.messageIsError = false;
        await reloadAfterManagementMutation();
      } catch (error) {
        state.management.message = friendlyManagementError(error);
        state.management.messageIsError = true;
        renderCurrent();
      }
      return;
    }
    if (action === "export-codes" || action === "export-created-codes") {
      const selectedClass = state.management.classes.find(function (row) { return row.id === state.management.selectedClassId; });
      const rows = action === "export-created-codes" ? studentCodeRows({ classes: state.management.classes, students: state.management.createdStudents }, selectedClass && selectedClass.id) : studentCodeRows(state.management, id);
      downloadCsv("leerlingcodes-" + safeFilename(selectedClass && selectedClass.name || "klassen") + ".csv", ["Leerlingnaam", "Klascode", "Schoolmail", "Fallback-leerlingcode"], rows);
      return;
    }
    renderCurrent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleContentKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest && event.target.closest(".monitor-row[data-action]");
    if (!row) return;
    event.preventDefault();
    handleContentClick({ target: row });
  }

  async function handleFilters() {
    const previousClass = state.filters.classId;
    state.filters = {
      period: document.querySelector("#periodFilter").value,
      trajectory: document.querySelector("#trajectoryFilter").value,
      mode: document.querySelector("#modeFilter").value,
      classId: document.querySelector("#classFilter").value,
      studentId: document.querySelector("#studentFilter").value,
      studentStatus: document.querySelector("#studentStatusFilter").value,
      category: document.querySelector("#categoryFilter").value,
      subsection: document.querySelector("#subsectionFilter").value,
      assignmentId: document.querySelector("#assignmentFilter").value
    };
    populateFilters();
    if (state.filters.studentId !== "all") {
      const selectedStudent = state.raw.students.find(function (student) { return student.id === state.filters.studentId; });
      state.route = { view: "student", classId: selectedStudent && selectedStudent.class_id || null, studentId: state.filters.studentId };
      await openStudentDetail(state.filters.studentId);
      return;
    } else if (state.route.view === "student") {
      state.route = { view: "dashboard", classId: null, studentId: null };
    }
    if (previousClass !== state.filters.classId) state.monitorQuickFilter = "all";
    renderCurrent();
    await refreshMonitor(previousClass !== state.filters.classId);
    scheduleAutoRefresh();
  }

  function handleContentChange(event) {
    if (event.target.id === "taskStatusFilter") {
      state.tasks.filter = event.target.value;
      return renderCurrent();
    }
    const taskForm = event.target.closest && event.target.closest('form[data-form="task-editor"]');
    if (taskForm) {
      updateTaskDraftFromForm(taskForm);
      if (["trajectory", "top_category", "lesson", "block", "subsection", "category"].includes(event.target.name)) {
        const wasAuto = state.tasks.draft.title === state.tasks.draft.autoTitle;
        const order = ["trajectory", "top_category", "lesson", "block", "subsection", "category"];
        order.slice(order.indexOf(event.target.name) + 1).forEach(function (name) { state.tasks.draft[name] = ""; });
        state.tasks.draft.range_start = 1;
        state.tasks.draft.range_end = null;
        state.tasks.draft.mastery_strategy = "item_mastery";
        state.tasks.draft.verb_item_ids = null;
        state.tasks.draft.autoTitle = taskSuggestedTitle(state.tasks.draft);
        if (wasAuto) state.tasks.draft.title = state.tasks.draft.autoTitle;
      }
      renderCurrent();
      return;
    }
    if (event.target.id === "managementStudentStatus") {
      state.management.studentStatus = event.target.value;
      renderCurrent();
    }
    if (event.target.id === "monitorSort") {
      state.monitorSort = event.target.value;
      renderCurrent();
    }
  }

  function handleContentInput(event) {
    const taskForm = event.target.closest && event.target.closest('form[data-form="task-editor"]');
    if (taskForm) {
      updateTaskDraftFromForm(taskForm);
      return;
    }
    const form = event.target.closest && event.target.closest('form[data-form="add-student"]');
    if (!form) return;
    const email = form.querySelector('input[name="school_email"]');
    if (!email) return;
    if (event.target.name === "school_email") {
      email.dataset.manuallyEdited = "true";
      return;
    }
    if (event.target.name === "display_name" && email.dataset.manuallyEdited !== "true") {
      email.value = suggestSchoolEmail(event.target.value);
    }
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
      if (!state.user) return;
      if (state.route.view === "management") openManagement(true);
      else if (state.route.view === "teachers") openTeachers(true);
      else if (state.route.view.indexOf("task") === 0) openTasks(true);
      else if (state.route.view === "dashboard") refreshMonitor(true);
      else showDashboardForSession({ user: state.user }, true);
    });
    document.querySelector("#filterBar").addEventListener("change", handleFilters);
    document.querySelector("#dashboardContent").addEventListener("click", handleContentClick);
    document.querySelector("#dashboardContent").addEventListener("keydown", handleContentKeydown);
    document.querySelector("#dashboardContent").addEventListener("submit", handleManagementSubmit);
    document.querySelector("#dashboardContent").addEventListener("change", handleContentChange);
    document.querySelector("#dashboardContent").addEventListener("input", handleContentInput);
    document.querySelector("#teacherNav").addEventListener("click", handleContentClick);
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
    periodBounds: periodBounds,
    relativeActivity: relativeActivity,
    normalizeMonitorRows: normalizeMonitorRows,
    renderClassMonitor: renderClassMonitor,
    monitorSummary: monitorSummary,
    formatMonitorDuration: formatMonitorDuration,
    fetchClassMonitor: fetchClassMonitor,
    loadStudentDetailExtras: loadStudentDetailExtras,
    openStudentDetail: openStudentDetail,
    renderStudentDetail: renderStudentDetail,
    loadDashboardBase: loadDashboardBase,
    filterDataset: filterDataset,
    summarize: summarize,
    classMonitor: classMonitor,
    sortClassMonitor: sortClassMonitor,
    classOverview: classOverview,
    studentOverview: studentOverview,
    studentMasterySummary: studentMasterySummary,
    difficultItems: difficultItems,
    describeItem: describeItem,
    sessionStats: sessionStats,
    percentage: percentage,
    completedExerciseCount: completedExerciseCount,
    formatActiveDuration: formatActiveDuration,
    normalizeClassCode: normalizeClassCode,
    normalizeSchoolEmail: normalizeSchoolEmail,
    validateSchoolEmail: validateSchoolEmail,
    suggestSchoolEmail: suggestSchoolEmail,
    validateClassInput: validateClassInput,
    generateStudentCode: generateStudentCode,
    generateUniqueStudentCodes: generateUniqueStudentCodes,
    parseBulkNames: parseBulkNames,
    parseBulkStudents: parseBulkStudents,
    protectCsvValue: protectCsvValue,
    makeCsv: makeCsv,
    classOverviewRows: classOverviewRows,
    studentSessionRows: studentSessionRows,
    difficultItemRows: difficultItemRows,
    studentCodeRows: studentCodeRows,
    loadRlsDataset: loadRlsDataset,
    loadManagementDataset: loadManagementDataset,
    loadTeacherProfile: loadTeacherProfile,
    loadTeacherAdminDataset: loadTeacherAdminDataset,
    updateTeacherAccess: updateTeacherAccess,
    createClassRecord: createClassRecord,
    updateClassRecord: updateClassRecord,
    createStudentRecords: createStudentRecords,
    updateStudentRecord: updateStudentRecord,
    createTeacherClient: createTeacherClient,
    taskDeadlineLocal: taskDeadlineLocal,
    taskDeadlineUtc: taskDeadlineUtc,
    tableColumns: TABLE_COLUMNS,
    managementColumns: MANAGEMENT_COLUMNS,
    accessColumns: ACCESS_COLUMNS
  });

  if (window.MON_PARCOURS_TEACHER_TEST) {
    window.MonParcoursTeacherTestState = state;
    window.MonParcoursTeacherTaskTest = Object.freeze({ taskLifecycle: taskLifecycle,
      taskDeadlineLabel: taskDeadlineLabel, taskArchiveFilterRows: taskArchiveFilterRows,
      renderTasksPage: renderTasksPage, renderTaskDetail: renderTaskDetail });
  }

  if (!window.MON_PARCOURS_TEACHER_TEST) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
