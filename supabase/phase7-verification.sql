-- Alleen LEZEN. Optioneel uitvoeren NA phase7-assignments.sql.
-- Verwacht: 1036 permanente IDs, 5 nieuwe tabellen, alle RLS aan,
-- en anon/authenticated zonder rechtstreekse SELECT op taak-/completiontabellen.
select count(*) as registered_item_ids,
  min(item_id) as first_item_id, max(item_id) as last_item_id
from public.course_item_ids;

select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
  pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('course_item_ids','assignments','assignment_classes','assignment_items','assignment_completions')
order by c.relname;

select p.proname, n.nspname as schema_name,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname in ('save_assignment','save_assignment_impl',
  'get_student_assignments','get_student_assignments_impl',
  'get_teacher_assignments','get_teacher_assignments_impl',
  'get_teacher_assignment_detail','get_teacher_assignment_detail_impl',
  'assignment_progress_for_student','ingest_practice_bundle_impl')
order by p.proname, n.nspname;

select pg_catalog.has_function_privilege('anon', 'public.get_student_assignments(text)', 'EXECUTE') as anon_student_rpc,
  pg_catalog.has_function_privilege('anon', 'public.get_teacher_assignments()', 'EXECUTE') as anon_teacher_rpc,
  pg_catalog.has_function_privilege('authenticated', 'public.get_teacher_assignments()', 'EXECUTE') as teacher_rpc;
