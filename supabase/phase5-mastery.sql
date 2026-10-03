-- Handmatige fase-5-migratie: afgeleide leerlingbeheersing.
-- Voer dit bestand één keer uit NA schema.sql, rls.sql en de eerdere fase-5-migraties.
-- Er wordt bewust geen mastery-tabel of blijvende statusvlag aangemaakt.

create or replace function private.get_student_mastery_impl(
  p_identity_token text,
  p_pending_attempt_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_student_id uuid;
  result_items jsonb;
  accepted_ids jsonb;
begin
  if p_identity_token is null
     or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid identity';
  end if;

  if cardinality(coalesce(p_pending_attempt_ids, '{}'::uuid[])) > 5000 then
    raise exception 'too many pending attempt ids';
  end if;

  select s.id into matched_student_id
  from public.students s
  join public.classes c on c.id = s.class_id
  where s.sync_token = p_identity_token::uuid
    and s.is_active = true
    and c.is_active = true
  limit 1;

  if matched_student_id is null then raise exception 'invalid identity'; end if;

  with expanded as (
    select
      pa.id,
      pa.session_id,
      ps.client_session_id,
      expanded_id.item_id,
      coalesce(pa.item_variant, '') as item_variant,
      pa.mode,
      pa.was_correct,
      pa.created_at
    from public.practice_attempts pa
    join public.practice_sessions ps on ps.id = pa.session_id
    cross join lateral (
      select distinct candidate as item_id
      from unnest(array_prepend(pa.item_id, coalesce(pa.equivalent_item_ids, '{}'::text[]))) candidate
      where candidate is not null and candidate <> ''
    ) expanded_id
    where pa.student_id = matched_student_id
  ), grouped as (
    select
      item_id,
      item_variant,
      count(*)::integer as practiced_attempts,
      count(*) filter (where mode in ('practice', 'test'))::integer as independent_attempts,
      count(*) filter (where mode in ('practice', 'test') and was_correct)::integer as independent_correct,
      count(distinct session_id) filter (where mode in ('practice', 'test'))::integer as independent_session_count,
      coalesce(array_agg(distinct client_session_id::text) filter (where mode in ('practice', 'test')), '{}'::text[]) as independent_session_ids,
      max(created_at) filter (where mode in ('practice', 'test')) as latest_independent_at,
      (array_agg(was_correct order by created_at desc, id desc) filter (where mode in ('practice', 'test')))[1] as latest_independent_correct
    from expanded
    group by item_id, item_variant
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id', item_id,
    'item_variant', item_variant,
    'practiced_attempts', practiced_attempts,
    'independent_attempts', independent_attempts,
    'independent_correct', independent_correct,
    'independent_session_count', independent_session_count,
    'independent_session_ids', independent_session_ids,
    'latest_independent_at', latest_independent_at,
    'latest_independent_correct', latest_independent_correct
  ) order by item_id, item_variant), '[]'::jsonb)
  into result_items
  from grouped;

  select coalesce(jsonb_agg(pa.client_attempt_id), '[]'::jsonb)
  into accepted_ids
  from public.practice_attempts pa
  where pa.student_id = matched_student_id
    and pa.client_attempt_id = any(coalesce(p_pending_attempt_ids, '{}'::uuid[]));

  return jsonb_build_object(
    'items', result_items,
    'accepted_pending_attempt_ids', accepted_ids
  );
end;
$$;

create or replace function public.get_student_mastery(
  p_identity_token text,
  p_pending_attempt_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_student_mastery_impl(p_identity_token, p_pending_attempt_ids);
$$;

revoke all on function public.get_student_mastery(text, uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.get_student_mastery_impl(text, uuid[]) from public, anon, authenticated, service_role;

grant execute on function public.get_student_mastery(text, uuid[]) to anon, authenticated;
grant execute on function private.get_student_mastery_impl(text, uuid[]) to anon, authenticated;

