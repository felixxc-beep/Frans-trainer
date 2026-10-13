begin;

create or replace function private.get_teacher_assignment_error_analysis_impl(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then
    raise exception 'teacher access denied';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'variant_id',x.variant_id,
    'round_item_id',x.round_item_id,
    'attempts',x.attempts,
    'incorrect',x.incorrect,
    'students',x.students,
    'students_with_error',x.students_with_error,
    'error_percentage',x.error_percentage,
    'first_seen',x.first_seen,
    'last_seen',x.last_seen
  ) order by x.error_percentage desc, x.incorrect desc, x.attempts desc, x.variant_id),'[]'::jsonb)
  into v_rows
  from (
    select
      q.variant_id,
      q.round_item_id,
      count(*)::integer as attempts,
      count(*) filter (where not q.was_correct)::integer as incorrect,
      count(distinct q.student_id)::integer as students,
      count(distinct q.student_id) filter (where not q.was_correct)::integer as students_with_error,
      case when count(*)=0 then 0 else round(100.0 * count(*) filter (where not q.was_correct) / count(*))::integer end as error_percentage,
      min(q.created_at) as first_seen,
      max(q.created_at) as last_seen
    from public.practice_question_submissions q
    join public.practice_sessions ps on ps.id=q.session_id
    join public.students s on s.id=q.student_id
    join public.classes c on c.id=s.class_id
    where ps.assignment_id=p_assignment_id
      and private.teacher_has_class_access(c.id)
    group by q.variant_id,q.round_item_id
  ) x;

  return v_rows;
end;
$$;

create or replace function public.get_teacher_assignment_error_analysis(p_assignment_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_error_analysis_impl(p_assignment_id);
$$;

revoke all on function private.get_teacher_assignment_error_analysis_impl(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.get_teacher_assignment_error_analysis_impl(uuid) to authenticated;

revoke all on function public.get_teacher_assignment_error_analysis(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.get_teacher_assignment_error_analysis(uuid) to authenticated;

commit;
