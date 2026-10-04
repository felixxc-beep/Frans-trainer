-- Handmatig uitvoeren na phase8-class-monitor.sql (en phase8b indien toegepast).
-- Herberekent gewone item-mastery uit historische pogingen; geen datawijziging.
-- De strikte Acquis-definitie en fase-7b-werkwoorddoelen blijven ongewijzigd.
begin;

create function private.item_mastery_level(
  p_practiced integer,p_independent integer,p_correct integer,
  p_sessions integer,p_correct_sessions integer,
  p_first_correct boolean,p_latest_correct boolean)
returns integer language sql immutable security invoker set search_path = '' as $$
  with evidence as (
    select case
      when p_correct_sessions>=2 and p_correct>=3 then 90
      when p_correct_sessions>=2 then 80
      when p_first_correct is true and p_correct>=2 then 70
      when p_first_correct is true then 60
      else 40 end as base,
      p_correct::numeric/nullif(p_independent,0) as accuracy,
      case when p_first_correct is true then 1::numeric else 0.5::numeric end as threshold
  ), scored as (
    select greatest(15,base-pg_catalog.round(greatest(0::numeric,threshold-accuracy)*40)::integer) as level
    from evidence
  )
  select case
    when coalesce(p_practiced,0)=0 then 0
    when coalesce(p_independent,0)=0 then 10
    when coalesce(p_correct,0)=0 then 15
    when p_correct>=3 and p_correct::numeric/nullif(p_independent,0)>=0.75
      and p_sessions>=2 and p_latest_correct is true then 100
    when p_latest_correct is false then least(70,(select level from scored))
    else least(90,(select level from scored)) end;
$$;
revoke all on function private.item_mastery_level(integer,integer,integer,integer,integer,boolean,boolean)
  from public,anon,authenticated,service_role;

-- Bij handmatige uitvoering faalt de hele transactie als de SQL-curve afwijkt.
do $curve_check$
begin
  if private.item_mastery_level(0,0,0,0,0,null,null)<>0
    or private.item_mastery_level(1,0,0,0,0,null,null)<>10
    or private.item_mastery_level(1,1,0,1,0,false,false)<>15
    or private.item_mastery_level(1,1,1,1,1,true,true)<>60
    or private.item_mastery_level(2,2,1,1,1,false,true)<>40
    or private.item_mastery_level(2,2,2,1,1,true,true)<>70
    or private.item_mastery_level(2,2,2,2,2,true,true)<>80
    or private.item_mastery_level(3,3,3,2,2,true,true)<>100
    or private.item_mastery_level(4,4,3,2,2,true,false)<>70
    or private.item_mastery_level(5,5,1,1,1,true,false)<>28
    then raise exception 'item-mastery-groeicurve komt niet overeen met de regressiewaarden'; end if;
end;
$curve_check$;

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
      coalesce(pa.item_variant,'') item_variant,pa.mode,pa.was_correct,pa.created_at,pa.attempt_number
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
      count(distinct session_id) filter(where mode in ('practice','test') and was_correct)::integer independent_correct_session_count,
      coalesce(pg_catalog.array_agg(distinct client_session_id::text)
        filter(where mode in ('practice','test')),'{}'::text[]) independent_session_ids,
      coalesce(pg_catalog.array_agg(distinct client_session_id::text)
        filter(where mode in ('practice','test') and was_correct),'{}'::text[]) independent_correct_session_ids,
      min(created_at) filter(where mode in ('practice','test')) first_independent_at,
      (pg_catalog.array_agg(was_correct order by created_at,attempt_number,id)
        filter(where mode in ('practice','test')))[1] first_independent_correct,
      max(created_at) filter(where mode in ('practice','test')) latest_independent_at,
      (pg_catalog.array_agg(was_correct order by created_at desc,attempt_number desc,id desc)
        filter(where mode in ('practice','test')))[1] latest_independent_correct
    from expanded group by item_id,item_variant
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'item_id',item_id,'item_variant',item_variant,'practiced_attempts',practiced_attempts,
    'independent_attempts',independent_attempts,'independent_correct',independent_correct,
    'independent_session_count',independent_session_count,'independent_session_ids',independent_session_ids,
    'independent_correct_session_count',independent_correct_session_count,
    'independent_correct_session_ids',independent_correct_session_ids,
    'first_independent_at',first_independent_at,'first_independent_correct',first_independent_correct,
    'latest_independent_at',latest_independent_at,'latest_independent_correct',latest_independent_correct)
    order by item_id,item_variant),'[]'::jsonb) into v_items from grouped;
  select coalesce(pg_catalog.jsonb_agg(pa.client_attempt_id),'[]'::jsonb) into v_accepted
  from public.practice_attempts pa where pa.student_id=v_student
    and pa.client_attempt_id=any(coalesce(p_pending_attempt_ids,'{}'::uuid[]));
  return pg_catalog.jsonb_build_object('items',v_items,'accepted_pending_attempt_ids',v_accepted);
end;
$$;

create or replace function private.item_assignment_progress_for_student(p_assignment_id uuid,p_student_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with evidence as (
    select ai.item_id,
      count(pa.id)::integer practiced,
      count(pa.id) filter(where pa.mode in ('practice','test'))::integer independent,
      count(pa.id) filter(where pa.mode in ('practice','test') and pa.was_correct)::integer correct,
      count(distinct pa.session_id) filter(where pa.mode in ('practice','test'))::integer sessions,
      count(distinct pa.session_id) filter(where pa.mode in ('practice','test') and pa.was_correct)::integer correct_sessions,
      (pg_catalog.array_agg(pa.was_correct order by pa.created_at,pa.attempt_number,pa.id)
        filter(where pa.mode in ('practice','test')))[1] first_correct,
      (pg_catalog.array_agg(pa.was_correct order by pa.created_at desc,pa.attempt_number desc,pa.id desc)
        filter(where pa.mode in ('practice','test')))[1] latest_correct,
      max(pa.created_at) last_activity
    from public.assignment_items ai
    left join public.practice_attempts pa on pa.student_id=p_student_id
      and (pa.item_id=ai.item_id or ai.item_id=any(pa.equivalent_item_ids))
      and (not exists(select 1 from public.verb_goal_items gi where gi.item_id=pa.item_id)
        or pa.exercise_key in ('verb-nl-inf','verb-fr-nl')
        or (pa.exercise_key='assignment-mixed' and coalesce(pa.item_variant,'')=''))
    where ai.assignment_id=p_assignment_id group by ai.item_id
  ), levels as (
    select private.item_mastery_level(practiced,independent,correct,sessions,correct_sessions,
      first_correct,latest_correct) level,practiced,last_activity from evidence
  )
  select pg_catalog.jsonb_build_object(
    'total',count(*)::integer,'practiced',count(*) filter(where practiced>0)::integer,
    'acquired',count(*) filter(where level=100)::integer,
    'mastery_level',coalesce(pg_catalog.round(pg_catalog.avg(level)),0)::integer,
    'last_activity',max(last_activity)) from levels;
$$;

create or replace function private.student_current_mastery_percentage(p_student uuid)
returns integer language sql stable security definer set search_path = '' as $$
  with expanded as (
    select pa.id,pa.session_id,x.item_id,pa.mode,pa.was_correct,pa.created_at,pa.attempt_number
    from public.practice_attempts pa
    left join public.verb_goal_items gi on gi.item_id=pa.item_id
    cross join lateral (
      select distinct candidate item_id from pg_catalog.unnest(
        pg_catalog.array_prepend(pa.item_id,coalesce(pa.equivalent_item_ids,'{}'::text[]))) candidate
      where candidate is not null and candidate<>'') x
    where pa.student_id=p_student and
      (gi.item_id is null or pa.exercise_key in ('verb-nl-inf','verb-fr-nl')
        or (pa.exercise_key='assignment-mixed' and coalesce(pa.item_variant,'')=''))
  ), grouped as (
    select item_id,count(*)::integer practiced,
      count(*) filter(where mode in ('practice','test'))::integer independent,
      count(*) filter(where mode in ('practice','test') and was_correct)::integer correct,
      count(distinct session_id) filter(where mode in ('practice','test'))::integer sessions,
      count(distinct session_id) filter(where mode in ('practice','test') and was_correct)::integer correct_sessions,
      (pg_catalog.array_agg(was_correct order by created_at,attempt_number,id)
        filter(where mode in ('practice','test')))[1] first_correct,
      (pg_catalog.array_agg(was_correct order by created_at desc,attempt_number desc,id desc)
        filter(where mode in ('practice','test')))[1] latest_correct
    from expanded group by item_id
  ), levels as (
    select private.item_mastery_level(g.practiced,g.independent,g.correct,g.sessions,g.correct_sessions,
      g.first_correct,g.latest_correct) level
    from public.course_item_ids ci left join grouped g on g.item_id=ci.item_id
  )
  select coalesce(pg_catalog.round(pg_catalog.avg(level))::integer,0) from levels;
$$;

commit;
