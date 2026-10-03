-- Mon parcours · fase 7. Handmatig uitvoeren NA phase6-multi-teacher.sql.
-- De 1.036 huidige permanente IDs zijn de enige toegelaten taakitems.
begin;

create table public.course_item_ids (
  item_id text primary key check (item_id ~ '^uf1-item-[0-9]{6}$')
);
insert into public.course_item_ids(item_id)
select 'uf1-item-' || pg_catalog.lpad(n::text, 6, '0')
from pg_catalog.generate_series(1, 1036) as n;

create table public.assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  created_by_teacher_id uuid not null references public.teachers(auth_user_id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  target_acquired_percentage integer not null default 80 check (target_acquired_percentage between 1 and 100),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  published_at timestamptz,
  check (status = 'draft' or published_at is not null)
);
create table public.assignment_classes (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (assignment_id, class_id)
);
create table public.assignment_items (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  item_id text not null references public.course_item_ids(item_id) on delete restrict,
  item_order integer not null check (item_order between 1 and 2000),
  primary key (assignment_id, item_id),
  unique (assignment_id, item_order)
);
create table public.assignment_completions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  completed_at timestamptz not null default pg_catalog.now(),
  acquired_count_at_completion integer not null,
  total_count_at_completion integer not null,
  acquired_percentage_at_completion integer not null,
  primary key (assignment_id, student_id)
);
alter table public.practice_sessions add column assignment_id uuid references public.assignments(id) on delete restrict;
create index assignment_classes_class_idx on public.assignment_classes(class_id, assignment_id);
create index assignment_items_item_idx on public.assignment_items(item_id, assignment_id);
create index assignment_completions_student_idx on public.assignment_completions(student_id, assignment_id);
create index assignments_status_due_idx on public.assignments(status, due_at);
create index practice_sessions_assignment_idx on public.practice_sessions(assignment_id, student_id);
create index practice_attempts_equivalent_ids_idx on public.practice_attempts using gin(equivalent_item_ids);

create trigger assignments_set_updated_at before update on public.assignments
for each row execute function private.set_updated_at();

alter table public.course_item_ids enable row level security;
alter table public.course_item_ids force row level security;
alter table public.assignments enable row level security;
alter table public.assignments force row level security;
alter table public.assignment_classes enable row level security;
alter table public.assignment_classes force row level security;
alter table public.assignment_items enable row level security;
alter table public.assignment_items force row level security;
alter table public.assignment_completions enable row level security;
alter table public.assignment_completions force row level security;
revoke all on public.course_item_ids, public.assignments, public.assignment_classes,
  public.assignment_items, public.assignment_completions from public, anon, authenticated;
-- Zelfs authenticated leerkrachten gebruiken uitsluitend gecontroleerde RPC's.

-- Dit is dezelfde Acquis-definitie als mastery.js, op permanente item-ID geaggregeerd.
create function private.assignment_progress_for_student(p_assignment_id uuid, p_student_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with evidence as (
    select ai.item_id,
      count(pa.id)::integer as practiced,
      count(pa.id) filter (where pa.mode in ('practice','test'))::integer as independent_attempts,
      count(pa.id) filter (where pa.mode in ('practice','test') and pa.was_correct)::integer as independent_correct,
      count(distinct pa.session_id) filter (where pa.mode in ('practice','test'))::integer as independent_sessions,
      (array_agg(pa.was_correct order by pa.created_at desc, pa.id desc)
        filter (where pa.mode in ('practice','test')))[1] as latest_correct,
      max(pa.created_at) as last_activity
    from public.assignment_items ai
    left join public.practice_attempts pa on pa.student_id = p_student_id
      and (pa.item_id = ai.item_id or ai.item_id = any(pa.equivalent_item_ids))
    where ai.assignment_id = p_assignment_id
    group by ai.item_id
  ), scored as (
    select *,
      (independent_correct >= 3 and independent_correct * 4 >= independent_attempts * 3
        and independent_sessions >= 2 and latest_correct is true) as acquired,
      case
        when practiced = 0 then 0
        when independent_attempts = 0 then 10
        else greatest(10, least(90, pg_catalog.round(
          (case when independent_correct = 0 then 10
                when independent_correct = 1 then 40
                when independent_correct = 2 then 60
                else least(90, 75 + (independent_correct - 3) * 3) end)::numeric
          * independent_correct / independent_attempts)))::integer
      end as partial_level
    from evidence
  )
  select pg_catalog.jsonb_build_object(
    'total', count(*)::integer,
    'practiced', count(*) filter (where practiced > 0)::integer,
    'acquired', count(*) filter (where acquired)::integer,
    'mastery_level', coalesce(pg_catalog.round(avg(case when acquired then 100 else partial_level end)), 0)::integer,
    'last_activity', max(last_activity)
  ) from scored;
$$;

create function private.register_assignment_completion(p_assignment_id uuid, p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p jsonb; target integer;
begin
  if exists (select 1 from public.assignment_completions c
    where c.assignment_id=p_assignment_id and c.student_id=p_student_id) then return; end if;
  select a.target_acquired_percentage into target from public.assignments a
  join public.assignment_classes ac on ac.assignment_id = a.id
  join public.students s on s.class_id = ac.class_id
  where a.id = p_assignment_id and s.id = p_student_id and a.published_at is not null
    and a.status in ('published','archived');
  if target is null then return; end if;
  p := private.assignment_progress_for_student(p_assignment_id, p_student_id);
  if (p->>'total')::integer > 0 and (p->>'practiced')::integer = (p->>'total')::integer
     and (p->>'acquired')::integer * 100 >= target * (p->>'total')::integer then
    insert into public.assignment_completions
      (assignment_id, student_id, acquired_count_at_completion, total_count_at_completion, acquired_percentage_at_completion)
    values (p_assignment_id, p_student_id, (p->>'acquired')::integer,
      (p->>'total')::integer, pg_catalog.round((p->>'acquired')::numeric * 100 / (p->>'total')::integer)::integer)
    on conflict (assignment_id, student_id) do nothing;
  end if;
end;
$$;

create function private.assignment_attempt_inserted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare assignment_row record;
begin
  for assignment_row in
    select distinct ai.assignment_id from public.assignment_items ai
    join public.assignment_classes ac on ac.assignment_id = ai.assignment_id
    join public.students s on s.class_id = ac.class_id
    join public.assignments a on a.id = ai.assignment_id
    where s.id = new.student_id and not exists (
      select 1 from public.assignment_completions c
      where c.assignment_id = ai.assignment_id and c.student_id = new.student_id)
      and (a.status = 'published' or
      (a.status = 'archived' and exists (select 1 from public.practice_sessions ps
        where ps.id = new.session_id and ps.assignment_id = a.id)))
      and (ai.item_id = new.item_id or ai.item_id = any(new.equivalent_item_ids))
  loop
    perform private.register_assignment_completion(assignment_row.assignment_id, new.student_id);
  end loop;
  return new;
end;
$$;
create trigger assignment_attempt_inserted after insert on public.practice_attempts
for each row execute function private.assignment_attempt_inserted();

create function private.save_assignment_impl(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_existing public.assignments%rowtype; v_status text; v_title text;
  v_classes uuid[]; v_items text[]; v_class uuid; v_item text; v_changed boolean;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid assignment'; end if;
  v_id := nullif(p_payload->>'id','')::uuid;
  v_title := btrim(coalesce(p_payload->>'title',''));
  v_status := coalesce(p_payload->>'status','draft');
  if char_length(v_title) not between 1 and 160 or v_status not in ('draft','published','archived')
     or coalesce((p_payload->>'target_acquired_percentage')::integer,80) not between 1 and 100
     or char_length(coalesce(p_payload->>'instructions','')) > 1000 then raise exception 'invalid assignment'; end if;
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_classes
    from pg_catalog.jsonb_array_elements_text(coalesce(p_payload->'class_ids','[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[]) into v_items
    from pg_catalog.jsonb_array_elements_text(coalesce(p_payload->'item_ids','[]'::jsonb));
  if cardinality(v_classes) not between 1 and 100 or cardinality(v_items) not between 1 and 2000
     or cardinality(v_classes) <> (select count(distinct x) from unnest(v_classes) x)
     or cardinality(v_items) <> (select count(distinct x) from unnest(v_items) x)
     or exists (select 1 from unnest(v_items) x left join public.course_item_ids ci on ci.item_id = x where ci.item_id is null)
  then raise exception 'invalid assignment scope'; end if;
  foreach v_class in array v_classes loop
    if not private.teacher_has_class_access(v_class) then raise exception 'class access denied'; end if;
  end loop;
  if v_id is null then
    if v_status = 'archived' then raise exception 'new assignment cannot be archived'; end if;
    insert into public.assignments(created_by_teacher_id,title,instructions,target_acquired_percentage,due_at,status,published_at)
    values (auth.uid(),v_title,nullif(p_payload->>'instructions',''),
      coalesce((p_payload->>'target_acquired_percentage')::integer,80),
      nullif(p_payload->>'due_at','')::timestamptz,v_status,
      case when v_status <> 'draft' then pg_catalog.now() end) returning id into v_id;
  else
    select * into v_existing from public.assignments where id = v_id for update;
    if not found then raise exception 'assignment not found'; end if;
    if not (private.current_teacher_is_admin() or v_existing.created_by_teacher_id = auth.uid()) then
      raise exception 'assignment edit denied'; end if;
    if not private.current_teacher_is_admin() and exists (
      select 1 from public.assignment_classes ac where ac.assignment_id=v_id
        and not private.teacher_has_class_access(ac.class_id)
    ) then raise exception 'class access denied'; end if;
    if v_existing.status = 'draft' and v_status = 'archived' then raise exception 'draft assignment cannot be archived'; end if;
    if v_existing.status = 'archived' and v_status <> 'archived' then raise exception 'archived assignment cannot be reopened'; end if;
    if v_existing.status = 'published' and v_status = 'draft' then raise exception 'published assignment cannot become draft'; end if;
    select exists (
      select 1 from public.assignment_classes ac where ac.assignment_id = v_id and not ac.class_id = any(v_classes)
    ) or exists (select 1 from unnest(v_classes) x where not exists
      (select 1 from public.assignment_classes ac where ac.assignment_id = v_id and ac.class_id = x))
      or exists (select 1 from public.assignment_items ai where ai.assignment_id = v_id and not ai.item_id = any(v_items))
      or exists (select 1 from unnest(v_items) x where not exists
        (select 1 from public.assignment_items ai where ai.assignment_id = v_id and ai.item_id = x))
      into v_changed;
    if v_existing.status <> 'draft' and v_changed and (
      exists (select 1 from public.practice_sessions ps where ps.assignment_id = v_id)
      or exists (select 1 from public.practice_attempts pa
        join public.students s on s.id = pa.student_id
        join public.assignment_classes ac on ac.class_id = s.class_id and ac.assignment_id = v_id
        join public.assignment_items ai on ai.assignment_id = v_id
          and (ai.item_id = pa.item_id or ai.item_id = any(pa.equivalent_item_ids))
        where pa.created_at >= v_existing.published_at)
    ) then raise exception 'assignment scope locked after activity'; end if;
    update public.assignments set title=v_title,instructions=nullif(p_payload->>'instructions',''),
      target_acquired_percentage=coalesce((p_payload->>'target_acquired_percentage')::integer,80),
      due_at=nullif(p_payload->>'due_at','')::timestamptz,status=v_status,
      published_at=case when v_status <> 'draft' then coalesce(published_at,pg_catalog.now()) else null end
    where id=v_id;
    delete from public.assignment_classes where assignment_id=v_id;
    delete from public.assignment_items where assignment_id=v_id;
  end if;
  insert into public.assignment_classes(assignment_id,class_id)
  select v_id,x from unnest(v_classes) x;
  insert into public.assignment_items(assignment_id,item_id,item_order)
  select v_id,x,ord::integer from unnest(v_items) with ordinality as t(x,ord);
  if v_status='published' then
    foreach v_class in array v_classes loop
      perform private.register_assignment_completion(v_id,s.id)
      from public.students s where s.class_id=v_class and s.is_active=true;
    end loop;
  end if;
  return pg_catalog.jsonb_build_object('id',v_id,'status',v_status);
end;
$$;

create function public.save_assignment(p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.save_assignment_impl(p_payload);
$$;

create function private.get_student_assignments_impl(p_identity_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_rows jsonb;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s
  join public.classes c on c.id=s.class_id
  where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',a.id,'title',a.title,'instructions',a.instructions,'due_at',a.due_at,
    'target_acquired_percentage',a.target_acquired_percentage,'status',a.status,
    'published_at',a.published_at,'completed_at',acomp.completed_at,
    'item_ids',(select pg_catalog.jsonb_agg(ai.item_id order by ai.item_order)
      from public.assignment_items ai where ai.assignment_id=a.id)
  ) order by a.due_at nulls last,a.created_at), '[]'::jsonb) into v_rows
  from public.assignments a
  join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=v_class
  left join public.assignment_completions acomp on acomp.assignment_id=a.id and acomp.student_id=v_student
  where a.status='published';
  return v_rows;
end;
$$;
create function public.get_student_assignments(p_identity_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_student_assignments_impl(p_identity_token);
$$;

create function private.get_teacher_assignments_impl() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  select coalesce(pg_catalog.jsonb_agg(row_data order by (row_data->>'created_at') desc),'[]'::jsonb)
    into v_rows from (
    select pg_catalog.jsonb_build_object('id',a.id,'title',a.title,'instructions',a.instructions,
      'target_acquired_percentage',a.target_acquired_percentage,'due_at',a.due_at,
      'status',a.status,'created_at',a.created_at,'published_at',a.published_at,
      'created_by_teacher_id',a.created_by_teacher_id,
      'class_ids',(select pg_catalog.jsonb_agg(ac.class_id) from public.assignment_classes ac
        where ac.assignment_id=a.id and private.teacher_has_class_access(ac.class_id)),
      'classes',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',c.id,'name',c.name))
        from public.assignment_classes ac join public.classes c on c.id=ac.class_id
        where ac.assignment_id=a.id and private.teacher_has_class_access(c.id)),
      'item_ids',(select pg_catalog.jsonb_agg(ai.item_id order by ai.item_order) from public.assignment_items ai
        where ai.assignment_id=a.id),
      'completed_count',(select count(*) from public.assignment_completions comp
        join public.students s on s.id=comp.student_id
        where comp.assignment_id=a.id and s.is_active=true and private.teacher_has_class_access(s.class_id)),
      'student_count',(select count(*) from public.students s
        join public.assignment_classes ac on ac.class_id=s.class_id
        where ac.assignment_id=a.id and s.is_active=true and private.teacher_has_class_access(s.class_id))
    ) as row_data from public.assignments a
    where private.current_teacher_is_admin() or exists (
      select 1 from public.assignment_classes ac where ac.assignment_id=a.id
      and private.teacher_has_class_access(ac.class_id))
  ) result;
  return v_rows;
end;
$$;
create function public.get_teacher_assignments() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignments_impl();
$$;

create function private.get_teacher_assignment_detail_impl(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() or not exists (
    select 1 from public.assignment_classes ac where ac.assignment_id=p_assignment_id
      and private.teacher_has_class_access(ac.class_id)) then raise exception 'assignment access denied'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'student_id',s.id,'student_name',s.display_name,'class_id',c.id,'class_name',c.name,
    'progress',private.assignment_progress_for_student(p_assignment_id,s.id),
    'completed_at',comp.completed_at,
    'active_task_time',(select coalesce(sum(ps.active_duration_seconds),0)::integer
      from public.practice_sessions ps where ps.assignment_id=p_assignment_id and ps.student_id=s.id)
  ) order by c.name,s.display_name),'[]'::jsonb) into v_rows
  from public.students s
  join public.classes c on c.id=s.class_id
  join public.assignment_classes ac on ac.class_id=c.id and ac.assignment_id=p_assignment_id
  left join public.assignment_completions comp on comp.assignment_id=p_assignment_id and comp.student_id=s.id
  where s.is_active=true and private.teacher_has_class_access(c.id);
  return v_rows;
end;
$$;
create function public.get_teacher_assignment_detail(p_assignment_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_detail_impl(p_assignment_id);
$$;

-- Vervang uitsluitend de private ingest-implementatie. Publieke RPC-signatuur blijft identiek.
create or replace function private.ingest_practice_bundle_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_session uuid; v_client uuid; v_assignment uuid;
  v_attempt jsonb; v_seconds integer; v_count integer;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s join public.classes c on c.id=s.class_id
    where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  if pg_catalog.jsonb_typeof(p_session) is distinct from 'object' or pg_catalog.jsonb_typeof(p_attempts) is distinct from 'array' then raise exception 'invalid bundle'; end if;
  v_count := pg_catalog.jsonb_array_length(p_attempts);
  if v_count > 5000 or (p_session->>'question_count')::integer not between 1 and 2000
    or coalesce(p_session->>'mode','') not in ('learn','practice','test') then raise exception 'invalid session'; end if;
  if p_session ? 'active_duration_seconds' then
    v_seconds := nullif(p_session->>'active_duration_seconds','')::integer;
    if v_seconds is null or v_seconds not between 0 and 604800 then raise exception 'invalid active duration'; end if;
  end if;
  v_client := (p_session->>'client_session_id')::uuid;
  v_assignment := nullif(p_session->>'assignment_id','')::uuid;
  if v_assignment is not null and not exists (
    select 1 from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
    where a.id=v_assignment and a.status in ('published','archived') and a.published_at is not null
      and ac.class_id=v_class
  ) then raise exception 'invalid assignment'; end if;
  insert into public.practice_sessions as existing_session (
    student_id,client_session_id,course_key,trajectory,top_category,lesson,block,subsection,
    exercise_key,mode,question_count,active_duration_seconds,started_at,finished_at,assignment_id
  ) values (v_student,v_client,left(coalesce(p_session->>'course_key','UF1'),40),
    left(p_session->>'trajectory',80),left(p_session->>'top_category',120),left(p_session->>'lesson',160),
    nullif(left(coalesce(p_session->>'block',''),160),''),nullif(left(coalesce(p_session->>'subsection',''),160),''),
    left(p_session->>'exercise_key',40),p_session->>'mode',(p_session->>'question_count')::integer,v_seconds,
    (p_session->>'started_at')::timestamptz,nullif(p_session->>'finished_at','')::timestamptz,v_assignment)
  on conflict (student_id,client_session_id) do update set
    question_count=excluded.question_count,
    active_duration_seconds=case when excluded.active_duration_seconds is null then existing_session.active_duration_seconds
      when existing_session.active_duration_seconds is null then excluded.active_duration_seconds
      else greatest(existing_session.active_duration_seconds,excluded.active_duration_seconds) end,
    finished_at=coalesce(excluded.finished_at,existing_session.finished_at),updated_at=pg_catalog.now()
  where existing_session.assignment_id is not distinct from excluded.assignment_id
  returning id into v_session;
  if v_session is null then raise exception 'session assignment cannot change'; end if;
  for v_attempt in select value from pg_catalog.jsonb_array_elements(p_attempts) loop
    if pg_catalog.jsonb_typeof(v_attempt) is distinct from 'object'
      or coalesce(v_attempt->>'item_id','')=''
      or coalesce(v_attempt->>'item_type','') not in ('vocabulary','verb','phrase','grammar_rule','number','sound_rule')
      or pg_catalog.jsonb_typeof(coalesce(v_attempt->'equivalent_item_ids','[]'::jsonb)) is distinct from 'array'
      or pg_catalog.jsonb_array_length(coalesce(v_attempt->'equivalent_item_ids','[]'::jsonb)) > 20
      or pg_catalog.jsonb_typeof(coalesce(v_attempt->'correct_answers','[]'::jsonb)) is distinct from 'array'
      or pg_catalog.jsonb_array_length(coalesce(v_attempt->'correct_answers','[]'::jsonb)) > 20
      or (v_attempt->>'attempt_number')::integer not between 1 and 1000 then raise exception 'invalid attempt'; end if;
    if v_assignment is not null and (
      not exists (select 1 from public.assignment_items ai where ai.assignment_id=v_assignment and ai.item_id=v_attempt->>'item_id')
      or exists (select 1 from pg_catalog.jsonb_array_elements_text(coalesce(v_attempt->'equivalent_item_ids','[]'::jsonb)) x
        where not exists (select 1 from public.assignment_items ai where ai.assignment_id=v_assignment and ai.item_id=x.value))
    ) then raise exception 'item outside assignment'; end if;
    insert into public.practice_attempts(session_id,student_id,client_attempt_id,item_id,equivalent_item_ids,legacy_item_id,item_variant,
      item_type,trajectory,top_category,lesson,block,subsection,exercise_key,mode,prompt,correct_answers,was_correct,attempt_number,created_at)
    values (v_session,v_student,(v_attempt->>'client_attempt_id')::uuid,left(v_attempt->>'item_id',80),
      coalesce(array(select pg_catalog.jsonb_array_elements_text(coalesce(v_attempt->'equivalent_item_ids','[]'::jsonb))),'{}'),
      nullif(left(coalesce(v_attempt->>'legacy_item_id',''),120),''),nullif(left(coalesce(v_attempt->>'item_variant',''),120),''),
      v_attempt->>'item_type',left(v_attempt->>'trajectory',80),left(v_attempt->>'top_category',120),left(v_attempt->>'lesson',160),
      nullif(left(coalesce(v_attempt->>'block',''),160),''),nullif(left(coalesce(v_attempt->>'subsection',''),160),''),
      left(v_attempt->>'exercise_key',40),v_attempt->>'mode',left(v_attempt->>'prompt',500),
      coalesce(v_attempt->'correct_answers','[]'::jsonb),(v_attempt->>'was_correct')::boolean,
      (v_attempt->>'attempt_number')::integer,(v_attempt->>'created_at')::timestamptz)
    on conflict (student_id,client_attempt_id) do nothing;
  end loop;
  update public.practice_sessions ps set attempt_count=t.attempt_count,correct_count=t.correct_count,
    incorrect_count=t.incorrect_count,updated_at=pg_catalog.now()
  from (select count(*)::integer attempt_count,count(*) filter(where was_correct)::integer correct_count,
    count(*) filter(where not was_correct)::integer incorrect_count from public.practice_attempts where session_id=v_session) t
  where ps.id=v_session;
  return pg_catalog.jsonb_build_object('accepted',true,'client_session_id',v_client,
    'attempt_count',(select attempt_count from public.practice_sessions where id=v_session),
    'active_duration_seconds',(select active_duration_seconds from public.practice_sessions where id=v_session));
end;
$$;

revoke all on function private.assignment_progress_for_student(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.register_assignment_completion(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.assignment_attempt_inserted() from public,anon,authenticated,service_role;
revoke all on function private.save_assignment_impl(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.get_student_assignments_impl(text) from public,anon,authenticated,service_role;
revoke all on function private.get_teacher_assignments_impl() from public,anon,authenticated,service_role;
revoke all on function private.get_teacher_assignment_detail_impl(uuid) from public,anon,authenticated,service_role;
revoke all on function public.save_assignment(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_student_assignments(text) from public,anon,authenticated,service_role;
revoke all on function public.get_teacher_assignments() from public,anon,authenticated,service_role;
revoke all on function public.get_teacher_assignment_detail(uuid) from public,anon,authenticated,service_role;
revoke all on function private.ingest_practice_bundle_impl(text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.save_assignment_impl(jsonb), private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_impl(uuid) to authenticated;
grant execute on function public.save_assignment(jsonb), public.get_teacher_assignments(),
  public.get_teacher_assignment_detail(uuid) to authenticated;
grant execute on function private.get_student_assignments_impl(text) to anon,authenticated;
grant execute on function public.get_student_assignments(text) to anon,authenticated;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb) to anon,authenticated;

commit;
