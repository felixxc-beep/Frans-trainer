-- READ-ONLY preflight. Run before phase10-12-state-aware-upgrade.sql.
-- Catalog checks only: no table is created, changed, or populated.
with required(kind, phase, object_name, present) as (
  select 'table', phase, name, pg_catalog.to_regclass('public.' || name) is not null
  from (values
    ('base','students'),('base','classes'),('base','teachers'),
    ('base','assignments'),('base','assignment_classes'),('base','assignment_items'),
    ('base','assignment_completions'),('base','assignment_rounds'),('base','assignment_round_items'),
    ('base','practice_sessions'),('base','practice_attempts'),('base','course_item_ids'),
    ('base','verb_goal_items'),('base','assignment_requirements'),
    ('10','assignment_item_reports'),('11','practice_question_submissions'),
    ('12','assignment_completion_reopenings')) v(phase,name)
  union all
  select 'column', phase, 'assignments.' || name,
    exists(select 1 from pg_catalog.pg_attribute a
      where a.attrelid=pg_catalog.to_regclass('public.assignments')
        and a.attname=name and a.attnum>0 and not a.attisdropped)
  from (values ('12','include_integrative_sentences'),('11','use_exercise_variants'),
    ('new','exercise_forms')) v(phase,name)
  union all
  select 'column', phase, table_name || '.' || column_name,
    exists(select 1 from pg_catalog.pg_attribute a
      where a.attrelid=pg_catalog.to_regclass('public.' || table_name)
        and a.attname=column_name and a.attnum>0 and not a.attisdropped)
  from (values
    ('10','assignment_item_reports','id'),('10','assignment_item_reports','assignment_id'),
    ('11','practice_question_submissions','client_submission_id'),
    ('12','assignment_completion_reopenings','report_id'),
    ('12','assignment_round_items','completion_kind')) v(phase,table_name,column_name)
  union all
  select 'function', phase, signature, pg_catalog.to_regprocedure(signature) is not null
  from (values
    ('base','private.ingest_practice_bundle_pre_rounds_impl(text,jsonb,jsonb)'),
    ('base','private.save_assignment_pre_rounds_impl(jsonb)'),
    ('base','private.get_teacher_assignments_pre_rounds_impl()'),
    ('base','private.get_teacher_assignment_detail_pre_rounds_impl(uuid)'),
    ('base','private.assignment_progress_for_student(uuid,uuid)'),
    ('base','private.current_teacher_is_active()'),
    ('base','private.teacher_has_class_access(uuid)'),
    ('10','public.report_assignment_item(text,jsonb)'),
    ('11','public.curated_sync_version()'),
    ('11','private.assignment_auto_archive_grace_days()'),
    ('12','public.assignment_sentence_sync_version()'),
    ('new','public.assignment_variant_sync_version()'),
    ('new','public.save_assignment(jsonb)'),
    ('new','public.get_student_assignments(text)'),
    ('new','public.get_teacher_assignments()')) v(phase,signature)
)
select phase, kind, object_name, present,
  case when phase='base' and not present then 'STOP: basisarchitectuur ontbreekt'
       when not present then 'Upgrade/herstel nodig'
       else 'Aanwezig' end as beoordeling
from required order by case phase when 'base' then 0 when '10' then 1 when '11' then 2 when '12' then 3 else 4 end,
  kind, object_name;

-- Summary is a separate, still read-only result set. A partial state is
-- normal: the state-aware upgrade is designed to reconcile phases 10–12.
with checks as (
  select
    pg_catalog.to_regclass('public.assignments') is not null and
    pg_catalog.to_regclass('public.practice_attempts') is not null and
    pg_catalog.to_regclass('public.practice_sessions') is not null and
    pg_catalog.to_regclass('public.assignment_round_items') is not null and
    pg_catalog.to_regprocedure('private.save_assignment_pre_rounds_impl(jsonb)') is not null as base_ready,
    pg_catalog.to_regclass('public.assignment_item_reports') is not null as phase10_reports,
    pg_catalog.to_regclass('public.practice_question_submissions') is not null as phase11_question_submissions,
    pg_catalog.to_regclass('public.assignment_completion_reopenings') is not null as phase12_reopenings,
    exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.assignments')
      and attname='use_exercise_variants' and attnum>0 and not attisdropped) as use_exercise_variants,
    exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.assignments')
      and attname='include_integrative_sentences' and attnum>0 and not attisdropped) as include_integrative_sentences,
    exists(select 1 from pg_catalog.pg_attribute where attrelid=pg_catalog.to_regclass('public.assignments')
      and attname='exercise_forms' and attnum>0 and not attisdropped) as exercise_forms,
    pg_catalog.to_regprocedure('public.assignment_variant_sync_version()') is not null as assignment_variant_sync_version,
    coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('private.save_assignment_impl(jsonb)'))
      like '%exercise_forms%',false) as save_rpc_handles_forms,
    coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('private.get_student_assignments_impl(text)'))
      like '%exercise_forms%',false) as student_rpc_returns_forms,
    coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('private.get_teacher_assignments_impl()'))
      like '%exercise_forms%',false) as teacher_rpc_returns_forms,
    pg_catalog.to_regprocedure('private.mon_parcours_upgrade_verification()') is not null as verification_function
)
select *, case
  when not base_ready then 'STOP: basis ontbreekt; voer upgrade niet uit'
  when not (phase10_reports and phase11_question_submissions and phase12_reopenings and
    use_exercise_variants and include_integrative_sentences and exercise_forms and
    assignment_variant_sync_version and save_rpc_handles_forms and student_rpc_returns_forms and
    teacher_rpc_returns_forms and verification_function)
    then 'Upgrade nodig: voer phase10-12-state-aware-upgrade.sql uit; daarna verification'
  else 'Structuur aanwezig: voer eerst verification uit; upgrade alleen bij afwijkingen'
  end as beslissing
from checks;
