-- Alleen-lezen controle na handmatige uitvoering van phase8-class-monitor.sql.
select pg_catalog.to_regprocedure('public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)') as monitor_rpc,
  pg_catalog.to_regprocedure('public.get_teacher_student_verb_goals(uuid)') as verb_goals_rpc;

select pg_catalog.has_function_privilege('anon',
  'public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)','EXECUTE') as anon_monitor_execute,
  pg_catalog.has_function_privilege('authenticated',
  'public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)','EXECUTE') as teacher_monitor_execute,
  pg_catalog.has_function_privilege('anon','private.get_teacher_student_verb_goals_impl(uuid)','EXECUTE') as anon_private_verb_execute;

select n.nspname,p.proname,p.prosecdef as security_definer,p.proconfig
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where p.proname in ('student_current_mastery_percentage','get_class_activity_monitor_impl',
  'get_class_activity_monitor','get_teacher_student_verb_goals_impl','get_teacher_student_verb_goals')
order by p.proname,n.nspname;

select indexname from pg_catalog.pg_indexes
where schemaname='public' and tablename in ('students','practice_sessions','practice_attempts')
  and indexname in ('students_class_idx','sessions_student_started_idx',
    'attempts_student_item_idx','practice_sessions_assignment_idx','practice_attempts_created_student_idx')
order by indexname;
