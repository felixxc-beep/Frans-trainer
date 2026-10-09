-- Handmatig na phase8c-mastery-growth.sql uitvoeren. Geen bestaande taak omzetten.
begin;

alter table public.assignments add column completion_strategy text;
update public.assignments set completion_strategy = case
  when mastery_strategy = 'item_mastery' then 'legacy_mastery' else mastery_strategy end;
alter table public.assignments alter column completion_strategy set not null;
alter table public.assignments alter column completion_strategy set default 'rounds';
alter table public.assignments add constraint assignments_completion_strategy_check
  check (completion_strategy in ('legacy_mastery','rounds','verb_rule_mastery','irregular_verb_mastery','mixed_verb_mastery'));
alter table public.assignments add column required_rounds integer not null default 3
  check (required_rounds between 1 and 4);
alter table public.assignments add column item_verb_exercise_key text not null default 'verb-nl-conj'
  check (item_verb_exercise_key in ('verb-nl-inf','verb-nl-conj','verb-fr-conj'));
alter table public.practice_sessions add column assignment_round_number integer
  check (assignment_round_number between 1 and 4);

create table public.assignment_rounds (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  round_number integer not null check (round_number between 1 and 4),
  selected_item_ids text[] not null,
  started_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  primary key (assignment_id,student_id,round_number)
);
create table public.assignment_round_items (
  assignment_id uuid not null,
  student_id uuid not null,
  round_number integer not null,
  item_id text not null references public.course_item_ids(item_id) on delete restrict,
  selection_reason text not null check (selection_reason in
    ('full_round','previous_round_error','historically_difficult','consulted','random_sample')),
  wrong_count integer not null default 0 check (wrong_count>=0),
  consulted boolean not null default false,
  completed_at timestamptz,
  primary key (assignment_id,student_id,round_number,item_id),
  foreign key (assignment_id,student_id,round_number)
    references public.assignment_rounds(assignment_id,student_id,round_number) on delete cascade
);
create index assignment_round_items_student_idx on public.assignment_round_items(student_id,assignment_id,round_number);
create index practice_sessions_assignment_round_idx on public.practice_sessions(assignment_id,student_id,assignment_round_number);
alter table public.assignment_rounds enable row level security;
alter table public.assignment_rounds force row level security;
alter table public.assignment_round_items enable row level security;
alter table public.assignment_round_items force row level security;
revoke all on public.assignment_rounds,public.assignment_round_items from public,anon,authenticated;

-- De oude trigger blijft bestaan. Alleen de voltooiingsbeslissing is strategy-aware.
create or replace function private.register_assignment_completion(p_assignment_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p jsonb; target integer; strategy text; completion text; required integer; reached boolean;
begin
  if exists (select 1 from public.assignment_completions c
    where c.assignment_id=p_assignment_id and c.student_id=p_student_id) then return; end if;
  select a.target_acquired_percentage,a.mastery_strategy,a.completion_strategy,a.required_rounds
    into target,strategy,completion,required
  from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
  join public.students s on s.class_id=ac.class_id
  where a.id=p_assignment_id and s.id=p_student_id and a.published_at is not null
    and a.status in ('published','archived');
  if target is null then return; end if;
  if completion='rounds' then
    reached:=exists(select 1 from public.assignment_rounds r
      where r.assignment_id=p_assignment_id and r.student_id=p_student_id
        and r.round_number=required and r.completed_at is not null);
  else
    p:=private.assignment_progress_for_student(p_assignment_id,p_student_id);
    reached:=case when strategy='item_mastery' then
      (p->>'total')::integer>0 and (p->>'practiced')::integer=(p->>'total')::integer
        and (p->>'acquired')::integer*100>=target*(p->>'total')::integer
      else coalesce((p->>'reached')::boolean,false) end;
  end if;
  if reached then
    if p is null then p:=private.assignment_progress_for_student(p_assignment_id,p_student_id); end if;
    insert into public.assignment_completions
      (assignment_id,student_id,acquired_count_at_completion,total_count_at_completion,acquired_percentage_at_completion)
    values (p_assignment_id,p_student_id,(p->>'acquired')::integer,(p->>'total')::integer,
      case when (p->>'total')::integer>0 then
        pg_catalog.round((p->>'acquired')::numeric*100/(p->>'total')::integer)::integer else 0 end)
    on conflict (assignment_id,student_id) do nothing;
  end if;
end;
$$;

alter function private.save_assignment_impl(jsonb) rename to save_assignment_pre_rounds_impl;
create function private.save_assignment_impl(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old public.assignments%rowtype; v_strategy text; v_rounds integer;
  v_verb_key text; v_result jsonb;
begin
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is not null then select * into v_old from public.assignments where id=v_id; end if;
  v_strategy:=coalesce(nullif(p_payload->>'completion_strategy',''),
    case when v_id is not null then v_old.completion_strategy
      when coalesce(p_payload->>'mastery_strategy','item_mastery')='item_mastery' then 'rounds'
      else p_payload->>'mastery_strategy' end);
  v_rounds:=coalesce((p_payload->>'required_rounds')::integer,case when v_id is not null then v_old.required_rounds else 3 end);
  v_verb_key:=coalesce(nullif(p_payload->>'item_verb_exercise_key',''),
    case when v_id is not null then v_old.item_verb_exercise_key else 'verb-nl-conj' end);
  if v_strategy not in ('legacy_mastery','rounds','verb_rule_mastery','irregular_verb_mastery','mixed_verb_mastery')
    or v_rounds not between 1 and 4
    or v_verb_key not in ('verb-nl-inf','verb-nl-conj','verb-fr-conj')
    or (v_strategy in ('rounds','legacy_mastery')) is distinct from
      (coalesce(p_payload->>'mastery_strategy',v_old.mastery_strategy,'item_mastery')='item_mastery')
    then raise exception 'invalid completion strategy'; end if;
  if v_id is null and v_strategy='legacy_mastery' then
    raise exception 'new item assignments require rounds'; end if;
  if v_id is not null and (v_old.completion_strategy<>'rounds' and v_old.completion_strategy is distinct from v_strategy
    or v_old.status<>'draft' and (v_old.completion_strategy is distinct from v_strategy
      or v_old.required_rounds is distinct from v_rounds or v_old.item_verb_exercise_key is distinct from v_verb_key)) then
    raise exception 'create a new assignment to change completion strategy or rounds'; end if;
  v_result:=private.save_assignment_pre_rounds_impl(p_payload);
  update public.assignments set completion_strategy=v_strategy,required_rounds=v_rounds,
    item_verb_exercise_key=v_verb_key
    where id=(v_result->>'id')::uuid;
  return v_result;
end;
$$;

-- Een server-set is onveranderlijk. Een ingest mag alleen geldige oefenpogingen
-- in een toegewezen ronde vastleggen; completion wordt uit opgeslagen pogingen afgeleid.
alter function private.ingest_practice_bundle_impl(text,jsonb,jsonb)
  rename to ingest_practice_bundle_pre_rounds_impl;
create function private.ingest_practice_bundle_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_assignment uuid; v_strategy text; v_required integer;
  v_round integer; v_selected text[]; v_assigned text[]; v_existing text[]; v_item text;
  v_client uuid; v_session uuid; v_previous integer; v_result jsonb; v_reason text;
begin
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  if v_assignment is null then
    return private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  end if;
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s join public.classes c on c.id=s.class_id
    where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select a.completion_strategy,a.required_rounds into v_strategy,v_required
    from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
    where a.id=v_assignment and ac.class_id=v_class and a.status in ('published','archived');
  if v_strategy is null then raise exception 'invalid assignment'; end if;
  if v_strategy<>'rounds' then
    if p_session ? 'assignment_round_number' and p_session->>'assignment_round_number' is not null
      then raise exception 'legacy assignment cannot have rounds'; end if;
    return private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  end if;
  v_round:=(p_session->>'assignment_round_number')::integer;
  if v_round is null or v_round not between 1 and v_required or p_session->>'mode'<>'practice'
    or pg_catalog.jsonb_typeof(p_session->'assignment_round_selected_item_ids')<>'array'
    then raise exception 'invalid round session'; end if;
  select coalesce(pg_catalog.array_agg(value),'{}'::text[]) into v_selected
    from pg_catalog.jsonb_array_elements_text(p_session->'assignment_round_selected_item_ids');
  select coalesce(pg_catalog.array_agg(ai.item_id order by ai.item_order),'{}'::text[]) into v_assigned
    from public.assignment_items ai where ai.assignment_id=v_assignment;
  if pg_catalog.cardinality(v_selected)=0 or pg_catalog.cardinality(v_selected)>pg_catalog.cardinality(v_assigned)
    or pg_catalog.cardinality(v_selected)<>(select count(distinct x) from pg_catalog.unnest(v_selected) x)
    or exists(select 1 from pg_catalog.unnest(v_selected) x where x<>all(v_assigned))
    then raise exception 'invalid round selection'; end if;
  if v_round<=2 and (pg_catalog.cardinality(v_selected)<>pg_catalog.cardinality(v_assigned)
    or exists(select 1 from pg_catalog.unnest(v_assigned) x where x<>all(v_selected)))
    then raise exception 'full round required'; end if;
  if v_round>=3 and (
    pg_catalog.cardinality(v_selected)<pg_catalog.ceil(pg_catalog.cardinality(v_assigned)*0.33)::integer
    or exists(select 1 from public.assignment_round_items ri
      where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round-1
        and ri.wrong_count>0 and ri.item_id<>all(v_selected)))
    then raise exception 'review selection incomplete'; end if;
  if v_round>=3 and (
    exists(select 1 from public.assignment_round_items older
      where older.assignment_id=v_assignment and older.student_id=v_student
        and older.round_number<v_round-1 and older.wrong_count>0 and older.item_id<>all(v_selected)
        and exists(select 1 from pg_catalog.unnest(v_selected) chosen
          where not exists(select 1 from public.assignment_round_items difficult
            where difficult.assignment_id=v_assignment and difficult.student_id=v_student
              and difficult.item_id=chosen and difficult.round_number<v_round and difficult.wrong_count>0)))
    or exists(select 1 from public.assignment_round_items consulted
      where consulted.assignment_id=v_assignment and consulted.student_id=v_student
        and consulted.round_number=1 and consulted.consulted and consulted.item_id<>all(v_selected)
        and exists(select 1 from pg_catalog.unnest(v_selected) chosen
          where not exists(select 1 from public.assignment_round_items difficult
            where difficult.assignment_id=v_assignment and difficult.student_id=v_student
              and difficult.item_id=chosen and difficult.round_number<v_round and difficult.wrong_count>0)
            and not exists(select 1 from public.assignment_round_items seen
              where seen.assignment_id=v_assignment and seen.student_id=v_student
                and seen.round_number=1 and seen.item_id=chosen and seen.consulted))))
    then raise exception 'review priorities incomplete'; end if;
  if v_round>1 and not exists(select 1 from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student
      and r.round_number=v_round-1 and r.completed_at is not null)
    then raise exception 'previous round incomplete'; end if;
  select r.selected_item_ids into v_existing from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round for update;
  if v_existing is not null and v_existing<>v_selected then raise exception 'round selection is immutable'; end if;
  if v_existing is null then
    insert into public.assignment_rounds(assignment_id,student_id,round_number,selected_item_ids)
      values(v_assignment,v_student,v_round,v_selected);
    foreach v_item in array v_selected loop
      v_reason:=case when v_round<=2 then 'full_round'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number=v_round-1 and ri.item_id=v_item and ri.wrong_count>0)
          then 'previous_round_error'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number<v_round-1 and ri.item_id=v_item and ri.wrong_count>0)
          then 'historically_difficult'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number=1 and ri.item_id=v_item and ri.consulted)
          then 'consulted' else 'random_sample' end;
      insert into public.assignment_round_items(assignment_id,student_id,round_number,item_id,selection_reason)
        values(v_assignment,v_student,v_round,v_item,v_reason);
    end loop;
  end if;
  if pg_catalog.jsonb_typeof(p_attempts)<>'array' or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_attempts) x
    where x.value->>'item_id'<>all(v_selected)
      or coalesce(x.value->>'mode','')<>'practice'
      or exists(select 1 from pg_catalog.jsonb_array_elements_text(coalesce(x.value->'equivalent_item_ids','[]'::jsonb)) e
        where e.value<>all(v_selected)))
    then raise exception 'attempt outside round'; end if;
  if p_session ? 'assignment_round_consulted_item_ids' and
    (pg_catalog.jsonb_typeof(p_session->'assignment_round_consulted_item_ids')<>'array' or v_round<>1
      and pg_catalog.jsonb_array_length(p_session->'assignment_round_consulted_item_ids')>0
      or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_session->'assignment_round_consulted_item_ids') x
        where x.value<>all(v_selected))) then raise exception 'invalid consultation'; end if;
  v_result:=private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  v_client:=(p_session->>'client_session_id')::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=v_client for update;
  if v_session is null then raise exception 'missing session'; end if;
  update public.practice_sessions ps set assignment_round_number=v_round where ps.id=v_session
    and (ps.assignment_round_number is null or ps.assignment_round_number=v_round);
  if not found then raise exception 'session round cannot change'; end if;
  update public.assignment_round_items ri set consulted=true
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=1
      and ri.item_id in (select value from pg_catalog.jsonb_array_elements_text(
        coalesce(p_session->'assignment_round_consulted_item_ids','[]'::jsonb)));
  update public.assignment_round_items ri set wrong_count=e.wrong_count,completed_at=e.completed_at
    from (select ri2.item_id,count(distinct pa.id) filter(where not pa.was_correct)::integer wrong_count,
      min(pa.created_at) filter(where pa.was_correct and pa.mode='practice') completed_at
      from public.assignment_round_items ri2
      left join public.practice_sessions ps on ps.assignment_id=ri2.assignment_id
        and ps.student_id=ri2.student_id and ps.assignment_round_number=ri2.round_number
      left join public.practice_attempts pa on pa.session_id=ps.id
        and (pa.item_id=ri2.item_id or ri2.item_id=any(pa.equivalent_item_ids))
      where ri2.assignment_id=v_assignment and ri2.student_id=v_student and ri2.round_number=v_round
      group by ri2.item_id) e
    where ri.assignment_id=v_assignment and ri.student_id=v_student
      and ri.round_number=v_round and ri.item_id=e.item_id;
  update public.assignment_rounds r set completed_at=pg_catalog.now()
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and r.completed_at is null and not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
          and ri.completed_at is null);
  perform private.register_assignment_completion(v_assignment,v_student);
  return v_result;
end;
$$;

-- Het bestaande token-gecontroleerde RPC krijgt rondevoortgang erbij.
alter function private.get_student_assignments_impl(text) rename to get_student_assignments_pre_rounds_impl;
create function private.get_student_assignments_impl(p_identity_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_rounds_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'completion_strategy',a.completion_strategy,'required_rounds',a.required_rounds,
    'item_verb_exercise_key',a.item_verb_exercise_key,
    'rounds',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'number',r.round_number,'selected_item_ids',r.selected_item_ids,
      'selection_reasons',(select coalesce(pg_catalog.jsonb_object_agg(ri.item_id,ri.selection_reason),'{}'::jsonb)
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number),
      'random_sample_item_ids',(select coalesce(pg_catalog.array_agg(ri.item_id order by array_position(r.selected_item_ids,ri.item_id)),'{}'::text[])
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.selection_reason='random_sample'),
      'items',(select coalesce(pg_catalog.jsonb_object_agg(ri.item_id,pg_catalog.jsonb_build_object(
        'wrong_count',ri.wrong_count,'consulted',ri.consulted,'completed_at',ri.completed_at)),'{}'::jsonb)
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number)) order by r.round_number),'[]'::jsonb)
      from public.assignment_rounds r where r.assignment_id=a.id and r.student_id=v_student)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

alter function private.get_teacher_assignments_impl() rename to get_teacher_assignments_pre_rounds_impl;
create function private.get_teacher_assignments_impl() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignments_pre_rounds_impl();
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'completion_strategy',a.completion_strategy,'required_rounds',a.required_rounds,
    'item_verb_exercise_key',a.item_verb_exercise_key) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

alter function private.get_teacher_assignment_detail_impl(uuid) rename to get_teacher_assignment_detail_pre_rounds_impl;
create function private.get_teacher_assignment_detail_impl(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignment_detail_pre_rounds_impl(p_assignment_id);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'round_progress',(select pg_catalog.jsonb_build_object('round_number',r.round_number,
      'required_rounds',a.required_rounds,'total',pg_catalog.cardinality(r.selected_item_ids),
      'completed',(select count(*) from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is not null))
      from public.assignment_rounds r join public.assignments a on a.id=r.assignment_id
      where r.assignment_id=p_assignment_id and r.student_id=(x.value->>'student_id')::uuid
      order by r.round_number desc limit 1)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

revoke all on function private.save_assignment_pre_rounds_impl(jsonb),private.save_assignment_impl(jsonb),
  private.ingest_practice_bundle_pre_rounds_impl(text,jsonb,jsonb),private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_pre_rounds_impl(text),private.get_student_assignments_impl(text),
  private.get_teacher_assignments_pre_rounds_impl(),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_pre_rounds_impl(uuid),private.get_teacher_assignment_detail_impl(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.save_assignment_impl(jsonb),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_impl(uuid) to authenticated;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_impl(text) to anon,authenticated;
commit;
