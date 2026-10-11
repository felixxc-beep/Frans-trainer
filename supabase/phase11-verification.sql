-- Alleen-lezen controle NA phase11-curated-variants.sql.
-- Alle *_ok-kolommen horen true te zijn; voer de migratie niet opnieuw uit.
select
  c.relrowsecurity as rls_enabled_ok,
  c.relforcerowsecurity as rls_forced_ok,
  not pg_catalog.has_table_privilege('anon','public.practice_question_submissions','SELECT') as no_anon_select_ok,
  not pg_catalog.has_table_privilege('authenticated','public.practice_question_submissions','SELECT') as no_student_select_ok,
  not pg_catalog.has_table_privilege('anon','public.practice_question_submissions','INSERT') as no_anon_insert_ok,
  not pg_catalog.has_table_privilege('authenticated','public.practice_question_submissions','INSERT') as no_student_insert_ok
from pg_catalog.pg_class c
where c.oid=pg_catalog.to_regclass('public.practice_question_submissions');

select
  pg_catalog.has_function_privilege('anon','public.curated_sync_version()','EXECUTE') as sync_check_ok,
  pg_catalog.has_function_privilege('anon',
    'public.ingest_practice_bundle(text,jsonb,jsonb)','EXECUTE') as student_ingest_ok,
  pg_catalog.has_function_privilege('authenticated',
    'public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)',
    'EXECUTE') as teacher_monitor_ok,
  not pg_catalog.has_function_privilege('anon',
    'private.get_class_activity_monitor_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)',
    'EXECUTE') as no_anon_private_monitor_ok;
