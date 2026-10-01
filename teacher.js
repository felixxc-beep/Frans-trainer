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
  const MANAGEMENT_COLUMNS = Object.freeze({
    classes: "id,name,class_code,is_active,created_at,updated_at",
    students: "id,class_id,display_name,school_email,student_code,is_active,created_at,updated_at"
  });
  const STUDENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const state = {
    client: null,
    user: null,
    course: null,
    courseIndex: Object.create(null),
    raw: emptyDataset(),
    filters: { period: "all", trajectory: "all", mode: "all", classId: "all", studentId: "all", studentStatus: "active", category: "all", subsection: "all" },
    route: { view: "dashboard", classId: null, studentId: null },
    management: { loaded: false, classes: [], students: [], selectedClassId: null, studentStatus: "active", generatedCode: "", createdStudents: [], message: "", messageIsError: false },
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
    const classId = filters.classId || "all";
    const studentId = filters.studentId || "all";
    const studentStatus = filters.studentStatus || "active";
    const category = filters.category || "all";
    const subsection = filters.subsection || "all";
    const now = nowValue ? new Date(nowValue).getTime() : Date.now();
    const days = filters.period === "7" ? 7 : filters.period === "30" ? 30 : null;
    const threshold = days ? now - days * 24 * 60 * 60 * 1000 : null;
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
    const sessions = asArray(source.sessions).filter(function (session) {
      if (!studentIds.has(session.student_id)) return false;
      const sessionTime = new Date(session.finished_at || session.started_at || 0).getTime();
      if (threshold !== null && (Number.isNaN(sessionTime) || sessionTime < threshold)) return false;
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

  function classOverviewRows(data, classId) {
    return data.students.filter(function (student) { return student.class_id === classId; }).map(function (student) {
      const stats = studentOverview(data, student);
      return [student.display_name || "Naamloze leerling", stats.sessions, stats.questions, stats.attempts, stats.correct, stats.incorrect, stats.accuracy + "%", formatDate(stats.lastActivity)];
    });
  }

  function studentSessionRows(data, studentId) {
    return data.sessions.filter(function (session) { return session.student_id === studentId; }).sort(function (left, right) {
      return new Date(right.finished_at || right.started_at) - new Date(left.finished_at || left.started_at);
    }).map(function (session) {
      const stats = sessionStats(session, data.attempts);
      return [formatDate(session.finished_at || session.started_at), modeLabel(session.mode), session.trajectory || "", session.top_category || "", session.lesson || "", Number(session.question_count || 0), stats.attempts, stats.correct, stats.incorrect, stats.accuracy + "%"];
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

  async function loadManagementDataset(client) {
    const results = await Promise.all([
      fetchAll(client, "classes", MANAGEMENT_COLUMNS.classes),
      fetchAll(client, "students", MANAGEMENT_COLUMNS.students)
    ]);
    return { classes: results[0], students: results[1] };
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
      statCard("Pogingen", summary.attempts, "inclusief herhalingen") +
      statCard("Correct", summary.accuracy + "%", summary.correct + " van " + summary.attempts + " pogingen") +
      '</section>';
  }

  function renderClassCards(data) {
    return data.classes.map(function (classRow) {
      const overview = classOverview(data, classRow);
      return '<button class="class-card" type="button" data-action="view-class" data-id="' + escapeHtml(classRow.id) + '">' +
        '<span class="class-card-head"><span><h3>' + escapeHtml(classRow.name) + '</h3><span class="muted">Laatste activiteit: ' + escapeHtml(formatDate(overview.lastActivity)) + '</span></span><span class="pill">' + overview.activeStudents + ' leerlingen</span></span>' +
        '<span class="class-metrics"><span><strong>' + overview.sessions + '</strong>sessies</span><span><strong>' + overview.attempts + '</strong>pogingen</span><span><strong>' + overview.accuracy + '%</strong>correct</span></span>' +
        '</button>';
    }).join("");
  }

  function renderDashboard(data) {
    const cards = renderClassCards(data);
    return renderSummaryCards(data) + '<section class="section-block"><div class="section-heading"><div><p class="eyebrow">Mijn klassen</p><h2>Klassenoverzicht</h2></div></div>' + (cards ? '<div class="class-grid">' + cards + '</div>' : emptyState("Nog geen klassen", "Supabase gaf voor dit leerkrachtenaccount geen klassen terug.")) + '</section>';
  }

  function renderClassesPage(data) {
    const cards = renderClassCards(data);
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: "Klassen" }]) + '<div class="page-heading"><div><p class="eyebrow">Resultaten</p><h2>Klassen</h2><p class="muted">Open een klas voor leerlingen, recente activiteit en moeilijke leerstof.</p></div></div>' + (cards ? '<div class="class-grid">' + cards + '</div>' : emptyState("Nog geen klassen", "Maak je eerste klas aan onder Beheer."));
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
      '<div class="page-heading"><div><p class="eyebrow">Klasdetail</p><h2>' + escapeHtml(classRow.name) + '</h2><p class="muted">' + overview.activeStudents + ' actieve leerlingen</p></div><div class="export-actions"><button class="button button-secondary" type="button" data-action="export-class" data-id="' + escapeHtml(classRow.id) + '">Klasoverzicht CSV</button><button class="button button-secondary" type="button" data-action="export-difficult-class" data-id="' + escapeHtml(classRow.id) + '">Moeilijke items CSV</button></div></div>' +
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
      '<div class="page-heading"><div><p class="eyebrow">Leerlingdetail</p><h2>' + escapeHtml(student.display_name || "Naamloze leerling") + '</h2><p class="muted">' + escapeHtml(classRow ? classRow.name : "Onbekende klas") + ' · laatste activiteit ' + escapeHtml(formatDate(overview.lastActivity)) + '</p></div><div class="export-actions"><button class="button button-secondary" type="button" data-action="export-student" data-id="' + escapeHtml(student.id) + '">Sessies CSV</button><button class="button button-secondary" type="button" data-action="export-difficult-student" data-id="' + escapeHtml(student.id) + '">Moeilijke items CSV</button></div></div>' +
      '<section class="stat-grid">' + statCard("Sessies", overview.sessions) + statCard("Vragen", overview.questions, "uniek geselecteerd") + statCard("Pogingen", overview.attempts, "incl. herhalingen") + statCard("Juist / fout", overview.correct + " / " + overview.incorrect) + statCard("Correct", overview.accuracy + "%") + '</section>' +
      '<section class="section-block"><div class="section-heading"><div><h2>Sessiegeschiedenis</h2><p>Open een sessie voor itemdetails en modelantwoorden.</p></div></div><div class="session-list">' + (sessions.length ? sessions.map(function (session) { return renderSessionCard(session, overview.attemptRows); }).join("") : emptyState("Nog geen sessies", "Binnen de gekozen filters zijn voor deze leerling geen sessies gevonden.")) + '</div></section>' +
      '<section class="section-block">' + renderDifficult(difficultItems(overview.attemptRows, state.courseIndex), "Moeilijk voor deze leerling") + '</section>';
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
        return '<tr><td><strong>' + escapeHtml(student.display_name || "Naamloze leerling") + '</strong><br><span class="pill">' + (student.is_active === false ? "Inactief" : "Actief") + '</span></td><td><strong>' + escapeHtml(student.school_email || "Nog geen schoolmail") + '</strong><div class="row-actions"><button class="small-button" type="button" data-action="edit-student-email" data-id="' + escapeHtml(student.id) + '">' + (student.school_email ? "Schoolmail aanpassen" : "Schoolmail toevoegen") + '</button></div></td><td><details><summary>Fallbackcode tonen</summary><span class="code-value">' + escapeHtml(student.student_code) + '</span><div class="row-actions"><button class="small-button" type="button" data-action="copy-student-code" data-id="' + escapeHtml(student.id) + '">Kopieer code</button><button class="small-button warning" type="button" data-action="regenerate-student-code" data-id="' + escapeHtml(student.id) + '">Nieuwe code</button></div></details></td><td><button class="small-button" type="button" data-action="toggle-student-active" data-id="' + escapeHtml(student.id) + '">' + (student.is_active === false ? "Activeren" : "Deactiveren") + '</button></td></tr>';
      }).join("");
      detail = '<div class="management-stack"><section class="panel"><h2>' + escapeHtml(selectedClass.name) + '</h2><form class="management-form" data-form="update-class"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Klasnaam</span><input name="name" maxlength="80" value="' + escapeHtml(selectedClass.name) + '" required></label><label><span>Klascode</span><input value="' + escapeHtml(selectedClass.class_code) + '" readonly></label><label><span>Status</span><select name="is_active"><option value="true"' + (selectedClass.is_active === false ? "" : " selected") + '>Actief</option><option value="false"' + (selectedClass.is_active === false ? " selected" : "") + '>Inactief</option></select></label><button class="button button-primary" type="submit">Klas bijwerken</button><p class="muted">Deactiveren bewaart alle leerlingen en historische resultaten.</p></form></section>' +
        '<section class="panel"><h3>Leerling toevoegen</h3><form class="management-form" data-form="add-student"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Naam</span><input name="display_name" maxlength="80" required></label><label><span>Schoolmail — controleer het voorstel</span><input name="school_email" type="email" placeholder="achternaamvoornaam@camposturnhout.be"></label><label><span>Automatisch gegenereerde fallbackcode</span><input name="generated_code" value="' + escapeHtml(management.generatedCode) + '" readonly></label><button class="button button-primary" type="submit">Leerling toevoegen</button></form></section>' +
        '<section class="panel"><h3>Meerdere leerlingen toevoegen</h3><form class="management-form" data-form="bulk-students"><input type="hidden" name="class_id" value="' + escapeHtml(selectedClass.id) + '"><label><span>Eén leerling per regel: Naam of Naam;schoolmail</span><textarea name="names" placeholder="Emma Janssens;janssensemma@camposturnhout.be&#10;Noah Peeters" required></textarea></label><div class="share-actions"><button class="button button-secondary" type="button" data-action="preview-bulk-emails">E-mailvoorstellen invullen</button><button class="button button-primary" type="submit">Leerlingen toevoegen</button></div></form></section>' +
        '<section class="panel"><div class="section-heading"><div><h3>Leerlingen</h3><p>' + allStudents.length + ' in deze klas</p></div><div class="export-actions"><select id="managementStudentStatus" aria-label="Filter leerlingstatus"><option value="active"' + (management.studentStatus === "active" ? " selected" : "") + '>Actief</option><option value="inactive"' + (management.studentStatus === "inactive" ? " selected" : "") + '>Inactief</option><option value="all"' + (management.studentStatus === "all" ? " selected" : "") + '>Alle</option></select><button class="small-button" type="button" data-action="export-codes" data-id="' + escapeHtml(selectedClass.id) + '">Login- en fallbackcodes CSV</button></div></div><p class="privacy-warning"><strong>Schoolmail is een persoonsgegeven; behandel de fallbackcode als een wachtwoord.</strong> Deze gegevens staan bewust alleen in Beheer.</p>' + (studentRows ? '<div class="table-wrap"><table><thead><tr><th>Leerling</th><th>Schoolmail</th><th>Fallbackcode</th><th>Status</th></tr></thead><tbody>' + studentRows + '</tbody></table></div>' : emptyState("Geen leerlingen in deze selectie", "Pas de statusfilter aan of voeg leerlingen toe.")) + '</section></div>';
    }
    return breadcrumbs([{ label: "Dashboard", action: "view-dashboard" }, { label: "Beheer" }]) + '<div class="page-heading"><div><p class="eyebrow">Administratie</p><h2>Klassen beheren</h2><p class="muted">Maak klassen en leerlingen aan zonder historische resultaten te verwijderen.</p></div></div><p id="managementMessage" class="management-message' + (management.messageIsError ? " error" : "") + '" aria-live="polite">' + escapeHtml(management.message) + '</p><div class="management-grid"><aside class="management-stack"><section class="panel"><h3>Nieuwe klas</h3><form class="management-form" data-form="create-class"><label><span>Klasnaam</span><input name="name" maxlength="80" placeholder="1AA" required></label><label><span>Klascode</span><input name="class_code" minlength="2" maxlength="20" pattern="[A-Za-z0-9-]{2,20}" placeholder="1AA" required></label><button class="button button-primary" type="submit">Klas aanmaken</button></form></section><section class="panel"><h3>Mijn klassen</h3><div class="management-class-list">' + (classList || emptyState("Nog geen klassen", "Maak hierboven je eerste klas aan.")) + '</div></section></aside><div>' + detail + renderCreatedStudents(selectedClass) + '</div></div>';
  }

  function currentFilteredData() {
    return filterDataset(state.raw, state.filters);
  }

  function renderCurrent() {
    const content = document.querySelector("#dashboardContent");
    if (!content || !state.user) return;
    const data = currentFilteredData();
    document.querySelector("#filterBar").hidden = state.route.view === "management";
    if (state.route.view === "management") content.innerHTML = renderManagement();
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
    const trajectories = courseTrajectories(state.course, state.raw.sessions);
    const modes = Array.from(new Set(state.raw.sessions.map(function (session) { return session.mode; }).filter(Boolean)));
    const categories = Array.from(new Set(state.raw.sessions.map(function (session) { return session.top_category; }).filter(Boolean)));
    const subsections = Array.from(new Set(state.raw.sessions.map(function (session) { return session.subsection; }).filter(Boolean)));
    const availableStudents = state.raw.students.filter(function (student) { return state.filters.classId === "all" || student.class_id === state.filters.classId; });
    trajectorySelect.innerHTML = '<option value="all">Alle Trajets</option>' + trajectories.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    modeSelect.innerHTML = '<option value="all">Alle modi</option>' + modes.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(modeLabel(value)) + '</option>'; }).join("");
    classSelect.innerHTML = '<option value="all">Alle klassen</option>' + state.raw.classes.map(function (row) { return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.name) + '</option>'; }).join("");
    studentSelect.innerHTML = '<option value="all">Alle leerlingen</option>' + availableStudents.map(function (row) { return '<option value="' + escapeHtml(row.id) + '">' + escapeHtml(row.display_name || "Naamloze leerling") + '</option>'; }).join("");
    categorySelect.innerHTML = '<option value="all">Alle onderdelen</option>' + categories.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    subsectionSelect.innerHTML = '<option value="all">Alle subsections</option>' + subsections.map(function (value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>'; }).join("");
    if (trajectories.indexOf(state.filters.trajectory) < 0) state.filters.trajectory = "all";
    if (modes.indexOf(state.filters.mode) < 0) state.filters.mode = "all";
    if (!state.raw.classes.some(function (row) { return row.id === state.filters.classId; })) state.filters.classId = "all";
    if (!availableStudents.some(function (row) { return row.id === state.filters.studentId; })) state.filters.studentId = "all";
    if (categories.indexOf(state.filters.category) < 0) state.filters.category = "all";
    if (subsections.indexOf(state.filters.subsection) < 0) state.filters.subsection = "all";
    trajectorySelect.value = state.filters.trajectory;
    modeSelect.value = state.filters.mode;
    classSelect.value = state.filters.classId;
    studentSelect.value = state.filters.studentId;
    studentStatusSelect.value = state.filters.studentStatus;
    categorySelect.value = state.filters.category;
    subsectionSelect.value = state.filters.subsection;
  }

  function updateNavigation() {
    const current = state.route.view === "management" ? "view-management" : state.route.view === "dashboard" ? "view-dashboard" : "view-classes";
    document.querySelectorAll("#teacherNav [data-action]").forEach(function (button) {
      if (button.dataset.action === current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function showLogin(message) {
    state.user = null;
    state.raw = emptyDataset();
    state.management = { loaded: false, classes: [], students: [], selectedClassId: null, studentStatus: "active", generatedCode: "", createdStudents: [], message: "", messageIsError: false };
    state.route = { view: "dashboard", classId: null, studentId: null };
    document.querySelector("#authView").hidden = false;
    document.querySelector("#dashboardView").hidden = true;
    document.querySelector("#accountArea").hidden = true;
    document.querySelector("#teacherNav").hidden = true;
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
    document.querySelector("#teacherNav").hidden = false;
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

  async function reloadAfterManagementMutation(createdStudents) {
    const results = await Promise.all([loadManagementDataset(state.client), loadRlsDataset(state.client)]);
    state.management.classes = results[0].classes;
    state.management.students = results[0].students;
    state.management.loaded = true;
    state.management.generatedCode = "";
    if (createdStudents) state.management.createdStudents = createdStudents;
    state.raw = results[1];
    populateFilters();
    renderCurrent();
  }

  function friendlyManagementError(error) {
    const message = String(error && error.message || "");
    if (/duplicate|unique/i.test(message)) return "Deze klas- of leerlingcode bestaat al. Probeer opnieuw.";
    if (/row-level security|permission|policy/i.test(message)) return "Supabase heeft deze wijziging via RLS geweigerd.";
    return message && !/^[A-Z_]+$/.test(message) ? message : "De wijziging kon niet worden opgeslagen. Probeer opnieuw.";
  }

  async function handleManagementSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    submit.disabled = true;
    state.management.message = "Opslaan…";
    state.management.messageIsError = false;
    try {
      if (form.dataset.form === "create-class") {
        const created = await createClassRecord(state.client, state.user, { name: values.get("name"), classCode: values.get("class_code") }, state.management.classes);
        state.management.selectedClassId = created.id;
        state.management.createdStudents = [];
        state.management.message = "Klas aangemaakt.";
        await reloadAfterManagementMutation();
      } else if (form.dataset.form === "update-class") {
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
      state.management.message = friendlyManagementError(error);
      state.management.messageIsError = true;
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
      downloadCsv("klasoverzicht-" + safeFilename(classRow.name) + ".csv", ["Leerlingnaam", "Sessies", "Unieke vragen", "Pogingen", "Correct", "Fout", "Percentage correct", "Laatste activiteit"], classOverviewRows(data, classRow.id));
    }
    if (action === "export-student" && student) {
      downloadCsv("sessies-" + safeFilename(student.display_name) + ".csv", ["Datum", "Modus", "Trajet", "Cursusonderdeel", "Les", "Question count", "Attempt count", "Correct", "Fout", "Percentage correct"], studentSessionRows(data, student.id));
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
    if (action === "view-management") {
      await openManagement(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "view-dashboard") state.route = { view: "dashboard", classId: null, studentId: null };
    if (action === "view-classes") state.route = { view: "classes", classId: null, studentId: null };
    if (action === "view-class") state.route = { view: "class", classId: id, studentId: null };
    if (action === "view-student") {
      const student = state.raw.students.find(function (row) { return row.id === id; });
      state.route = { view: "student", classId: student && student.class_id || null, studentId: id };
    }
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

  function handleFilters() {
    state.filters = {
      period: document.querySelector("#periodFilter").value,
      trajectory: document.querySelector("#trajectoryFilter").value,
      mode: document.querySelector("#modeFilter").value,
      classId: document.querySelector("#classFilter").value,
      studentId: document.querySelector("#studentFilter").value,
      studentStatus: document.querySelector("#studentStatusFilter").value,
      category: document.querySelector("#categoryFilter").value,
      subsection: document.querySelector("#subsectionFilter").value
    };
    populateFilters();
    renderCurrent();
  }

  function handleContentChange(event) {
    if (event.target.id === "managementStudentStatus") {
      state.management.studentStatus = event.target.value;
      renderCurrent();
    }
  }

  function handleContentInput(event) {
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
      else showDashboardForSession({ user: state.user }, true);
    });
    document.querySelector("#filterBar").addEventListener("change", handleFilters);
    document.querySelector("#dashboardContent").addEventListener("click", handleContentClick);
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
    filterDataset: filterDataset,
    summarize: summarize,
    classOverview: classOverview,
    studentOverview: studentOverview,
    difficultItems: difficultItems,
    describeItem: describeItem,
    sessionStats: sessionStats,
    percentage: percentage,
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
    createClassRecord: createClassRecord,
    updateClassRecord: updateClassRecord,
    createStudentRecords: createStudentRecords,
    updateStudentRecord: updateStudentRecord,
    createTeacherClient: createTeacherClient,
    tableColumns: TABLE_COLUMNS,
    managementColumns: MANAGEMENT_COLUMNS
  });

  if (!window.MON_PARCOURS_TEACHER_TEST) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }
})();
