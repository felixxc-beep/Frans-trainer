-- ALLEEN-LEZEN. Voer dit eerst uit in de productie-SQL Editor.
-- Fase 11 mag alleen worden uitgevoerd als phase12_base_ready,
-- phase11_cleanly_absent en phase12_not_started alle drie true zijn.
-- Bij een gedeeltelijke fase 11:
-- STOP; voer geen eenmalige migratie opnieuw of gedeeltelijk uit.
with state as (
  select
    pg_catalog.to_regclass('public.practice_attempts') is not null as attempts_present,
    pg_catalog.to_regclass('public.practice_sessions') is not null as sessions_present,
    pg_catalog.to_regclass('public.students') is not null as students_present,
    pg_catalog.to_regclass('public.assignment_item_reports') is not null as reports_present,
    pg_catalog.to_regclass('public.assignment_round_items') is not null as round_items_present,
    pg_catalog.to_regclass('public.assignment_rounds') is not null as rounds_present,
    pg_catalog.to_regclass('public.assignment_completions') is not null as completions_present,
    pg_catalog.to_regclass('public.assignments') is not null as assignments_present,
    pg_catalog.to_regclass('public.assignment_classes') is not null as assignment_classes_present,
    pg_catalog.to_regclass('public.course_item_ids') is not null as course_ids_present,
    pg_catalog.to_regclass('public.practice_question_submissions') is not null as submissions_present,
    pg_catalog.to_regclass('public.assignment_completion_reopenings') is not null as reopenings_present,
    pg_catalog.to_regprocedure('private.ingest_practice_bundle_impl(text,jsonb,jsonb)') is not null as ingest_present,
    pg_catalog.to_regprocedure('private.get_class_activity_monitor_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)') is not null as monitor_present,
    pg_catalog.to_regprocedure('private.report_assignment_item_impl(text,jsonb)') is not null as report_rpc_present,
    pg_catalog.to_regprocedure('private.resolve_assignment_item_report_impl(uuid,text)') is not null as resolve_rpc_present,
    pg_catalog.to_regprocedure('private.save_assignment_impl(jsonb)') is not null as save_assignment_rpc_present,
    pg_catalog.to_regprocedure('private.get_student_assignments_impl(text)') is not null as student_assignments_rpc_present,
    pg_catalog.to_regprocedure('private.get_teacher_assignments_impl()') is not null as teacher_assignments_rpc_present,
    pg_catalog.to_regprocedure('private.get_teacher_assignment_detail_impl(uuid)') is not null as teacher_detail_rpc_present,
    pg_catalog.to_regprocedure('private.register_assignment_completion(uuid,uuid)') is not null as completion_rpc_present,
    pg_catalog.to_regprocedure('private.ingest_practice_bundle_pre_curated_impl(text,jsonb,jsonb)') is not null as pre_curated_ingest_present,
    pg_catalog.to_regprocedure('private.get_class_activity_monitor_pre_curated_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)') is not null as pre_curated_monitor_present,
    pg_catalog.to_regprocedure('public.curated_sync_version()') is not null as curated_version_present,
    pg_catalog.to_regprocedure('public.assignment_sentence_sync_version()') is not null as sentence_version_present,
    exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='assignments'
        and column_name='include_integrative_sentences') as sentence_flag_present
)
select *,
  attempts_present and sessions_present and students_present
    and reports_present and round_items_present
    and rounds_present and completions_present and assignments_present
    and assignment_classes_present and course_ids_present and ingest_present
    and monitor_present and report_rpc_present and resolve_rpc_present
    and save_assignment_rpc_present and student_assignments_rpc_present
    and teacher_assignments_rpc_present and teacher_detail_rpc_present
    and completion_rpc_present as phase12_base_ready,
  not submissions_present and not pre_curated_ingest_present
    and not pre_curated_monitor_present and not curated_version_present as phase11_cleanly_absent,
  submissions_present and pre_curated_ingest_present
    and pre_curated_monitor_present and curated_version_present as phase11_complete,
  not reopenings_present and not sentence_version_present
    and not sentence_flag_present as phase12_not_started
from state;

-- Vergelijk de kolommen van de echte productie-tabellen met de repository.
-- Een ontbrekende kolom in deze lijst vraagt onderzoek vóór de migratie.
with expected(table_name,column_name) as (values
  ('practice_attempts','id'),('practice_attempts','session_id'),
  ('practice_attempts','student_id'),('practice_attempts','client_attempt_id'),
  ('practice_attempts','item_id'),('practice_attempts','equivalent_item_ids'),
  ('practice_attempts','legacy_item_id'),('practice_attempts','item_variant'),
  ('practice_attempts','item_type'),('practice_attempts','was_correct'),
  ('practice_attempts','created_at'),
  ('practice_sessions','id'),('practice_sessions','student_id'),
  ('practice_sessions','client_session_id'),('practice_sessions','exercise_key'),
  ('practice_sessions','assignment_id'),('practice_sessions','assignment_round_number'),
  ('practice_sessions','attempt_count'),('practice_sessions','correct_count'),
  ('practice_sessions','incorrect_count')
)
select e.table_name,e.column_name,
  c.column_name is not null as present,
  c.data_type,c.udt_name
from expected e left join information_schema.columns c
  on c.table_schema='public' and c.table_name=e.table_name
    and c.column_name=e.column_name
order by e.table_name,e.column_name;

-- Controleer de bestaande idempotentie- en integriteitsconstraints;
-- deze migratie verandert de constraints van practice_attempts/sessions niet.
select cl.relname as table_name,con.conname,
  pg_catalog.pg_get_constraintdef(con.oid) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cl on cl.oid=con.conrelid
join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
where ns.nspname='public' and cl.relname in ('practice_attempts','practice_sessions')
order by cl.relname,con.conname;

-- Basistellingen vastleggen; de schema-migraties mogen deze niet verlagen.
select
  (select count(*) from public.practice_sessions) as practice_sessions,
  (select count(*) from public.practice_attempts) as practice_attempts;
