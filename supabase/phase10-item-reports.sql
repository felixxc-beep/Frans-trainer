-- Handmatig uitvoeren NA phase9-task-rounds.sql. Niet automatisch door de frontend.
begin;

alter table public.assignment_round_items add column completion_kind text
  check (completion_kind in ('correct','reported_pending','teacher_approved'));
update public.assignment_round_items set completion_kind='correct'
  where completed_at is not null and completion_kind is null;

create table public.assignment_item_reports (
  id uuid primary key,
  assignment_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 4),
  item_id text not null references public.course_item_ids(item_id) on delete restrict,
  prompt text not null check (pg_catalog.char_length(prompt) between 1 and 500),
  exercise_direction text not null check (exercise_direction in
    ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl','verb-nl-conj','verb-fr-conj',
     'phrase-nl-fr','grammar','number-nl-fr','number-fr-nl')),
  submitted_answers jsonb not null check (pg_catalog.jsonb_typeof(submitted_answers)='array'
    and pg_catalog.jsonb_array_length(submitted_answers) between 1 and 3),
  accepted_answers jsonb not null check (pg_catalog.jsonb_typeof(accepted_answers)='array'
    and pg_catalog.jsonb_array_length(accepted_answers) between 1 and 20),
  consulted boolean not null default false,
  app_version text check (pg_catalog.char_length(app_version)<=64),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  unique (assignment_id,student_id,round_number,item_id),
  foreign key (assignment_id,student_id,round_number,item_id)
    references public.assignment_round_items(assignment_id,student_id,round_number,item_id) on delete cascade
);
create index assignment_item_reports_pending_idx on public.assignment_item_reports(assignment_id,status,created_at);
alter table public.assignment_item_reports enable row level security;
alter table public.assignment_item_reports force row level security;
revoke all on public.assignment_item_reports from public,anon,authenticated;

-- Teacher-approved rondes leveren geen practice_attempt en verhogen dus geen mastery.
alter function private.register_assignment_completion(uuid,uuid)
  rename to register_assignment_completion_pre_reports;
create function private.register_assignment_completion(p_assignment_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_strategy text; v_required integer;
begin
  select a.completion_strategy,a.required_rounds into v_strategy,v_required
    from public.assignments a where a.id=p_assignment_id;
  if v_strategy='rounds' then
    if exists(select 1 from public.assignment_item_reports x where x.assignment_id=p_assignment_id
      and x.student_id=p_student_id and x.status='pending') then return; end if;
    if (select count(*) from public.assignment_rounds r where r.assignment_id=p_assignment_id
      and r.student_id=p_student_id and r.completed_at is not null) < v_required then return; end if;
  end if;
  perform private.register_assignment_completion_pre_reports(p_assignment_id,p_student_id);
end;
$$;

-- De bestaande ingestroute blijft intact; alleen expliciet gemelde items worden
-- na een idempotente hersynchronisatie weer als reported_pending gemarkeerd.
alter function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  rename to ingest_practice_bundle_pre_reports_impl;
create function private.ingest_practice_bundle_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_student uuid; v_assignment uuid; v_round integer;
begin
  v_result:=private.ingest_practice_bundle_pre_reports_impl(p_identity_token,p_session,p_attempts);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  v_round:=nullif(p_session->>'assignment_round_number','')::integer;
  if v_assignment is null or v_round is null then return v_result; end if;
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  update public.assignment_round_items ri set completion_kind='correct'
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and ri.completed_at is not null and ri.completion_kind is null;
  update public.assignment_round_items ri set
    completed_at=coalesce(ri.completed_at,pg_catalog.now()),
    completion_kind=case when x.status='approved' then 'teacher_approved' else 'reported_pending' end
    from public.assignment_item_reports x
    where x.assignment_id=v_assignment and x.student_id=v_student and x.round_number=v_round
      and x.status in ('pending','approved') and ri.assignment_id=x.assignment_id
      and ri.student_id=x.student_id and ri.round_number=x.round_number and ri.item_id=x.item_id
      and (ri.completion_kind is null or ri.completion_kind<>'correct');
  update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  perform private.register_assignment_completion(v_assignment,v_student);
  return v_result;
end;
$$;

create function private.report_assignment_item_impl(p_identity_token text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_assignment uuid; v_round integer; v_item text;
  v_id uuid; v_existing public.assignment_item_reports%rowtype; v_wrong integer; v_direction text;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(p_payload)<>'object' then raise exception 'invalid report'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s join public.classes c on c.id=s.class_id
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
    or pg_catalog.jsonb_array_length(p_payload->'submitted_answers') not between 1 and 3
    or pg_catalog.jsonb_typeof(p_payload->'accepted_answers')<>'array'
    or pg_catalog.jsonb_array_length(p_payload->'accepted_answers') not between 1 and 20
    or pg_catalog.char_length(coalesce(p_payload->>'prompt','')) not between 1 and 500
    or pg_catalog.char_length(coalesce(p_payload->>'app_version',''))>64
    or v_direction not in ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl',
      'verb-nl-conj','verb-fr-conj','phrase-nl-fr','grammar','number-nl-fr','number-fr-nl')
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'submitted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'accepted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    then raise exception 'invalid report payload'; end if;
  select * into v_existing from public.assignment_item_reports x where x.assignment_id=v_assignment
    and x.student_id=v_student and x.round_number=v_round and x.item_id=v_item for update;
  if v_existing.status in ('pending','approved') then
    return pg_catalog.jsonb_build_object('id',v_existing.id,'status',v_existing.status);
  end if;
  select count(distinct pa.id)::integer into v_wrong from public.practice_attempts pa
    join public.practice_sessions ps on ps.id=pa.session_id
    where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
      and pa.item_id=v_item and pa.was_correct=false
      and (v_existing.id is null or pa.created_at>v_existing.resolved_at);
  if v_wrong<2 then raise exception 'two wrong attempts required'; end if;
  if v_existing.id is null then
    insert into public.assignment_item_reports(id,assignment_id,student_id,round_number,item_id,prompt,
      exercise_direction,submitted_answers,accepted_answers,consulted,app_version)
    values(v_id,v_assignment,v_student,v_round,v_item,p_payload->>'prompt',v_direction,
      p_payload->'submitted_answers',p_payload->'accepted_answers',
      coalesce((p_payload->>'consulted')::boolean,false),p_payload->>'app_version');
  else
    update public.assignment_item_reports x set status='pending',prompt=p_payload->>'prompt',
      exercise_direction=v_direction,submitted_answers=p_payload->'submitted_answers',
      accepted_answers=p_payload->'accepted_answers',consulted=coalesce((p_payload->>'consulted')::boolean,false),
      app_version=p_payload->>'app_version',created_at=pg_catalog.now(),resolved_at=null,resolved_by=null
      where x.id=v_existing.id;
    v_id:=v_existing.id;
  end if;
  update public.assignment_round_items ri set completed_at=coalesce(ri.completed_at,pg_catalog.now()),
    completion_kind='reported_pending'
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and ri.item_id=v_item and ri.completed_at is null;
  if not found then raise exception 'item already completed'; end if;
  update public.assignment_rounds r set completed_at=pg_catalog.now()
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and r.completed_at is null and not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id and ri.round_number=r.round_number
          and ri.completed_at is null);
  return pg_catalog.jsonb_build_object('id',v_id,'status','pending');
end;
$$;
create function public.report_assignment_item(p_identity_token text,p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.report_assignment_item_impl(p_identity_token,p_payload);
$$;

alter function private.get_student_assignments_impl(text)
  rename to get_student_assignments_pre_reports_impl;
create function private.get_student_assignments_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_student uuid; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_reports_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object('reports',
    (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('round_number',r.round_number,
      'item_id',r.item_id,'status',r.status)),'[]'::jsonb)
      from public.assignment_item_reports r where r.assignment_id=(x.value->>'id')::uuid
        and r.student_id=v_student)) order by x.ord),'[]'::jsonb) into v_rows
    from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

create function private.get_teacher_assignment_reports_impl(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access denied'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'assignment_id',r.assignment_id,
    'student_id',r.student_id,'student_name',s.display_name,'class_name',c.name,'round_number',r.round_number,
    'item_id',r.item_id,'prompt',r.prompt,'exercise_direction',r.exercise_direction,
    'submitted_answers',r.submitted_answers,'accepted_answers',r.accepted_answers,
    'consulted',r.consulted,'app_version',r.app_version,'created_at',r.created_at,'status',r.status)
    order by r.created_at),'[]'::jsonb) into v_rows
    from public.assignment_item_reports r join public.students s on s.id=r.student_id
    join public.classes c on c.id=s.class_id
    where r.assignment_id=p_assignment_id and r.status='pending'
      and private.teacher_has_class_access(c.id);
  return v_rows;
end;
$$;
create function public.get_teacher_assignment_reports(p_assignment_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_reports_impl(p_assignment_id);
$$;

create function private.resolve_assignment_item_report_impl(p_report_id uuid,p_decision text)
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
    update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
      where r.assignment_id=v_report.assignment_id and r.student_id=v_report.student_id
        and r.round_number=v_report.round_number
        and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
          and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
    perform private.register_assignment_completion(v_report.assignment_id,v_report.student_id);
  else
    update public.assignment_round_items ri set completed_at=null,completion_kind=null
      where ri.assignment_id=v_report.assignment_id and ri.student_id=v_report.student_id
        and ri.round_number=v_report.round_number and ri.item_id=v_report.item_id
        and ri.completion_kind='reported_pending';
    update public.assignment_rounds r set completed_at=null where r.assignment_id=v_report.assignment_id
      and r.student_id=v_report.student_id and r.round_number=v_report.round_number;
  end if;
  return pg_catalog.jsonb_build_object('id',p_report_id,'status',p_decision);
end;
$$;
create function public.resolve_assignment_item_report(p_report_id uuid,p_decision text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.resolve_assignment_item_report_impl(p_report_id,p_decision);
$$;

revoke all on function private.register_assignment_completion_pre_reports(uuid,uuid),
  private.register_assignment_completion(uuid,uuid),
  private.ingest_practice_bundle_pre_reports_impl(text,jsonb,jsonb),
  private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.report_assignment_item_impl(text,jsonb),
  private.get_student_assignments_pre_reports_impl(text),private.get_student_assignments_impl(text),
  private.get_teacher_assignment_reports_impl(uuid),
  private.resolve_assignment_item_report_impl(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_impl(text),private.report_assignment_item_impl(text,jsonb)
  to anon,authenticated;
grant execute on function private.get_teacher_assignment_reports_impl(uuid),
  private.resolve_assignment_item_report_impl(uuid,text) to authenticated;
revoke all on function public.report_assignment_item(text,jsonb),
  public.get_teacher_assignment_reports(uuid),public.resolve_assignment_item_report(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.report_assignment_item(text,jsonb) to anon,authenticated;
grant execute on function public.get_teacher_assignment_reports(uuid),
  public.resolve_assignment_item_report(uuid,text) to authenticated;
commit;
