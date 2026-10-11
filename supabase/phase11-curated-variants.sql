-- Handmatig uitvoeren NA phase10-item-reports.sql en VÓÓR de gecureerde
-- Trajet 1–6-bank online wordt gebruikt. Geen nieuwe permanente course-items.
begin;

-- Eén leerlinginzending kan nul (foute integratieve vertaling), één of meerdere
-- mastery-evidencerijen (multi-gap) opleveren. Deze tabel bewaart uitsluitend
-- de vraaguitkomst, nooit het getypte antwoord.
create table public.practice_question_submissions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  client_submission_id uuid not null,
  variant_id text not null check (pg_catalog.char_length(variant_id) between 5 and 120),
  was_correct boolean not null,
  created_at timestamptz not null,
  received_at timestamptz not null default pg_catalog.now(),
  unique (student_id, client_submission_id)
);
create index practice_question_submissions_session_idx
  on public.practice_question_submissions(session_id);
alter table public.practice_question_submissions enable row level security;
alter table public.practice_question_submissions force row level security;
revoke all on public.practice_question_submissions from public, anon, authenticated, service_role;

-- De bestaande, beveiligde ingest blijft ongewijzigd voor legacy- en
-- assignment-sessies. De wrapper corrigeert alleen de drie sessietellers voor
-- curated-* op basis van idempotente inzendingen, niet op basis van evidence.
alter function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  rename to ingest_practice_bundle_pre_curated_impl;

create function private.ingest_practice_bundle_impl(
  p_identity_token text, p_session jsonb, p_attempts jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_student uuid;
  v_session uuid;
  v_submissions jsonb;
  v_submission jsonb;
  v_client_session uuid;
  v_total integer;
begin
  v_result := private.ingest_practice_bundle_pre_curated_impl(p_identity_token,p_session,p_attempts);
  if coalesce(p_session->>'exercise_key','') not like 'curated-%' then return v_result; end if;
  v_submissions := p_session->'question_submissions';
  if pg_catalog.jsonb_typeof(v_submissions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(v_submissions) > 5000 then
    raise exception 'invalid curated submissions';
  end if;
  v_total := nullif(p_session->>'attempt_count','')::integer;
  if v_total is null or v_total not between 0 and 10000
    or v_total <> pg_catalog.jsonb_array_length(v_submissions) then
    raise exception 'invalid curated attempt count';
  end if;
  v_client_session := (p_session->>'client_session_id')::uuid;
  select s.id into v_student from public.students s
    where s.sync_token=p_identity_token::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=v_client_session;
  if v_session is null then raise exception 'invalid curated session'; end if;

  for v_submission in select value from pg_catalog.jsonb_array_elements(v_submissions) loop
    if pg_catalog.jsonb_typeof(v_submission) is distinct from 'object'
      or coalesce(v_submission->>'client_submission_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_submission->>'variant_id','') !~ '^T[1-6]-[A-Z0-9-]+-[0-9]{3}$'
      or pg_catalog.jsonb_typeof(v_submission->'was_correct') is distinct from 'boolean'
      or coalesce(v_submission->>'created_at','')='' then
      raise exception 'invalid curated submission';
    end if;
    insert into public.practice_question_submissions
      (session_id,student_id,client_submission_id,variant_id,was_correct,created_at)
    values (v_session,v_student,(v_submission->>'client_submission_id')::uuid,
      v_submission->>'variant_id',(v_submission->>'was_correct')::boolean,
      (v_submission->>'created_at')::timestamptz)
    on conflict (student_id,client_submission_id) do nothing;
  end loop;

  update public.practice_sessions ps set
    attempt_count=totals.attempt_count,
    correct_count=totals.correct_count,
    incorrect_count=totals.incorrect_count,
    updated_at=pg_catalog.now()
  from (
    select count(*)::integer attempt_count,
      count(*) filter (where was_correct)::integer correct_count,
      count(*) filter (where not was_correct)::integer incorrect_count
    from public.practice_question_submissions where session_id=v_session
  ) totals where ps.id=v_session;
  return v_result || pg_catalog.jsonb_build_object(
    'attempt_count',(select ps.attempt_count from public.practice_sessions ps where ps.id=v_session)
  );
end;
$$;

revoke all on function private.ingest_practice_bundle_pre_curated_impl(text,jsonb,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  to anon,authenticated;
create or replace function public.ingest_practice_bundle(
  p_identity_token text,p_session jsonb,p_attempts jsonb
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.ingest_practice_bundle_impl(p_identity_token,p_session,p_attempts);
$$;

-- Frontend-capabilitycheck: vóór deze migratie blijft een curated sessie in
-- de offline queue, zodat oudere ingest-code geen foutieve tellers bevestigt.
create function public.curated_sync_version()
returns integer language sql stable set search_path = '' as $$ select 1; $$;
revoke all on function public.curated_sync_version() from public,anon,authenticated,service_role;
grant execute on function public.curated_sync_version() to anon,authenticated;

-- De fase-8-monitor telt practice_attempts als oefeningen. Bij curated
-- multi-gap-vragen zijn dat evidence per gat; bij een foute integratieve
-- vertaling kan er zelfs nul evidence zijn. Houd de bestaande beveiligde
-- monitor en filters intact en vervang alleen deze vier vraagstatistieken
-- door de idempotente question_submissions voor curated sessies.
alter function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  rename to get_class_activity_monitor_pre_curated_impl;

create function private.get_class_activity_monitor_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_base jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_student uuid;
  v_evidence_unique integer;
  v_evidence_attempts integer;
  v_evidence_independent integer;
  v_evidence_correct integer;
  v_question_unique integer;
  v_question_attempts integer;
  v_question_independent integer;
  v_question_correct integer;
  v_last_question timestamptz;
  v_recent_question boolean;
begin
  -- De oude SECURITY DEFINER-functie handhaaft docent- en klastoegang en
  -- levert alleen leerlingen op die deze docent in dit filter mag zien.
  v_base := private.get_class_activity_monitor_pre_curated_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
  for v_row in select value from pg_catalog.jsonb_array_elements(v_base) loop
    v_student := (v_row->>'student_id')::uuid;
    with scoped_sessions as (
      select ps.id,ps.mode,ps.started_at,ps.finished_at
      from public.practice_sessions ps
      where ps.student_id=v_student and ps.exercise_key like 'curated-%'
        and (p_trajectory is null or ps.trajectory=p_trajectory)
        and (p_mode is null or ps.mode=p_mode)
        and (p_category is null or ps.top_category=p_category)
        and (p_subsection is null or ps.subsection=p_subsection)
        and (p_assignment_id is null or ps.assignment_id=p_assignment_id)
    ), evidence as (
      select pa.session_id,pa.item_id,pa.item_variant,pa.was_correct,ps.mode
      from public.practice_attempts pa join scoped_sessions ps on ps.id=pa.session_id
      where (p_period_start is null or pa.created_at>=p_period_start)
        and (p_period_end is null or pa.created_at<p_period_end)
    ), questions as (
      select q.session_id,q.variant_id,q.was_correct,q.created_at,ps.mode,
        ps.started_at,ps.finished_at
      from public.practice_question_submissions q
      join scoped_sessions ps on ps.id=q.session_id
      where (p_period_start is null or q.created_at>=p_period_start)
        and (p_period_end is null or q.created_at<p_period_end)
    )
    select
      (select count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer from evidence),
      (select count(*)::integer from evidence),
      (select count(*)::integer from evidence where mode in ('practice','test')),
      (select count(*)::integer from evidence where mode in ('practice','test') and was_correct),
      (select count(distinct (session_id,variant_id))::integer from questions),
      (select count(*)::integer from questions),
      (select count(*)::integer from questions where mode in ('practice','test')),
      (select count(*)::integer from questions where mode in ('practice','test') and was_correct),
      (select max(created_at) from questions),
      (select exists (
        select 1 from questions where finished_at is null
          and created_at>=pg_catalog.now()-interval '180 seconds'))
    into v_evidence_unique,v_evidence_attempts,v_evidence_independent,v_evidence_correct,
      v_question_unique,v_question_attempts,v_question_independent,v_question_correct,
      v_last_question,v_recent_question;

    v_row := v_row || pg_catalog.jsonb_build_object(
      'unique_exercises',greatest(0,(v_row->>'unique_exercises')::integer-v_evidence_unique+v_question_unique),
      'attempt_count',greatest(0,(v_row->>'attempt_count')::integer-v_evidence_attempts+v_question_attempts),
      'independent_attempts',greatest(0,(v_row->>'independent_attempts')::integer-v_evidence_independent+v_question_independent),
      'independent_correct',greatest(0,(v_row->>'independent_correct')::integer-v_evidence_correct+v_question_correct),
      'last_activity_at',greatest((v_row->>'last_activity_at')::timestamptz,v_last_question),
      'recent_open_session',coalesce((v_row->>'recent_open_session')::boolean,false) or v_recent_question
    );
    v_rows := v_rows || pg_catalog.jsonb_build_array(v_row);
  end loop;
  return v_rows;
end;
$$;
revoke all on function private.get_class_activity_monitor_pre_curated_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  from public,anon,authenticated,service_role;
revoke all on function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  to authenticated;
create or replace function public.get_class_activity_monitor(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_class_activity_monitor_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
$$;

commit;
