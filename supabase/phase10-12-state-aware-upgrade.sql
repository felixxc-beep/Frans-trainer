-- State-aware upgrade phases 10–12. Run this ONE file manually in Supabase.
-- Requires the existing phases 7–9 architecture. No production connection here.
-- Transactional and repeatable; no item IDs, student rows, attempts or rounds removed.
begin;
set transaction isolation level repeatable read;
set local lock_timeout = '10s';
set local search_path = '';
select pg_catalog.pg_advisory_xact_lock(1036, 101112);
do $base$
declare name text;
begin
  foreach name in array array['students','classes','teachers','assignments','assignment_classes',
    'assignment_items','assignment_completions','assignment_rounds','assignment_round_items',
    'practice_sessions','practice_attempts','course_item_ids','verb_goal_items','assignment_requirements'] loop
    if pg_catalog.to_regclass('public.'||name) is null then
      raise exception 'Required phase 7–9 table missing: public.%',name;
    end if;
  end loop;
  foreach name in array array[
    'private.ingest_practice_bundle_pre_rounds_impl(text,jsonb,jsonb)',
    'private.save_assignment_pre_rounds_impl(jsonb)',
    'private.get_teacher_assignments_pre_rounds_impl()',
    'private.get_teacher_assignment_detail_pre_rounds_impl(uuid)',
    'private.assignment_progress_for_student(uuid,uuid)',
    'private.current_teacher_is_active()', 'private.teacher_has_class_access(uuid)'] loop
    if pg_catalog.to_regprocedure(name) is null then
      raise exception 'Required phase 7–9 function missing: %',name;
    end if;
  end loop;
  if (select count(*) from public.course_item_ids)<>1036 or exists(select 1 from generate_series(1,1036) n
    where not exists(select 1 from public.course_item_ids i where i.item_id='uf1-item-'||lpad(n::text,6,'0')))
    then raise exception 'Permanent course IDs differ from the required 1036 IDs; no IDs will be repaired or reset'; end if;
end; $base$;

-- Capture the actual starting catalog and rows for this run, including any
-- partially installed phases. JSON preserves original column values exactly.
create table if not exists private.mon_parcours_upgrade_runs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  started_at timestamptz not null default pg_catalog.now(), finished_at timestamptz,
  starting_catalog jsonb not null, preserved_rows jsonb not null default '{}'::jsonb,
  installed_functions jsonb not null default '{}'::jsonb, preservation_verified boolean not null default false
);
revoke all on private.mon_parcours_upgrade_runs from public,anon,authenticated,service_role;
create temporary table mon_parcours_upgrade_run (id uuid) on commit drop;
do $snapshot$
declare run_id uuid; name text; rows jsonb; columns text[]; snapshot jsonb := '{}'::jsonb;
begin
  foreach name in array array['students','assignments','assignment_classes','assignment_items',
    'assignment_completions','assignment_rounds','assignment_round_items','practice_sessions',
    'practice_attempts','assignment_item_reports','practice_question_submissions',
    'assignment_completion_reopenings','course_item_ids','verb_goal_items','assignment_requirements','classes','teachers','class_teachers'] loop
    if pg_catalog.to_regclass('public.'||name) is not null then
      select array_agg(a.attname order by a.attnum) into columns from pg_attribute a
        where a.attrelid=to_regclass('public.'||name) and a.attnum>0 and not a.attisdropped;
      execute pg_catalog.format('select jsonb_build_object(''count'',count(*),''digest'',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' order by md5(to_jsonb(t)::text)),'''')),''columns'',$1) from public.%I t',name) into rows using to_jsonb(columns);
      snapshot := snapshot || pg_catalog.jsonb_build_object(name,rows);
    end if;
  end loop;
  insert into private.mon_parcours_upgrade_runs(starting_catalog,preserved_rows)
    values(pg_catalog.jsonb_build_object(
      'columns',(select jsonb_agg(to_jsonb(c)) from information_schema.columns c where c.table_schema='public'),
      'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
        'definition',pg_get_functiondef(p.oid),'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','private') and p.prokind='f'),
      'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,
        'definition',pg_get_constraintdef(c.oid))) from pg_constraint c join pg_namespace n on n.oid=c.connamespace
        where n.nspname='public'),
      'indexes',(select jsonb_agg(to_jsonb(i)) from pg_indexes i where i.schemaname='public'),
      'supabase_ledger_present',to_regclass('supabase_migrations.schema_migrations') is not null),snapshot)
    returning id into run_id;
  insert into mon_parcours_upgrade_run values(run_id);
end; $snapshot$;

alter table public.assignment_round_items add column if not exists completion_kind text;
alter table public.assignments add column if not exists include_integrative_sentences boolean not null default false;
alter table public.assignments add column if not exists use_exercise_variants boolean not null default false;
alter table public.assignments add column if not exists exercise_forms jsonb;
alter table public.assignment_completions add column if not exists reopened_at timestamptz;
alter table public.assignments alter column created_by_teacher_id drop not null;


create table if not exists public.assignment_item_reports (
  id uuid primary key,
  assignment_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 4),
  item_id text not null references public.course_item_ids(item_id) on delete restrict,
  prompt text not null check (pg_catalog.char_length(prompt) between 1 and 500),
  exercise_direction text not null check (exercise_direction in
    ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl','verb-nl-conj','verb-fr-conj',
     'phrase-nl-fr','grammar','number-nl-fr','number-fr-nl')),
  submitted_answers jsonb not null check (pg_catalog.jsonb_typeof(submitted_answers)='array'
    and pg_catalog.jsonb_array_length(submitted_answers) between 1 and 3),
  accepted_answers jsonb not null check (pg_catalog.jsonb_typeof(accepted_answers)='array'
    and pg_catalog.jsonb_array_length(accepted_answers) between 1 and 20),
  consulted boolean not null default false,
  app_version text check (pg_catalog.char_length(app_version)<=64),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  unique (assignment_id,student_id,round_number,item_id),
  foreign key (assignment_id,student_id,round_number,item_id)
    references public.assignment_round_items(assignment_id,student_id,round_number,item_id) on delete cascade
);

create table if not exists public.practice_question_submissions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  client_submission_id uuid not null,
  variant_id text not null check (pg_catalog.char_length(variant_id) between 5 and 120),
  was_correct boolean not null,
  created_at timestamptz not null,
  received_at timestamptz not null default pg_catalog.now(),
  unique (student_id, client_submission_id)
);

create table if not exists public.assignment_completion_reopenings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  report_id uuid not null references public.assignment_item_reports(id) on delete restrict,
  original_completion jsonb not null,
  reopened_at timestamptz not null default pg_catalog.now(),
  unique (report_id)
);

alter table public.practice_question_submissions add column if not exists round_item_id text;
alter table public.practice_question_submissions add column if not exists client_evidence_ids uuid[] not null default '{}';
alter table public.practice_question_submissions add column if not exists evidence_linked boolean not null default false;
alter table public.practice_question_submissions add column if not exists target_results jsonb not null default '[]';
alter table public.assignment_item_reports add column if not exists variant_id text;
alter table public.assignment_item_reports add column if not exists model_answer text;
alter table public.assignment_item_reports add column if not exists attempt_details jsonb not null default '[]';
alter table public.assignment_item_reports add column if not exists exercise_type text;


do $columns$ declare r record; actual text; begin
  for r in select * from (values ('students','id','uuid'),
('students','class_id','uuid'),
('students','sync_token','uuid'),
('students','is_active','boolean'),
('classes','id','uuid'),
('classes','name','text'),
('classes','is_active','boolean'),
('teachers','auth_user_id','uuid'),
('teachers','email','text'),
('teachers','display_name','text'),
('teachers','role','text'),
('teachers','is_active','boolean'),
('assignments','id','uuid'),
('assignments','created_by_teacher_id','uuid'),
('assignments','title','text'),
('assignments','status','text'),
('assignments','due_at','timestamp with time zone'),
('assignments','published_at','timestamp with time zone'),
('assignments','updated_at','timestamp with time zone'),
('assignments','target_acquired_percentage','integer'),
('assignments','mastery_strategy','text'),
('assignments','completion_strategy','text'),
('assignments','required_rounds','integer'),
('assignments','item_verb_exercise_key','text'),
('assignments','include_integrative_sentences','boolean'),
('assignments','use_exercise_variants','boolean'),
('assignments','exercise_forms','jsonb'),
('assignment_classes','assignment_id','uuid'),
('assignment_classes','class_id','uuid'),
('assignment_items','assignment_id','uuid'),
('assignment_items','item_id','text'),
('assignment_items','item_order','integer'),
('assignment_completions','assignment_id','uuid'),
('assignment_completions','student_id','uuid'),
('assignment_completions','completed_at','timestamp with time zone'),
('assignment_completions','acquired_count_at_completion','integer'),
('assignment_completions','total_count_at_completion','integer'),
('assignment_completions','acquired_percentage_at_completion','integer'),
('assignment_completions','reopened_at','timestamp with time zone'),
('assignment_rounds','assignment_id','uuid'),
('assignment_rounds','student_id','uuid'),
('assignment_rounds','round_number','integer'),
('assignment_rounds','selected_item_ids','text[]'),
('assignment_rounds','completed_at','timestamp with time zone'),
('assignment_round_items','assignment_id','uuid'),
('assignment_round_items','student_id','uuid'),
('assignment_round_items','round_number','integer'),
('assignment_round_items','item_id','text'),
('assignment_round_items','wrong_count','integer'),
('assignment_round_items','consulted','boolean'),
('assignment_round_items','completed_at','timestamp with time zone'),
('assignment_round_items','completion_kind','text'),
('assignment_round_items','selection_reason','text'),
('practice_attempts','id','uuid'),
('practice_attempts','session_id','uuid'),
('practice_attempts','student_id','uuid'),
('practice_attempts','client_attempt_id','uuid'),
('practice_attempts','item_id','text'),
('practice_attempts','equivalent_item_ids','text[]'),
('practice_attempts','legacy_item_id','text'),
('practice_attempts','item_variant','text'),
('practice_attempts','item_type','text'),
('practice_attempts','trajectory','text'),
('practice_attempts','top_category','text'),
('practice_attempts','lesson','text'),
('practice_attempts','block','text'),
('practice_attempts','subsection','text'),
('practice_attempts','exercise_key','text'),
('practice_attempts','mode','text'),
('practice_attempts','prompt','text'),
('practice_attempts','correct_answers','jsonb'),
('practice_attempts','was_correct','boolean'),
('practice_attempts','attempt_number','integer'),
('practice_attempts','created_at','timestamp with time zone'),
('practice_sessions','id','uuid'),
('practice_sessions','student_id','uuid'),
('practice_sessions','client_session_id','uuid'),
('practice_sessions','exercise_key','text'),
('practice_sessions','assignment_id','uuid'),
('practice_sessions','assignment_round_number','integer'),
('practice_sessions','mode','text'),
('practice_sessions','trajectory','text'),
('practice_sessions','top_category','text'),
('practice_sessions','subsection','text'),
('practice_sessions','started_at','timestamp with time zone'),
('practice_sessions','finished_at','timestamp with time zone'),
('practice_sessions','attempt_count','integer'),
('practice_sessions','correct_count','integer'),
('practice_sessions','incorrect_count','integer'),
('practice_sessions','updated_at','timestamp with time zone'),
('practice_sessions','active_duration_seconds','integer'),
('assignment_item_reports','id','uuid'),
('assignment_item_reports','assignment_id','uuid'),
('assignment_item_reports','student_id','uuid'),
('assignment_item_reports','round_number','integer'),
('assignment_item_reports','item_id','text'),
('assignment_item_reports','prompt','text'),
('assignment_item_reports','exercise_direction','text'),
('assignment_item_reports','submitted_answers','jsonb'),
('assignment_item_reports','accepted_answers','jsonb'),
('assignment_item_reports','consulted','boolean'),
('assignment_item_reports','app_version','text'),
('assignment_item_reports','status','text'),
('assignment_item_reports','created_at','timestamp with time zone'),
('assignment_item_reports','resolved_at','timestamp with time zone'),
('assignment_item_reports','resolved_by','uuid'),
('assignment_item_reports','variant_id','text'),
('assignment_item_reports','model_answer','text'),
('assignment_item_reports','attempt_details','jsonb'),
('assignment_item_reports','exercise_type','text'),
('practice_question_submissions','id','uuid'),
('practice_question_submissions','session_id','uuid'),
('practice_question_submissions','student_id','uuid'),
('practice_question_submissions','client_submission_id','uuid'),
('practice_question_submissions','variant_id','text'),
('practice_question_submissions','was_correct','boolean'),
('practice_question_submissions','created_at','timestamp with time zone'),
('practice_question_submissions','received_at','timestamp with time zone'),
('practice_question_submissions','round_item_id','text'),
('practice_question_submissions','client_evidence_ids','uuid[]'),
('practice_question_submissions','evidence_linked','boolean'),
('practice_question_submissions','target_results','jsonb'),
('assignment_completion_reopenings','id','uuid'),
('assignment_completion_reopenings','assignment_id','uuid'),
('assignment_completion_reopenings','student_id','uuid'),
('assignment_completion_reopenings','report_id','uuid'),
('assignment_completion_reopenings','original_completion','jsonb'),
('assignment_completion_reopenings','reopened_at','timestamp with time zone')) as e(tbl,col,typ) loop
    select format_type(a.atttypid,a.atttypmod) into actual from pg_attribute a
      where a.attrelid=to_regclass('public.'||r.tbl) and a.attname=r.col and not a.attisdropped;
    if actual is distinct from r.typ then raise exception 'Incompatible column %.%: expected %, got %',r.tbl,r.col,r.typ,actual; end if;
  end loop;
  if exists(select 1 from public.assignments where include_integrative_sentences is null or use_exercise_variants is null)
    then raise exception 'Existing assignment options contain NULL: investigate without resetting data'; end if;
end; $columns$;
alter table public.assignments alter column include_integrative_sentences set default false;
alter table public.assignments alter column include_integrative_sentences set not null;
alter table public.assignments alter column use_exercise_variants set default false;
alter table public.assignments alter column use_exercise_variants set not null;


do $$
declare v_constraint text;
begin
  select c.conname into v_constraint from pg_catalog.pg_constraint c
  where c.conrelid='public.assignment_item_reports'::pg_catalog.regclass
    and c.contype='u' and replace(pg_catalog.pg_get_constraintdef(c.oid),' ','') =
      'UNIQUE(assignment_id,student_id,round_number,item_id)';
  if v_constraint is not null then
    execute pg_catalog.format('alter table public.assignment_item_reports drop constraint %I',v_constraint);
  end if;
end; $$;
create unique index if not exists assignment_item_reports_one_pending_idx
  on public.assignment_item_reports(assignment_id,student_id,round_number,item_id)
  where status='pending';

-- Geen limiet van drie pogingen: het clientrapport bevat alle foute antwoorden
-- sinds het begin van deze meldcyclus, in invoervolgorde. Een ruime technische
-- bovengrens voorkomt onbegrensde publieke RPC-payloads.
alter table public.assignment_item_reports
  drop constraint if exists assignment_item_reports_submitted_answers_check;
alter table public.assignment_item_reports
  add constraint assignment_item_reports_submitted_answers_check
  check (pg_catalog.jsonb_typeof(submitted_answers)='array'
    and pg_catalog.jsonb_array_length(submitted_answers) between 1 and 1000);
alter table public.assignment_item_reports
  drop constraint if exists assignment_item_reports_exercise_direction_check;
alter table public.assignment_item_reports
  add constraint assignment_item_reports_exercise_direction_check
  check (exercise_direction in ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl',
    'verb-nl-conj','verb-fr-conj','phrase-nl-fr','full-sentence-nl-fr',
    'grammar','number-nl-fr','number-fr-nl'));



do $constraints$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.assignment_round_items'::regclass
    and conname='mon_parcours_completion_kind_check') then
    alter table public.assignment_round_items add constraint mon_parcours_completion_kind_check
      check(completion_kind in ('correct','reported_pending','teacher_approved'));
  end if;
end; $constraints$;
create index if not exists practice_question_submissions_session_idx on public.practice_question_submissions(session_id);
create index if not exists assignment_item_reports_pending_idx on public.assignment_item_reports(assignment_id,status,created_at);


do $integrity$
declare r record;
begin
  for r in select * from (values ('assignment_item_reports','mon_parcours_report_pk','PRIMARY KEY (id)'),
('assignment_item_reports','mon_parcours_report_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE'),
('assignment_item_reports','mon_parcours_report_round_fk','FOREIGN KEY (assignment_id,student_id,round_number,item_id) REFERENCES public.assignment_round_items(assignment_id,student_id,round_number,item_id) ON DELETE CASCADE'),
('assignment_item_reports','mon_parcours_report_item_fk','FOREIGN KEY (item_id) REFERENCES public.course_item_ids(item_id) ON DELETE RESTRICT'),
('assignment_item_reports','mon_parcours_report_resolver_fk','FOREIGN KEY (resolved_by) REFERENCES auth.users(id)'),
('practice_question_submissions','mon_parcours_submission_pk','PRIMARY KEY (id)'),
('practice_question_submissions','mon_parcours_submission_uuid_unique','UNIQUE (student_id,client_submission_id)'),
('practice_question_submissions','mon_parcours_submission_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE'),
('practice_question_submissions','mon_parcours_submission_session_fk','FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE'),
('practice_question_submissions','mon_parcours_submission_round_item_fk','FOREIGN KEY (round_item_id) REFERENCES public.course_item_ids(item_id) ON DELETE RESTRICT'),
('assignment_completion_reopenings','mon_parcours_reopening_pk','PRIMARY KEY (id)'),
('assignment_completion_reopenings','mon_parcours_reopening_report_unique','UNIQUE (report_id)'),
('assignment_completion_reopenings','mon_parcours_reopening_assignment_fk','FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE'),
('assignment_completion_reopenings','mon_parcours_reopening_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT'),
('assignment_completion_reopenings','mon_parcours_reopening_report_fk','FOREIGN KEY (report_id) REFERENCES public.assignment_item_reports(id) ON DELETE RESTRICT')) e(tbl,name,def) loop
    if not exists(select 1 from pg_constraint c where c.conrelid=to_regclass('public.'||r.tbl)
      and regexp_replace(lower(pg_get_constraintdef(c.oid)),'[[:space:]]','','g')=regexp_replace(lower(r.def),'[[:space:]]','','g')) then
      execute format('alter table public.%I add constraint %I %s',r.tbl,r.name,r.def);
    end if;
  end loop;
  if exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.assignment_item_reports_one_pending_idx') and
    (not i.indisunique or not i.indisvalid or regexp_replace(pg_get_expr(i.indpred,i.indrelid),'[ ()]','','g') is distinct from 'status=''pending''::text'
      or array(select a.attname::text from unnest(i.indkey) with ordinality key(attnum,ord)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum where key.ord<=i.indnkeyatts order by key.ord)
        is distinct from array['assignment_id','student_id','round_number','item_id']))
    then raise exception 'Existing pending-report index has an incompatible definition'; end if;
  if exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.practice_question_submissions_session_idx') and
    (i.indisunique or not i.indisvalid or i.indpred is not null or
      array(select a.attname::text from unnest(i.indkey) with ordinality key(attnum,ord)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum where key.ord<=i.indnkeyatts order by key.ord)
        is distinct from array['session_id'])) then raise exception 'Existing submissions index is incompatible'; end if;
end; $integrity$;


alter table public.assignment_item_reports alter column id set not null;

alter table public.assignment_item_reports alter column assignment_id set not null;

alter table public.assignment_item_reports alter column student_id set not null;

alter table public.assignment_item_reports alter column round_number set not null;

alter table public.assignment_item_reports alter column item_id set not null;

alter table public.assignment_item_reports alter column prompt set not null;

alter table public.assignment_item_reports alter column exercise_direction set not null;

alter table public.assignment_item_reports alter column submitted_answers set not null;

alter table public.assignment_item_reports alter column accepted_answers set not null;

alter table public.assignment_item_reports alter column consulted set not null;

alter table public.assignment_item_reports alter column status set not null;

alter table public.assignment_item_reports alter column created_at set not null;

alter table public.assignment_item_reports alter column attempt_details set not null;

alter table public.practice_question_submissions alter column id set not null;

alter table public.practice_question_submissions alter column session_id set not null;

alter table public.practice_question_submissions alter column student_id set not null;

alter table public.practice_question_submissions alter column client_submission_id set not null;

alter table public.practice_question_submissions alter column variant_id set not null;

alter table public.practice_question_submissions alter column was_correct set not null;

alter table public.practice_question_submissions alter column created_at set not null;

alter table public.practice_question_submissions alter column received_at set not null;

alter table public.practice_question_submissions alter column client_evidence_ids set not null;

alter table public.practice_question_submissions alter column evidence_linked set not null;

alter table public.practice_question_submissions alter column target_results set not null;

alter table public.assignment_completion_reopenings alter column id set not null;

alter table public.assignment_completion_reopenings alter column assignment_id set not null;

alter table public.assignment_completion_reopenings alter column student_id set not null;

alter table public.assignment_completion_reopenings alter column report_id set not null;

alter table public.assignment_completion_reopenings alter column original_completion set not null;

alter table public.assignment_completion_reopenings alter column reopened_at set not null;

alter table public.practice_question_submissions alter column id set default pg_catalog.gen_random_uuid();
alter table public.practice_question_submissions alter column received_at set default pg_catalog.now();
alter table public.practice_question_submissions alter column client_evidence_ids set default '{}';
alter table public.practice_question_submissions alter column evidence_linked set default false;
alter table public.practice_question_submissions alter column target_results set default '[]';
alter table public.assignment_item_reports alter column consulted set default false;
alter table public.assignment_item_reports alter column status set default 'pending';
alter table public.assignment_item_reports alter column created_at set default pg_catalog.now();
alter table public.assignment_item_reports alter column attempt_details set default '[]';
alter table public.assignment_completion_reopenings alter column id set default pg_catalog.gen_random_uuid();
alter table public.assignment_completion_reopenings alter column reopened_at set default pg_catalog.now();

alter table public.assignment_item_reports enable row level security;
alter table public.assignment_item_reports force row level security;
revoke all on public.assignment_item_reports from public,anon,authenticated,service_role;

alter table public.practice_question_submissions enable row level security;
alter table public.practice_question_submissions force row level security;
revoke all on public.practice_question_submissions from public,anon,authenticated,service_role;

alter table public.assignment_completion_reopenings enable row level security;
alter table public.assignment_completion_reopenings force row level security;
revoke all on public.assignment_completion_reopenings from public,anon,authenticated,service_role;

create or replace function private.register_assignment_completion_pre_reports(p_assignment_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p jsonb; target integer; strategy text; completion text; required integer; reached boolean;
begin
  if coalesce(pg_catalog.current_setting('mon_parcours.defer_round_completion',true),'')=p_assignment_id::text then return; end if;
  if exists(select 1 from public.assignments a where a.id=p_assignment_id and a.completion_strategy='rounds') and
    exists(select 1 from public.assignment_item_reports r where r.assignment_id=p_assignment_id and r.student_id=p_student_id and r.status='pending')
    then return; end if;
  if exists (select 1 from public.assignment_completions c
    where c.assignment_id=p_assignment_id and c.student_id=p_student_id and c.reopened_at is null) then return; end if;
  select a.target_acquired_percentage,a.mastery_strategy,a.completion_strategy,a.required_rounds
    into target,strategy,completion,required
  from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
  join public.students s on s.class_id=ac.class_id
  where a.id=p_assignment_id and s.id=p_student_id and a.published_at is not null
    and a.status in ('published','archived');
  if target is null then return; end if;
  if completion='rounds' then
    reached:=exists(select 1 from public.assignment_rounds r
      where r.assignment_id=p_assignment_id and r.student_id=p_student_id
        and r.round_number=required and r.completed_at is not null) and not exists(select 1 from public.assignment_rounds r where r.assignment_id=p_assignment_id and r.student_id=p_student_id and r.completed_at is null);
  else
    p:=private.assignment_progress_for_student(p_assignment_id,p_student_id);
    reached:=case when strategy='item_mastery' then
      (p->>'total')::integer>0 and (p->>'practiced')::integer=(p->>'total')::integer
        and (p->>'acquired')::integer*100>=target*(p->>'total')::integer
      else coalesce((p->>'reached')::boolean,false) end;
  end if;
  if reached then
    if p is null then p:=private.assignment_progress_for_student(p_assignment_id,p_student_id); end if;
    insert into public.assignment_completions
      (assignment_id,student_id,acquired_count_at_completion,total_count_at_completion,acquired_percentage_at_completion)
    values (p_assignment_id,p_student_id,(p->>'acquired')::integer,(p->>'total')::integer,
      case when (p->>'total')::integer>0 then
        pg_catalog.round((p->>'acquired')::numeric*100/(p->>'total')::integer)::integer else 0 end)
    on conflict (assignment_id,student_id) do update set reopened_at=null;
  end if;
end;
$$;

create or replace function private.register_assignment_completion(p_assignment_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_strategy text; v_required integer;
begin
  if coalesce(pg_catalog.current_setting('mon_parcours.defer_round_completion',true),'')=p_assignment_id::text then return; end if;
  if exists(select 1 from public.assignments a where a.id=p_assignment_id and a.completion_strategy='rounds') and
    exists(select 1 from public.assignment_item_reports r where r.assignment_id=p_assignment_id and r.student_id=p_student_id and r.status='pending')
    then return; end if;
  select a.completion_strategy,a.required_rounds into v_strategy,v_required
    from public.assignments a where a.id=p_assignment_id;
  if v_strategy='rounds' then
    if exists(select 1 from public.assignment_item_reports x where x.assignment_id=p_assignment_id
      and x.student_id=p_student_id and x.status='pending') then return; end if;
    if (select count(*) from public.assignment_rounds r where r.assignment_id=p_assignment_id
      and r.student_id=p_student_id and r.completed_at is not null) < v_required then return; end if;
  end if;
  perform private.register_assignment_completion_pre_reports(p_assignment_id,p_student_id);
end;
$$;

create or replace function private.assignment_attempt_inserted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare assignment_row record;
begin
  for assignment_row in
    select distinct ai.assignment_id from public.assignment_items ai
    join public.assignment_classes ac on ac.assignment_id = ai.assignment_id
    join public.students s on s.class_id = ac.class_id
    join public.assignments a on a.id = ai.assignment_id
    where s.id = new.student_id and not exists (
      select 1 from public.assignment_completions c
      where c.assignment_id = ai.assignment_id and c.student_id = new.student_id)
      and (a.status = 'published' or
      (a.status = 'archived' and exists (select 1 from public.practice_sessions ps
        where ps.id = new.session_id and ps.assignment_id = a.id)))
      and (ai.item_id = new.item_id or ai.item_id = any(new.equivalent_item_ids))
  loop
    perform private.register_assignment_completion(assignment_row.assignment_id, new.student_id);
  end loop;
  return new;
end;
$$;

create or replace function private.ingest_practice_bundle_pre_reports_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_assignment uuid; v_strategy text; v_required integer;
  v_round integer; v_selected text[]; v_assigned text[]; v_existing text[]; v_item text;
  v_client uuid; v_session uuid; v_previous integer; v_result jsonb; v_reason text;
begin
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  if v_assignment is null then
    return private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  end if;
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s join public.classes c on c.id=s.class_id
    where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select a.completion_strategy,a.required_rounds into v_strategy,v_required
    from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
    where a.id=v_assignment and ac.class_id=v_class and a.status in ('published','archived');
  if v_strategy is null then raise exception 'invalid assignment'; end if;
  if v_strategy<>'rounds' then
    if p_session ? 'assignment_round_number' and p_session->>'assignment_round_number' is not null
      then raise exception 'legacy assignment cannot have rounds'; end if;
    return private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  end if;
  v_round:=(p_session->>'assignment_round_number')::integer;
  if v_round is null or v_round not between 1 and v_required or p_session->>'mode'<>'practice'
    or pg_catalog.jsonb_typeof(p_session->'assignment_round_selected_item_ids') is distinct from 'array'
    then raise exception 'invalid round session'; end if;
  select coalesce(pg_catalog.array_agg(value),'{}'::text[]) into v_selected
    from pg_catalog.jsonb_array_elements_text(p_session->'assignment_round_selected_item_ids');
  select coalesce(pg_catalog.array_agg(ai.item_id order by ai.item_order),'{}'::text[]) into v_assigned
    from public.assignment_items ai where ai.assignment_id=v_assignment;
  if pg_catalog.cardinality(v_selected)=0 or pg_catalog.cardinality(v_selected)>pg_catalog.cardinality(v_assigned)
    or pg_catalog.cardinality(v_selected)<>(select count(distinct x) from pg_catalog.unnest(v_selected) x)
    or exists(select 1 from pg_catalog.unnest(v_selected) x where x<>all(v_assigned))
    then raise exception 'invalid round selection'; end if;
  select r.selected_item_ids into v_existing from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round for update;
  if v_round<=2 and (pg_catalog.cardinality(v_selected)<>pg_catalog.cardinality(v_assigned)
    or exists(select 1 from pg_catalog.unnest(v_assigned) x where x<>all(v_selected)))
    then raise exception 'full round required'; end if;
  if v_existing is null and v_round>=3 and (
    pg_catalog.cardinality(v_selected)<pg_catalog.ceil(pg_catalog.cardinality(v_assigned)*0.33)::integer
    or exists(select 1 from public.assignment_round_items ri
      where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round-1
        and ri.wrong_count>0 and ri.item_id<>all(v_selected)))
    then raise exception 'review selection incomplete'; end if;
  if v_round>=3 and (
    exists(select 1 from public.assignment_round_items older
      where older.assignment_id=v_assignment and older.student_id=v_student
        and older.round_number<v_round-1 and older.wrong_count>0 and older.item_id<>all(v_selected)
        and exists(select 1 from pg_catalog.unnest(v_selected) chosen
          where not exists(select 1 from public.assignment_round_items difficult
            where difficult.assignment_id=v_assignment and difficult.student_id=v_student
              and difficult.item_id=chosen and difficult.round_number<v_round and difficult.wrong_count>0)))
    or exists(select 1 from public.assignment_round_items consulted
      where consulted.assignment_id=v_assignment and consulted.student_id=v_student
        and consulted.round_number=1 and consulted.consulted and consulted.item_id<>all(v_selected)
        and exists(select 1 from pg_catalog.unnest(v_selected) chosen
          where not exists(select 1 from public.assignment_round_items difficult
            where difficult.assignment_id=v_assignment and difficult.student_id=v_student
              and difficult.item_id=chosen and difficult.round_number<v_round and difficult.wrong_count>0)
            and not exists(select 1 from public.assignment_round_items seen
              where seen.assignment_id=v_assignment and seen.student_id=v_student
                and seen.round_number=1 and seen.item_id=chosen and seen.consulted))))
    then raise exception 'review priorities incomplete'; end if;
  if v_existing is null and v_round>1 and not exists(select 1 from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student
      and r.round_number=v_round-1 and r.completed_at is not null)
    then raise exception 'previous round incomplete'; end if;

  if v_existing is not null and v_existing<>v_selected then raise exception 'round selection is immutable'; end if;
  if v_existing is null then
    insert into public.assignment_rounds(assignment_id,student_id,round_number,selected_item_ids)
      values(v_assignment,v_student,v_round,v_selected);
    foreach v_item in array v_selected loop
      v_reason:=case when v_round<=2 then 'full_round'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number=v_round-1 and ri.item_id=v_item and ri.wrong_count>0)
          then 'previous_round_error'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number<v_round-1 and ri.item_id=v_item and ri.wrong_count>0)
          then 'historically_difficult'
        when exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
          and ri.student_id=v_student and ri.round_number=1 and ri.item_id=v_item and ri.consulted)
          then 'consulted' else 'random_sample' end;
      insert into public.assignment_round_items(assignment_id,student_id,round_number,item_id,selection_reason)
        values(v_assignment,v_student,v_round,v_item,v_reason);
    end loop;
  end if;
  if pg_catalog.jsonb_typeof(p_attempts) is distinct from 'array' or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_attempts) x
    where x.value->>'item_id'<>all(v_selected)
      or coalesce(x.value->>'mode','')<>'practice'
      or exists(select 1 from pg_catalog.jsonb_array_elements_text(coalesce(x.value->'equivalent_item_ids','[]'::jsonb)) e
        where e.value<>all(v_selected)))
    then raise exception 'attempt outside round'; end if;
  if p_session ? 'assignment_round_consulted_item_ids' and
    (pg_catalog.jsonb_typeof(p_session->'assignment_round_consulted_item_ids') is distinct from 'array' or v_round<>1
      and pg_catalog.jsonb_array_length(p_session->'assignment_round_consulted_item_ids')>0
      or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_session->'assignment_round_consulted_item_ids') x
        where x.value<>all(v_selected))) then raise exception 'invalid consultation'; end if;
  v_result:=private.ingest_practice_bundle_pre_rounds_impl(p_identity_token,p_session,p_attempts);
  v_client:=(p_session->>'client_session_id')::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=v_client for update;
  if v_session is null then raise exception 'missing session'; end if;
  update public.practice_sessions ps set assignment_round_number=v_round where ps.id=v_session
    and (ps.assignment_round_number is null or ps.assignment_round_number=v_round);
  if not found then raise exception 'session round cannot change'; end if;
  update public.assignment_round_items ri set consulted=true
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=1
      and ri.item_id in (select value from pg_catalog.jsonb_array_elements_text(
        coalesce(p_session->'assignment_round_consulted_item_ids','[]'::jsonb)));
  update public.assignment_round_items ri set wrong_count=greatest(ri.wrong_count,e.wrong_count),completed_at=coalesce(ri.completed_at,e.completed_at)
    from (select ri2.item_id,count(distinct pa.id) filter(where not pa.was_correct)::integer wrong_count,
      min(pa.created_at) filter(where pa.was_correct and pa.mode='practice') completed_at
      from public.assignment_round_items ri2
      left join public.practice_sessions ps on ps.assignment_id=ri2.assignment_id
        and ps.student_id=ri2.student_id and ps.assignment_round_number=ri2.round_number
      left join public.practice_attempts pa on pa.session_id=ps.id
        and (pa.item_id=ri2.item_id or ri2.item_id=any(pa.equivalent_item_ids))
      where ri2.assignment_id=v_assignment and ri2.student_id=v_student and ri2.round_number=v_round
      group by ri2.item_id) e
    where ri.assignment_id=v_assignment and ri.student_id=v_student
      and ri.round_number=v_round and ri.item_id=e.item_id;
  update public.assignment_rounds r set completed_at=pg_catalog.now()
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and r.completed_at is null and not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
          and ri.completed_at is null);
  perform private.register_assignment_completion(v_assignment,v_student);
  return v_result;
end;
$$;

create or replace function private.ingest_practice_bundle_pre_curated_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_student uuid; v_assignment uuid; v_round integer;
begin
  v_result:=private.ingest_practice_bundle_pre_reports_impl(p_identity_token,p_session,p_attempts);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  v_round:=nullif(p_session->>'assignment_round_number','')::integer;
  if v_assignment is null or v_round is null then return v_result; end if;
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  update public.assignment_round_items ri set completion_kind='correct'
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and ri.completed_at is not null and ri.completion_kind is null;
  update public.assignment_round_items ri set
    completed_at=coalesce(ri.completed_at,pg_catalog.now()),
    completion_kind=case when x.status='approved' then 'teacher_approved' else 'reported_pending' end
    from (select distinct on (assignment_id,student_id,round_number,item_id) *
      from public.assignment_item_reports order by assignment_id,student_id,round_number,item_id,created_at desc,id desc) x
    where x.assignment_id=v_assignment and x.student_id=v_student and x.round_number=v_round
      and x.status in ('pending','approved') and ri.assignment_id=x.assignment_id
      and ri.student_id=x.student_id and ri.round_number=x.round_number and ri.item_id=x.item_id
      and (ri.completion_kind is null or ri.completion_kind<>'correct');
  update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  perform private.register_assignment_completion(v_assignment,v_student);
  return v_result;
end;
$$;

create or replace function private.ingest_practice_bundle_pre_report_reliability_impl(
  p_identity_token text, p_session jsonb, p_attempts jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_student uuid;
  v_session uuid;
  v_submissions jsonb;
  v_submission jsonb;
  v_client_session uuid;
  v_total integer;
begin
  v_result := private.ingest_practice_bundle_pre_curated_impl(p_identity_token,p_session,p_attempts);
  if coalesce(p_session->>'exercise_key','') not like 'curated-%' and not (
    nullif(p_session->>'assignment_id','') is null and p_session->>'exercise_key' in ('number-nl-fr','number-fr-nl')
    and pg_catalog.jsonb_typeof(p_session->'question_submissions')='array'
    and pg_catalog.jsonb_array_length(p_session->'question_submissions')>0) then return v_result; end if;
  v_submissions := p_session->'question_submissions';
  if pg_catalog.jsonb_typeof(v_submissions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(v_submissions) > 5000 then
    raise exception 'invalid curated submissions';
  end if;
  v_total := nullif(p_session->>'attempt_count','')::integer;
  if v_total is null or v_total not between 0 and 10000
    or v_total <> pg_catalog.jsonb_array_length(v_submissions) then
    raise exception 'invalid curated attempt count';
  end if;
  v_client_session := (p_session->>'client_session_id')::uuid;
  select s.id into v_student from public.students s
    where s.sync_token=p_identity_token::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=v_client_session;
  if v_session is null then raise exception 'invalid curated session'; end if;

  for v_submission in select value from pg_catalog.jsonb_array_elements(v_submissions) loop
    if pg_catalog.jsonb_typeof(v_submission) is distinct from 'object'
      or coalesce(v_submission->>'client_submission_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_submission->>'variant_id','') !~ '^T[1-6]-[A-Z0-9-]+-[0-9]{3,6}$'
      or pg_catalog.jsonb_typeof(v_submission->'was_correct') is distinct from 'boolean'
      or coalesce(v_submission->>'created_at','')='' then
      raise exception 'invalid curated submission';
    end if;
    insert into public.practice_question_submissions
      (session_id,student_id,client_submission_id,variant_id,was_correct,created_at,client_evidence_ids,evidence_linked)
    values (v_session,v_student,(v_submission->>'client_submission_id')::uuid,
      v_submission->>'variant_id',(v_submission->>'was_correct')::boolean,
      (v_submission->>'created_at')::timestamptz,
      array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
        where e.value->>'client_submission_id'=v_submission->>'client_submission_id'),
      not exists(select 1 from jsonb_array_elements(p_attempts) e where e.value->>'legacy_item_id'=v_submission->>'variant_id'
        and not (e.value ? 'client_submission_id')))
    on conflict (student_id,client_submission_id) do nothing;
    if exists(select 1 from public.practice_question_submissions stored
      where stored.student_id=v_student and stored.client_submission_id=(v_submission->>'client_submission_id')::uuid
        and (stored.session_id<>v_session or stored.variant_id<>v_submission->>'variant_id'
          or stored.was_correct<>(v_submission->>'was_correct')::boolean
          or stored.created_at<>(v_submission->>'created_at')::timestamptz)) then
      raise exception 'submission UUID reused with different content';
    end if;
  end loop;

  update public.practice_sessions ps set
    attempt_count=totals.attempt_count,
    correct_count=totals.correct_count,
    incorrect_count=totals.incorrect_count,
    updated_at=pg_catalog.now()
  from (
    select count(*)::integer attempt_count,
      count(*) filter (where was_correct)::integer correct_count,
      count(*) filter (where not was_correct)::integer incorrect_count
    from public.practice_question_submissions where session_id=v_session
  ) totals where ps.id=v_session;
  return v_result || pg_catalog.jsonb_build_object(
    'attempt_count',(select ps.attempt_count from public.practice_sessions ps where ps.id=v_session)
  );
end;
$$;

create or replace function private.ingest_practice_bundle_impl(p_identity_token text,p_session jsonb,p_attempts jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_student uuid; v_assignment uuid; v_round integer; v_report record;
  v_correct timestamptz; v_session uuid; v_submission jsonb; v_submissions jsonb;
  v_reopen_report uuid; v_previous_defer text;
begin
  v_previous_defer:=pg_catalog.current_setting('mon_parcours.defer_round_completion',true);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  if v_assignment is not null and nullif(p_session->>'assignment_round_number','') is not null then
    perform pg_catalog.set_config('mon_parcours.defer_round_completion',v_assignment::text,true);
  end if;
  v_result:=private.ingest_practice_bundle_pre_report_reliability_impl(p_identity_token,p_session,p_attempts);
  perform pg_catalog.set_config('mon_parcours.defer_round_completion',coalesce(v_previous_defer,''),true);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  v_round:=nullif(p_session->>'assignment_round_number','')::integer;
  if v_assignment is null or v_round is null then return v_result; end if;
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select ps.id into v_session from public.practice_sessions ps
    where ps.student_id=v_student and ps.client_session_id=(p_session->>'client_session_id')::uuid;
  if v_session is null then raise exception 'missing assignment session'; end if;
  v_submissions:=coalesce(p_session->'question_submissions','[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_submissions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(v_submissions)>5000 then
    raise exception 'invalid assignment submissions'; end if;
  for v_submission in select value from pg_catalog.jsonb_array_elements(v_submissions) loop
    if pg_catalog.jsonb_typeof(v_submission) is distinct from 'object'
      or coalesce(v_submission->>'client_submission_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_submission->>'variant_id','') !~ '^T[1-6]-[A-Z0-9-]+-[0-9]{3,6}$'
      or pg_catalog.jsonb_typeof(v_submission->'was_correct') is distinct from 'boolean'
      or coalesce(v_submission->>'created_at','')=''
      or jsonb_typeof(coalesce(v_submission->'target_results','[]'::jsonb)) is distinct from 'array'
      or jsonb_array_length(coalesce(v_submission->'target_results','[]'::jsonb))>20
      or jsonb_array_length(coalesce(v_submission->'target_results','[]'::jsonb))<>(select count(distinct target.value->>'item_id')
        from jsonb_array_elements(coalesce(v_submission->'target_results','[]'::jsonb)) target)
      or exists(select 1 from jsonb_array_elements(coalesce(v_submission->'target_results','[]'::jsonb)) target
        where jsonb_typeof(target.value->'was_correct') is distinct from 'boolean'
          or not exists(select 1 from public.assignment_round_items allowed where allowed.assignment_id=v_assignment
            and allowed.student_id=v_student and allowed.round_number=v_round and allowed.item_id=target.value->>'item_id')
          or target.value->>'item_id'=v_submission->>'item_id' and target.value->'was_correct' is distinct from v_submission->'was_correct'
          or v_submission->'was_correct'='true'::jsonb and target.value->'was_correct'='false'::jsonb)
      or not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=v_assignment and ri.student_id=v_student
          and ri.round_number=v_round and ri.item_id=v_submission->>'item_id')
      or not exists(select 1 from public.assignments a where a.id=v_assignment
        and (a.include_integrative_sentences=true or a.use_exercise_variants=true))
      then raise exception 'invalid assignment submission'; end if;
    insert into public.practice_question_submissions
      (session_id,student_id,client_submission_id,variant_id,round_item_id,was_correct,created_at,client_evidence_ids,evidence_linked,target_results)
    values (v_session,v_student,(v_submission->>'client_submission_id')::uuid,
      v_submission->>'variant_id',v_submission->>'item_id',
      (v_submission->>'was_correct')::boolean,(v_submission->>'created_at')::timestamptz,
      array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
        where e.value->>'client_submission_id'=v_submission->>'client_submission_id'),
      not exists(select 1 from jsonb_array_elements(p_attempts) e where e.value->>'legacy_item_id'=v_submission->>'variant_id'
        and not (e.value ? 'client_submission_id')),coalesce(v_submission->'target_results','[]'::jsonb))
    on conflict (student_id,client_submission_id) do nothing;
    if exists(select 1 from public.practice_question_submissions stored
      where stored.student_id=v_student and stored.client_submission_id=(v_submission->>'client_submission_id')::uuid
        and (stored.session_id<>v_session or stored.variant_id<>v_submission->>'variant_id'
          or stored.was_correct<>(v_submission->>'was_correct')::boolean
          or stored.created_at<>(v_submission->>'created_at')::timestamptz
          or stored.round_item_id is distinct from v_submission->>'item_id'
          or stored.target_results is distinct from coalesce(v_submission->'target_results','[]'::jsonb)
          or stored.client_evidence_ids is distinct from array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
            where e.value->>'client_submission_id'=v_submission->>'client_submission_id')))  then
      raise exception 'submission UUID reused with different content';
    end if;
  end loop;
  if pg_catalog.jsonb_array_length(v_submissions)>0 then
    update public.assignment_round_items ri set wrong_count=counts.wrong_count
      from (select selected.item_id,
        (select count(distinct pa.id)::integer from public.practice_attempts pa
          join public.practice_sessions ps on ps.id=pa.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student
            and ps.assignment_round_number=v_round and pa.item_id=selected.item_id
            and pa.was_correct=false
      and not exists(select 1 from public.practice_question_submissions linked
        where linked.session_id=pa.session_id and (pa.client_attempt_id=any(linked.client_evidence_ids) or not linked.evidence_linked and linked.variant_id=pa.legacy_item_id and (linked.round_item_id is null or linked.round_item_id=pa.item_id)))) +
        (select count(*)::integer from public.practice_question_submissions q
          join public.practice_sessions ps on ps.id=q.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student
            and ps.assignment_round_number=v_round and (q.round_item_id=selected.item_id or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=selected.item_id and target.value->'was_correct'='false'::jsonb))
            and q.was_correct=false) as wrong_count
        from public.assignment_round_items selected
        where selected.assignment_id=v_assignment and selected.student_id=v_student
          and selected.round_number=v_round) counts
      where ri.assignment_id=v_assignment and ri.student_id=v_student
        and ri.round_number=v_round and ri.item_id=counts.item_id;
    update public.practice_sessions ps set
      attempt_count=totals.attempt_count,correct_count=totals.correct_count,
      incorrect_count=totals.incorrect_count,updated_at=pg_catalog.now()
    from (select
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)))) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session)
        as attempt_count,
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and pa.was_correct and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)))) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session
        and q.was_correct) as correct_count,
      (select count(*)::integer from public.practice_attempts pa where pa.session_id=v_session
        and not pa.was_correct and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=v_session and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)))) +
      (select count(*)::integer from public.practice_question_submissions q where q.session_id=v_session
        and not q.was_correct) as incorrect_count) totals where ps.id=v_session;
  end if;
  update public.assignment_round_items ri set
    completed_at=case when ri.completion_kind in ('reported_pending','teacher_approved') then ri.completed_at else (
      select min(correct_at) from (
        select q.created_at correct_at from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
            and (q.round_item_id=ri.item_id and q.was_correct or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=ri.item_id and target.value->'was_correct'='true'::jsonb))
        union all select pa.created_at from public.practice_attempts pa join public.practice_sessions ps on ps.id=pa.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
            and (pa.item_id=ri.item_id or ri.item_id=any(pa.equivalent_item_ids)) and pa.was_correct
            and not exists(select 1 from public.practice_question_submissions q
              where q.session_id=pa.session_id and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)))
      ) correct_questions) end
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and exists(select 1 from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
        where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round and (q.round_item_id=ri.item_id or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=ri.item_id)));
  for v_report in select latest.item_id,latest.resolved_at from (
    select distinct on (r.item_id) r.item_id,r.status,r.resolved_at
    from public.assignment_item_reports r where r.assignment_id=v_assignment
      and r.student_id=v_student and r.round_number=v_round
    order by r.item_id,r.created_at desc,r.id desc) latest
    where latest.status='rejected' loop
    select min(pa.created_at) into v_correct from public.practice_attempts pa
      join public.practice_sessions ps on ps.id=pa.session_id
      where ps.assignment_id=v_assignment and ps.student_id=v_student
        and ps.assignment_round_number=v_round and pa.was_correct=true
        and (pa.item_id=v_report.item_id or v_report.item_id=any(pa.equivalent_item_ids))
        and pa.created_at>v_report.resolved_at
        and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=pa.session_id and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)));
    select least(v_correct,min(q.created_at)) into v_correct
      from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
      where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
        and (q.round_item_id=v_report.item_id and q.was_correct or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=v_report.item_id and target.value->'was_correct'='true'::jsonb)) and q.created_at>v_report.resolved_at;
    update public.assignment_round_items ri set completed_at=v_correct,
      completion_kind=case when v_correct is null then null else 'correct' end
      where ri.assignment_id=v_assignment and ri.student_id=v_student
        and ri.round_number=v_round and ri.item_id=v_report.item_id;
  end loop;
  update public.assignment_round_items ri set completion_kind=case when completed_at is null then null
    when completion_kind in ('reported_pending','teacher_approved') then completion_kind else 'correct' end
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round;
  update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  update public.assignment_rounds r set completed_at=null
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  -- De oude ingest kan in dezelfde transactie een verouderde completion
  -- opnieuw afleiden. Die ongeldige afgeleide rij hoort niet te blijven staan.
  select r.id into v_reopen_report from public.assignment_item_reports r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.status='rejected'
    order by r.resolved_at desc,r.id desc limit 1;
  if v_reopen_report is not null and exists(select 1 from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.completed_at is null) then
    insert into public.assignment_completion_reopenings(assignment_id,student_id,report_id,original_completion)
      select c.assignment_id,c.student_id,v_reopen_report,to_jsonb(c)
      from public.assignment_completions c where c.assignment_id=v_assignment
        and c.student_id=v_student on conflict (report_id) do nothing;
    update public.assignment_completions c set reopened_at=coalesce(c.reopened_at,pg_catalog.now()) where c.assignment_id=v_assignment
      and c.student_id=v_student;
  end if;
  update public.assignment_completions c set reopened_at=coalesce(c.reopened_at,pg_catalog.now())
    where c.assignment_id=v_assignment and c.student_id=v_student
      and exists(select 1 from public.assignment_rounds r where r.assignment_id=c.assignment_id
        and r.student_id=c.student_id and r.completed_at is null);
  if not exists(select 1 from public.assignment_item_reports x where x.assignment_id=v_assignment
    and x.student_id=v_student and x.status='pending') then
    perform private.register_assignment_completion(v_assignment,v_student);
  end if;
  return v_result || pg_catalog.jsonb_build_object('attempt_count',
    (select ps.attempt_count from public.practice_sessions ps where ps.id=v_session));
end;
$$;

create or replace function private.get_student_assignments_pre_reports_impl(p_identity_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_rounds_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'completion_strategy',a.completion_strategy,'required_rounds',a.required_rounds,
    'item_verb_exercise_key',a.item_verb_exercise_key,
    'rounds',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'number',r.round_number,'selected_item_ids',r.selected_item_ids,
      'selection_reasons',(select coalesce(pg_catalog.jsonb_object_agg(ri.item_id,ri.selection_reason),'{}'::jsonb)
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number),
      'random_sample_item_ids',(select coalesce(pg_catalog.array_agg(ri.item_id order by array_position(r.selected_item_ids,ri.item_id)),'{}'::text[])
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.selection_reason='random_sample'),
      'items',(select coalesce(pg_catalog.jsonb_object_agg(ri.item_id,pg_catalog.jsonb_build_object(
        'wrong_count',ri.wrong_count,'consulted',ri.consulted,'completed_at',ri.completed_at,'completion_kind',ri.completion_kind)),'{}'::jsonb)
        from public.assignment_round_items ri where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number)) order by r.round_number),'[]'::jsonb)
      from public.assignment_rounds r where r.assignment_id=a.id and r.student_id=v_student)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

create or replace function private.get_student_assignments_pre_report_reliability_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_student uuid; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_reports_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object('reports',
    (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('round_number',r.round_number,
      'item_id',r.item_id,'status',r.status)),'[]'::jsonb)
      from public.assignment_item_reports r where r.assignment_id=(x.value->>'id')::uuid
        and r.student_id=v_student)) order by x.ord),'[]'::jsonb) into v_rows
    from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

create or replace function private.get_student_assignments_pre_sentences_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_student uuid; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_report_reliability_impl(p_identity_token);
  select s.id into v_student from public.students s where s.sync_token=p_identity_token::uuid;
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object('reports',
    (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('round_number',r.round_number,
      'item_id',r.item_id,'status',r.status,'resolved_at',r.resolved_at)),'[]'::jsonb)
      from (select distinct on (ar.round_number,ar.item_id) ar.round_number,ar.item_id,
        ar.status,ar.resolved_at from public.assignment_item_reports ar
        where ar.assignment_id=(x.value->>'id')::uuid and ar.student_id=v_student
        order by ar.round_number,ar.item_id,ar.created_at desc,ar.id desc) r)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

create or replace function private.get_student_assignments_impl(p_identity_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_student_assignments_pre_sentences_impl(p_identity_token);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'use_exercise_variants',a.use_exercise_variants,'include_integrative_sentences',a.include_integrative_sentences,'exercise_forms',a.exercise_forms) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

create or replace function private.save_assignment_pre_sentences_impl(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old public.assignments%rowtype; v_strategy text; v_rounds integer;
  v_verb_key text; v_result jsonb;
begin
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is not null then select * into v_old from public.assignments where id=v_id; end if;
  v_strategy:=coalesce(nullif(p_payload->>'completion_strategy',''),
    case when v_id is not null then v_old.completion_strategy
      when coalesce(p_payload->>'mastery_strategy','item_mastery')='item_mastery' then 'rounds'
      else p_payload->>'mastery_strategy' end);
  v_rounds:=coalesce((p_payload->>'required_rounds')::integer,case when v_id is not null then v_old.required_rounds else 3 end);
  v_verb_key:=coalesce(nullif(p_payload->>'item_verb_exercise_key',''),
    case when v_id is not null then v_old.item_verb_exercise_key else 'verb-nl-conj' end);
  if v_strategy not in ('legacy_mastery','rounds','verb_rule_mastery','irregular_verb_mastery','mixed_verb_mastery')
    or v_rounds not between 1 and 4
    or v_verb_key not in ('verb-nl-inf','verb-nl-conj','verb-fr-conj')
    or (v_strategy in ('rounds','legacy_mastery')) is distinct from
      (coalesce(p_payload->>'mastery_strategy',v_old.mastery_strategy,'item_mastery')='item_mastery')
    then raise exception 'invalid completion strategy'; end if;
  if v_id is null and v_strategy='legacy_mastery' then
    raise exception 'new item assignments require rounds'; end if;
  if v_id is not null and (v_old.completion_strategy<>'rounds' and v_old.completion_strategy is distinct from v_strategy
    or v_old.status<>'draft' and (v_old.completion_strategy is distinct from v_strategy
      or v_old.required_rounds is distinct from v_rounds or v_old.item_verb_exercise_key is distinct from v_verb_key)) then
    raise exception 'create a new assignment to change completion strategy or rounds'; end if;
  v_result:=private.save_assignment_pre_rounds_impl(p_payload);
  update public.assignments set completion_strategy=v_strategy,required_rounds=v_rounds,
    item_verb_exercise_key=v_verb_key
    where id=(v_result->>'id')::uuid;
  return v_result;
end;
$$;

create or replace function private.save_assignment_impl(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_old public.assignments%rowtype; v_enabled boolean; v_variants boolean; v_forms jsonb; v_result jsonb;
begin
  v_id:=nullif(p_payload->>'id','')::uuid;
  if v_id is not null then select * into v_old from public.assignments where id=v_id; end if;
  v_enabled:=coalesce((p_payload->>'include_integrative_sentences')::boolean,
    v_old.include_integrative_sentences,false);
  if v_enabled and coalesce(p_payload->>'completion_strategy',v_old.completion_strategy,'rounds')<>'rounds'
    then raise exception 'full sentences require rounds'; end if;
  if v_id is not null and v_old.status<>'draft'
    and v_old.include_integrative_sentences is distinct from v_enabled
    then raise exception 'published sentence mode is immutable'; end if;
  v_variants:=coalesce((p_payload->>'use_exercise_variants')::boolean,v_old.use_exercise_variants,false);
  if v_variants and coalesce(p_payload->>'completion_strategy',v_old.completion_strategy,'rounds')<>'rounds'
    then raise exception 'variants require rounds'; end if;
  if v_id is not null and v_old.status<>'draft' and v_old.use_exercise_variants is distinct from v_variants
    then raise exception 'published variant mode is immutable'; end if;
  v_forms:=coalesce(p_payload->'exercise_forms',v_old.exercise_forms);
  if v_forms is not null then
    if pg_catalog.jsonb_typeof(v_forms) is distinct from 'array'
      then raise exception 'exercise_forms must be an array'; end if;
    if pg_catalog.jsonb_array_length(v_forms) not between 1 and 13
      then raise exception 'exercise_forms count is invalid'; end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(v_forms) e(value)
      where pg_catalog.jsonb_typeof(e.value) is distinct from 'string' or e.value #>> '{}' not in
      ('vocab_direct','vocab_context','verb_conjugation','verb_context','grammar_rule','grammar_context',
       'grammar_mixed','phrase_direct','actes_context','number_direct','number_dynamic','spelling_context','revision_integrative'))
      then raise exception 'Unknown exercise form'; end if;
    if (select count(*) from pg_catalog.jsonb_array_elements_text(v_forms)) is distinct from
       (select count(distinct value) from pg_catalog.jsonb_array_elements_text(v_forms) e(value))
      then raise exception 'Duplicate exercise form'; end if;
    if coalesce(p_payload->>'completion_strategy',v_old.completion_strategy,'rounds')<>'rounds'
      then raise exception 'exercise_forms require rounds'; end if;
  end if;
  if v_id is not null and v_old.status<>'draft' and v_old.exercise_forms is distinct from v_forms
    then raise exception 'published exercise forms are immutable'; end if;
  v_result:=private.save_assignment_pre_sentences_impl(p_payload);
  update public.assignments a set include_integrative_sentences=v_enabled,use_exercise_variants=v_variants,exercise_forms=v_forms
    where a.id=(v_result->>'id')::uuid;
  return v_result;
end;
$$;

create or replace function private.get_teacher_assignments_pre_lifecycle_impl() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignments_pre_rounds_impl();
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'completion_strategy',a.completion_strategy,'required_rounds',a.required_rounds,
    'item_verb_exercise_key',a.item_verb_exercise_key) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

create or replace function private.assignment_auto_archive_grace_days()
returns integer language sql stable security invoker set search_path = '' as $$
  select 7;
$$;

create or replace function private.restore_assignment_impl(p_assignment_id uuid)
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

create or replace function private.get_teacher_assignments_pre_sentences_impl()
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

create or replace function private.get_teacher_assignments_impl()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignments_pre_sentences_impl();
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'use_exercise_variants',a.use_exercise_variants,'include_integrative_sentences',a.include_integrative_sentences,'exercise_forms',a.exercise_forms) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord)
    join public.assignments a on a.id=(x.value->>'id')::uuid;
  return v_rows;
end;
$$;

create or replace function private.get_teacher_assignment_detail_pre_reopen_impl(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignment_detail_pre_rounds_impl(p_assignment_id);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'round_progress',(select pg_catalog.jsonb_build_object('round_number',r.round_number,
      'required_rounds',a.required_rounds,'total',pg_catalog.cardinality(r.selected_item_ids),
      'completed',(select count(*) from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is not null))
      from public.assignment_rounds r join public.assignments a on a.id=r.assignment_id
      where r.assignment_id=p_assignment_id and r.student_id=(x.value->>'student_id')::uuid
      order by r.round_number desc limit 1)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

create or replace function private.get_teacher_assignment_detail_impl(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_old jsonb; v_rows jsonb;
begin
  v_old:=private.get_teacher_assignment_detail_pre_reopen_impl(p_assignment_id);
  select coalesce(pg_catalog.jsonb_agg(x.value||pg_catalog.jsonb_build_object(
    'round_progress',(select pg_catalog.jsonb_build_object(
      'round_number',r.round_number,'required_rounds',a.required_rounds,
      'total',pg_catalog.cardinality(r.selected_item_ids),
      'completed',(select count(*) from public.assignment_round_items ri
        where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.completed_at is not null))
      from public.assignment_rounds r join public.assignments a on a.id=r.assignment_id
      where r.assignment_id=p_assignment_id and r.student_id=(x.value->>'student_id')::uuid
      order by case when r.completed_at is null then 0 else 1 end,
        case when r.completed_at is null then r.round_number else -r.round_number end
      limit 1)) order by x.ord),'[]'::jsonb)
    into v_rows from pg_catalog.jsonb_array_elements(v_old) with ordinality as x(value,ord);
  return v_rows;
end;
$$;

create or replace function private.get_class_activity_monitor_pre_curated_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  if p_class_id is not null and not private.teacher_has_class_access(p_class_id)
    then raise exception 'class access denied'; end if;
  if coalesce(p_include_mastery,false) and p_class_id is null
    then raise exception 'choose one class for mastery'; end if;
  if p_period_start is not null and p_period_end is not null and p_period_start>=p_period_end
    then raise exception 'invalid period'; end if;
  if p_trajectory is not null and pg_catalog.char_length(p_trajectory)>80 or
     p_mode is not null and p_mode not in ('learn','practice','test') or
     p_category is not null and pg_catalog.char_length(p_category)>120 or
     p_subsection is not null and pg_catalog.char_length(p_subsection)>160
     or p_student_status is not null and p_student_status not in ('active','inactive','all')
    then raise exception 'invalid monitor filter'; end if;

  with allowed_students as (
    select s.id,s.class_id,s.display_name,s.is_active
    from public.students s join public.classes c on c.id=s.class_id
    where c.is_active=true
      and (coalesce(p_student_status,'active')='all'
        or p_student_status='inactive' and s.is_active=false
        or coalesce(p_student_status,'active')='active' and s.is_active=true)
      and (p_class_id is null or s.class_id=p_class_id)
      and private.teacher_has_class_access(s.class_id)
  ), scoped_sessions as (
    select ps.* from public.practice_sessions ps
    join allowed_students s on s.id=ps.student_id
    where (p_trajectory is null or ps.trajectory=p_trajectory)
      and (p_mode is null or ps.mode=p_mode)
      and (p_category is null or ps.top_category=p_category)
      and (p_subsection is null or ps.subsection=p_subsection)
      and (p_assignment_id is null or ps.assignment_id=p_assignment_id)
  ), period_sessions as (
    select ps.* from scoped_sessions ps
    where (p_period_start is null or ps.started_at>=p_period_start)
      and (p_period_end is null or ps.started_at<p_period_end)
  ), period_attempts as (
    select pa.student_id,pa.session_id,pa.item_id,pa.item_variant,pa.mode,
      pa.was_correct,pa.created_at
    from public.practice_attempts pa join scoped_sessions ps on ps.id=pa.session_id
    where (p_period_start is null or pa.created_at>=p_period_start)
      and (p_period_end is null or pa.created_at<p_period_end)
  ), attempt_totals as (
    select student_id,
      count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer unique_exercises,
      count(*)::integer attempt_count,
      count(*) filter(where mode in ('practice','test'))::integer independent_attempts,
      count(*) filter(where mode in ('practice','test') and was_correct)::integer independent_correct,
      max(created_at) last_attempt_at
    from period_attempts group by student_id
  ), session_totals as (
    select student_id,
      -- Alleen sessies die in deze periode begonnen: de huidige tabel heeft
      -- geen tijdlijn om één sessie exact over twee perioden te splitsen.
      coalesce(sum(greatest(0,active_duration_seconds)),0)::bigint active_seconds,
      max(started_at) last_started_at,
      max(finished_at) filter(where (p_period_start is null or finished_at>=p_period_start)
        and (p_period_end is null or finished_at<p_period_end)) last_finished_at
    from period_sessions group by student_id
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'student_id',s.id,'class_id',s.class_id,'display_name',s.display_name,'is_active',s.is_active,
    'unique_exercises',coalesce(at.unique_exercises,0),
    'attempt_count',coalesce(at.attempt_count,0),
    'independent_attempts',coalesce(at.independent_attempts,0),
    'independent_correct',coalesce(at.independent_correct,0),
    'active_seconds',coalesce(st.active_seconds,0),
    'last_activity_at',greatest(at.last_attempt_at,st.last_started_at,st.last_finished_at),
    'recent_open_session',exists (
      select 1 from scoped_sessions live
      where live.student_id=s.id and live.finished_at is null
        and (live.started_at>=pg_catalog.now()-interval '180 seconds' or exists (
          select 1 from public.practice_attempts recent
          where recent.session_id=live.id and recent.created_at>=pg_catalog.now()-interval '180 seconds'))),
    'current_mastery_percentage',case when coalesce(p_include_mastery,false)
      then private.student_current_mastery_percentage(s.id) else null end,
    'active_assignment_count',(
      select count(*) from public.assignments a
      join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=s.class_id
      left join public.assignment_completions done on done.assignment_id=a.id and done.student_id=s.id and done.reopened_at is null
      where a.status='published' and done.completed_at is null),
    'active_assignment',(
      select pg_catalog.jsonb_build_object('id',a.id,'title',a.title,'due_at',a.due_at,
        'mastery_strategy',a.mastery_strategy,
        'mastery_percentage',(private.assignment_progress_for_student(a.id,s.id)->>'mastery_level')::integer)
      from public.assignments a
      join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=s.class_id
      left join public.assignment_completions done on done.assignment_id=a.id and done.student_id=s.id and done.reopened_at is null
      where a.status='published' and done.completed_at is null
      order by a.due_at nulls last,a.created_at limit 1)
    ) order by s.class_id,s.display_name),'[]'::jsonb) into v_rows
  from allowed_students s
  left join attempt_totals at on at.student_id=s.id
  left join session_totals st on st.student_id=s.id;
  return v_rows;
end;
$$;

create or replace function private.get_class_activity_monitor_pre_sentences_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_base jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_student uuid;
  v_evidence_unique integer;
  v_evidence_attempts integer;
  v_evidence_independent integer;
  v_evidence_correct integer;
  v_question_unique integer;
  v_question_attempts integer;
  v_question_independent integer;
  v_question_correct integer;
  v_last_question timestamptz;
  v_recent_question boolean;
begin
  -- De oude SECURITY DEFINER-functie handhaaft docent- en klastoegang en
  -- levert alleen leerlingen op die deze docent in dit filter mag zien.
  v_base := private.get_class_activity_monitor_pre_curated_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
  for v_row in select value from pg_catalog.jsonb_array_elements(v_base) loop
    v_student := (v_row->>'student_id')::uuid;
    with scoped_sessions as (
      select ps.id,ps.mode,ps.started_at,ps.finished_at
      from public.practice_sessions ps
      where ps.student_id=v_student and (ps.exercise_key like 'curated-%' or ps.assignment_id is null and
        exists(select 1 from public.practice_question_submissions q where q.session_id=ps.id))
        and (p_trajectory is null or ps.trajectory=p_trajectory)
        and (p_mode is null or ps.mode=p_mode)
        and (p_category is null or ps.top_category=p_category)
        and (p_subsection is null or ps.subsection=p_subsection)
        and (p_assignment_id is null or ps.assignment_id=p_assignment_id)
    ), evidence as (
      select pa.session_id,pa.item_id,pa.item_variant,pa.was_correct,ps.mode
      from public.practice_attempts pa join scoped_sessions ps on ps.id=pa.session_id
      where (p_period_start is null or pa.created_at>=p_period_start)
        and (p_period_end is null or pa.created_at<p_period_end)
    ), questions as (
      select q.session_id,q.variant_id,q.was_correct,q.created_at,ps.mode,
        ps.started_at,ps.finished_at
      from public.practice_question_submissions q
      join scoped_sessions ps on ps.id=q.session_id
      where (p_period_start is null or q.created_at>=p_period_start)
        and (p_period_end is null or q.created_at<p_period_end)
    )
    select
      (select count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer from evidence),
      (select count(*)::integer from evidence),
      (select count(*)::integer from evidence where mode in ('practice','test')),
      (select count(*)::integer from evidence where mode in ('practice','test') and was_correct),
      (select count(distinct (session_id,variant_id))::integer from questions),
      (select count(*)::integer from questions),
      (select count(*)::integer from questions where mode in ('practice','test')),
      (select count(*)::integer from questions where mode in ('practice','test') and was_correct),
      (select max(created_at) from questions),
      (select exists (
        select 1 from questions where finished_at is null
          and created_at>=pg_catalog.now()-interval '180 seconds'))
    into v_evidence_unique,v_evidence_attempts,v_evidence_independent,v_evidence_correct,
      v_question_unique,v_question_attempts,v_question_independent,v_question_correct,
      v_last_question,v_recent_question;

    v_row := v_row || pg_catalog.jsonb_build_object(
      'unique_exercises',greatest(0,(v_row->>'unique_exercises')::integer-v_evidence_unique+v_question_unique),
      'attempt_count',greatest(0,(v_row->>'attempt_count')::integer-v_evidence_attempts+v_question_attempts),
      'independent_attempts',greatest(0,(v_row->>'independent_attempts')::integer-v_evidence_independent+v_question_independent),
      'independent_correct',greatest(0,(v_row->>'independent_correct')::integer-v_evidence_correct+v_question_correct),
      'last_activity_at',greatest((v_row->>'last_activity_at')::timestamptz,v_last_question),
      'recent_open_session',coalesce((v_row->>'recent_open_session')::boolean,false) or v_recent_question
    );
    v_rows := v_rows || pg_catalog.jsonb_build_array(v_row);
  end loop;
  return v_rows;
end;
$$;

create or replace function private.get_class_activity_monitor_impl(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_base jsonb; v_rows jsonb:='[]'::jsonb; v_row jsonb; v_student uuid;
  v_evidence_unique integer; v_evidence_attempts integer; v_evidence_correct integer;
  v_question_unique integer; v_question_attempts integer; v_question_correct integer;
  v_last_question timestamptz; v_recent_question boolean;
begin
  v_base:=private.get_class_activity_monitor_pre_sentences_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
  for v_row in select value from pg_catalog.jsonb_array_elements(v_base) loop
    v_student:=(v_row->>'student_id')::uuid;
    with scoped_sessions as (
      select ps.id,ps.mode,ps.started_at,ps.finished_at
      from public.practice_sessions ps join public.assignments a on a.id=ps.assignment_id
      where ps.student_id=v_student and ps.exercise_key='assignment-mixed'
        and (a.include_integrative_sentences=true or a.use_exercise_variants=true)
        and (p_trajectory is null or ps.trajectory=p_trajectory)
        and (p_mode is null or ps.mode=p_mode)
        and (p_category is null or ps.top_category=p_category)
        and (p_subsection is null or ps.subsection=p_subsection)
        and (p_assignment_id is null or ps.assignment_id=p_assignment_id)
    ), evidence as (
      select pa.session_id,pa.item_id,pa.item_variant,pa.was_correct,ps.mode
      from public.practice_attempts pa join scoped_sessions ps on ps.id=pa.session_id
      where (p_period_start is null or pa.created_at>=p_period_start)
        and (p_period_end is null or pa.created_at<p_period_end)
        and exists(select 1 from public.practice_question_submissions q
          where q.session_id=pa.session_id and (pa.client_attempt_id=any(q.client_evidence_ids) or not q.evidence_linked and q.variant_id=pa.legacy_item_id and (q.round_item_id is null or q.round_item_id=pa.item_id)))
    ), questions as (
      select q.session_id,q.variant_id,q.round_item_id,q.was_correct,q.created_at,
        ps.mode,ps.finished_at from public.practice_question_submissions q
      join scoped_sessions ps on ps.id=q.session_id
      where q.round_item_id is not null
        and (p_period_start is null or q.created_at>=p_period_start)
        and (p_period_end is null or q.created_at<p_period_end)
    )
    select
      (select count(distinct (session_id,item_id,coalesce(item_variant,'')))::integer from evidence),
      (select count(*)::integer from evidence),
      (select count(*)::integer from evidence where was_correct),
      (select count(distinct (session_id,variant_id,round_item_id))::integer from questions),
      (select count(*)::integer from questions),
      (select count(*)::integer from questions where was_correct),
      (select max(created_at) from questions),
      (select exists(select 1 from questions where finished_at is null
        and created_at>=pg_catalog.now()-interval '180 seconds'))
    into v_evidence_unique,v_evidence_attempts,v_evidence_correct,
      v_question_unique,v_question_attempts,v_question_correct,v_last_question,v_recent_question;
    v_row:=v_row||pg_catalog.jsonb_build_object(
      'unique_exercises',greatest(0,(v_row->>'unique_exercises')::integer-v_evidence_unique+v_question_unique),
      'attempt_count',greatest(0,(v_row->>'attempt_count')::integer-v_evidence_attempts+v_question_attempts),
      'independent_attempts',greatest(0,(v_row->>'independent_attempts')::integer-v_evidence_attempts+v_question_attempts),
      'independent_correct',greatest(0,(v_row->>'independent_correct')::integer-v_evidence_correct+v_question_correct),
      'last_activity_at',greatest((v_row->>'last_activity_at')::timestamptz,v_last_question),
      'recent_open_session',coalesce((v_row->>'recent_open_session')::boolean,false) or v_recent_question);
    v_rows:=v_rows||pg_catalog.jsonb_build_array(v_row);
  end loop;
  return v_rows;
end;
$$;

create or replace function private.report_assignment_item_impl(p_identity_token text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_assignment uuid; v_round integer; v_item text;
  v_id uuid; v_wrong integer; v_direction text; v_last_resolved timestamptz;
  v_existing_status text;
begin
  if p_identity_token is null or p_identity_token !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid report'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s
    join public.classes c on c.id=s.class_id
    where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  v_assignment:=(p_payload->>'assignment_id')::uuid;
  v_round:=(p_payload->>'round_number')::integer;
  v_item:=p_payload->>'item_id';
  v_id:=(p_payload->>'client_report_id')::uuid;
  v_direction:=p_payload->>'exercise_direction';
  if v_round not between 1 and 4 or v_item is null or v_id is null
    or not exists(select 1 from public.assignments a join public.assignment_classes ac on ac.assignment_id=a.id
      where a.id=v_assignment and ac.class_id=v_class and a.completion_strategy='rounds'
        and a.status in ('published','archived'))
    or not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=v_assignment
      and ri.student_id=v_student and ri.round_number=v_round and ri.item_id=v_item)
    or pg_catalog.jsonb_typeof(p_payload->'submitted_answers') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_payload->'submitted_answers') not between 1 and 1000
    or pg_catalog.jsonb_typeof(p_payload->'accepted_answers') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_payload->'accepted_answers') not between 1 and 20
    or pg_catalog.char_length(coalesce(p_payload->>'prompt','')) not between 1 and 500
    or pg_catalog.char_length(coalesce(p_payload->>'app_version',''))>64
    or pg_catalog.char_length(coalesce(p_payload->>'variant_id',''))>120
    or pg_catalog.char_length(coalesce(p_payload->>'exercise_type',''))>40
    or pg_catalog.char_length(coalesce(p_payload->>'model_answer',''))>2000
    or pg_catalog.jsonb_typeof(coalesce(p_payload->'attempt_details','[]'::jsonb)) is distinct from 'array'
    or pg_catalog.jsonb_array_length(coalesce(p_payload->'attempt_details','[]'::jsonb))>1000
    or pg_catalog.char_length(coalesce(p_payload->'attempt_details','[]'::jsonb)::text)>1000000
    or v_direction not in ('vocab-nl-fr','vocab-fr-nl','verb-nl-inf','verb-fr-nl',
      'verb-nl-conj','verb-fr-conj','phrase-nl-fr','full-sentence-nl-fr','grammar','number-nl-fr','number-fr-nl')
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'submitted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    or exists(select 1 from pg_catalog.jsonb_array_elements_text(p_payload->'accepted_answers') x
      where pg_catalog.char_length(x.value) not between 1 and 250)
    then raise exception 'invalid report payload'; end if;
  select r.status into v_existing_status from public.assignment_item_reports r where r.id=v_id
    and r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
    and r.item_id=v_item;
  if v_existing_status is not null then
    return pg_catalog.jsonb_build_object('id',v_id,'status',v_existing_status);
  end if;
  if exists(select 1 from public.assignment_item_reports r where r.assignment_id=v_assignment
    and r.student_id=v_student and r.round_number=v_round and r.item_id=v_item and r.status='pending')
    then raise exception 'report already pending'; end if;
  select max(r.resolved_at) into v_last_resolved from public.assignment_item_reports r
    where r.assignment_id=v_assignment and r.student_id=v_student
      and r.round_number=v_round and r.item_id=v_item;
  select count(distinct pa.id)::integer into v_wrong from public.practice_attempts pa
    join public.practice_sessions ps on ps.id=pa.session_id
    where ps.assignment_id=v_assignment and ps.student_id=v_student
      and ps.assignment_round_number=v_round and pa.item_id=v_item and pa.was_correct=false
      and not exists(select 1 from public.practice_question_submissions linked
        where linked.session_id=pa.session_id and (pa.client_attempt_id=any(linked.client_evidence_ids) or not linked.evidence_linked and linked.variant_id=pa.legacy_item_id and (linked.round_item_id is null or linked.round_item_id=pa.item_id)))
      and (v_last_resolved is null or pa.created_at>v_last_resolved);
  v_wrong:=v_wrong+(select count(*)::integer from public.practice_question_submissions q
    join public.practice_sessions ps on ps.id=q.session_id
    where ps.assignment_id=v_assignment and ps.student_id=v_student
      and ps.assignment_round_number=v_round and (q.round_item_id=v_item or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=v_item and target.value->'was_correct'='false'::jsonb)) and q.was_correct=false
      and (v_last_resolved is null or q.created_at>v_last_resolved));
  if v_wrong<2 then raise exception 'two wrong attempts required'; end if;
  insert into public.assignment_item_reports(id,assignment_id,student_id,round_number,item_id,prompt,
    exercise_direction,submitted_answers,accepted_answers,consulted,app_version,variant_id,model_answer,attempt_details,exercise_type)
  values(v_id,v_assignment,v_student,v_round,v_item,p_payload->>'prompt',v_direction,
    p_payload->'submitted_answers',p_payload->'accepted_answers',
    coalesce((p_payload->>'consulted')::boolean,false),p_payload->>'app_version',p_payload->>'variant_id',p_payload->>'model_answer',coalesce(p_payload->'attempt_details','[]'::jsonb),p_payload->>'exercise_type');
  update public.assignment_round_items ri set completed_at=coalesce(ri.completed_at,pg_catalog.now()),
    completion_kind='reported_pending'
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and ri.item_id=v_item and ri.completed_at is null;
  if not found then raise exception 'item already completed'; end if;
  update public.assignment_rounds r set completed_at=pg_catalog.now()
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and r.completed_at is null and not exists(select 1 from public.assignment_round_items ri
        where ri.assignment_id=r.assignment_id and ri.student_id=r.student_id
          and ri.round_number=r.round_number and ri.completed_at is null);
  return pg_catalog.jsonb_build_object('id',v_id,'status','pending');
end;
$$;

create or replace function private.resolve_assignment_item_report_impl(p_report_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_report public.assignment_item_reports%rowtype; v_class uuid;
begin
  if p_decision not in ('approved','rejected') or not private.current_teacher_is_active()
    then raise exception 'invalid decision'; end if;
  select r.* into v_report from public.assignment_item_reports r where r.id=p_report_id for update;
  select s.class_id into v_class from public.students s where s.id=v_report.student_id;
  if v_report.id is null or not private.teacher_has_class_access(v_class)
    then raise exception 'report access denied'; end if;
  if v_report.status=p_decision then
    return pg_catalog.jsonb_build_object('id',v_report.id,'status',v_report.status);
  end if;
  if v_report.status<>'pending' then raise exception 'report already resolved'; end if;
  update public.assignment_item_reports set status=p_decision,resolved_at=pg_catalog.now(),resolved_by=auth.uid()
    where id=p_report_id;
  if p_decision='approved' then
    update public.assignment_round_items ri set completed_at=coalesce(ri.completed_at,pg_catalog.now()),
      completion_kind='teacher_approved'
      where ri.assignment_id=v_report.assignment_id and ri.student_id=v_report.student_id
        and ri.round_number=v_report.round_number and ri.item_id=v_report.item_id;
    update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
      where r.assignment_id=v_report.assignment_id and r.student_id=v_report.student_id and r.round_number=v_report.round_number
        and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
          and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
    perform private.register_assignment_completion(v_report.assignment_id,v_report.student_id);
  else
    update public.assignment_round_items ri set completed_at=null,completion_kind=null
      where ri.assignment_id=v_report.assignment_id and ri.student_id=v_report.student_id
        and ri.round_number=v_report.round_number and ri.item_id=v_report.item_id
        and ri.completion_kind='reported_pending';
    update public.assignment_rounds r set completed_at=null
      where r.assignment_id=v_report.assignment_id and r.student_id=v_report.student_id
        and r.round_number=v_report.round_number;
    insert into public.assignment_completion_reopenings(assignment_id,student_id,report_id,original_completion)
      select c.assignment_id,c.student_id,p_report_id,to_jsonb(c)
      from public.assignment_completions c where c.assignment_id=v_report.assignment_id
        and c.student_id=v_report.student_id on conflict (report_id) do nothing;
    update public.assignment_completions c set reopened_at=coalesce(c.reopened_at,pg_catalog.now()) where c.assignment_id=v_report.assignment_id
      and c.student_id=v_report.student_id;
  end if;
  return pg_catalog.jsonb_build_object('id',p_report_id,'status',p_decision);
end;
$$;

create or replace function private.get_teacher_assignment_reports_impl(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access denied'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',r.id,'assignment_id',r.assignment_id,
    'student_id',r.student_id,'student_name',s.display_name,'class_name',c.name,'round_number',r.round_number,
    'item_id',r.item_id,'prompt',r.prompt,'exercise_direction',r.exercise_direction,
    'submitted_answers',r.submitted_answers,'accepted_answers',r.accepted_answers,
    'exercise_type',r.exercise_type,'attempt_details',r.attempt_details,'variant_id',r.variant_id,'model_answer',r.model_answer,'consulted',r.consulted,'app_version',r.app_version,'created_at',r.created_at,'status',r.status,'resolved_at',r.resolved_at)
    order by r.created_at),'[]'::jsonb) into v_rows
    from public.assignment_item_reports r join public.students s on s.id=r.student_id
    join public.classes c on c.id=s.class_id
    where r.assignment_id=p_assignment_id
      and private.teacher_has_class_access(c.id);
  return v_rows;
end;
$$;

create or replace function public.save_assignment(p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.save_assignment_impl(p_payload);
$$;

create or replace function public.get_student_assignments(p_identity_token text) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_student_assignments_impl(p_identity_token);
$$;

create or replace function public.get_teacher_assignments() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignments_impl();
$$;

create or replace function public.get_teacher_assignment_detail(p_assignment_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_detail_impl(p_assignment_id);
$$;

create or replace function public.report_assignment_item(p_identity_token text,p_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.report_assignment_item_impl(p_identity_token,p_payload);
$$;

create or replace function public.get_teacher_assignment_reports(p_assignment_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_teacher_assignment_reports_impl(p_assignment_id);
$$;

create or replace function public.resolve_assignment_item_report(p_report_id uuid,p_decision text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.resolve_assignment_item_report_impl(p_report_id,p_decision);
$$;

create or replace function public.restore_assignment(p_assignment_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.restore_assignment_impl(p_assignment_id);
$$;

create or replace function public.ingest_practice_bundle(
  p_identity_token text,p_session jsonb,p_attempts jsonb
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.ingest_practice_bundle_impl(p_identity_token,p_session,p_attempts);
$$;

create or replace function public.get_class_activity_monitor(
  p_class_id uuid,p_period_start timestamptz,p_period_end timestamptz,
  p_trajectory text,p_mode text,p_category text,p_subsection text,
  p_assignment_id uuid,p_student_status text,p_include_mastery boolean default false
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_class_activity_monitor_impl(
    p_class_id,p_period_start,p_period_end,p_trajectory,p_mode,p_category,
    p_subsection,p_assignment_id,p_student_status,p_include_mastery);
$$;

create or replace function public.curated_sync_version()
returns integer language sql stable set search_path = '' as $$ select 1; $$;

create or replace function public.assignment_sentence_sync_version()
returns integer language sql stable set search_path = '' as $$ select 1; $$;

create or replace function private.get_student_assignments_pre_rounds_impl(p_identity_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_class uuid; v_rows jsonb;
begin
  if p_identity_token is null or p_identity_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then raise exception 'invalid identity'; end if;
  select s.id,s.class_id into v_student,v_class from public.students s
  join public.classes c on c.id=s.class_id
  where s.sync_token=p_identity_token::uuid and s.is_active=true and c.is_active=true;
  if v_student is null then raise exception 'invalid identity'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',a.id,'title',a.title,'instructions',a.instructions,'due_at',a.due_at,
    'target_acquired_percentage',a.target_acquired_percentage,'mastery_strategy',a.mastery_strategy,
    'status',a.status,'published_at',a.published_at,'completed_at',acomp.completed_at,
    'item_ids',(select pg_catalog.jsonb_agg(ai.item_id order by ai.item_order)
      from public.assignment_items ai where ai.assignment_id=a.id),
    'requirements',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'requirement_type',ar.requirement_type,'reference_id',ar.reference_id,
      'target_percentage',ar.target_percentage,'ordering',ar.ordering) order by ar.ordering),'[]'::jsonb)
      from public.assignment_requirements ar where ar.assignment_id=a.id))
    order by a.due_at nulls last,a.created_at),'[]'::jsonb) into v_rows
  from public.assignments a
  join public.assignment_classes ac on ac.assignment_id=a.id and ac.class_id=v_class
  left join public.assignment_completions acomp on acomp.assignment_id=a.id and acomp.student_id=v_student and acomp.reopened_at is null
  where a.status='published';
  return v_rows;
end;
$$;

create or replace function private.get_teacher_assignments_items_impl() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() then raise exception 'teacher access required'; end if;
  select coalesce(pg_catalog.jsonb_agg(row_data order by (row_data->>'created_at') desc),'[]'::jsonb)
    into v_rows from (
    select pg_catalog.jsonb_build_object('id',a.id,'title',a.title,'instructions',a.instructions,
      'target_acquired_percentage',a.target_acquired_percentage,'due_at',a.due_at,
      'status',a.status,'created_at',a.created_at,'published_at',a.published_at,
      'created_by_teacher_id',a.created_by_teacher_id,
      'class_ids',(select pg_catalog.jsonb_agg(ac.class_id) from public.assignment_classes ac
        where ac.assignment_id=a.id and private.teacher_has_class_access(ac.class_id)),
      'classes',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',c.id,'name',c.name))
        from public.assignment_classes ac join public.classes c on c.id=ac.class_id
        where ac.assignment_id=a.id and private.teacher_has_class_access(c.id)),
      'item_ids',(select pg_catalog.jsonb_agg(ai.item_id order by ai.item_order) from public.assignment_items ai
        where ai.assignment_id=a.id),
      'completed_count',(select count(*) from public.assignment_completions comp
        join public.students s on s.id=comp.student_id
        where comp.assignment_id=a.id and comp.reopened_at is null and s.is_active=true and private.teacher_has_class_access(s.class_id)),
      'student_count',(select count(*) from public.students s
        join public.assignment_classes ac on ac.class_id=s.class_id
        where ac.assignment_id=a.id and s.is_active=true and private.teacher_has_class_access(s.class_id))
    ) as row_data from public.assignments a
    where private.current_teacher_is_admin() or exists (
      select 1 from public.assignment_classes ac where ac.assignment_id=a.id
      and private.teacher_has_class_access(ac.class_id))
  ) result;
  return v_rows;
end;
$$;

create or replace function private.get_teacher_assignment_detail_items_impl(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if not private.current_teacher_is_active() or not exists (
    select 1 from public.assignment_classes ac where ac.assignment_id=p_assignment_id
      and private.teacher_has_class_access(ac.class_id)) then raise exception 'assignment access denied'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'student_id',s.id,'student_name',s.display_name,'class_id',c.id,'class_name',c.name,
    'progress',private.assignment_progress_for_student(p_assignment_id,s.id),
    'completed_at',comp.completed_at,
    'active_task_time',(select coalesce(sum(ps.active_duration_seconds),0)::integer
      from public.practice_sessions ps where ps.assignment_id=p_assignment_id and ps.student_id=s.id)
  ) order by c.name,s.display_name),'[]'::jsonb) into v_rows
  from public.students s
  join public.classes c on c.id=s.class_id
  join public.assignment_classes ac on ac.class_id=c.id and ac.assignment_id=p_assignment_id
  left join public.assignment_completions comp on comp.assignment_id=p_assignment_id and comp.student_id=s.id and comp.reopened_at is null
  where s.is_active=true and private.teacher_has_class_access(c.id);
  return v_rows;
end;
$$;
revoke all on function private.ingest_practice_bundle_pre_report_reliability_impl(text,jsonb,jsonb),
  private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_pre_report_reliability_impl(text),
  private.get_student_assignments_pre_sentences_impl(text),
  private.get_student_assignments_impl(text),private.report_assignment_item_impl(text,jsonb),
  private.save_assignment_pre_sentences_impl(jsonb),private.save_assignment_impl(jsonb),
  private.get_teacher_assignments_pre_sentences_impl(),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_pre_reopen_impl(uuid),
  private.get_teacher_assignment_detail_impl(uuid),
  private.get_class_activity_monitor_pre_sentences_impl(
    uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.get_class_activity_monitor_impl(
    uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean),
  private.resolve_assignment_item_report_impl(uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function private.ingest_practice_bundle_impl(text,jsonb,jsonb),
  private.get_student_assignments_impl(text),private.report_assignment_item_impl(text,jsonb)
  to anon,authenticated;
grant execute on function private.resolve_assignment_item_report_impl(uuid,text),
  private.save_assignment_impl(jsonb),private.get_teacher_assignments_impl(),
  private.get_teacher_assignment_detail_impl(uuid)
  to authenticated;
grant execute on function private.get_class_activity_monitor_impl(
  uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  to authenticated;

revoke all on function public.ingest_practice_bundle(text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.ingest_practice_bundle(text,jsonb,jsonb) to anon,authenticated;
revoke all on function public.get_student_assignments(text) from public,anon,authenticated,service_role;
grant execute on function public.get_student_assignments(text) to anon,authenticated;
revoke all on function public.report_assignment_item(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.report_assignment_item(text,jsonb) to anon,authenticated;
revoke all on function public.curated_sync_version() from public,anon,authenticated,service_role;
grant execute on function public.curated_sync_version() to anon,authenticated;
revoke all on function public.assignment_sentence_sync_version() from public,anon,authenticated,service_role;
grant execute on function public.assignment_sentence_sync_version() to anon,authenticated;
revoke all on function public.save_assignment(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_assignment(jsonb) to authenticated;
revoke all on function public.get_teacher_assignments() from public,anon,authenticated,service_role;
grant execute on function public.get_teacher_assignments() to authenticated;
revoke all on function public.get_teacher_assignment_detail(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_teacher_assignment_detail(uuid) to authenticated;
revoke all on function public.get_teacher_assignment_reports(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_teacher_assignment_reports(uuid) to authenticated;
revoke all on function public.resolve_assignment_item_report(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_assignment_item_report(uuid,text) to authenticated;
revoke all on function public.restore_assignment(uuid) from public,anon,authenticated,service_role;
grant execute on function public.restore_assignment(uuid) to authenticated;
revoke all on function public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean) to authenticated;
revoke all on function private.register_assignment_completion_pre_reports(uuid,uuid),private.register_assignment_completion(uuid,uuid),private.assignment_attempt_inserted(),
  private.ingest_practice_bundle_pre_reports_impl(text,jsonb,jsonb),private.ingest_practice_bundle_pre_curated_impl(text,jsonb,jsonb),
  private.get_student_assignments_pre_reports_impl(text),private.get_teacher_assignments_pre_lifecycle_impl(),
  private.assignment_auto_archive_grace_days(),private.restore_assignment_impl(uuid),private.get_teacher_assignment_reports_impl(uuid),
  private.get_class_activity_monitor_pre_curated_impl(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function private.restore_assignment_impl(uuid),private.get_teacher_assignment_reports_impl(uuid) to authenticated;
create or replace function public.assignment_variant_sync_version() returns integer language sql stable set search_path='' as $$ select 1; $$;
revoke all on function public.assignment_variant_sync_version() from public,anon,authenticated,service_role;
grant execute on function public.assignment_variant_sync_version() to anon,authenticated;
-- Assert preservation against the actual starting schema. Added columns are
-- excluded automatically; every original value must still have the same hash.
do $preservation$
declare r record; actual jsonb; cols text[];
begin
  for r in select e.key tbl,e.value baseline from private.mon_parcours_upgrade_runs u,
    jsonb_each(u.preserved_rows) e where u.id=(select id from mon_parcours_upgrade_run) loop
    select array_agg(value) into cols from jsonb_array_elements_text(r.baseline->'columns');
    execute format('select jsonb_build_object(''count'',count(*),''digest'',md5(coalesce(string_agg(hash,'''' order by hash),'''')))
      from (select md5((select jsonb_object_agg(e.key,e.value) from jsonb_each(to_jsonb(t)) e where e.key=any($1))::text) hash
      from public.%I t) rows',r.tbl) into actual using cols;
    if actual->'count' is distinct from r.baseline->'count' or actual->'digest' is distinct from r.baseline->'digest'
      then raise exception 'Preservation failed for %: transaction rolled back',r.tbl; end if;
  end loop;
  update private.mon_parcours_upgrade_runs set finished_at=pg_catalog.now(),preservation_verified=true,
    installed_functions=(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f')
    where id=(select id from mon_parcours_upgrade_run);
end; $preservation$;

-- SQL Editor-only verification helper. Read-only; no Data API access.
create or replace function private.mon_parcours_upgrade_verification()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare run private.mon_parcours_upgrade_runs%rowtype; r record; current_count bigint;
  counts jsonb := '{}'::jsonb; missing jsonb; drift jsonb; grant_drift jsonb; nullability_drift jsonb; schema_ok boolean;
begin
  select * into run from private.mon_parcours_upgrade_runs order by started_at desc,id desc limit 1;
  select coalesce(jsonb_agg(e.tbl||'.'||e.col),'[]'::jsonb) into missing from
    (values ('students','id','uuid'),
('students','class_id','uuid'),
('students','sync_token','uuid'),
('students','is_active','boolean'),
('classes','id','uuid'),
('classes','name','text'),
('classes','is_active','boolean'),
('teachers','auth_user_id','uuid'),
('teachers','email','text'),
('teachers','display_name','text'),
('teachers','role','text'),
('teachers','is_active','boolean'),
('assignments','id','uuid'),
('assignments','created_by_teacher_id','uuid'),
('assignments','title','text'),
('assignments','status','text'),
('assignments','due_at','timestamp with time zone'),
('assignments','published_at','timestamp with time zone'),
('assignments','updated_at','timestamp with time zone'),
('assignments','target_acquired_percentage','integer'),
('assignments','mastery_strategy','text'),
('assignments','completion_strategy','text'),
('assignments','required_rounds','integer'),
('assignments','item_verb_exercise_key','text'),
('assignments','include_integrative_sentences','boolean'),
('assignments','use_exercise_variants','boolean'),
('assignments','exercise_forms','jsonb'),
('assignment_classes','assignment_id','uuid'),
('assignment_classes','class_id','uuid'),
('assignment_items','assignment_id','uuid'),
('assignment_items','item_id','text'),
('assignment_items','item_order','integer'),
('assignment_completions','assignment_id','uuid'),
('assignment_completions','student_id','uuid'),
('assignment_completions','completed_at','timestamp with time zone'),
('assignment_completions','acquired_count_at_completion','integer'),
('assignment_completions','total_count_at_completion','integer'),
('assignment_completions','acquired_percentage_at_completion','integer'),
('assignment_completions','reopened_at','timestamp with time zone'),
('assignment_rounds','assignment_id','uuid'),
('assignment_rounds','student_id','uuid'),
('assignment_rounds','round_number','integer'),
('assignment_rounds','selected_item_ids','text[]'),
('assignment_rounds','completed_at','timestamp with time zone'),
('assignment_round_items','assignment_id','uuid'),
('assignment_round_items','student_id','uuid'),
('assignment_round_items','round_number','integer'),
('assignment_round_items','item_id','text'),
('assignment_round_items','wrong_count','integer'),
('assignment_round_items','consulted','boolean'),
('assignment_round_items','completed_at','timestamp with time zone'),
('assignment_round_items','completion_kind','text'),
('assignment_round_items','selection_reason','text'),
('practice_attempts','id','uuid'),
('practice_attempts','session_id','uuid'),
('practice_attempts','student_id','uuid'),
('practice_attempts','client_attempt_id','uuid'),
('practice_attempts','item_id','text'),
('practice_attempts','equivalent_item_ids','text[]'),
('practice_attempts','legacy_item_id','text'),
('practice_attempts','item_variant','text'),
('practice_attempts','item_type','text'),
('practice_attempts','trajectory','text'),
('practice_attempts','top_category','text'),
('practice_attempts','lesson','text'),
('practice_attempts','block','text'),
('practice_attempts','subsection','text'),
('practice_attempts','exercise_key','text'),
('practice_attempts','mode','text'),
('practice_attempts','prompt','text'),
('practice_attempts','correct_answers','jsonb'),
('practice_attempts','was_correct','boolean'),
('practice_attempts','attempt_number','integer'),
('practice_attempts','created_at','timestamp with time zone'),
('practice_sessions','id','uuid'),
('practice_sessions','student_id','uuid'),
('practice_sessions','client_session_id','uuid'),
('practice_sessions','exercise_key','text'),
('practice_sessions','assignment_id','uuid'),
('practice_sessions','assignment_round_number','integer'),
('practice_sessions','mode','text'),
('practice_sessions','trajectory','text'),
('practice_sessions','top_category','text'),
('practice_sessions','subsection','text'),
('practice_sessions','started_at','timestamp with time zone'),
('practice_sessions','finished_at','timestamp with time zone'),
('practice_sessions','attempt_count','integer'),
('practice_sessions','correct_count','integer'),
('practice_sessions','incorrect_count','integer'),
('practice_sessions','updated_at','timestamp with time zone'),
('practice_sessions','active_duration_seconds','integer'),
('assignment_item_reports','id','uuid'),
('assignment_item_reports','assignment_id','uuid'),
('assignment_item_reports','student_id','uuid'),
('assignment_item_reports','round_number','integer'),
('assignment_item_reports','item_id','text'),
('assignment_item_reports','prompt','text'),
('assignment_item_reports','exercise_direction','text'),
('assignment_item_reports','submitted_answers','jsonb'),
('assignment_item_reports','accepted_answers','jsonb'),
('assignment_item_reports','consulted','boolean'),
('assignment_item_reports','app_version','text'),
('assignment_item_reports','status','text'),
('assignment_item_reports','created_at','timestamp with time zone'),
('assignment_item_reports','resolved_at','timestamp with time zone'),
('assignment_item_reports','resolved_by','uuid'),
('assignment_item_reports','variant_id','text'),
('assignment_item_reports','model_answer','text'),
('assignment_item_reports','attempt_details','jsonb'),
('assignment_item_reports','exercise_type','text'),
('practice_question_submissions','id','uuid'),
('practice_question_submissions','session_id','uuid'),
('practice_question_submissions','student_id','uuid'),
('practice_question_submissions','client_submission_id','uuid'),
('practice_question_submissions','variant_id','text'),
('practice_question_submissions','was_correct','boolean'),
('practice_question_submissions','created_at','timestamp with time zone'),
('practice_question_submissions','received_at','timestamp with time zone'),
('practice_question_submissions','round_item_id','text'),
('practice_question_submissions','client_evidence_ids','uuid[]'),
('practice_question_submissions','evidence_linked','boolean'),
('practice_question_submissions','target_results','jsonb'),
('assignment_completion_reopenings','id','uuid'),
('assignment_completion_reopenings','assignment_id','uuid'),
('assignment_completion_reopenings','student_id','uuid'),
('assignment_completion_reopenings','report_id','uuid'),
('assignment_completion_reopenings','original_completion','jsonb'),
('assignment_completion_reopenings','reopened_at','timestamp with time zone')) e(tbl,col,typ)
    where not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||e.tbl)
      and a.attname=e.col and not a.attisdropped and format_type(a.atttypid,a.atttypmod)=e.typ);
  for r in select e.key tbl,e.value baseline from jsonb_each(coalesce(run.preserved_rows,'{}')) e loop
    if to_regclass('public.'||r.tbl) is not null then
      execute format('select count(*) from public.%I',r.tbl) into current_count;
      counts:=counts||jsonb_build_object(r.tbl,jsonb_build_object('before',r.baseline->'count','now',current_count,
        'count_not_lower',current_count>=(r.baseline->>'count')::bigint));
    else counts:=counts||jsonb_build_object(r.tbl,jsonb_build_object('missing',true)); end if;
  end loop;
  select coalesce(jsonb_agg(e.key),'[]'::jsonb) into drift from jsonb_each_text(run.installed_functions) e
    where to_regprocedure(e.key) is null or md5(pg_get_functiondef(to_regprocedure(e.key))) is distinct from e.value;
  select coalesce(jsonb_agg(e.tbl||'.'||e.col),'[]'::jsonb) into nullability_drift from
    (values ('assignment_item_reports','id'),
('assignment_item_reports','assignment_id'),
('assignment_item_reports','student_id'),
('assignment_item_reports','round_number'),
('assignment_item_reports','item_id'),
('assignment_item_reports','prompt'),
('assignment_item_reports','exercise_direction'),
('assignment_item_reports','submitted_answers'),
('assignment_item_reports','accepted_answers'),
('assignment_item_reports','consulted'),
('assignment_item_reports','status'),
('assignment_item_reports','created_at'),
('assignment_item_reports','attempt_details'),
('practice_question_submissions','id'),
('practice_question_submissions','session_id'),
('practice_question_submissions','student_id'),
('practice_question_submissions','client_submission_id'),
('practice_question_submissions','variant_id'),
('practice_question_submissions','was_correct'),
('practice_question_submissions','created_at'),
('practice_question_submissions','received_at'),
('practice_question_submissions','client_evidence_ids'),
('practice_question_submissions','evidence_linked'),
('practice_question_submissions','target_results'),
('assignment_completion_reopenings','id'),
('assignment_completion_reopenings','assignment_id'),
('assignment_completion_reopenings','student_id'),
('assignment_completion_reopenings','report_id'),
('assignment_completion_reopenings','original_completion'),
('assignment_completion_reopenings','reopened_at'),
('assignments','include_integrative_sentences'),
('assignments','use_exercise_variants')) e(tbl,col)
    where not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||e.tbl)
      and a.attname=e.col and not a.attisdropped and a.attnotnull);
  select coalesce(jsonb_agg(jsonb_build_object('function',e.sig,'role',e.role,'expected_execute',e.allowed)),'[]'::jsonb) into grant_drift from
    (values ('public.ingest_practice_bundle(text,jsonb,jsonb)','anon',true),
('public.ingest_practice_bundle(text,jsonb,jsonb)','authenticated',true),
('public.get_student_assignments(text)','anon',true),
('public.get_student_assignments(text)','authenticated',true),
('public.report_assignment_item(text,jsonb)','anon',true),
('public.report_assignment_item(text,jsonb)','authenticated',true),
('public.curated_sync_version()','anon',true),
('public.curated_sync_version()','authenticated',true),
('public.assignment_sentence_sync_version()','anon',true),
('public.assignment_sentence_sync_version()','authenticated',true),
('public.assignment_variant_sync_version()','anon',true),
('public.assignment_variant_sync_version()','authenticated',true),
('public.save_assignment(jsonb)','anon',false),
('public.save_assignment(jsonb)','authenticated',true),
('public.get_teacher_assignments()','anon',false),
('public.get_teacher_assignments()','authenticated',true),
('public.get_teacher_assignment_detail(uuid)','anon',false),
('public.get_teacher_assignment_detail(uuid)','authenticated',true),
('public.get_teacher_assignment_reports(uuid)','anon',false),
('public.get_teacher_assignment_reports(uuid)','authenticated',true),
('public.resolve_assignment_item_report(uuid,text)','anon',false),
('public.resolve_assignment_item_report(uuid,text)','authenticated',true),
('public.restore_assignment(uuid)','anon',false),
('public.restore_assignment(uuid)','authenticated',true),
('public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)','anon',false),
('public.get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)','authenticated',true)) e(sig,role,allowed)
    where coalesce(has_function_privilege(e.role,to_regprocedure(e.sig),'EXECUTE'),false) is distinct from e.allowed;
  schema_ok:=jsonb_array_length(missing)=0 and jsonb_array_length(nullability_drift)=0;
  return jsonb_build_object('schema_ready',schema_ok,'missing_or_incompatible_columns',missing,
    'starting_phase_state',jsonb_build_object(
      'completion_kind_present',exists(select 1 from jsonb_array_elements(run.starting_catalog->'columns') c
        where c.value->>'table_name'='assignment_round_items' and c.value->>'column_name'='completion_kind'),
      'sentence_flag_present',exists(select 1 from jsonb_array_elements(run.starting_catalog->'columns') c
        where c.value->>'table_name'='assignments' and c.value->>'column_name'='include_integrative_sentences'),
      'question_submissions_present',exists(select 1 from jsonb_array_elements(run.starting_catalog->'columns') c
        where c.value->>'table_name'='practice_question_submissions'),
      'lifecycle_function_present',exists(select 1 from jsonb_array_elements(run.starting_catalog->'functions') f
        where f.value->>'signature'='private.assignment_auto_archive_grace_days()'),
      'supabase_ledger_present',run.starting_catalog->'supabase_ledger_present'),
    'migration_finished',run.finished_at is not null,'original_rows_verified_at_commit',run.preservation_verified,
    'function_definition_drift',drift,'row_counts',counts,
    'not_null_constraint_drift',nullability_drift,'rpc_grant_deviations',grant_drift,
    'private_table_security',(select bool_and(c.relrowsecurity and c.relforcerowsecurity and
      not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') and
      not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
      from pg_class c where c.oid=any(array[to_regclass('public.assignment_item_reports'),
        to_regclass('public.practice_question_submissions'),to_regclass('public.assignment_completion_reopenings')])),
    'pending_uniqueness_index',exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.assignment_item_reports_one_pending_idx')
      and i.indisunique and i.indisvalid and pg_get_expr(i.indpred,i.indrelid) is not null),
    'permanent_item_count',(select count(*) from public.course_item_ids),
    'student_rpc_grants',has_function_privilege('anon','public.ingest_practice_bundle(text,jsonb,jsonb)','EXECUTE') and
      has_function_privilege('anon','public.report_assignment_item(text,jsonb)','EXECUTE'),
    'teacher_rpc_grants',has_function_privilege('authenticated','public.restore_assignment(uuid)','EXECUTE') and
      not has_function_privilege('anon','public.restore_assignment(uuid)','EXECUTE'),
    'existing_assignment_defaults','include_integrative_sentences=false; use_exercise_variants=false; existing values preserved');
end; $$;
revoke all on function private.mon_parcours_upgrade_verification() from public,anon,authenticated,service_role;
update private.mon_parcours_upgrade_runs set installed_functions=(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f')
  where id=(select id from mon_parcours_upgrade_run);
commit;

