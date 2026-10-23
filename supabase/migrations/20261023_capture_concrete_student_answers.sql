-- Store literal student submissions for pedagogical error analysis.
-- Install this migration BEFORE deploying the matching frontend changes.
-- Existing attempts cannot be reconstructed retroactively.
alter table public.practice_attempts
  add column if not exists submitted_answer text;

comment on column public.practice_attempts.submitted_answer is
  'Exact learner entry, retained for teacher-only error analysis; may be null for older attempts.';

create or replace function private.capture_submitted_answers(
  p_identity_token text, p_session jsonb, p_attempts jsonb
) returns void
language plpgsql
security definer
set search_path to ''
as $body$
declare
  v_student uuid;
  v_session uuid;
  v_attempt jsonb;
  v_answer text;
begin
  select s.id into v_student from public.students s
    where s.sync_token = p_identity_token::uuid;
  if v_student is null then
    raise exception 'Unknown student identity';
  end if;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id = v_student
      and ps.client_session_id = (p_session->>'client_session_id')::uuid;
  if v_session is null then
    raise exception 'Unknown student session';
  end if;
  if pg_catalog.jsonb_typeof(p_attempts) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_attempts) > 5000 then
    raise exception 'Invalid attempt payload';
  end if;
  for v_attempt in select value from pg_catalog.jsonb_array_elements(p_attempts) loop
    if not (v_attempt ? 'submitted_answer') then continue; end if;
    if pg_catalog.jsonb_typeof(v_attempt->'submitted_answer') is distinct from 'string'
       or pg_catalog.length(v_attempt->>'submitted_answer') > 1000 then
      raise exception 'Invalid submitted answer';
    end if;
    if coalesce(v_attempt->>'client_attempt_id','') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Invalid attempt id';
    end if;
    v_answer := v_attempt->>'submitted_answer';
    update public.practice_attempts a
      set submitted_answer = v_answer
      where a.student_id = v_student
        and a.session_id = v_session
        and a.client_attempt_id = (v_attempt->>'client_attempt_id')::uuid
        and (a.submitted_answer is null or a.submitted_answer = v_answer);
  end loop;
end;
$body$;

revoke all on function private.capture_submitted_answers(text,jsonb,jsonb) from public;
grant execute on function private.capture_submitted_answers(text,jsonb,jsonb) to anon, authenticated;

-- Keep existing validation, round tracking and ingest semantics intact.
-- Only append literal-answer capture after an accepted bundle was ingested.
create or replace function public.ingest_practice_bundle(
  p_identity_token text, p_session jsonb, p_attempts jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $body$
declare
  v_result jsonb;
begin
  v_result := private.ingest_practice_bundle_impl(p_identity_token,p_session,p_attempts);
  perform private.capture_submitted_answers(p_identity_token,p_session,p_attempts);
  return v_result;
end;
$body$;
