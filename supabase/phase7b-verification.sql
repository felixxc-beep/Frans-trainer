-- Alleen-lezen controle na handmatige uitvoering van phase7b-verb-mastery.sql.
-- Verwacht: 55 werkwoord-ID's (39 regelmatig, 16 onregelmatig),
-- 3 regeldoelen, alle nieuwe tabellen met RLS en geen directe leerling-SELECT.

select count(*) as verb_ids,
  count(*) filter (where goal_kind='regular') as regular_ids,
  count(*) filter (where goal_kind='irregular') as irregular_ids,
  count(distinct reference_id) filter (where goal_kind='regular') as regular_rule_goals
from public.verb_goal_items;

select reference_id,count(*) as verb_count
from public.verb_goal_items
where goal_kind='regular'
group by reference_id order by reference_id;

select c.relname as table_name,c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_catalog.has_table_privilege('anon',c.oid,'SELECT') as anon_select,
  pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('verb_goal_items','assignment_requirements')
order by c.relname;

select p.proname,n.nspname as schema_name,p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where p.proname in ('verb_goal_progress','get_student_verb_evidence',
  'get_student_verb_evidence_impl','save_assignment_impl',
  'assignment_progress_for_student','get_teacher_assignment_detail_impl')
order by p.proname,n.nspname;

select pg_catalog.has_function_privilege('anon','public.get_student_verb_evidence(text)','EXECUTE') as anon_student_rpc,
  pg_catalog.has_function_privilege('anon','public.save_assignment(jsonb)','EXECUTE') as anon_teacher_write,
  pg_catalog.has_function_privilege('authenticated','public.save_assignment(jsonb)','EXECUTE') as teacher_write_rpc,
  pg_catalog.has_function_privilege('anon','private.verb_goal_progress(uuid,text,text)','EXECUTE') as anon_private_goal_rpc;

select count(*) as assignments_missing_default_strategy
from public.assignments where mastery_strategy is null;
