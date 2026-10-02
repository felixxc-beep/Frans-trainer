-- Mon parcours · fase 5B · handmatig uitvoeren in Supabase SQL Editor
-- Actieve oefentijd wordt als een totale, idempotente sessiewaarde opgeslagen.

begin;

alter table public.practice_sessions
  add column if not exists active_duration_seconds integer;

alter table public.practice_sessions
  drop constraint if exists practice_sessions_active_duration_seconds_check;

alter table public.practice_sessions
  add constraint practice_sessions_active_duration_seconds_check check (
    active_duration_seconds is null
    or active_duration_seconds between 0 and 604800
  );

alter table public.practice_sessions
  alter column active_duration_seconds set default 0;

-- Geeft een bruikbare reden terug zonder te onthullen welk intern record bestaat.
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
    return pg_catalog.jsonb_build_object('verified', false, 'reason', 'invalid');
  end if;

  select s.sync_token, s.display_name, s.is_active as student_active,
         c.name as class_name, c.is_active as class_active
    into matched_student
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.school_email_normalized = normalized_email
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('verified', false, 'reason', 'not_found');
  end if;

  if matched_student.student_active is distinct from true
     or matched_student.class_active is distinct from true then
    return pg_catalog.jsonb_build_object('verified', false, 'reason', 'inactive');
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
  active_seconds integer;
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
  if pg_catalog.jsonb_typeof(p_session) is distinct from 'object' then raise exception 'invalid session'; end if;
  if pg_catalog.jsonb_typeof(p_attempts) is distinct from 'array' then raise exception 'invalid attempts'; end if;

  attempt_total := pg_catalog.jsonb_array_length(p_attempts);
  if attempt_total > 5000 then raise exception 'too many attempts'; end if;
  if (p_session->>'question_count')::integer not between 1 and 2000 then raise exception 'invalid question count'; end if;
  if coalesce(p_session->>'mode', '') not in ('learn', 'practice', 'test') then raise exception 'invalid mode'; end if;

  active_seconds := null;
  if p_session ? 'active_duration_seconds' then
    active_seconds := nullif(p_session->>'active_duration_seconds', '')::integer;
    if active_seconds is null or active_seconds not between 0 and 604800 then raise exception 'invalid active duration'; end if;
  end if;
  client_session := (p_session->>'client_session_id')::uuid;

  insert into public.practice_sessions as existing_session (
    student_id, client_session_id, course_key, trajectory, top_category, lesson, block, subsection,
    exercise_key, mode, question_count, active_duration_seconds, started_at, finished_at
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
    active_seconds,
    (p_session->>'started_at')::timestamptz,
    nullif(p_session->>'finished_at', '')::timestamptz
  )
  on conflict (student_id, client_session_id) do update set
    question_count = excluded.question_count,
    active_duration_seconds = case
      when excluded.active_duration_seconds is null then existing_session.active_duration_seconds
      when existing_session.active_duration_seconds is null then excluded.active_duration_seconds
      else greatest(existing_session.active_duration_seconds, excluded.active_duration_seconds)
    end,
    finished_at = coalesce(excluded.finished_at, existing_session.finished_at),
    updated_at = pg_catalog.now()
  returning id into stored_session_id;

  for attempt_row in select value from pg_catalog.jsonb_array_elements(p_attempts)
  loop
    if pg_catalog.jsonb_typeof(attempt_row) is distinct from 'object'
       or coalesce(attempt_row->>'item_id', '') = ''
       or coalesce(attempt_row->>'item_type', '') not in ('vocabulary', 'verb', 'phrase', 'grammar_rule', 'number', 'sound_rule')
       or pg_catalog.jsonb_typeof(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb)) is distinct from 'array'
       or pg_catalog.jsonb_array_length(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb)) > 20
       or pg_catalog.jsonb_typeof(coalesce(attempt_row->'correct_answers', '[]'::jsonb)) is distinct from 'array'
       or pg_catalog.jsonb_array_length(coalesce(attempt_row->'correct_answers', '[]'::jsonb)) > 20
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
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(attempt_row->'equivalent_item_ids', '[]'::jsonb))), '{}'),
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
    updated_at = pg_catalog.now()
  from (
    select count(*)::integer as attempt_count,
           count(*) filter (where was_correct)::integer as correct_count,
           count(*) filter (where not was_correct)::integer as incorrect_count
    from public.practice_attempts
    where session_id = stored_session_id
  ) totals
  where ps.id = stored_session_id;

  return pg_catalog.jsonb_build_object(
    'accepted', true,
    'client_session_id', client_session,
    'attempt_count', (select attempt_count from public.practice_sessions where id = stored_session_id),
    'active_duration_seconds', (select active_duration_seconds from public.practice_sessions where id = stored_session_id)
  );
end;
$$;

revoke all on function private.verify_student_email_impl(text) from public, anon, authenticated, service_role;
revoke all on function private.ingest_practice_bundle_impl(text, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.verify_student_email_impl(text) to anon, authenticated;
grant execute on function private.ingest_practice_bundle_impl(text, jsonb, jsonb) to anon, authenticated;

commit;
