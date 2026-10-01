-- Mon parcours · fase 5A · handmatig uitvoeren in Supabase SQL Editor
-- Eenvoudige schoolmailidentificatie; dit is geen e-mailverificatie of sterke authenticatie.

begin;

alter table public.students
  add column if not exists school_email text;

alter table public.students
  add column if not exists school_email_normalized text
  generated always as (lower(btrim(school_email))) stored;

alter table public.students
  drop constraint if exists students_school_email_check;

alter table public.students
  add constraint students_school_email_check check (
    school_email is null
    or (
      school_email = btrim(school_email)
      and char_length(school_email) between 3 and 254
      and lower(school_email) ~ '^[^@[:space:]]+@camposturnhout\.be$'
    )
  );

create unique index if not exists students_school_email_normalized_unique
  on public.students (school_email_normalized)
  where school_email_normalized is not null;

create or replace function private.verify_student_email_impl(p_school_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  matched_student record;
begin
  normalized_email := lower(btrim(coalesce(p_school_email, '')));

  if char_length(normalized_email) not between 3 and 254
     or normalized_email !~ '^[^@[:space:]]+@camposturnhout\.be$' then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;

  select s.sync_token, s.display_name, c.name as class_name
    into matched_student
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.school_email_normalized = normalized_email
    and s.is_active = true
    and c.is_active = true
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('verified', false);
  end if;

  return pg_catalog.jsonb_build_object(
    'verified', true,
    'identity', pg_catalog.jsonb_build_object(
      'provider', 'school_email',
      'subject', matched_student.sync_token::text,
      'display_name', coalesce(matched_student.display_name, 'Leerling'),
      'class_name', matched_student.class_name
    )
  );
end;
$$;

create or replace function public.verify_student_email(p_school_email text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.verify_student_email_impl(p_school_email);
$$;

revoke all on function public.verify_student_email(text) from public, anon, authenticated, service_role;
revoke all on function private.verify_student_email_impl(text) from public, anon, authenticated, service_role;

grant execute on function public.verify_student_email(text) to anon, authenticated;
grant execute on function private.verify_student_email_impl(text) to anon, authenticated;

grant select (school_email) on table public.students to authenticated;
grant insert (school_email) on table public.students to authenticated;
grant update (school_email) on table public.students to authenticated;

commit;
