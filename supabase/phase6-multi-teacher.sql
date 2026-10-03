-- Mon parcours · fase 6 · handmatig uitvoeren in Supabase SQL Editor
-- Multi-teacher accounts, rollen en many-to-many klastoegang.
-- Voer dit bestand uit NA schema.sql, rls.sql en alle fase-4/5-migraties.

begin;

create table if not exists public.teachers (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  is_active boolean not null default false,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(auth_user_id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (class_id, teacher_id)
);

create index if not exists class_teachers_teacher_idx on public.class_teachers(teacher_id, class_id);
create index if not exists teachers_active_role_idx on public.teachers(is_active, role);

alter table public.classes drop constraint if exists classes_owner_id_fkey;
alter table public.classes
  add constraint classes_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete restrict;

drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function private.set_updated_at();

create or replace function private.handle_new_teacher_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.teachers (auth_user_id, email, display_name, role, is_active)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''),
    'teacher',
    false
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_teacher on auth.users;
create trigger on_auth_user_created_teacher
after insert on auth.users
for each row execute function private.handle_new_teacher_user();

-- Veilige bootstrap: alleen bij exact één bestaande Auth-user wordt automatisch
-- een actieve admin gekozen. Bij meerdere gebruikers wordt niemand geraden.
do $$
declare
  auth_count integer;
  teacher_count integer;
begin
  select count(*) into auth_count from auth.users;
  select count(*) into teacher_count from public.teachers;

  if teacher_count = 0 and auth_count = 1 then
    insert into public.teachers (auth_user_id, email, display_name, role, is_active)
    select id, email,
           nullif(btrim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')), ''),
           'admin', true
    from auth.users
    on conflict (auth_user_id) do nothing;
  else
    insert into public.teachers (auth_user_id, email, display_name, role, is_active)
    select id, email,
           nullif(btrim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')), ''),
           'teacher', false
    from auth.users
    on conflict (auth_user_id) do nothing;
  end if;
end;
$$;

-- Bestaande klas-eigenaars blijven als expliciete klastoewijzing behouden.
insert into public.class_teachers (class_id, teacher_id)
select c.id, c.owner_id
from public.classes c
join public.teachers t on t.auth_user_id = c.owner_id
on conflict (class_id, teacher_id) do nothing;

create or replace function private.assign_new_class_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.class_teachers (class_id, teacher_id)
  values (new.id, new.owner_id)
  on conflict (class_id, teacher_id) do nothing;
  return new;
end;
$$;

drop trigger if exists classes_assign_owner_teacher on public.classes;
create trigger classes_assign_owner_teacher
after insert on public.classes
for each row execute function private.assign_new_class_owner();

create or replace function private.current_teacher_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t
    where t.auth_user_id = auth.uid() and t.is_active = true
  );
$$;

create or replace function private.current_teacher_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t
    where t.auth_user_id = auth.uid()
      and t.is_active = true
      and t.role = 'admin'
  );
$$;

create or replace function private.teacher_has_class_access(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_teacher_is_admin()
    or exists (
      select 1
      from public.teachers t
      join public.class_teachers ct on ct.teacher_id = t.auth_user_id
      where t.auth_user_id = auth.uid()
        and t.is_active = true
        and ct.class_id = p_class_id
    );
$$;

create or replace function private.protect_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.is_active = true
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.is_active is distinct from true)
     and not exists (
       select 1 from public.teachers t
       where t.auth_user_id <> old.auth_user_id
         and t.role = 'admin'
         and t.is_active = true
     ) then
    raise exception 'last active admin cannot be removed or deactivated';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists teachers_protect_last_admin on public.teachers;
create trigger teachers_protect_last_admin
before update or delete on public.teachers
for each row execute function private.protect_last_active_admin();

create or replace function private.admin_update_teacher_access_impl(
  p_teacher_id uuid,
  p_display_name text,
  p_role text,
  p_is_active boolean,
  p_class_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.teachers%rowtype;
  normalized_name text;
  requested_classes uuid[];
begin
  if not private.current_teacher_is_admin() then raise exception 'admin access required'; end if;
  if p_role not in ('admin', 'teacher') then raise exception 'invalid teacher role'; end if;

  normalized_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if normalized_name is not null and char_length(normalized_name) > 120 then raise exception 'invalid display name'; end if;
  requested_classes := coalesce(p_class_ids, '{}'::uuid[]);
  if cardinality(requested_classes) > 500 then raise exception 'too many classes'; end if;

  select * into target from public.teachers where auth_user_id = p_teacher_id for update;
  if not found then raise exception 'teacher not found'; end if;

  if exists (
    select 1 from unnest(requested_classes) class_id
    where not exists (select 1 from public.classes c where c.id = class_id)
  ) then raise exception 'unknown class'; end if;

  update public.teachers
  set display_name = normalized_name,
      role = p_role,
      is_active = coalesce(p_is_active, false),
      updated_at = pg_catalog.now()
  where auth_user_id = p_teacher_id;

  delete from public.class_teachers where teacher_id = p_teacher_id;
  insert into public.class_teachers (class_id, teacher_id)
  select distinct class_id, p_teacher_id
  from unnest(requested_classes) class_id
  on conflict (class_id, teacher_id) do nothing;

  return pg_catalog.jsonb_build_object('updated', true, 'teacher_id', p_teacher_id);
end;
$$;

create or replace function public.admin_update_teacher_access(
  p_teacher_id uuid,
  p_display_name text,
  p_role text,
  p_is_active boolean,
  p_class_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_teacher_access_impl(
    p_teacher_id, p_display_name, p_role, p_is_active, p_class_ids
  );
$$;

alter table public.teachers enable row level security;
alter table public.teachers force row level security;
alter table public.class_teachers enable row level security;
alter table public.class_teachers force row level security;

revoke all on table public.teachers from public, anon, authenticated;
revoke all on table public.class_teachers from public, anon, authenticated;
grant select on table public.teachers to authenticated;
grant select on table public.class_teachers to authenticated;

drop policy if exists teachers_select on public.teachers;
create policy teachers_select on public.teachers for select to authenticated
using (auth_user_id = auth.uid() or private.current_teacher_is_admin());

drop policy if exists class_teachers_select on public.class_teachers;
create policy class_teachers_select on public.class_teachers for select to authenticated
using (teacher_id = auth.uid() or private.current_teacher_is_admin());

drop policy if exists classes_teacher_select on public.classes;
drop policy if exists classes_teacher_insert on public.classes;
drop policy if exists classes_teacher_update on public.classes;
drop policy if exists classes_teacher_delete on public.classes;
drop policy if exists classes_admin_insert on public.classes;
drop policy if exists classes_admin_update on public.classes;
drop policy if exists classes_admin_delete on public.classes;
create policy classes_teacher_select on public.classes for select to authenticated
using (private.teacher_has_class_access(id));
create policy classes_admin_insert on public.classes for insert to authenticated
with check (private.current_teacher_is_admin() and owner_id = auth.uid());
create policy classes_admin_update on public.classes for update to authenticated
using (private.current_teacher_is_admin()) with check (private.current_teacher_is_admin());
create policy classes_admin_delete on public.classes for delete to authenticated
using (private.current_teacher_is_admin());

drop policy if exists students_teacher_select on public.students;
drop policy if exists students_teacher_insert on public.students;
drop policy if exists students_teacher_update on public.students;
drop policy if exists students_teacher_delete on public.students;
drop policy if exists students_admin_delete on public.students;
create policy students_teacher_select on public.students for select to authenticated
using (private.teacher_has_class_access(class_id));
create policy students_teacher_insert on public.students for insert to authenticated
with check (private.teacher_has_class_access(class_id));
create policy students_teacher_update on public.students for update to authenticated
using (private.teacher_has_class_access(class_id))
with check (private.teacher_has_class_access(class_id));
create policy students_admin_delete on public.students for delete to authenticated
using (private.current_teacher_is_admin());

drop policy if exists sessions_teacher_select on public.practice_sessions;
create policy sessions_teacher_select on public.practice_sessions for select to authenticated
using (exists (
  select 1 from public.students s
  where s.id = practice_sessions.student_id
    and private.teacher_has_class_access(s.class_id)
));

drop policy if exists attempts_teacher_select on public.practice_attempts;
create policy attempts_teacher_select on public.practice_attempts for select to authenticated
using (exists (
  select 1 from public.students s
  where s.id = practice_attempts.student_id
    and private.teacher_has_class_access(s.class_id)
));

revoke all on function private.handle_new_teacher_user() from public, anon, authenticated, service_role;
revoke all on function private.assign_new_class_owner() from public, anon, authenticated, service_role;
revoke all on function private.current_teacher_is_active() from public, anon, authenticated, service_role;
revoke all on function private.current_teacher_is_admin() from public, anon, authenticated, service_role;
revoke all on function private.teacher_has_class_access(uuid) from public, anon, authenticated, service_role;
revoke all on function private.protect_last_active_admin() from public, anon, authenticated, service_role;
revoke all on function private.admin_update_teacher_access_impl(uuid, text, text, boolean, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_teacher_access(uuid, text, text, boolean, uuid[]) from public, anon, authenticated, service_role;

grant execute on function private.current_teacher_is_active() to authenticated;
grant execute on function private.current_teacher_is_admin() to authenticated;
grant execute on function private.teacher_has_class_access(uuid) to authenticated;
grant execute on function private.admin_update_teacher_access_impl(uuid, text, text, boolean, uuid[]) to authenticated;
grant execute on function public.admin_update_teacher_access(uuid, text, text, boolean, uuid[]) to authenticated;

commit;
