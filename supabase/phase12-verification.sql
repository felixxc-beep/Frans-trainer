-- Alleen-lezen: na phase12-report-reliability.sql in de SQL Editor uitvoeren.
select
  (select count(*) from public.course_item_ids)=1036 as permanent_item_count_ok,
  (select count(*) from public.assignments where include_integrative_sentences is null)=0
    as assignment_flag_present_ok,
  (select count(*) from public.assignment_item_reports r where r.status='pending')=
    (select count(*) from (select distinct assignment_id,student_id,round_number,item_id
      from public.assignment_item_reports where status='pending') x) as one_pending_report_per_item_ok,
  (select c.relrowsecurity and c.relforcerowsecurity from pg_catalog.pg_class c
    where c.oid='public.assignment_completion_reopenings'::pg_catalog.regclass)
    as completion_audit_rls_ok,
  not pg_catalog.has_table_privilege('anon','public.assignment_completion_reopenings','SELECT')
    as no_anon_completion_audit_select_ok,
  not pg_catalog.has_table_privilege('authenticated','public.assignment_item_reports','SELECT')
    as no_direct_teacher_report_select_ok,
  public.assignment_sentence_sync_version()=1 as sentence_sync_version_ok;

-- Deze aantallen vergelijken met de eigen back-up/snapshot van vóór migratie.
-- De migratie zelf mag ze niet verminderen.
select
  (select count(*) from public.students) as students,
  (select count(*) from public.practice_sessions) as practice_sessions,
  (select count(*) from public.assignments) as assignments,
  (select count(*) from public.assignment_rounds) as rounds,
  (select count(*) from public.assignment_round_items) as round_items,
  (select count(*) from public.assignment_completions) as assignment_completions,
  (select count(*) from public.practice_attempts) as practice_attempts,
  (select count(*) from public.practice_question_submissions) as question_submissions,
  (select count(*) from public.assignment_item_reports) as item_reports,
  (select count(*) from public.assignment_completion_reopenings) as audited_reopenings;
