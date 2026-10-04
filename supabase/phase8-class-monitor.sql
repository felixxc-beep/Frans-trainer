-- Fase 8 · handmatig EEN KEER uitvoeren na phase7b-verb-mastery.sql.
-- De live monitor haalt aggregaten op; er worden geen antwoorden of ruwe pogingen uitgedeeld.
begin;

create index if not exists practice_attempts_created_student_idx
  on public.practice_attempts(created_at desc, student_id);
-- Bestaand: students_class_idx, sessions_student_started_idx,
-- attempts_student_item_idx en practice_sessions_assignment_idx.

-- Exacte port van de bestaande item-level-formule in mastery.js voor de
-- huidige (niet periodegebonden) totaalstand. Werkwoordvervoegingen tellen
-- niet als lexicale itempogingen; regel-/irregular-mastery blijft fase 7b.
create function private.student_current_mastery_percentage(p_student uuid)
returns integer language sql stable security definer set search_path = '' as $$
  with expanded as (
    select pa.id,pa.session_id,x.item_id,pa.mode,pa.was_correct,pa.created_at
    from public.practice_attempts pa
    left join public.verb_goal_items gi on gi.item_id=pa.item_id
    cross join lateral (
      select distinct candidate as item_id from pg_catalog.unnest(
        pg_catalog.array_prepend(pa.item_id,coalesce(pa.equivalent_item_ids,'{}'::text[]))) candidate
      where candidate is not null and candidate<>''
    ) x
    where pa.student_id=p_student and
      (gi.item_id is null or pa.exercise_key in ('verb-nl-inf','verb-fr-nl')
        or (pa.exercise_key='assignment-mixed' and coalesce(pa.item_variant,'')=''))
  ), grouped as (
    select item_id,count(*)::integer practiced,
      count(*) filter(where mode in ('practice','test'))::integer independent,
      count(*) filter(where mode in ('practice','test') and was_correct)::integer correct,
      count(distinct session_id) filter(where mode in ('practice','test'))::integer sessions,
      (pg_catalog.array_agg(was_correct order by created_at desc,id desc)
        filter(where mode in ('practice','test')))[1] latest_correct
    from expanded group by item_id
  ), levels as (
    select case
      when g.practiced is null then 0
      when g.correct>=3 and g.correct::numeric/nullif(g.independent,0)>=0.75
        and g.sessions>=2 and g.latest_correct is true then 100
      when g.independent=0 then 10
      else pg_catalog.greatest(10,pg_catalog.least(90,pg_catalog.round(
        (case when g.correct=0 then 10 when g.correct=1 then 40
          when g.correct=2 then 60 else pg_catalog.least(90,75+(g.correct-3)*3) end)
        *g.correct::numeric/nullif(g.independent,0))::integer)) end as level
    from public.course_item_ids ci left join grouped g on g.item_id=ci.item_id
  )
  select coalesce(pg_catalog.round(pg_catalog.avg(level))::integer,0) from levels;
$$;

create function private.get_class_activity_monitor_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  if p_class_id is not null and not private.teacher_has_class_access(p_class_id)
    then raise exception 'class access denied'; end if;
  if coalesce(p_include_mastery,false) and p_class_id is null
    then raise exception 'choose one class for mastery'; end if;
  if p_period_start is not null and p_period_end is not null and p_period_start>=p_period_end
    then raise exception 'invalid period'; end if;
  if p_trajectory is not null and pg_catalog.char_length(p_trajectory)>80 or
     p_mode is not null and p_mode not in ('learn','practice','test') or
     p_category is not null and pg_catalog.char_length(p_category)>120 or
     p_subsection is not null and pg_catalog.char_length(p_subsection)>160
     or p_student_status is not null and p_student_status not in ('active','inactive','all')
    then raise exception 'invalid monitor filter'; end if;

  with allowed_students as (
    select s.id,s.class_id,s.display_name,s.is_active
    from public.students s join public.classes c on c.id=s.class_id
    where c.is_active=true
      and (coalesce(p_student_status,'active')='all'
        or p_student_status='inactive' and s.is_active=false
        or coalesce(p_student_status,'active')='active' and s.is_active=true)
      and (p_class_id is null or s.class_id=p_class_id)
      and private.teacher_has_class_access(s.class_id)
  ), scoped_sessions as (
    select ps.* from public.practice_sessions ps
    join allowed_students s on s.id=ps.student_id
    where (p_trajectory is null or ps.trajectory=p_trajectory)
      and (p_mode is null or ps.mode=p_mode)
      and (p_category is null or ps.top_category=p_category)
      and (p_subsection is null or ps.subsection=p_subsection)
      and (p_assignment_id is null or ps.assignment_id=p_assignment_id)
  ), period_sessions as (
    select ps.* from scoped_sessions ps
    where (p_period_start is null or ps.started_at>=p_period_start)
      and (p_period_end is null or ps.started_at<p_period_end)
  ), period_attempts as (
    select pa.student_id,pa.session_id,pa.item_id,pa.item_variant,pa.mode,
      pa.was_correct,pa.created_at
    from public.practice_attempts pa join scoped_sessions ps on ps.id=pa.session_id
    where (p_period_start is null or pa.created_at>=p_period_start)
      and (p_period_end is null or pa.created_at<p_period_end)
  ), attempt_totals as (
    select student_id,
      count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer unique_exercises,
      count(*)::integer attempt_count,
      count(*) filter(where mode in ('practice','test'))::integer independent_attempts,
      count(*) filter(where mode in ('practice','test') and was_correct)::integer independent_correct,
      max(created_at) last_attempt_at
    from period_attempts group by student_id
  ), session_totals as (
    select student_id,
      -- Alleen sessies die in deze periode begonnen: de huidige tabel heeft
      -- geen tijdlijn om één sessie exact over twee perioden te splitsen.
      coalesce(sum(pg_catalog.greatest(0,active_duration_seconds)),0)::bigint active_seconds,
      max(started_at) last_started_at,
      max(finished_at) filter(where (p_period_start is null or finished_at>=p_period_start)
        and (p_period_end is null or finished_at<p_period_end)) last_finished_at
    from period_sessions group by student_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'student_id',s.id,'class_id',s.class_id,'display_name',s.display_name,'is_active',s.is_active,
    'unique_exercises',coalesce(at.unique_exercises,0),
    'attempt_count',coalesce(at.attempt_count,0),
    'independent_attempts',coalesce(at.independent_attempts,0),
    'independent_correct',coalesce(at.independent_correct,0),
    'active_seconds',coalesce(st.active_seconds,0),
    'last_activity_at',pg_catalog.greatest(at.last_attempt_at,st.last_started_at,st.last_finished_at),
    'recent_open_session',exists (
      select 1 from scoped_sessions live
      where live.student_id=s.id and live.finished_at is null
        and (live.started_at>=pg_catalog.now()-interval '180 seconds' or exists (
          select 1 from public.practice_attempts recent
          where recent.session_id=live.id and recent.created_at>=pg_catalog.now()-interval '180 seconds'))),
    'current_mastery_percentage',case when coalesce(p_include_mastery,false)
      then private.student_current_mastery_percentage(s.id) else null end,
    'active_assignment_count',(
      select count(*) from public.assignments a
      join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=s.class_id
      left join public.assignment_completions done on done.assignment_id=a.id and done.student_id=s.id
      where a.status='published' and done.completed_at is null),
    'active_assignment',(
      select pg_catalog.jsonb_build_object('id',a.id,'title',a.title,'due_at',a.due_at,
        'mastery_strategy',a.mastery_strategy,
        'mastery_percentage',(private.assignment_progress_for_student(a.id,s.id)->>'mastery_level')::integer)
      from public.assignments a
      join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=s.class_id
      left join public.assignment_completions done on done.assignment_id=a.id and done.student_id=s.id
      where a.status='published' and done.completed_at is null
      order by a.due_at nulls last,a.created_at limit 1)
    ) order by s.class_id,s.display_name),'[]'::jsonb) into v_rows
  from allowed_students s
  left join attempt_totals at on at.student_id=s.id
  left join session_totals st on st.student_id=s.id;
  return v_rows;
end;
$$;

create function public.get_class_activity_monitor(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_class_activity_monitor_impl(p_class_id,p_period_start,p_period_end,
    p_trajectory,p_mode,p_category,p_subsection,p_assignment_id,p_student_status,p_include_mastery);
$$;

create function private.get_teacher_student_verb_goals_impl(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() or not exists (
    select 1 from public.students s where s.id=p_student_id and s.is_active=true
      and private.teacher_has_class_access(s.class_id))
    then raise exception 'student access denied'; end if;
  select coalesce(pg_catalog.jsonb_agg(private.verb_goal_progress(p_student_id,g.goal_kind,g.reference_id)
    order by g.goal_kind,g.reference_id),'[]'::jsonb) into v_rows
  from (select distinct goal_kind,reference_id from public.verb_goal_items) g;
  return v_rows;
end;
$$;

create function public.get_teacher_student_verb_goals(p_student_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_teacher_student_verb_goals_impl(p_student_id);
$$;

revoke all on function private.student_current_mastery_percentage(uuid),
  private.get_class_activity_monitor_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.get_teacher_student_verb_goals_impl(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  public.get_teacher_student_verb_goals(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.get_class_activity_monitor_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.get_teacher_student_verb_goals_impl(uuid) to authenticated;
grant execute on function public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  public.get_teacher_student_verb_goals(uuid) to authenticated;

commit;
