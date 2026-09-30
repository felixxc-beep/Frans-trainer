-- Voer dit bestand NA schema.sql uit.

revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to anon, authenticated;

alter table public.classes enable row level security;
alter table public.classes force row level security;
alter table public.students enable row level security;
alter table public.students force row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_sessions force row level security;
alter table public.practice_attempts enable row level security;
alter table public.practice_attempts force row level security;

revoke all on table public.classes from anon, authenticated;
revoke all on table public.students from anon, authenticated;
revoke all on table public.practice_sessions from anon, authenticated;
revoke all on table public.practice_attempts from anon, authenticated;

grant select, insert, update, delete on table public.classes to authenticated;
grant select (id, class_id, student_code, display_name, is_active, created_at, updated_at) on table public.students to authenticated;
grant insert (class_id, student_code, display_name, is_active) on table public.students to authenticated;
grant update (student_code, display_name, is_active) on table public.students to authenticated;
grant delete on table public.students to authenticated;
grant select on table public.practice_sessions to authenticated;
grant select on table public.practice_attempts to authenticated;

drop policy if exists classes_teacher_select on public.classes;
create policy classes_teacher_select on public.classes for select to authenticated
using (owner_id = auth.uid());

drop policy if exists classes_teacher_insert on public.classes;
create policy classes_teacher_insert on public.classes for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists classes_teacher_update on public.classes;
create policy classes_teacher_update on public.classes for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists classes_teacher_delete on public.classes;
create policy classes_teacher_delete on public.classes for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists students_teacher_select on public.students;
create policy students_teacher_select on public.students for select to authenticated
using (exists (select 1 from public.classes c where c.id = students.class_id and c.owner_id = auth.uid()));

drop policy if exists students_teacher_insert on public.students;
create policy students_teacher_insert on public.students for insert to authenticated
with check (exists (select 1 from public.classes c where c.id = students.class_id and c.owner_id = auth.uid()));

drop policy if exists students_teacher_update on public.students;
create policy students_teacher_update on public.students for update to authenticated
using (exists (select 1 from public.classes c where c.id = students.class_id and c.owner_id = auth.uid()))
with check (exists (select 1 from public.classes c where c.id = students.class_id and c.owner_id = auth.uid()));

drop policy if exists students_teacher_delete on public.students;
create policy students_teacher_delete on public.students for delete to authenticated
using (exists (select 1 from public.classes c where c.id = students.class_id and c.owner_id = auth.uid()));

drop policy if exists sessions_teacher_select on public.practice_sessions;
create policy sessions_teacher_select on public.practice_sessions for select to authenticated
using (exists (
  select 1 from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = practice_sessions.student_id and c.owner_id = auth.uid()
));

drop policy if exists attempts_teacher_select on public.practice_attempts;
create policy attempts_teacher_select on public.practice_attempts for select to authenticated
using (exists (
  select 1 from public.students s
  join public.classes c on c.id = s.class_id
  where s.id = practice_attempts.student_id and c.owner_id = auth.uid()
));

revoke all on function public.verify_student_identity(text, text) from public, anon, authenticated, service_role;
revoke all on function public.ingest_practice_bundle(text, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.generate_student_code() from public, anon, authenticated, service_role;
revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.verify_student_identity_impl(text, text) from public, anon, authenticated, service_role;
revoke all on function private.ingest_practice_bundle_impl(text, jsonb, jsonb) from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public;
alter default privileges for role postgres in schema private revoke execute on functions from anon, authenticated, service_role;

grant execute on function public.verify_student_identity(text, text) to anon, authenticated;
grant execute on function public.ingest_practice_bundle(text, jsonb, jsonb) to anon, authenticated;
grant execute on function private.verify_student_identity_impl(text, text) to anon, authenticated;
grant execute on function private.ingest_practice_bundle_impl(text, jsonb, jsonb) to anon, authenticated;
grant execute on function private.generate_student_code() to authenticated;
grant execute on function private.set_updated_at() to authenticated;
