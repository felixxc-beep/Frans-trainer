const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sql = fs.readFileSync("supabase/phase6-multi-teacher.sql", "utf8");
const source = fs.readFileSync("teacher.js", "utf8");
const html = fs.readFileSync("teacher.html", "utf8");
const studentFrontend = fs.readFileSync("app.js", "utf8") + fs.readFileSync("student-identity.js", "utf8") + fs.readFileSync("sync-manager.js", "utf8");

assert.match(sql, /create table if not exists public\.teachers[\s\S]*auth_user_id uuid primary key references auth\.users\(id\)[\s\S]*role text[^]*admin[^]*teacher[\s\S]*is_active boolean not null default false/i);
assert.match(sql, /create table if not exists public\.class_teachers[\s\S]*primary key \(class_id, teacher_id\)/i);
assert.match(sql, /after insert on auth\.users[\s\S]*private\.handle_new_teacher_user/i);
assert.match(sql, /handle_new_teacher_user[\s\S]*'teacher'[\s\S]*false/i, "nieuwe Auth-users starten als inactieve teacher");
assert.match(sql, /teacher_count = 0 and auth_count = 1[\s\S]*'admin', true/i, "alleen exact één bestaand account wordt automatisch admin");
assert.match(sql, /current_teacher_is_active\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(sql, /current_teacher_is_admin\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(sql, /teacher_has_class_access\(p_class_id uuid\)[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(sql, /classes_teacher_select[\s\S]*private\.teacher_has_class_access\(id\)/i);
assert.match(sql, /classes_admin_insert[\s\S]*private\.current_teacher_is_admin\(\)/i);
assert.match(sql, /students_teacher_select[\s\S]*private\.teacher_has_class_access\(class_id\)/i);
assert.match(sql, /sessions_teacher_select[\s\S]*private\.teacher_has_class_access\(s\.class_id\)/i);
assert.match(sql, /attempts_teacher_select[\s\S]*private\.teacher_has_class_access\(s\.class_id\)/i);
assert.match(sql, /protect_last_active_admin[\s\S]*last active admin cannot be removed or deactivated/i);
assert.match(sql, /admin_update_teacher_access_impl[\s\S]*if not private\.current_teacher_is_admin\(\)/i);
assert.match(sql, /revoke all on table public\.teachers from public, anon, authenticated/i);
assert.match(sql, /grant select on table public\.teachers to authenticated/i);
assert.doesNotMatch(sql, /grant[^;]*(?:teachers|class_teachers)[^;]*(?:insert|update|delete)[^;]*authenticated/i, "teacherbeheer verloopt alleen via de begrensde admin-RPC");
assert.match(sql, /on delete restrict/i, "het verwijderen van een legacy owner mag geen hele klas wissen");

assert.match(html, /data-action="view-teachers"[^>]*hidden>Leerkrachten/);
assert.match(source, /Je leerkrachtenaccount heeft nog geen toegang\. Neem contact op met de beheerder\./);
assert.match(source, /profile\.role !== "admin"/);
assert.match(source, /admin_update_teacher_access/);
assert.match(source, /teacher-access-card/);
assert.doesNotMatch(html + source, /service[_-]?role|sb_secret_/i);
assert.match(studentFrontend, /verify_student_email|ingest_practice_bundle/);

const windowObject = { MON_PARCOURS_TEACHER_TEST: true, MON_PARCOURS_CONFIG: {} };
const context = vm.createContext({ window: windowObject, console, Intl, Date, Set, Map, Promise, Object, Array, String, Number, Math });
vm.runInContext(source, context, { filename: "teacher.js" });
const api = windowObject.MonParcoursTeacher;

const rpcCalls = [];
const rpcClient = {
  async rpc(name, parameters) {
    rpcCalls.push({ name, parameters });
    return { data: { updated: true }, error: null };
  }
};

(async function () {
  await api.updateTeacherAccess(rpcClient, {
    teacherId: "teacher-b",
    displayName: "Teacher B",
    role: "teacher",
    isActive: true,
    classIds: ["1aa", "1ab"]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls[0])), {
    name: "admin_update_teacher_access",
    parameters: {
      p_teacher_id: "teacher-b",
      p_display_name: "Teacher B",
      p_role: "teacher",
      p_is_active: true,
      p_class_ids: ["1aa", "1ab"]
    }
  });

  const profileClient = {
    from(table) {
      assert.equal(table, "teachers");
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "auth_user_id");
              assert.equal(value, "teacher-a");
              return { async maybeSingle() { return { data: { auth_user_id: value, role: "teacher", is_active: true }, error: null }; } };
            }
          };
        }
      };
    }
  };
  const profile = await api.loadTeacherProfile(profileClient, "teacher-a");
  assert.equal(profile.role, "teacher");
  assert.equal(profile.is_active, true);
  console.log("FASE 6 MULTI-TEACHER-REGRESSIE GESLAAGD");
  console.log("Rollen, bootstrap, many-to-many, RLS, inactieve login, admin-RPC en bestaande leerling-sync gecontroleerd.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
