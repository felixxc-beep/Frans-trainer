-- Mon parcours · fase 2
-- Voer dit bestand één keer uit in de Supabase SQL Editor.

create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function private.generate_student_code()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 16));
$$;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  class_code text not null check (class_code ~ '^[A-Za-z0-9_-]{3,32}$'),
  class_code_normalized text generated always as (lower(btrim(class_code))) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_code_normalized)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_code text not null default private.generate_student_code()
    check (student_code ~ '^[A-Za-z0-9_-]{8,64}$'),
  student_code_normalized text generated always as (lower(btrim(student_code))) stored,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  is_active boolean not null default true,
  sync_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_code_normalized),
  unique (sync_token)
);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  client_session_id uuid not null,
  course_key text not null default 'UF1' check (char_length(course_key) between 1 and 40),
  trajectory text not null check (char_length(trajectory) between 1 and 80),
  top_category text not null check (char_length(top_category) between 1 and 120),
  lesson text not null check (char_length(lesson) between 1 and 160),
  block text,
  subsection text,
  exercise_key text not null check (char_length(exercise_key) between 1 and 40),
  mode text not null check (mode in ('learn', 'practice', 'test')),
  question_count integer not null check (question_count between 1 and 2000),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10000),
  correct_count integer not null default 0 check (correct_count between 0 and 10000),
  incorrect_count integer not null default 0 check (incorrect_count between 0 and 10000),
  started_at timestamptz not null,
  finished_at timestamptz,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, client_session_id),
  check (correct_count + incorrect_count = attempt_count),
  check (finished_at is null or finished_at >= started_at)
);

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  client_attempt_id uuid not null,
  item_id text not null check (char_length(item_id) between 1 and 80),
  equivalent_item_ids text[] not null default '{}',
  legacy_item_id text,
  item_variant text,
  item_type text not null check (item_type in ('vocabulary', 'verb', 'phrase', 'grammar_rule', 'number', 'sound_rule')),
  trajectory text not null check (char_length(trajectory) between 1 and 80),
  top_category text not null check (char_length(top_category) between 1 and 120),
  lesson text not null check (char_length(lesson) between 1 and 160),
  block text,
  subsection text,
  exercise_key text not null check (char_length(exercise_key) between 1 and 40),
  mode text not null check (mode in ('learn', 'practice', 'test')),
  prompt text not null check (char_length(prompt) between 1 and 500),
  correct_answers jsonb not null default '[]'::jsonb check (jsonb_typeof(correct_answers) = 'array'),
  was_correct boolean not null,
  attempt_number integer not null check (attempt_number between 1 and 1000),
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (student_id, client_attempt_id)
);

create index if not exists classes_owner_idx on public.classes(owner_id);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists sessions_student_started_idx on public.practice_sessions(student_id, started_at desc);
create index if not exists sessions_path_idx on public.practice_sessions(trajectory, top_category, subsection, mode);
create index if not exists attempts_session_idx on public.practice_attempts(session_id);
create index if not exists attempts_student_item_idx on public.practice_attempts(student_id, item_id, created_at desc);
create index if not exists attempts_path_idx on public.practice_attempts(trajectory, top_category, subsection, mode);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at before update on public.classes
for each row execute function private.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
for each row execute function private.set_updated_at();

create or replace function private.verify_student_identity_impl(p_class_code text, p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_student record;
begin
  if p_class_code is null or p_student_code is null
     or char_length(btrim(p_class_code)) not between 3 and 32
     or char_length(btrim(p_student_code)) not between 8 and 64 then
    return jsonb_build_object('verified', false);
  end if;

  select s.sync_token, s.display_name, c.name as class_name
    into matched_student
  from public.students s
  join public.classes c on c.id = s.class_id
  where c.class_code_normalized = lower(btrim(p_class_code))
    and s.student_code_normalized = lower(btrim(p_student_code))
    and c.is_active = true
    and s.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object('verified', false);
  end if;

  return jsonb_build_object(
    'verified', true,
    'identity', jsonb_build_object(
      'provider', 'school_code',
      'subject', matched_student.sync_token::text,
      'display_name', coalesce(matched_student.display_name, 'Leerling'),
      'class_name', matched_student.class_name
    )
  );
end;
$$;

-- Alleen deze dunne SECURITY INVOKER-wrappers zijn zichtbaar via de Data API.
-- De bevoorrechte logica staat in het niet-blootgestelde private schema.
create or replace function public.verify_student_identity(p_class_code text, p_student_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.verify_student_identity_impl(p_class_code, p_student_code);
$$;

create or replace function private.ingest_practice_bundle_impl(
  p_identity_token text,
  p_session jsonb,
  p_attempts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_student_id uuid;
  stored_session_id uuid;
  client_session uuid;
  attempt_row jsonb;
  attempt_total integer;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid identity';
  end if;

  select s.id into matched_student_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.sync_token = p_identity_token::uuid
    and s.is_active = true
    and c.is_active = true
  limit 1;

  if matched_student_id is null then raise exception 'invalid identity'; end if;
  if jsonb_typeof(p_session) is distinct from 'object' then raise exception 'invalid session'; end if;
  if jsonb_typeof(p_attempts) is distinct from 'array' then raise exception 'invalid attempts'; end if;

  attempt_total := jsonb_array_length(p_attempts);
  if attempt_total > 5000 then raise exception 'too many attempts'; end if;
  if (p_session->>'question_count')::integer not between 1 and 2000 then raise exception 'invalid question count'; end if;
  if coalesce(p_session->>'mode', '') not in ('learn', 'practice', 'test') then raise exception 'invalid mode'; end if;

  client_session := (p_session->>'client_session_id')::uuid;

  insert into public.practice_sessions (
    student_id, client_session_id, course_key, trajectory, top_category, lesson, block, subsection,
    exercise_key, mode, question_count, started_at, finished_at
  ) values (
    matched_student_id,
    client_session,
    left(coalesce(p_session->>'course_key', 'UF1'), 40),
    left(p_session->>'trajectory', 80),
    left(p_session->>'top_category', 120),
    left(p_session->>'lesson', 160),
    nullif(left(coalesce(p_session->>'block', ''), 160), ''),
    nullif(left(coalesce(p_session->>'subsection', ''), 160), ''),
    left(p_session->>'exercise_key', 40),
    p_session->>'mode',
    (p_session->>'question_count')::integer,
    (p_session->>'started_at')::timestamptz,
    nullif(p_session->>'finished_at', '')::timestamptz
  )
  on conflict (student_id, client_session_id) do update set
    question_count = excluded.question_count,
    finished_at = coalesce(excluded.finished_at, practice_sessions.finished_at),
    updated_at = now()
  returning id into stored_session_id;

  for attempt_row in select value from jsonb_array_elements(p_attempts)
  loop
    if jsonb_typeof(attempt_row) is distinct from 'object'
       or coalesce(attempt_row->>'item_id', '') = ''
       or coalesce(attempt_row->>'item_type', '') not in ('vocabulary', 'verb', 'phrase', 'grammar_rule', 'number', 'sound_rule')
       or jsonb_typeof(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb)) > 20
       or jsonb_typeof(coalesce(attempt_row->'correct_answers', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(attempt_row->'correct_answers', '[]'::jsonb)) > 20
       or (attempt_row->>'attempt_number')::integer not between 1 and 1000 then
      raise exception 'invalid attempt';
    end if;

    insert into public.practice_attempts (
      session_id, student_id, client_attempt_id, item_id, equivalent_item_ids, legacy_item_id, item_variant,
      item_type, trajectory, top_category, lesson, block, subsection, exercise_key, mode, prompt,
      correct_answers, was_correct, attempt_number, created_at
    ) values (
      stored_session_id,
      matched_student_id,
      (attempt_row->>'client_attempt_id')::uuid,
      left(attempt_row->>'item_id', 80),
      coalesce(array(select jsonb_array_elements_text(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb))), '{}'),
      nullif(left(coalesce(attempt_row->>'legacy_item_id', ''), 120), ''),
      nullif(left(coalesce(attempt_row->>'item_variant', ''), 120), ''),
      attempt_row->>'item_type',
      left(attempt_row->>'trajectory', 80),
      left(attempt_row->>'top_category', 120),
      left(attempt_row->>'lesson', 160),
      nullif(left(coalesce(attempt_row->>'block', ''), 160), ''),
      nullif(left(coalesce(attempt_row->>'subsection', ''), 160), ''),
      left(attempt_row->>'exercise_key', 40),
      attempt_row->>'mode',
      left(attempt_row->>'prompt', 500),
      coalesce(attempt_row->'correct_answers', '[]'::jsonb),
      (attempt_row->>'was_correct')::boolean,
      (attempt_row->>'attempt_number')::integer,
      (attempt_row->>'created_at')::timestamptz
    )
    on conflict (student_id, client_attempt_id) do nothing;
  end loop;

  update public.practice_sessions ps set
    attempt_count = totals.attempt_count,
    correct_count = totals.correct_count,
    incorrect_count = totals.incorrect_count,
    updated_at = now()
  from (
    select count(*)::integer as attempt_count,
           count(*) filter (where was_correct)::integer as correct_count,
           count(*) filter (where not was_correct)::integer as incorrect_count
    from public.practice_attempts
    where session_id = stored_session_id
  ) totals
  where ps.id = stored_session_id;

  return jsonb_build_object(
    'accepted', true,
    'client_session_id', client_session,
    'attempt_count', (select attempt_count from public.practice_sessions where id = stored_session_id)
  );
end;
$$;

create or replace function public.ingest_practice_bundle(
  p_identity_token text,
  p_session jsonb,
  p_attempts jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.ingest_practice_bundle_impl(p_identity_token, p_session, p_attempts);
$$;
