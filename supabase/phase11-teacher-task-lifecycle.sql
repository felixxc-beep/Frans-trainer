-- Handmatig uitvoeren NA phase9-task-rounds.sql. phase10-item-reports.sql is optioneel.
-- Alleen teacher-overzicht/lifecycle: leerlingtaakselectie, rondes en mastery blijven ongewijzigd.
begin;

-- Bestaande maker-ID's blijven behouden. Onbekende legacy-makers worden niet gegokt.
alter table public.assignments alter column created_by_teacher_id drop not null;

-- AUTO_ARCHIVE_GRACE_DAYS: één server-side bron voor de afleidbare lifecycle.
create function private.assignment_auto_archive_grace_days()
returns integer language sql stable security invoker set search_path = '' as $$
  select 7;
$$;

alter function private.get_teacher_assignments_impl()
  rename to get_teacher_assignments_pre_lifecycle_impl;
create function private.get_teacher_assignments_impl()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_result jsonb := '[]'::jsonb; v_row jsonb;
  v_id uuid; v_status text; v_due timestamptz; v_updated timestamptz; v_creator text;
  v_lifecycle text; v_reports integer; v_grace integer;
begin
  v_base := private.get_teacher_assignments_pre_lifecycle_impl();
  v_grace := private.assignment_auto_archive_grace_days();
  for v_row in select x.value from pg_catalog.jsonb_array_elements(v_base) x loop
    v_id := (v_row->>'id')::uuid;
    select a.status, a.due_at, a.updated_at,
      coalesce(nullif(pg_catalog.btrim(t.display_name),''),nullif(t.email,''))
      into v_status, v_due, v_updated, v_creator
      from public.assignments a
      left join public.teachers t on t.auth_user_id=a.created_by_teacher_id
      where a.id=v_id;
    v_lifecycle := case
      when v_status='draft' then 'draft'
      when v_status='archived' then 'archived'
      when v_due is null or pg_catalog.now()<=v_due then 'active'
      when pg_catalog.now()<=v_due+pg_catalog.make_interval(days => v_grace) then 'recent'
      else 'archived' end;
    v_reports := 0;
    if pg_catalog.to_regclass('public.assignment_item_reports') is not null then
      execute 'select count(*)::integer from public.assignment_item_reports r
        join public.students s on s.id=r.student_id
        where r.assignment_id=$1 and r.status=''pending''
          and private.teacher_has_class_access(s.class_id)'
        into v_reports using v_id;
    end if;
    v_result := v_result || pg_catalog.jsonb_build_array(v_row || pg_catalog.jsonb_build_object(
      'creator_name',v_creator,'lifecycle_status',v_lifecycle,'updated_at',v_updated,
      'open_report_count',v_reports,'auto_archive_grace_days',v_grace));
  end loop;
  return v_result;
end;
$$;
create or replace function public.get_teacher_assignments()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignments_impl();
$$;

-- Alleen expliciet manueel gearchiveerde taken hebben een statusmutatie nodig.
-- De deadline en historische resultaten worden niet aangepast.
create function private.restore_assignment_impl(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_task public.assignments%rowtype;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  select * into v_task from public.assignments where id=p_assignment_id for update;
  if v_task.id is null then raise exception 'assignment not found'; end if;
  if not (private.current_teacher_is_admin() or v_task.created_by_teacher_id=auth.uid()) then
    raise exception 'assignment edit denied'; end if;
  if not private.current_teacher_is_admin() and exists (
    select 1 from public.assignment_classes ac where ac.assignment_id=p_assignment_id
      and not private.teacher_has_class_access(ac.class_id)) then
    raise exception 'class access denied'; end if;
  if v_task.status<>'archived' then raise exception 'assignment is not manually archived'; end if;
  update public.assignments set status='published',
    published_at=coalesce(published_at,pg_catalog.now()) where id=p_assignment_id;
  return pg_catalog.jsonb_build_object('id',p_assignment_id,'status','published',
    'due_at',v_task.due_at);
end;
$$;
create function public.restore_assignment(p_assignment_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.restore_assignment_impl(p_assignment_id);
$$;

revoke all on function private.assignment_auto_archive_grace_days(),
  private.get_teacher_assignments_pre_lifecycle_impl(),
  private.get_teacher_assignments_impl(),
  private.restore_assignment_impl(uuid), public.get_teacher_assignments(),
  public.restore_assignment(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.get_teacher_assignments_impl(),
  private.restore_assignment_impl(uuid), public.get_teacher_assignments(),
  public.restore_assignment(uuid) to authenticated;
commit;
