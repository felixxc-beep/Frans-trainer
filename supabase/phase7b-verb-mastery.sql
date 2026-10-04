-- Fase 7b. Eenmalig HANDMATIG uitvoeren na phase7-assignments.sql.
-- Geen course-item-ID's worden aangemaakt of gewijzigd. Deze tabel classificeert bestaande IDs.
begin;

alter table public.assignments add column mastery_strategy text not null default 'item_mastery'
  check (mastery_strategy in ('item_mastery','verb_rule_mastery','irregular_verb_mastery','mixed_verb_mastery'));

create table public.verb_goal_items (
  item_id text primary key references public.course_item_ids(item_id) on delete restrict,
  goal_kind text not null check (goal_kind in ('regular','irregular')),
  reference_id text not null,
  check ((goal_kind='irregular' and reference_id=item_id) or
    (goal_kind='regular' and reference_id in ('present_er','present_ir_finir','present_re')))
);
insert into public.verb_goal_items(item_id,goal_kind,reference_id)
select 'uf1-item-'||pg_catalog.lpad(n::text,6,'0'),'regular','present_er'
from pg_catalog.generate_series(102,123) n
union all select 'uf1-item-'||pg_catalog.lpad(n::text,6,'0'),'regular','present_ir_finir'
from pg_catalog.generate_series(246,254) n
union all select 'uf1-item-'||pg_catalog.lpad(n::text,6,'0'),'regular','present_re'
from pg_catalog.generate_series(415,422) n
union all select 'uf1-item-'||pg_catalog.lpad(n::text,6,'0'),'irregular',
  'uf1-item-'||pg_catalog.lpad(n::text,6,'0')
from unnest(array[124,125,240,241,242,243,244,245,410,411,412,413,414,697,698,699]) n;
create index verb_goal_items_reference_idx on public.verb_goal_items(reference_id,item_id);

create table public.assignment_requirements (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  requirement_type text not null check (requirement_type in ('verb_rule_mastery','irregular_verb_mastery')),
  reference_id text not null,
  target_percentage integer not null check (target_percentage between 1 and 100),
  ordering integer not null check (ordering between 1 and 100),
  primary key (assignment_id,requirement_type,reference_id),
  unique (assignment_id,ordering)
);
create index assignment_requirements_reference_idx on public.assignment_requirements(requirement_type,reference_id);

alter table public.verb_goal_items enable row level security;
alter table public.verb_goal_items force row level security;
alter table public.assignment_requirements enable row level security;
alter table public.assignment_requirements force row level security;
revoke all on public.verb_goal_items,public.assignment_requirements from public,anon,authenticated;

create function private.canonical_verb_person(p_variant text) returns text
language sql immutable set search_path = '' as $$
  select case pg_catalog.lower(pg_catalog.btrim(pg_catalog.replace(
      case when p_variant like 'rule:%' then pg_catalog.split_part(p_variant,':',3) else coalesce(p_variant,'') end,
      '’','''')))
    when 'je' then 'je' when 'j''' then 'je' when 'tu' then 'tu'
    when 'il' then 'il' when 'elle' then 'il' when 'on' then 'il' when 'il/elle/on' then 'il'
    when 'nous' then 'nous' when 'vous' then 'vous'
    when 'ils' then 'ils' when 'elles' then 'ils' when 'ils/elles' then 'ils'
    else null end;
$$;

-- Zelfde drempels/formule als verb-mastery.js. Alle aggregatie gebeurt op regel- of
-- werkwoorddoel, nooit op de negen concrete vraagvarianten als losse leerdoelen.
create function private.verb_goal_progress(p_student uuid,p_kind text,p_reference text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_total integer:=0; v_correct integer:=0; v_correct_conj integer:=0; v_conj_total integer:=0;
  v_persons integer:=0; v_verbs integer:=0; v_sessions integer:=0; v_evidence_sessions integer:=0;
  v_latest boolean; v_last timestamptz; v_accuracy numeric:=0; v_conj_accuracy numeric:=0; v_level integer:=0;
  v_acquired boolean:=false; v_score numeric:=0;
begin
  if p_kind not in ('regular','irregular') or not exists (
    select 1 from public.verb_goal_items gi where gi.goal_kind=p_kind and gi.reference_id=p_reference
  ) then raise exception 'invalid verb goal'; end if;
  with evidence as (
    select pa.id,pa.item_id,pa.session_id,pa.was_correct,pa.created_at,
      private.canonical_verb_person(pa.item_variant) as person,
      pa.exercise_key in ('verb-fr-conj','verb-nl-conj','assignment-mixed')
        and pa.item_variant not like 'rule:%' as conjugation
    from public.practice_attempts pa
    join public.verb_goal_items gi on gi.item_id=pa.item_id
    where pa.student_id=p_student and pa.item_type='verb' and pa.mode in ('practice','test')
      and gi.goal_kind=p_kind and gi.reference_id=p_reference
      and (pa.exercise_key in ('verb-fr-conj','verb-nl-conj','assignment-mixed')
        or (p_kind='regular' and p_reference='present_er'
          and pa.exercise_key='verb-rule-recognition' and pa.item_variant like 'rule:present_er:%'))
  )
  select count(*)::integer,count(*) filter(where was_correct)::integer,
    count(*) filter(where conjugation and was_correct)::integer,
    count(*) filter(where conjugation)::integer,
    count(distinct person) filter(where conjugation and was_correct and person is not null)::integer,
    count(distinct item_id) filter(where conjugation and was_correct)::integer,
    count(distinct session_id) filter(where conjugation)::integer,
    count(distinct session_id)::integer,
    (array_agg(was_correct order by created_at desc,id desc) filter(where conjugation))[1],max(created_at)
  into v_total,v_correct,v_correct_conj,v_conj_total,v_persons,v_verbs,v_sessions,v_evidence_sessions,v_latest,v_last
  from evidence;
  v_accuracy:=case when v_total=0 then 0 else v_correct::numeric/v_total end;
  v_conj_accuracy:=case when v_conj_total=0 then 0 else v_correct_conj::numeric/v_conj_total end;
  v_acquired:=v_persons=6 and (p_kind='irregular' or v_verbs>=3)
    and v_correct_conj>=8 and v_conj_accuracy>=0.75 and v_sessions>=2 and v_latest is true;
  if p_kind='regular' then
    v_score:=0.3*pg_catalog.least(1,v_correct::numeric/pg_catalog.greatest(8,v_total))+
      0.4*v_persons::numeric/6+0.2*pg_catalog.least(1,v_verbs::numeric/3)+
      0.1*pg_catalog.least(1,v_evidence_sessions::numeric/2);
  else
    v_score:=0.4*pg_catalog.least(1,v_correct::numeric/pg_catalog.greatest(8,v_total))+
      0.5*v_persons::numeric/6+0.1*pg_catalog.least(1,v_evidence_sessions::numeric/2);
  end if;
  v_level:=case when v_acquired then 100 else pg_catalog.least(99,pg_catalog.round(v_score*100)::integer) end;
  return pg_catalog.jsonb_build_object('goal_id',p_reference,'kind',p_kind,
    'status',case when v_total=0 then 'new' when v_acquired then 'acquired' else 'learning' end,
    'level',v_level,'attempts',v_total,'correct',v_correct,'conjugation_correct',v_correct_conj,
    'conjugation_attempts',v_conj_total,'accuracy',pg_catalog.round(v_accuracy*100)::integer,
    'conjugation_accuracy',pg_catalog.round(v_conj_accuracy*100)::integer,'persons',v_persons,'verbs',v_verbs,
    'sessions',v_sessions,'evidence_sessions',v_evidence_sessions,
    'latest_correct',v_latest,'last_activity',v_last);
end;
$$;

-- Oude itemtaakberekening intact houden; nieuwe strategieën gebruiken de wrapper.
alter function private.assignment_progress_for_student(uuid,uuid) rename to item_assignment_progress_for_student;
create function private.assignment_progress_for_student(p_assignment_id uuid,p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_strategy text; v_target integer; req record; g jsonb; v_goals jsonb:='[]'::jsonb;
  v_total integer:=0; v_practiced integer:=0; v_acquired integer:=0; v_level integer:=0;
  v_reached boolean:=true; v_last timestamptz;
begin
  select a.mastery_strategy,a.target_acquired_percentage into v_strategy,v_target
  from public.assignments a where a.id=p_assignment_id;
  if v_strategy is null then raise exception 'assignment not found'; end if;
  if v_strategy='item_mastery' then return private.item_assignment_progress_for_student(p_assignment_id,p_student_id); end if;
  for req in select ar.requirement_type,ar.reference_id,ar.target_percentage
    from public.assignment_requirements ar where ar.assignment_id=p_assignment_id order by ar.ordering loop
    g:=private.verb_goal_progress(p_student_id,
      case when req.requirement_type='verb_rule_mastery' then 'regular' else 'irregular' end,req.reference_id);
    v_total:=v_total+1;
    v_level:=v_level+(g->>'level')::integer;
    if (g->>'attempts')::integer>0 then v_practiced:=v_practiced+1; end if;
    if g->>'status'='acquired' then v_acquired:=v_acquired+1; end if;
    if req.requirement_type='verb_rule_mastery' and not (
      (g->>'level')::integer>=req.target_percentage and (g->>'persons')::integer=6
      and (g->>'verbs')::integer>=3 and (g->>'sessions')::integer>=2)
      then v_reached:=false;
    elsif req.requirement_type='irregular_verb_mastery' and g->>'status'<>'acquired' then v_reached:=false; end if;
    if (g->>'last_activity') is not null then
      v_last:=pg_catalog.greatest(v_last,(g->>'last_activity')::timestamptz); end if;
    v_goals:=v_goals||pg_catalog.jsonb_build_array(g||pg_catalog.jsonb_build_object(
      'requirement_type',req.requirement_type,'target',req.target_percentage));
  end loop;
  if v_total=0 then v_reached:=false; end if;
  if v_strategy='irregular_verb_mastery' then
    v_reached:=v_total>0 and v_acquired*100>=v_target*v_total;
  end if;
  return pg_catalog.jsonb_build_object('total',v_total,'practiced',v_practiced,
    'acquired',v_acquired,'mastery_level',case when v_total>0 then pg_catalog.round(v_level::numeric/v_total)::integer else 0 end,
    'last_activity',v_last,'goals',v_goals,'reached',v_reached);
end;
$$;

create or replace function private.register_assignment_completion(p_assignment_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p jsonb; target integer; strategy text; reached boolean;
begin
  if exists (select 1 from public.assignment_completions c
    where c.assignment_id=p_assignment_id and c.student_id=p_student_id) then return; end if;
  select a.target_acquired_percentage,a.mastery_strategy into target,strategy
  from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
  join public.students s on s.class_id=ac.class_id
  where a.id=p_assignment_id and s.id=p_student_id and a.published_at is not null
    and a.status in ('published','archived');
  if target is null then return; end if;
  p:=private.assignment_progress_for_student(p_assignment_id,p_student_id);
  reached:=case when strategy='item_mastery' then
    (p->>'total')::integer>0 and (p->>'practiced')::integer=(p->>'total')::integer
      and (p->>'acquired')::integer*100>=target*(p->>'total')::integer
    else coalesce((p->>'reached')::boolean,false) end;
  if reached then
    insert into public.assignment_completions
      (assignment_id,student_id,acquired_count_at_completion,total_count_at_completion,acquired_percentage_at_completion)
    values (p_assignment_id,p_student_id,(p->>'acquired')::integer,(p->>'total')::integer,
      pg_catalog.round((p->>'acquired')::numeric*100/(p->>'total')::integer)::integer)
    on conflict (assignment_id,student_id) do nothing;
  end if;
end;
$$;

-- De bestaande itemopslag blijft intact. Deze wrapper valideert relationele
-- requirements en bewaart beide delen atomair in dezelfde RPC-transactie.
alter function private.save_assignment_impl(jsonb) rename to save_assignment_items_impl;
create function private.save_assignment_impl(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_existing public.assignments%rowtype; v_strategy text;
  v_req jsonb; v_result jsonb; v_items text[]; v_expected text[]; v_actual text[];
  v_changed boolean; v_class uuid; r record;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is not null then select * into v_existing from public.assignments where id=v_id; end if;
  v_strategy:=coalesce(nullif(p_payload->>'mastery_strategy',''),v_existing.mastery_strategy,'item_mastery');
  if v_strategy not in ('item_mastery','verb_rule_mastery','irregular_verb_mastery','mixed_verb_mastery')
    then raise exception 'invalid mastery strategy'; end if;
  v_req:=p_payload->'requirements';
  if v_req is null and v_id is not null then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requirement_type',ar.requirement_type,'reference_id',ar.reference_id,
      'target_percentage',ar.target_percentage,'ordering',ar.ordering) order by ar.ordering),'[]'::jsonb)
    into v_req from public.assignment_requirements ar where ar.assignment_id=v_id;
  end if;
  v_req:=coalesce(v_req,'[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_req)<>'array' or pg_catalog.jsonb_array_length(v_req)>100
    then raise exception 'invalid assignment requirements'; end if;
  select coalesce(pg_catalog.array_agg(value),'{}'::text[]) into v_items
    from pg_catalog.jsonb_array_elements_text(coalesce(p_payload->'item_ids','[]'::jsonb));
  if v_strategy='item_mastery' then
    if pg_catalog.jsonb_array_length(v_req)<>0 then raise exception 'item strategy cannot have verb requirements'; end if;
  else
    if pg_catalog.cardinality(v_items)=0 then raise exception 'verb task needs items'; end if;
    if exists (select 1 from pg_catalog.unnest(v_items) i
      left join public.verb_goal_items gi on gi.item_id=i where gi.item_id is null)
      then raise exception 'verb task contains non-verb item'; end if;
    if (v_strategy='verb_rule_mastery' and exists (select 1 from pg_catalog.unnest(v_items) i
      join public.verb_goal_items gi on gi.item_id=i where gi.goal_kind<>'regular'))
      or (v_strategy='irregular_verb_mastery' and exists (select 1 from pg_catalog.unnest(v_items) i
      join public.verb_goal_items gi on gi.item_id=i where gi.goal_kind<>'irregular'))
      then raise exception 'verb strategy does not match items'; end if;
    select pg_catalog.array_agg(distinct gi.goal_kind||':'||gi.reference_id order by gi.goal_kind||':'||gi.reference_id)
      into v_expected from pg_catalog.unnest(v_items) i
      join public.verb_goal_items gi on gi.item_id=i;
    select pg_catalog.array_agg(distinct
      case when x.value->>'requirement_type'='verb_rule_mastery' then 'regular:'
        when x.value->>'requirement_type'='irregular_verb_mastery' then 'irregular:' else 'invalid:' end
      ||coalesce(x.value->>'reference_id','') order by
      case when x.value->>'requirement_type'='verb_rule_mastery' then 'regular:'
        when x.value->>'requirement_type'='irregular_verb_mastery' then 'irregular:' else 'invalid:' end
      ||coalesce(x.value->>'reference_id','')) into v_actual
      from pg_catalog.jsonb_array_elements(v_req) x;
    if v_expected is distinct from v_actual or pg_catalog.cardinality(v_actual)<>pg_catalog.jsonb_array_length(v_req)
      then raise exception 'requirements do not match verb items'; end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_req) x
      where (x.value->>'target_percentage')::integer not between 1 and 100)
      then raise exception 'invalid requirement target'; end if;
    if exists (select 1 from public.verb_goal_items gi where gi.item_id=any(v_items)
      and gi.goal_kind='regular' group by gi.reference_id having count(*)<3)
      then raise exception 'regular rule needs at least three verbs'; end if;
  end if;
  if v_id is not null and v_existing.status='published' and (
    v_existing.mastery_strategy<>v_strategy or
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requirement_type',ar.requirement_type,'reference_id',ar.reference_id,
      'target_percentage',ar.target_percentage,'ordering',ar.ordering) order by ar.ordering)
      from public.assignment_requirements ar where ar.assignment_id=v_id),'[]'::jsonb)<>v_req)
    and (exists (select 1 from public.practice_sessions ps where ps.assignment_id=v_id)
      or exists (select 1 from public.practice_attempts pa
        join public.students s on s.id=pa.student_id
        join public.assignment_classes ac on ac.class_id=s.class_id and ac.assignment_id=v_id
        join public.assignment_items ai on ai.assignment_id=v_id
          and (ai.item_id=pa.item_id or ai.item_id=any(pa.equivalent_item_ids))
        where pa.created_at>=v_existing.published_at))
    then raise exception 'assignment scope locked after activity'; end if;
  v_result:=private.save_assignment_items_impl(p_payload);
  v_id:=(v_result->>'id')::uuid;
  update public.assignments set mastery_strategy=v_strategy where id=v_id;
  delete from public.assignment_requirements where assignment_id=v_id;
  insert into public.assignment_requirements(assignment_id,requirement_type,reference_id,target_percentage,ordering)
  select v_id,x.value->>'requirement_type',x.value->>'reference_id',
    (x.value->>'target_percentage')::integer,x.ord::integer
  from pg_catalog.jsonb_array_elements(v_req) with ordinality as x(value,ord);
  if v_strategy<>'item_mastery' and (v_existing.id is null or v_existing.status='draft') then
    -- De oude itemfunctie kan historische oefenpogingen al als voltooiing hebben
    -- aangemerkt voordat de nieuwe requirements werden gezet. Corrigeer atomair.
    delete from public.assignment_completions where assignment_id=v_id;
  end if;
  for v_class in select ac.class_id from public.assignment_classes ac where ac.assignment_id=v_id loop
    perform private.register_assignment_completion(v_id,s.id)
    from public.students s where s.class_id=v_class and s.is_active=true;
  end loop;
  return v_result;
end;
$$;

create or replace function public.save_assignment(p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.save_assignment_impl(p_payload);
$$;

create function private.get_student_verb_evidence_impl(p_identity_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid; v_rows jsonb;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'invalid identity'; end if;
  select s.id into v_student from public.students s join public.classes c on c.id=s.class_id
  where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'client_attempt_id',pa.client_attempt_id,'client_session_id',ps.client_session_id,
    'item_id',pa.item_id,'item_variant',pa.item_variant,'exercise_key',pa.exercise_key,
    'mode',pa.mode,'was_correct',pa.was_correct,'created_at',pa.created_at)
    order by pa.created_at,pa.id),'[]'::jsonb) into v_rows
  from public.practice_attempts pa
  join public.practice_sessions ps on ps.id=pa.session_id
  join public.verb_goal_items gi on gi.item_id=pa.item_id
  where pa.student_id=v_student and pa.item_type='verb' and pa.mode in ('practice','test')
    and (pa.exercise_key in ('verb-fr-conj','verb-nl-conj','assignment-mixed','verb-rule-recognition')
      or (pa.exercise_key is null and private.canonical_verb_person(pa.item_variant) is not null));
  return v_rows;
end;
$$;
create function public.get_student_verb_evidence(p_identity_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_student_verb_evidence_impl(p_identity_token);
$$;

create or replace function private.get_student_assignments_impl(p_identity_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_rows jsonb;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s
  join public.classes c on c.id=s.class_id
  where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',a.id,'title',a.title,'instructions',a.instructions,'due_at',a.due_at,
    'target_acquired_percentage',a.target_acquired_percentage,'mastery_strategy',a.mastery_strategy,
    'status',a.status,'published_at',a.published_at,'completed_at',acomp.completed_at,
    'item_ids',(select pg_catalog.jsonb_agg(ai.item_id order by ai.item_order)
      from public.assignment_items ai where ai.assignment_id=a.id),
    'requirements',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requirement_type',ar.requirement_type,'reference_id',ar.reference_id,
      'target_percentage',ar.target_percentage,'ordering',ar.ordering) order by ar.ordering),'[]'::jsonb)
      from public.assignment_requirements ar where ar.assignment_id=a.id))
    order by a.due_at nulls last,a.created_at),'[]'::jsonb) into v_rows
  from public.assignments a
  join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=v_class
  left join public.assignment_completions acomp on acomp.assignment_id=a.id and acomp.student_id=v_student
  where a.status='published';
  return v_rows;
end;
$$;

-- Lexicale verbkennis blijft item-mastery; vervoeging voedt uitsluitend doelmastery.
create or replace function private.get_student_mastery_impl(
  p_identity_token text,p_pending_attempt_ids uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_items jsonb; v_accepted jsonb;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.cardinality(coalesce(p_pending_attempt_ids,'{}'::uuid[]))>5000
    then raise exception 'invalid identity'; end if;
  select s.id into v_student from public.students s join public.classes c on c.id=s.class_id
  where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  with expanded as (
    select pa.id,pa.session_id,ps.client_session_id,x.item_id,
      coalesce(pa.item_variant,'') item_variant,pa.mode,pa.was_correct,pa.created_at
    from public.practice_attempts pa
    join public.practice_sessions ps on ps.id=pa.session_id
    left join public.verb_goal_items gi on gi.item_id=pa.item_id
    cross join lateral (
      select distinct candidate item_id from pg_catalog.unnest(
        pg_catalog.array_prepend(pa.item_id,coalesce(pa.equivalent_item_ids,'{}'::text[]))) candidate
      where candidate is not null and candidate<>'') x
    where pa.student_id=v_student and
      (gi.item_id is null or pa.exercise_key in ('verb-nl-inf','verb-fr-nl')
        or (pa.exercise_key='assignment-mixed' and coalesce(pa.item_variant,'')=''))
  ), grouped as (
    select item_id,item_variant,count(*)::integer practiced_attempts,
      count(*) filter(where mode in ('practice','test'))::integer independent_attempts,
      count(*) filter(where mode in ('practice','test') and was_correct)::integer independent_correct,
      count(distinct session_id) filter(where mode in ('practice','test'))::integer independent_session_count,
      coalesce(pg_catalog.array_agg(distinct client_session_id::text)
        filter(where mode in ('practice','test')),'{}'::text[]) independent_session_ids,
      max(created_at) filter(where mode in ('practice','test')) latest_independent_at,
      (pg_catalog.array_agg(was_correct order by created_at desc,id desc)
        filter(where mode in ('practice','test')))[1] latest_independent_correct
    from expanded group by item_id,item_variant
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'item_id',item_id,'item_variant',item_variant,'practiced_attempts',practiced_attempts,
    'independent_attempts',independent_attempts,'independent_correct',independent_correct,
    'independent_session_count',independent_session_count,'independent_session_ids',independent_session_ids,
    'latest_independent_at',latest_independent_at,'latest_independent_correct',latest_independent_correct)
    order by item_id,item_variant),'[]'::jsonb) into v_items from grouped;
  select coalesce(pg_catalog.jsonb_agg(pa.client_attempt_id),'[]'::jsonb) into v_accepted
  from public.practice_attempts pa where pa.student_id=v_student
    and pa.client_attempt_id=any(coalesce(p_pending_attempt_ids,'{}'::uuid[]));
  return pg_catalog.jsonb_build_object('items',v_items,'accepted_pending_attempt_ids',v_accepted);
end;
$$;

alter function private.get_teacher_assignments_impl() rename to get_teacher_assignments_items_impl;
create function private.get_teacher_assignments_impl() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_rows jsonb;
begin
  v_base:=private.get_teacher_assignments_items_impl();
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'mastery_strategy',a.mastery_strategy,
    'requirements',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requirement_type',ar.requirement_type,'reference_id',ar.reference_id,
      'target_percentage',ar.target_percentage,'ordering',ar.ordering) order by ar.ordering),'[]'::jsonb)
      from public.assignment_requirements ar where ar.assignment_id=a.id)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_base) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;
create or replace function public.get_teacher_assignments() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignments_impl();
$$;

alter function private.get_teacher_assignment_detail_impl(uuid) rename to get_teacher_assignment_detail_items_impl;
create function private.get_teacher_assignment_detail_impl(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_rows jsonb;
begin
  v_base:=private.get_teacher_assignment_detail_items_impl(p_assignment_id);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'progress',private.assignment_progress_for_student(p_assignment_id,(x.value->>'student_id')::uuid))
    order by x.ord),'[]'::jsonb) into v_rows
  from pg_catalog.jsonb_array_elements(v_base) with ordinality as x(value,ord);
  return v_rows;
end;
$$;
create or replace function public.get_teacher_assignment_detail(p_assignment_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_detail_impl(p_assignment_id);
$$;

revoke all on function private.canonical_verb_person(text),private.verb_goal_progress(uuid,text,text),
  private.item_assignment_progress_for_student(uuid,uuid),private.assignment_progress_for_student(uuid,uuid),
  private.register_assignment_completion(uuid,uuid),private.save_assignment_items_impl(jsonb),
  private.save_assignment_impl(jsonb),private.get_student_verb_evidence_impl(text),
  private.get_student_assignments_impl(text),private.get_student_mastery_impl(text,uuid[]),
  private.get_teacher_assignments_items_impl(),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_items_impl(uuid),private.get_teacher_assignment_detail_impl(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.get_student_verb_evidence(text),public.save_assignment(jsonb),
  public.get_teacher_assignments(),public.get_teacher_assignment_detail(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.save_assignment_impl(jsonb),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_impl(uuid) to authenticated;
grant execute on function private.get_student_verb_evidence_impl(text),
  private.get_student_assignments_impl(text),private.get_student_mastery_impl(text,uuid[]) to anon;
grant execute on function private.get_student_verb_evidence_impl(text),
  private.get_student_assignments_impl(text),private.get_student_mastery_impl(text,uuid[])
  to authenticated;
grant execute on function public.get_student_verb_evidence(text) to anon,authenticated;
grant execute on function public.save_assignment(jsonb),public.get_teacher_assignments(),
  public.get_teacher_assignment_detail(uuid) to authenticated;

commit;
