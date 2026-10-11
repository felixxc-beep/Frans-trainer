-- Handmatig uitvoeren NA phase11-curated-variants.sql. Bestaande taken,
-- rondes, pogingen, mastery en rapporten blijven bewaard.
begin;

-- Opt-in voor nieuwe rondetaken. Bestaande gepubliceerde taken blijven false.
alter table public.assignments add column include_integrative_sentences boolean not null default false;
alter table public.practice_question_submissions add column round_item_id text
  references public.course_item_ids(item_id) on delete restrict;

-- Een leerling kan na terugsturen opnieuw melden. Behoud iedere cyclus als
-- afzonderlijk QA-record; hoogstens één melding per item mag tegelijk open zijn.
do $$
declare v_constraint text;
begin
  select c.conname into v_constraint from pg_catalog.pg_constraint c
  where c.conrelid='public.assignment_item_reports'::pg_catalog.regclass
    and c.contype='u' and replace(pg_catalog.pg_get_constraintdef(c.oid),' ','') =
      'UNIQUE(assignment_id,student_id,round_number,item_id)';
  if v_constraint is not null then
    execute pg_catalog.format('alter table public.assignment_item_reports drop constraint %I',v_constraint);
  end if;
end; $$;
create unique index assignment_item_reports_one_pending_idx
  on public.assignment_item_reports(assignment_id,student_id,round_number,item_id)
  where status='pending';

-- Geen limiet van drie pogingen: het clientrapport bevat alle foute antwoorden
-- sinds het begin van deze meldcyclus, in invoervolgorde. Een ruime technische
-- bovengrens voorkomt onbegrensde publieke RPC-payloads.
alter table public.assignment_item_reports
  drop constraint if exists assignment_item_reports_submitted_answers_check;
alter table public.assignment_item_reports
  add constraint assignment_item_reports_submitted_answers_check
  check (pg_catalog.jsonb_typeof(submitted_answers)='array'
    and pg_catalog.jsonb_array_length(submitted_answers) between 1 and 1000);
alter table public.assignment_item_reports
  drop constraint if exists assignment_item_reports_exercise_direction_check;
alter table public.assignment_item_reports
  add constraint assignment_item_reports_exercise_direction_check
  check (exercise_direction in ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl',
    'verb-nl-conj','verb-fr-conj','phrase-nl-fr','full-sentence-nl-fr',
    'grammar','number-nl-fr','number-fr-nl'));

-- Alleen een afgeleide completion wordt bij een teruggestuurd item heropend.
-- Het oorspronkelijke completion-event blijft ongewijzigd in dit auditspoor.
create table public.assignment_completion_reopenings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  report_id uuid not null references public.assignment_item_reports(id) on delete restrict,
  original_completion jsonb not null,
  reopened_at timestamptz not null default pg_catalog.now(),
  unique (report_id)
);
alter table public.assignment_completion_reopenings enable row level security;
alter table public.assignment_completion_reopenings force row level security;
revoke all on public.assignment_completion_reopenings from public,anon,authenticated,service_role;

create or replace function private.report_assignment_item_impl(p_identity_token text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_assignment uuid; v_round integer; v_item text;
  v_id uuid; v_wrong integer; v_direction text; v_last_resolved timestamptz;
  v_existing_status text;
begin
  if p_identity_token is null or p_identity_token !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(p_payload)<>'object' then raise exception 'invalid report'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s
    join public.classes c on c.id=s.class_id
    where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  v_assignment:=(p_payload->>'assignment_id')::uuid;
  v_round:=(p_payload->>'round_number')::integer;
  v_item:=p_payload->>'item_id';
  v_id:=(p_payload->>'client_report_id')::uuid;
  v_direction:=p_payload->>'exercise_direction';
  if v_round not between 1 and 4 or v_item is null or v_id is null
    or not exists(select 1 from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
      where a.id=v_assignment and ac.class_id=v_class and a.completion_strategy='rounds'
        and a.status in ('published','archived'))
    or not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
      and ri.student_id=v_student and ri.round_number=v_round and ri.item_id=v_item)
    or pg_catalog.jsonb_typeof(p_payload->'submitted_answers')<>'array'
    or pg_catalog.jsonb_array_length(p_payload->'submitted_answers') not between 1 and 1000
    or pg_catalog.jsonb_typeof(p_payload->'accepted_answers')<>'array'
    or pg_catalog.jsonb_array_length(p_payload->'accepted_answers') not between 1 and 20
    or pg_catalog.char_length(coalesce(p_payload->>'prompt','')) not between 1 and 500
    or pg_catalog.char_length(coalesce(p_payload->>'app_version',''))>64
    or v_direction not in ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl',
      'verb-nl-conj','verb-fr-conj','phrase-nl-fr','full-sentence-nl-fr','grammar','number-nl-fr','number-fr-nl')
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'submitted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'accepted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    then raise exception 'invalid report payload'; end if;
  select r.status into v_existing_status from public.assignment_item_reports r where r.id=v_id
    and r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
    and r.item_id=v_item;
  if v_existing_status is not null then
    return pg_catalog.jsonb_build_object('id',v_id,'status',v_existing_status);
  end if;
  if exists(select 1 from public.assignment_item_reports r where r.assignment_id=v_assignment
    and r.student_id=v_student and r.round_number=v_round and r.item_id=v_item and r.status='pending')
    then raise exception 'report already pending'; end if;
  select max(r.resolved_at) into v_last_resolved from public.assignment_item_reports r
    where r.assignment_id=v_assignment and r.student_id=v_student
      and r.round_number=v_round and r.item_id=v_item;
  select count(distinct pa.id)::integer into v_wrong from public.practice_attempts pa
    join public.practice_sessions ps on ps.id=pa.session_id
    where ps.assignment_id=v_assignment and ps.student_id=v_student
      and ps.assignment_round_number=v_round and pa.item_id=v_item and pa.was_correct=false
      and (v_last_resolved is null or pa.created_at>v_last_resolved);
  v_wrong:=v_wrong+(select count(*)::integer from public.practice_question_submissions q
    join public.practice_sessions ps on ps.id=q.session_id
    where ps.assignment_id=v_assignment and ps.student_id=v_student
      and ps.assignment_round_number=v_round and q.round_item_id=v_item and q.was_correct=false
      and (v_last_resolved is null or q.created_at>v_last_resolved));
  if v_wrong<2 then raise exception 'two wrong attempts required'; end if;
  insert into public.assignment_item_reports(id,assignment_id,student_id,round_number,item_id,prompt,
    exercise_direction,submitted_answers,accepted_answers,consulted,app_version)
  values(v_id,v_assignment,v_student,v_round,v_item,p_payload->>'prompt',v_direction,
    p_payload->'submitted_answers',p_payload->'accepted_answers',
    coalesce((p_payload->>'consulted')::boolean,false),p_payload->>'app_version');
  update public.assignment_round_items ri set completed_at=coalesce(ri.completed_at,pg_catalog.now()),
    completion_kind='reported_pending'
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and ri.item_id=v_item and ri.completed_at is null;
  if not found then raise exception 'item already completed'; end if;
  update public.assignment_rounds r set completed_at=pg_catalog.now()
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and r.completed_at is null and not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.completed_at is null);
  return pg_catalog.jsonb_build_object('id',v_id,'status','pending');
end;
$$;

create or replace function private.resolve_assignment_item_report_impl(p_report_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_report public.assignment_item_reports%rowtype; v_class uuid;
begin
  if p_decision not in ('approved','rejected') or not private.current_teacher_is_active()
    then raise exception 'invalid decision'; end if;
  select r.* into v_report from public.assignment_item_reports r where r.id=p_report_id for update;
  select s.class_id into v_class from public.students s where s.id=v_report.student_id;
  if v_report.id is null or not private.teacher_has_class_access(v_class)
    then raise exception 'report access denied'; end if;
  if v_report.status=p_decision then
    return pg_catalog.jsonb_build_object('id',v_report.id,'status',v_report.status);
  end if;
  if v_report.status<>'pending' then raise exception 'report already resolved'; end if;
  update public.assignment_item_reports set status=p_decision,resolved_at=pg_catalog.now(),resolved_by=auth.uid()
    where id=p_report_id;
  if p_decision='approved' then
    update public.assignment_round_items ri set completed_at=coalesce(ri.completed_at,pg_catalog.now()),
      completion_kind='teacher_approved'
      where ri.assignment_id=v_report.assignment_id and ri.student_id=v_report.student_id
        and ri.round_number=v_report.round_number and ri.item_id=v_report.item_id;
    perform private.register_assignment_completion(v_report.assignment_id,v_report.student_id);
  else
    update public.assignment_round_items ri set completed_at=null,completion_kind=null
      where ri.assignment_id=v_report.assignment_id and ri.student_id=v_report.student_id
        and ri.round_number=v_report.round_number and ri.item_id=v_report.item_id
        and ri.completion_kind='reported_pending';
    update public.assignment_rounds r set completed_at=null
      where r.assignment_id=v_report.assignment_id and r.student_id=v_report.student_id
        and r.round_number=v_report.round_number;
    insert into public.assignment_completion_reopenings(assignment_id,student_id,report_id,original_completion)
      select c.assignment_id,c.student_id,p_report_id,to_jsonb(c)
      from public.assignment_completions c where c.assignment_id=v_report.assignment_id
        and c.student_id=v_report.student_id on conflict (report_id) do nothing;
    delete from public.assignment_completions c where c.assignment_id=v_report.assignment_id
      and c.student_id=v_report.student_id;
  end if;
  return pg_catalog.jsonb_build_object('id',p_report_id,'status',p_decision);
end;
$$;

-- De fase-9 ingest reconstrueert voltooiing uit alle historische pogingen.
-- Na terugsturen mogen uitsluitend nieuwe correcte pogingen het item afsluiten.
alter function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  rename to ingest_practice_bundle_pre_report_reliability_impl;
create function private.ingest_practice_bundle_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_student uuid; v_assignment uuid; v_round integer; v_report record;
  v_correct timestamptz; v_session uuid; v_submission jsonb; v_submissions jsonb;
  v_reopen_report uuid;
begin
  v_result:=private.ingest_practice_bundle_pre_report_reliability_impl(p_identity_token,p_session,p_attempts);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  v_round:=nullif(p_session->>'assignment_round_number','')::integer;
  if v_assignment is null or v_round is null then return v_result; end if;
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=(p_session->>'client_session_id')::uuid;
  if v_session is null then raise exception 'missing assignment session'; end if;
  v_submissions:=coalesce(p_session->'question_submissions','[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_submissions)<>'array'
    or pg_catalog.jsonb_array_length(v_submissions)>5000 then
    raise exception 'invalid assignment submissions'; end if;
  for v_submission in select value from pg_catalog.jsonb_array_elements(v_submissions) loop
    if pg_catalog.jsonb_typeof(v_submission)<>'object'
      or coalesce(v_submission->>'client_submission_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_submission->>'variant_id','') !~ '^T[1-6]-[A-Z0-9-]+-[0-9]{3}$'
      or pg_catalog.jsonb_typeof(v_submission->'was_correct')<>'boolean'
      or coalesce(v_submission->>'created_at','')=''
      or not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=v_assignment and ri.student_id=v_student
          and ri.round_number=v_round and ri.item_id=v_submission->>'item_id')
      or not exists(select 1 from public.assignments a where a.id=v_assignment
        and a.include_integrative_sentences=true)
      then raise exception 'invalid assignment submission'; end if;
    insert into public.practice_question_submissions
      (session_id,student_id,client_submission_id,variant_id,round_item_id,was_correct,created_at)
    values (v_session,v_student,(v_submission->>'client_submission_id')::uuid,
      v_submission->>'variant_id',v_submission->>'item_id',
      (v_submission->>'was_correct')::boolean,(v_submission->>'created_at')::timestamptz)
    on conflict (student_id,client_submission_id) do nothing;
  end loop;
  if pg_catalog.jsonb_array_length(v_submissions)>0 then
    update public.assignment_round_items ri set wrong_count=counts.wrong_count
      from (select selected.item_id,
        (select count(distinct pa.id)::integer from public.practice_attempts pa
          join public.practice_sessions ps on ps.id=pa.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student
            and ps.assignment_round_number=v_round and pa.item_id=selected.item_id
            and pa.was_correct=false) +
        (select count(*)::integer from public.practice_question_submissions q
          join public.practice_sessions ps on ps.id=q.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student
            and ps.assignment_round_number=v_round and q.round_item_id=selected.item_id
            and q.was_correct=false) as wrong_count
        from public.assignment_round_items selected
        where selected.assignment_id=v_assignment and selected.student_id=v_student
          and selected.round_number=v_round) counts
      where ri.assignment_id=v_assignment and ri.student_id=v_student
        and ri.round_number=v_round and ri.item_id=counts.item_id;
    update public.practice_sessions ps set
      attempt_count=totals.attempt_count,correct_count=totals.correct_count,
      incorrect_count=totals.incorrect_count,updated_at=pg_catalog.now()
    from (select
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and q.variant_id=pa.legacy_item_id
            and q.round_item_id=pa.item_id)) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session)
        as attempt_count,
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and pa.was_correct and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and q.variant_id=pa.legacy_item_id
            and q.round_item_id=pa.item_id)) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session
        and q.was_correct) as correct_count,
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and not pa.was_correct and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and q.variant_id=pa.legacy_item_id
            and q.round_item_id=pa.item_id)) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session
        and not q.was_correct) as incorrect_count) totals where ps.id=v_session;
  end if;
  for v_report in select latest.item_id,latest.resolved_at from (
    select distinct on (r.item_id) r.item_id,r.status,r.resolved_at
    from public.assignment_item_reports r where r.assignment_id=v_assignment
      and r.student_id=v_student and r.round_number=v_round
    order by r.item_id,r.created_at desc,r.id desc) latest
    where latest.status='rejected' loop
    select min(pa.created_at) into v_correct from public.practice_attempts pa
      join public.practice_sessions ps on ps.id=pa.session_id
      where ps.assignment_id=v_assignment and ps.student_id=v_student
        and ps.assignment_round_number=v_round and pa.was_correct=true
        and (pa.item_id=v_report.item_id or v_report.item_id=any(pa.equivalent_item_ids))
        and pa.created_at>v_report.resolved_at;
    update public.assignment_round_items ri set completed_at=v_correct,
      completion_kind=case when v_correct is null then null else 'correct' end
      where ri.assignment_id=v_assignment and ri.student_id=v_student
        and ri.round_number=v_round and ri.item_id=v_report.item_id;
  end loop;
  update public.assignment_rounds r set completed_at=null
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  -- De oude ingest kan in dezelfde transactie een verouderde completion
  -- opnieuw afleiden. Die ongeldige afgeleide rij hoort niet te blijven staan.
  select r.id into v_reopen_report from public.assignment_item_reports r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.status='rejected'
    order by r.resolved_at desc,r.id desc limit 1;
  if v_reopen_report is not null and exists(select 1 from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.completed_at is null) then
    insert into public.assignment_completion_reopenings(assignment_id,student_id,report_id,original_completion)
      select c.assignment_id,c.student_id,v_reopen_report,to_jsonb(c)
      from public.assignment_completions c where c.assignment_id=v_assignment
        and c.student_id=v_student on conflict (report_id) do nothing;
    delete from public.assignment_completions c where c.assignment_id=v_assignment
      and c.student_id=v_student;
  end if;
  if not exists(select 1 from public.assignment_item_reports x where x.assignment_id=v_assignment
    and x.student_id=v_student and x.status='pending') then
    perform private.register_assignment_completion(v_assignment,v_student);
  end if;
  return v_result || pg_catalog.jsonb_build_object('attempt_count',
    (select ps.attempt_count from public.practice_sessions ps where ps.id=v_session));
end;
$$;

-- Geef voor de leerling per item alleen de laatste meldcyclus terug. Oude
-- meldingen blijven volledig aanwezig voor QA en audit.
alter function private.get_student_assignments_impl(text)
  rename to get_student_assignments_pre_report_reliability_impl;
create function private.get_student_assignments_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_student uuid; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_report_reliability_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object('reports',
    (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('round_number',r.round_number,
      'item_id',r.item_id,'status',r.status,'resolved_at',r.resolved_at)),'[]'::jsonb)
      from (select distinct on (ar.round_number,ar.item_id) ar.round_number,ar.item_id,
        ar.status,ar.resolved_at from public.assignment_item_reports ar
        where ar.assignment_id=(x.value->>'id')::uuid and ar.student_id=v_student
        order by ar.round_number,ar.item_id,ar.created_at desc,ar.id desc) r)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

-- Nieuwe opdrachtoptie is uitsluitend voor nog niet gepubliceerde rondetaken.
alter function private.save_assignment_impl(jsonb)
  rename to save_assignment_pre_sentences_impl;
create function private.save_assignment_impl(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old public.assignments%rowtype; v_enabled boolean; v_result jsonb;
begin
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is not null then select * into v_old from public.assignments where id=v_id; end if;
  v_enabled:=coalesce((p_payload->>'include_integrative_sentences')::boolean,
    v_old.include_integrative_sentences,false);
  if v_enabled and coalesce(p_payload->>'completion_strategy',v_old.completion_strategy,'rounds')<>'rounds'
    then raise exception 'full sentences require rounds'; end if;
  if v_id is not null and v_old.status<>'draft'
    and v_old.include_integrative_sentences is distinct from v_enabled
    then raise exception 'published sentence mode is immutable'; end if;
  v_result:=private.save_assignment_pre_sentences_impl(p_payload);
  update public.assignments a set include_integrative_sentences=v_enabled
    where a.id=(v_result->>'id')::uuid;
  return v_result;
end;
$$;

alter function private.get_student_assignments_impl(text)
  rename to get_student_assignments_pre_sentences_impl;
create function private.get_student_assignments_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_sentences_impl(p_identity_token);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'include_integrative_sentences',a.include_integrative_sentences) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

alter function private.get_teacher_assignments_impl()
  rename to get_teacher_assignments_pre_sentences_impl;
create function private.get_teacher_assignments_impl()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignments_pre_sentences_impl();
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'include_integrative_sentences',a.include_integrative_sentences) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

-- Bij een teruggestuurd item uit een vroegere ronde toont het docentdetail de
-- eerstvolgende werkelijk vereiste ronde, niet blind de hoogste aangemaakte.
alter function private.get_teacher_assignment_detail_impl(uuid)
  rename to get_teacher_assignment_detail_pre_reopen_impl;
create function private.get_teacher_assignment_detail_impl(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignment_detail_pre_reopen_impl(p_assignment_id);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'round_progress',(select pg_catalog.jsonb_build_object(
      'round_number',r.round_number,'required_rounds',a.required_rounds,
      'total',pg_catalog.cardinality(r.selected_item_ids),
      'completed',(select count(*) from public.assignment_round_items ri
        where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.completed_at is not null))
      from public.assignment_rounds r join public.assignments a on a.id=r.assignment_id
      where r.assignment_id=p_assignment_id and r.student_id=(x.value->>'student_id')::uuid
      order by case when r.completed_at is null then 0 else 1 end,
        case when r.completed_at is null then r.round_number else -r.round_number end
      limit 1)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

-- Eén volledige zin is één beantwoorde oefening, ook als een foute zin geen
-- mastery-evidence oplevert. Corrigeer alleen opt-in assignment-sessies.
alter function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  rename to get_class_activity_monitor_pre_sentences_impl;
create function private.get_class_activity_monitor_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_rows jsonb:='[]'::jsonb; v_row jsonb; v_student uuid;
  v_evidence_unique integer; v_evidence_attempts integer; v_evidence_correct integer;
  v_question_unique integer; v_question_attempts integer; v_question_correct integer;
  v_last_question timestamptz; v_recent_question boolean;
begin
  v_base:=private.get_class_activity_monitor_pre_sentences_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
  for v_row in select value from pg_catalog.jsonb_array_elements(v_base) loop
    v_student:=(v_row->>'student_id')::uuid;
    with scoped_sessions as (
      select ps.id,ps.mode,ps.started_at,ps.finished_at
      from public.practice_sessions ps join public.assignments a on a.id=ps.assignment_id
      where ps.student_id=v_student and ps.exercise_key='assignment-mixed'
        and a.include_integrative_sentences=true
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
        and exists(select 1 from public.practice_question_submissions q
          where q.session_id=pa.session_id and q.round_item_id=pa.item_id
            and q.variant_id=pa.legacy_item_id)
    ), questions as (
      select q.session_id,q.variant_id,q.round_item_id,q.was_correct,q.created_at,
        ps.mode,ps.finished_at from public.practice_question_submissions q
      join scoped_sessions ps on ps.id=q.session_id
      where q.round_item_id is not null
        and (p_period_start is null or q.created_at>=p_period_start)
        and (p_period_end is null or q.created_at<p_period_end)
    )
    select
      (select count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer from evidence),
      (select count(*)::integer from evidence),
      (select count(*)::integer from evidence where was_correct),
      (select count(distinct (session_id,variant_id,round_item_id))::integer from questions),
      (select count(*)::integer from questions),
      (select count(*)::integer from questions where was_correct),
      (select max(created_at) from questions),
      (select exists(select 1 from questions where finished_at is null
        and created_at>=pg_catalog.now()-interval '180 seconds'))
    into v_evidence_unique,v_evidence_attempts,v_evidence_correct,
      v_question_unique,v_question_attempts,v_question_correct,v_last_question,v_recent_question;
    v_row:=v_row||pg_catalog.jsonb_build_object(
      'unique_exercises',greatest(0,(v_row->>'unique_exercises')::integer-v_evidence_unique+v_question_unique),
      'attempt_count',greatest(0,(v_row->>'attempt_count')::integer-v_evidence_attempts+v_question_attempts),
      'independent_attempts',greatest(0,(v_row->>'independent_attempts')::integer-v_evidence_attempts+v_question_attempts),
      'independent_correct',greatest(0,(v_row->>'independent_correct')::integer-v_evidence_correct+v_question_correct),
      'last_activity_at',greatest((v_row->>'last_activity_at')::timestamptz,v_last_question),
      'recent_open_session',coalesce((v_row->>'recent_open_session')::boolean,false) or v_recent_question);
    v_rows:=v_rows||pg_catalog.jsonb_build_array(v_row);
  end loop;
  return v_rows;
end;
$$;

revoke all on function private.ingest_practice_bundle_pre_report_reliability_impl(text,jsonb,jsonb),
  private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_pre_report_reliability_impl(text),
  private.get_student_assignments_pre_sentences_impl(text),
  private.get_student_assignments_impl(text),private.report_assignment_item_impl(text,jsonb),
  private.save_assignment_pre_sentences_impl(jsonb),private.save_assignment_impl(jsonb),
  private.get_teacher_assignments_pre_sentences_impl(),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_pre_reopen_impl(uuid),
  private.get_teacher_assignment_detail_impl(uuid),
  private.get_class_activity_monitor_pre_sentences_impl(
    uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.get_class_activity_monitor_impl(
    uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.resolve_assignment_item_report_impl(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_impl(text),private.report_assignment_item_impl(text,jsonb)
  to anon,authenticated;
grant execute on function private.resolve_assignment_item_report_impl(uuid,text),
  private.save_assignment_impl(jsonb),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_impl(uuid)
  to authenticated;
grant execute on function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  to authenticated;
create function public.assignment_sentence_sync_version()
returns integer language sql stable set search_path = '' as $$ select 1; $$;
revoke all on function public.assignment_sentence_sync_version()
  from public,anon,authenticated,service_role;
grant execute on function public.assignment_sentence_sync_version() to anon,authenticated;
commit;
