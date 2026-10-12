// Rebuild the standalone repair from reviewed historical definitions.
// Never connects to a database. Historical one-shot migrations remain unchanged.
const fs = require('node:fs');
const read = name => fs.readFileSync('supabase/' + name + '.sql', 'utf8');
const p7 = read('phase7-assignments'), p7b = read('phase7b-verb-mastery');
const p8 = read('phase8-class-monitor'), p9 = read('phase9-task-rounds');
const p10 = read('phase10-item-reports'), life = read('phase11-teacher-task-lifecycle');
const curated = read('phase11-curated-variants'), p12 = read('phase12-report-reliability');
function functions(sql) {
  return [...sql.matchAll(/create (?:or replace )?function ([\w.]+)\s*\([\s\S]*?\$\$;/gi)].map(m => ({name:m[1],sql:m[0]}));
}
function def(sql, name, alias) {
  const entries = functions(sql).filter(f => f.name === name);
  if (!entries.length) throw Error('Missing definition: ' + name);
  return entries.at(-1).sql.replace(/^create (?:or replace )?function/i, 'create or replace function')
    .replace(name, alias || name);
}
const parts = [`-- State-aware upgrade phases 10–12. Run this ONE file manually in Supabase.
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
alter table public.assignment_completions add column if not exists reopened_at timestamptz;
alter table public.assignments alter column created_by_teacher_id drop not null;
`];
// Tables are the real question-outcome/audit structures, not replacement attempts.
for (const [source,name] of [[p10,'assignment_item_reports'],[curated,'practice_question_submissions'],[p12,'assignment_completion_reopenings']]) {
  const match = source.match(new RegExp('create table public\\.'+name+' \\([\\s\\S]*?\\n\\);'));
  if (!match) throw Error(name);
  parts.push(match[0].replace('create table', 'create table if not exists'));
}
parts.push(`alter table public.practice_question_submissions add column if not exists round_item_id text;
alter table public.practice_question_submissions add column if not exists client_evidence_ids uuid[] not null default '{}';
alter table public.practice_question_submissions add column if not exists evidence_linked boolean not null default false;
alter table public.practice_question_submissions add column if not exists target_results jsonb not null default '[]';
alter table public.assignment_item_reports add column if not exists variant_id text;
alter table public.assignment_item_reports add column if not exists model_answer text;
alter table public.assignment_item_reports add column if not exists attempt_details jsonb not null default '[]';
alter table public.assignment_item_reports add column if not exists exercise_type text;
`);
// Existing definitions are validated before any functions are changed. Unexpected
// schema drift aborts the entire transaction, rather than silently ignoring it.
const expected = {
  students:{id:'uuid',class_id:'uuid',sync_token:'uuid',is_active:'boolean'},
  classes:{id:'uuid',name:'text',is_active:'boolean'},
  teachers:{auth_user_id:'uuid',email:'text',display_name:'text',role:'text',is_active:'boolean'},
  assignments:{id:'uuid',created_by_teacher_id:'uuid',title:'text',status:'text',due_at:'timestamp with time zone',published_at:'timestamp with time zone',updated_at:'timestamp with time zone',target_acquired_percentage:'integer',mastery_strategy:'text',completion_strategy:'text',required_rounds:'integer',item_verb_exercise_key:'text',include_integrative_sentences:'boolean',use_exercise_variants:'boolean'},
  assignment_classes:{assignment_id:'uuid',class_id:'uuid'},
  assignment_items:{assignment_id:'uuid',item_id:'text',item_order:'integer'},
  assignment_completions:{assignment_id:'uuid',student_id:'uuid',completed_at:'timestamp with time zone',acquired_count_at_completion:'integer',total_count_at_completion:'integer',acquired_percentage_at_completion:'integer',reopened_at:'timestamp with time zone'},
  assignment_rounds:{assignment_id:'uuid',student_id:'uuid',round_number:'integer',selected_item_ids:'text[]',completed_at:'timestamp with time zone'},
  assignment_round_items:{assignment_id:'uuid',student_id:'uuid',round_number:'integer',item_id:'text',wrong_count:'integer',consulted:'boolean',completed_at:'timestamp with time zone',completion_kind:'text',selection_reason:'text'},
  practice_attempts:{id:'uuid',session_id:'uuid',student_id:'uuid',client_attempt_id:'uuid',item_id:'text',equivalent_item_ids:'text[]',legacy_item_id:'text',item_variant:'text',item_type:'text',trajectory:'text',top_category:'text',lesson:'text',block:'text',subsection:'text',exercise_key:'text',mode:'text',prompt:'text',correct_answers:'jsonb',was_correct:'boolean',attempt_number:'integer',created_at:'timestamp with time zone'},
  practice_sessions:{id:'uuid',student_id:'uuid',client_session_id:'uuid',exercise_key:'text',assignment_id:'uuid',assignment_round_number:'integer',mode:'text',trajectory:'text',top_category:'text',subsection:'text',started_at:'timestamp with time zone',finished_at:'timestamp with time zone',attempt_count:'integer',correct_count:'integer',incorrect_count:'integer',updated_at:'timestamp with time zone',active_duration_seconds:'integer'},
  assignment_item_reports:{id:'uuid',assignment_id:'uuid',student_id:'uuid',round_number:'integer',item_id:'text',prompt:'text',exercise_direction:'text',submitted_answers:'jsonb',accepted_answers:'jsonb',consulted:'boolean',app_version:'text',status:'text',created_at:'timestamp with time zone',resolved_at:'timestamp with time zone',resolved_by:'uuid',variant_id:'text',model_answer:'text',attempt_details:'jsonb',exercise_type:'text'},
  practice_question_submissions:{id:'uuid',session_id:'uuid',student_id:'uuid',client_submission_id:'uuid',variant_id:'text',was_correct:'boolean',created_at:'timestamp with time zone',received_at:'timestamp with time zone',round_item_id:'text',client_evidence_ids:'uuid[]',evidence_linked:'boolean',target_results:'jsonb'},
  assignment_completion_reopenings:{id:'uuid',assignment_id:'uuid',student_id:'uuid',report_id:'uuid',original_completion:'jsonb',reopened_at:'timestamp with time zone'}
};
parts.push(`do $columns$ declare r record; actual text; begin
  for r in select * from (values ${Object.entries(expected).flatMap(([table,cols])=>Object.entries(cols).map(([col,type])=>`('${table}','${col}','${type}')`)).join(',\n')}) as e(tbl,col,typ) loop
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
`);
// Legitimate constraint evolution for report cycles; all report rows stay intact.
parts.push(p12.slice(p12.indexOf('do $$'),p12.indexOf('-- Alleen een afgeleide'))
  .replace('create unique index ', 'create unique index if not exists '));
parts.push(`do $constraints$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.assignment_round_items'::regclass
    and conname='mon_parcours_completion_kind_check') then
    alter table public.assignment_round_items add constraint mon_parcours_completion_kind_check
      check(completion_kind in ('correct','reported_pending','teacher_approved'));
  end if;
end; $constraints$;
create index if not exists practice_question_submissions_session_idx on public.practice_question_submissions(session_id);
create index if not exists assignment_item_reports_pending_idx on public.assignment_item_reports(assignment_id,status,created_at);
`);
const requiredConstraints=[
  ['assignment_item_reports','report_pk','PRIMARY KEY (id)'],
  ['assignment_item_reports','report_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE'],
  ['assignment_item_reports','report_round_fk','FOREIGN KEY (assignment_id,student_id,round_number,item_id) REFERENCES public.assignment_round_items(assignment_id,student_id,round_number,item_id) ON DELETE CASCADE'],
  ['assignment_item_reports','report_item_fk','FOREIGN KEY (item_id) REFERENCES public.course_item_ids(item_id) ON DELETE RESTRICT'],
  ['assignment_item_reports','report_resolver_fk','FOREIGN KEY (resolved_by) REFERENCES auth.users(id)'],
  ['practice_question_submissions','submission_pk','PRIMARY KEY (id)'],
  ['practice_question_submissions','submission_uuid_unique','UNIQUE (student_id,client_submission_id)'],
  ['practice_question_submissions','submission_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE'],
  ['practice_question_submissions','submission_session_fk','FOREIGN KEY (session_id) REFERENCES public.practice_sessions(id) ON DELETE CASCADE'],
  ['practice_question_submissions','submission_round_item_fk','FOREIGN KEY (round_item_id) REFERENCES public.course_item_ids(item_id) ON DELETE RESTRICT'],
  ['assignment_completion_reopenings','reopening_pk','PRIMARY KEY (id)'],
  ['assignment_completion_reopenings','reopening_report_unique','UNIQUE (report_id)'],
  ['assignment_completion_reopenings','reopening_assignment_fk','FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE'],
  ['assignment_completion_reopenings','reopening_student_fk','FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT'],
  ['assignment_completion_reopenings','reopening_report_fk','FOREIGN KEY (report_id) REFERENCES public.assignment_item_reports(id) ON DELETE RESTRICT']
];
parts.push(`do $integrity$
declare r record;
begin
  for r in select * from (values ${requiredConstraints.map(([t,n,d])=>`('${t}','mon_parcours_${n}','${d}')`).join(',\n')}) e(tbl,name,def) loop
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
`);
const requiredNotNull={
  assignment_item_reports:['id','assignment_id','student_id','round_number','item_id','prompt','exercise_direction','submitted_answers','accepted_answers','consulted','status','created_at','attempt_details'],
  practice_question_submissions:['id','session_id','student_id','client_submission_id','variant_id','was_correct','created_at','received_at','client_evidence_ids','evidence_linked','target_results'],
  assignment_completion_reopenings:['id','assignment_id','student_id','report_id','original_completion','reopened_at']
};
for(const [table,cols] of Object.entries(requiredNotNull)) for(const col of cols)
  parts.push(`alter table public.${table} alter column ${col} set not null;`);
parts.push(`alter table public.practice_question_submissions alter column id set default pg_catalog.gen_random_uuid();
alter table public.practice_question_submissions alter column received_at set default pg_catalog.now();
alter table public.practice_question_submissions alter column client_evidence_ids set default '{}';
alter table public.practice_question_submissions alter column evidence_linked set default false;
alter table public.practice_question_submissions alter column target_results set default '[]';
alter table public.assignment_item_reports alter column consulted set default false;
alter table public.assignment_item_reports alter column status set default 'pending';
alter table public.assignment_item_reports alter column created_at set default pg_catalog.now();
alter table public.assignment_item_reports alter column attempt_details set default '[]';
alter table public.assignment_completion_reopenings alter column id set default pg_catalog.gen_random_uuid();
alter table public.assignment_completion_reopenings alter column reopened_at set default pg_catalog.now();`);
for (const name of ['assignment_item_reports','practice_question_submissions','assignment_completion_reopenings'])
  parts.push(`alter table public.${name} enable row level security;\nalter table public.${name} force row level security;\nrevoke all on public.${name} from public,anon,authenticated,service_role;`);
// Rebuild a known call graph with CREATE OR REPLACE. Never rename a possibly
// newer wrapper into its own dependency, and never drop functions to reinstall.
const add=(source,name,alias)=>parts.push(def(source,'private.'+name,alias && 'private.'+alias));
add(p9,'register_assignment_completion','register_assignment_completion_pre_reports');
add(p10,'register_assignment_completion');
add(p7,'assignment_attempt_inserted');
add(p9,'ingest_practice_bundle_impl','ingest_practice_bundle_pre_reports_impl');
add(p10,'ingest_practice_bundle_impl','ingest_practice_bundle_pre_curated_impl');
add(curated,'ingest_practice_bundle_impl','ingest_practice_bundle_pre_report_reliability_impl');
add(p12,'ingest_practice_bundle_impl');
add(p9,'get_student_assignments_impl','get_student_assignments_pre_reports_impl');
add(p10,'get_student_assignments_impl','get_student_assignments_pre_report_reliability_impl');
const studentDefs=functions(p12).filter(f=>f.name==='private.get_student_assignments_impl');
parts.push(studentDefs[0].sql.replace('create function','create or replace function').replace('private.get_student_assignments_impl','private.get_student_assignments_pre_sentences_impl'));
parts.push(studentDefs[1].sql.replace('create function','create or replace function'));
add(p9,'save_assignment_impl','save_assignment_pre_sentences_impl'); add(p12,'save_assignment_impl');
add(p9,'get_teacher_assignments_impl','get_teacher_assignments_pre_lifecycle_impl');
add(life,'assignment_auto_archive_grace_days'); add(life,'restore_assignment_impl');
add(life,'get_teacher_assignments_impl','get_teacher_assignments_pre_sentences_impl'); add(p12,'get_teacher_assignments_impl');
add(p9,'get_teacher_assignment_detail_impl','get_teacher_assignment_detail_pre_reopen_impl'); add(p12,'get_teacher_assignment_detail_impl');
add(p8,'get_class_activity_monitor_impl','get_class_activity_monitor_pre_curated_impl');
add(curated,'get_class_activity_monitor_impl','get_class_activity_monitor_pre_sentences_impl'); add(p12,'get_class_activity_monitor_impl');
add(p12,'report_assignment_item_impl'); add(p12,'resolve_assignment_item_report_impl');
parts.push(def(p10,'private.get_teacher_assignment_reports_impl')
  .replace("where r.assignment_id=p_assignment_id and r.status='pending'",'where r.assignment_id=p_assignment_id')
  .replace("'created_at',r.created_at,'status',r.status", "'created_at',r.created_at,'status',r.status,'resolved_at',r.resolved_at"));
// Public callers are redefined as well so any existing SQL dependency resolves
// to the final implementation, not to a previously renamed historical OID.
for(const [source,names] of [[p7,['save_assignment','get_student_assignments','get_teacher_assignments','get_teacher_assignment_detail']],
  [p10,['report_assignment_item','get_teacher_assignment_reports','resolve_assignment_item_report']],
  [life,['restore_assignment']],[curated,['ingest_practice_bundle','get_class_activity_monitor','curated_sync_version']],
  [p12,['assignment_sentence_sync_version']]]) for(const name of names) parts.push(def(source,'public.'+name));
// Preserve completion events while marking their current validity separately.
// Base authorized readers get the same state without deleting the event.
for(const [source,name,alias] of [[p7b,'get_student_assignments_impl','get_student_assignments_pre_rounds_impl'],
  [p7,'get_teacher_assignments_impl','get_teacher_assignments_items_impl'],
  [p7,'get_teacher_assignment_detail_impl','get_teacher_assignment_detail_items_impl']]) {
  let sql=def(source,'private.'+name,'private.'+alias);
  sql=sql.replace(/left join public\.assignment_completions (\w+) on ([^\n]+)/g, (m,a,condition)=>m+' and '+a+'.reopened_at is null');
  sql=sql.replace('where comp.assignment_id=a.id and comp.student_id=s.id','where comp.assignment_id=a.id and comp.student_id=s.id and comp.reopened_at is null');
  parts.push(sql);
}
let sql=parts.join('\n\n');
for(const name of ['private.register_assignment_completion_pre_reports','private.register_assignment_completion']) {
  const body=functions(sql).find(f=>f.name===name).sql;
  sql=sql.replace(body,()=>body.replace('begin\n', `begin
  if coalesce(pg_catalog.current_setting('mon_parcours.defer_round_completion',true),'')=p_assignment_id::text then return; end if;
  if exists(select 1 from public.assignments a where a.id=p_assignment_id and a.completion_strategy='rounds') and
    exists(select 1 from public.assignment_item_reports r where r.assignment_id=p_assignment_id and r.student_id=p_student_id and r.status='pending')
    then return; end if;
`));
}
sql=sql.replace(/delete from public\.assignment_completions c where c\.assignment_id=([^;]+);/g,
  'update public.assignment_completions c set reopened_at=coalesce(c.reopened_at,pg_catalog.now()) where c.assignment_id=$1;');
// Preserve completed rows during legacy reconstruction. A rejected item is
// subsequently reconstructed ONLY from new submissions/attempts after return.
sql=sql.replace('wrong_count=e.wrong_count,completed_at=e.completed_at',
  'wrong_count=greatest(ri.wrong_count,e.wrong_count),completed_at=coalesce(ri.completed_at,e.completed_at)');
sql=sql.replace('    from public.assignment_item_reports x\n', `    from (select distinct on (assignment_id,student_id,round_number,item_id) *
      from public.assignment_item_reports order by assignment_id,student_id,round_number,item_id,created_at desc,id desc) x\n`);
sql=sql.replace('and c.student_id=p_student_id) then return; end if;',
  'and c.student_id=p_student_id and c.reopened_at is null) then return; end if;');
sql=sql.replace('on conflict (assignment_id,student_id) do nothing;',
  'on conflict (assignment_id,student_id) do update set reopened_at=null;');
sql=sql.replace("and r.round_number=required and r.completed_at is not null);",
  "and r.round_number=required and r.completed_at is not null) and not exists(select 1 from public.assignment_rounds r where r.assignment_id=p_assignment_id and r.student_id=p_student_id and r.completed_at is null);");
// Teacher counts must ignore retained, reopened events.
sql=sql.replace(/where comp\.assignment_id=a\.id/g,'where comp.assignment_id=a.id and comp.reopened_at is null');
// Keep single question outcomes separate from their evidence rows. The link
// prevents multi-gap evidence from inflating wrong counts or completing a
// question whose other gap is still wrong.
sql=sql.replace(/\(session_id,student_id,client_submission_id,variant_id,round_item_id,was_correct,created_at\)/g,
  '(session_id,student_id,client_submission_id,variant_id,round_item_id,was_correct,created_at,client_evidence_ids,evidence_linked)');
sql=sql.replace("(v_submission->>'was_correct')::boolean,(v_submission->>'created_at')::timestamptz)",
  `(v_submission->>'was_correct')::boolean,(v_submission->>'created_at')::timestamptz,
      array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
        where e.value->>'client_submission_id'=v_submission->>'client_submission_id'),true)`);
sql=sql.replace('(session_id,student_id,client_submission_id,variant_id,was_correct,created_at)',
  '(session_id,student_id,client_submission_id,variant_id,was_correct,created_at,client_evidence_ids,evidence_linked)');
sql=sql.replace("(v_submission->>'created_at')::timestamptz)", `(v_submission->>'created_at')::timestamptz,
      array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
        where e.value->>'client_submission_id'=v_submission->>'client_submission_id'),true)`);
sql=sql.replace(/->>'client_submission_id'\),true\)/g, `->>'client_submission_id'),
      not exists(select 1 from jsonb_array_elements(p_attempts) e where e.value->>'legacy_item_id'=v_submission->>'variant_id'
        and not (e.value ? 'client_submission_id')))`);
sql=sql.replace("and a.include_integrative_sentences=true)",
  "and (a.include_integrative_sentences=true or a.use_exercise_variants=true))");
sql=sql.replace("and a.include_integrative_sentences=true\n", "and (a.include_integrative_sentences=true or a.use_exercise_variants=true)\n");
sql=sql.replace(/q\.variant_id=pa\.legacy_item_id\s+and q\.round_item_id=pa\.item_id/g,
  'pa.client_attempt_id=any(q.client_evidence_ids)');
sql=sql.replace(/q\.round_item_id=pa\.item_id\s+and q\.variant_id=pa\.legacy_item_id/g,
  'pa.client_attempt_id=any(q.client_evidence_ids)');
// Exclude linked evidence when counting a question's errors.
sql=sql.replace(/and pa\.was_correct=false/g, `and pa.was_correct=false
      and not exists(select 1 from public.practice_question_submissions linked
        where linked.session_id=pa.session_id and pa.client_attempt_id=any(linked.client_evidence_ids))`);
// Old phase 11 submission guards: never acknowledge a new submission UUID
// that was already used in another session or for another outcome.
sql=sql.replace(/on conflict \(student_id,client_submission_id\) do nothing;/g, `on conflict (student_id,client_submission_id) do nothing;
    if exists(select 1 from public.practice_question_submissions stored
      where stored.student_id=v_student and stored.client_submission_id=(v_submission->>'client_submission_id')::uuid
        and (stored.session_id<>v_session or stored.variant_id<>v_submission->>'variant_id'
          or stored.was_correct<>(v_submission->>'was_correct')::boolean
          or stored.created_at<>(v_submission->>'created_at')::timestamptz)) then
      raise exception 'submission UUID reused with different content';
    end if;`);
// Add report context; all historic report cycles remain separate rows.
sql=sql.replace('insert into public.assignment_item_reports(id,assignment_id,student_id,round_number,item_id,prompt,\n    exercise_direction,submitted_answers,accepted_answers,consulted,app_version)',
  'insert into public.assignment_item_reports(id,assignment_id,student_id,round_number,item_id,prompt,\n    exercise_direction,submitted_answers,accepted_answers,consulted,app_version,variant_id,model_answer,attempt_details,exercise_type)');
sql=sql.replace("coalesce((p_payload->>'consulted')::boolean,false),p_payload->>'app_version');",
  "coalesce((p_payload->>'consulted')::boolean,false),p_payload->>'app_version',p_payload->>'variant_id',p_payload->>'model_answer',coalesce(p_payload->'attempt_details','[]'::jsonb),p_payload->>'exercise_type');");
sql=sql.replace("'consulted',r.consulted,'app_version',r.app_version", "'exercise_type',r.exercise_type,'attempt_details',r.attempt_details,'variant_id',r.variant_id,'model_answer',r.model_answer,'consulted',r.consulted,'app_version',r.app_version");
sql=sql.replace('    perform private.register_assignment_completion(v_report.assignment_id,v_report.student_id);', `    update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
      where r.assignment_id=v_report.assignment_id and r.student_id=v_report.student_id and r.round_number=v_report.round_number
        and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
          and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
    perform private.register_assignment_completion(v_report.assignment_id,v_report.student_id);`);
sql=sql.replace("    or pg_catalog.char_length(coalesce(p_payload->>'app_version',''))>64", `    or pg_catalog.char_length(coalesce(p_payload->>'app_version',''))>64
    or pg_catalog.char_length(coalesce(p_payload->>'variant_id',''))>120
    or pg_catalog.char_length(coalesce(p_payload->>'exercise_type',''))>40
    or pg_catalog.char_length(coalesce(p_payload->>'model_answer',''))>2000
    or pg_catalog.jsonb_typeof(coalesce(p_payload->'attempt_details','[]'::jsonb)) is distinct from 'array'
    or pg_catalog.jsonb_array_length(coalesce(p_payload->'attempt_details','[]'::jsonb))>1000
    or pg_catalog.char_length(coalesce(p_payload->'attempt_details','[]'::jsonb)::text)>1000000`);
// The source client defaults retain old assignments. New drafts opt into
// variants explicitly; published options cannot change under an active round.
sql=sql.replace('v_enabled boolean; v_result jsonb;', 'v_enabled boolean; v_variants boolean; v_result jsonb;');
sql=sql.replace('  v_result:=private.save_assignment_pre_sentences_impl(p_payload);', `  v_variants:=coalesce((p_payload->>'use_exercise_variants')::boolean,v_old.use_exercise_variants,false);
  if v_variants and coalesce(p_payload->>'completion_strategy',v_old.completion_strategy,'rounds')<>'rounds'
    then raise exception 'variants require rounds'; end if;
  if v_id is not null and v_old.status<>'draft' and v_old.use_exercise_variants is distinct from v_variants
    then raise exception 'published variant mode is immutable'; end if;
  v_result:=private.save_assignment_pre_sentences_impl(p_payload);`);
sql=sql.replace('set include_integrative_sentences=v_enabled', 'set include_integrative_sentences=v_enabled,use_exercise_variants=v_variants');
sql=sql.replace(/left join public\.assignment_completions done on ([^\n]+)/g, (m)=>m+' and done.reopened_at is null');
sql=sql.replace(/'include_integrative_sentences',a\.include_integrative_sentences/g,
  "'use_exercise_variants',a.use_exercise_variants,'include_integrative_sentences',a.include_integrative_sentences");
sql=sql.replace("'wrong_count',ri.wrong_count,'consulted',ri.consulted,'completed_at',ri.completed_at",
  "'wrong_count',ri.wrong_count,'consulted',ri.consulted,'completed_at',ri.completed_at,'completion_kind',ri.completion_kind");
sql=sql.replace("if coalesce(p_session->>'exercise_key','') not like 'curated-%' then return v_result; end if;", `if coalesce(p_session->>'exercise_key','') not like 'curated-%' and not (
    nullif(p_session->>'assignment_id','') is null and p_session->>'exercise_key' in ('number-nl-fr','number-fr-nl')
    and pg_catalog.jsonb_typeof(p_session->'question_submissions')='array'
    and pg_catalog.jsonb_array_length(p_session->'question_submissions')>0) then return v_result; end if;`);
sql=sql.replace(/\[0-9\]\{3\}\$'/g,()=>"[0-9]{3,6}$'");
sql=sql.replace("ps.exercise_key like 'curated-%'", `(ps.exercise_key like 'curated-%' or ps.assignment_id is null and
        exists(select 1 from public.practice_question_submissions q where q.session_id=ps.id))`);
// Missing SQL values must fail closed, not bypass a nullable IF expression.
sql=sql.replace(/pg_catalog\.jsonb_typeof\(([^\n]+?)\)<>/g,'pg_catalog.jsonb_typeof($1) is distinct from ');
// Existing immutable rounds must not be reselected from updated history.
sql=sql.replace('  if v_round>=3 and (', '  if v_existing is null and v_round>=3 and (');
sql=sql.replace('  if v_round>1 and not exists', '  if v_existing is null and v_round>1 and not exists');
const selectRound=`  select r.selected_item_ids into v_existing from public.assignment_rounds r
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round for update;`;
sql=sql.replace(selectRound,'');
sql=sql.replace('  if v_round<=2 and (',selectRound+'\n  if v_round<=2 and (');
// For a rejected question, old correct evidence cannot close a later cycle.
sql=sql.replace('and pa.created_at>v_report.resolved_at;', `and pa.created_at>v_report.resolved_at
        and not exists(select 1 from public.practice_question_submissions q
          where q.session_id=pa.session_id and pa.client_attempt_id=any(q.client_evidence_ids));
    select least(v_correct,min(q.created_at)) into v_correct
      from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
      where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
        and q.round_item_id=v_report.item_id and q.was_correct and q.created_at>v_report.resolved_at;`);
// Fully correct variant questions close their anchor once; partial gaps don't.
sql=sql.replace('  for v_report in select latest.item_id', `  update public.assignment_round_items ri set
    completed_at=case when ri.completion_kind in ('reported_pending','teacher_approved') then ri.completed_at else (
      select min(correct_at) from (
        select q.created_at correct_at from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
            and q.round_item_id=ri.item_id and q.was_correct
        union all select pa.created_at from public.practice_attempts pa join public.practice_sessions ps on ps.id=pa.session_id
          where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round
            and (pa.item_id=ri.item_id or ri.item_id=any(pa.equivalent_item_ids)) and pa.was_correct
            and not exists(select 1 from public.practice_question_submissions q
              where q.session_id=pa.session_id and pa.client_attempt_id=any(q.client_evidence_ids))
      ) correct_questions) end
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round
      and exists(select 1 from public.practice_question_submissions q join public.practice_sessions ps on ps.id=q.session_id
        where ps.assignment_id=v_assignment and ps.student_id=v_student and ps.assignment_round_number=v_round and q.round_item_id=ri.item_id);
  for v_report in select latest.item_id`);
sql=sql.replace("  update public.assignment_rounds r set completed_at=null\n", `  update public.assignment_round_items ri set completion_kind=case when completed_at is null then null
    when completion_kind in ('reported_pending','teacher_approved') then completion_kind else 'correct' end
    where ri.assignment_id=v_assignment and ri.student_id=v_student and ri.round_number=v_round;
  update public.assignment_rounds r set completed_at=coalesce(r.completed_at,pg_catalog.now())
    where r.assignment_id=v_assignment and r.student_id=v_student and r.round_number=v_round
      and not exists(select 1 from public.assignment_round_items ri where ri.assignment_id=r.assignment_id
        and ri.student_id=r.student_id and ri.round_number=r.round_number and ri.completed_at is null);
  update public.assignment_rounds r set completed_at=null\n`);
// Preserve compatibility with submissions stored by older clients, which did
// not provide per-submission evidence links. Their original grouping remains.
sql=sql.replace(/pa\.client_attempt_id=any\((q|linked)\.client_evidence_ids\)/g, (m,a)=>
  '('+m+' or not '+a+'.evidence_linked and '+a+'.variant_id=pa.legacy_item_id and ('+a+'.round_item_id is null or '+a+'.round_item_id=pa.item_id))');
sql=sql.replace("  if not exists(select 1 from public.assignment_item_reports x where x.assignment_id=v_assignment", `  update public.assignment_completions c set reopened_at=coalesce(c.reopened_at,pg_catalog.now())
    where c.assignment_id=v_assignment and c.student_id=v_student
      and exists(select 1 from public.assignment_rounds r where r.assignment_id=c.assignment_id
        and r.student_id=c.student_id and r.completed_at is null);
  if not exists(select 1 from public.assignment_item_reports x where x.assignment_id=v_assignment`);
// A multi-gap question can reliably score a secondary permanent goal without
// completing its anchor question. Persist those per-goal outcomes so client
// progress, backend progress and round-3/4 priorities use the same events.
const finalIngest=functions(sql).find(f=>f.name==='private.ingest_practice_bundle_impl').sql;
let withTargets=finalIngest.replace('created_at,client_evidence_ids,evidence_linked)',
  'created_at,client_evidence_ids,evidence_linked,target_results)');
withTargets=withTargets.replace('v_reopen_report uuid;', 'v_reopen_report uuid; v_previous_defer text;');
withTargets=withTargets.replace('  v_result:=private.ingest_practice_bundle_pre_report_reliability_impl(p_identity_token,p_session,p_attempts);', `  v_previous_defer:=pg_catalog.current_setting('mon_parcours.defer_round_completion',true);
  v_assignment:=nullif(p_session->>'assignment_id','')::uuid;
  if v_assignment is not null and nullif(p_session->>'assignment_round_number','') is not null then
    perform pg_catalog.set_config('mon_parcours.defer_round_completion',v_assignment::text,true);
  end if;
  v_result:=private.ingest_practice_bundle_pre_report_reliability_impl(p_identity_token,p_session,p_attempts);
  perform pg_catalog.set_config('mon_parcours.defer_round_completion',coalesce(v_previous_defer,''),true);`);
withTargets=withTargets.replace("and not (e.value ? 'client_submission_id')))",
  "and not (e.value ? 'client_submission_id')),coalesce(v_submission->'target_results','[]'::jsonb))");
withTargets=withTargets.replace("      or coalesce(v_submission->>'created_at','')=''", `      or coalesce(v_submission->>'created_at','')=''
      or jsonb_typeof(coalesce(v_submission->'target_results','[]'::jsonb)) is distinct from 'array'
      or jsonb_array_length(coalesce(v_submission->'target_results','[]'::jsonb))>20
      or jsonb_array_length(coalesce(v_submission->'target_results','[]'::jsonb))<>(select count(distinct target.value->>'item_id')
        from jsonb_array_elements(coalesce(v_submission->'target_results','[]'::jsonb)) target)
      or exists(select 1 from jsonb_array_elements(coalesce(v_submission->'target_results','[]'::jsonb)) target
        where jsonb_typeof(target.value->'was_correct') is distinct from 'boolean'
          or not exists(select 1 from public.assignment_round_items allowed where allowed.assignment_id=v_assignment
            and allowed.student_id=v_student and allowed.round_number=v_round and allowed.item_id=target.value->>'item_id')
          or target.value->>'item_id'=v_submission->>'item_id' and target.value->'was_correct' is distinct from v_submission->'was_correct'
          or v_submission->'was_correct'='true'::jsonb and target.value->'was_correct'='false'::jsonb)`);
for(const scope of ['selected.item_id','ri.item_id']) {
  withTargets=withTargets.replaceAll('q.round_item_id='+scope+'\n            and q.was_correct=false',
    '(q.round_item_id='+scope+' or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>\'item_id\'='+scope+' and target.value->\'was_correct\'=\'false\'::jsonb))\n            and q.was_correct=false');
  withTargets=withTargets.replaceAll('q.round_item_id='+scope+' and q.was_correct',
    '(q.round_item_id='+scope+' and q.was_correct or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>\'item_id\'='+scope+' and target.value->\'was_correct\'=\'true\'::jsonb))');
}
withTargets=withTargets.replace('and q.round_item_id=ri.item_id);',
  "and (q.round_item_id=ri.item_id or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=ri.item_id)));");
withTargets=withTargets.replace('q.round_item_id=v_report.item_id and q.was_correct',
  "(q.round_item_id=v_report.item_id and q.was_correct or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=v_report.item_id and target.value->'was_correct'='true'::jsonb))");
withTargets=withTargets.replace("or stored.created_at<>(v_submission->>'created_at')::timestamptz))", `or stored.created_at<>(v_submission->>'created_at')::timestamptz
          or stored.round_item_id is distinct from v_submission->>'item_id'
          or stored.target_results is distinct from coalesce(v_submission->'target_results','[]'::jsonb)
          or stored.client_evidence_ids is distinct from array(select (e.value->>'client_attempt_id')::uuid from jsonb_array_elements(p_attempts) e
            where e.value->>'client_submission_id'=v_submission->>'client_submission_id'))) `);
sql=sql.replace(finalIngest,()=>withTargets);
const reportBody=functions(sql).find(f=>f.name==='private.report_assignment_item_impl').sql;
sql=sql.replace(reportBody,()=>reportBody.replace('q.round_item_id=v_item and q.was_correct=false',
  "(q.round_item_id=v_item or exists(select 1 from jsonb_array_elements(q.target_results) target where target.value->>'item_id'=v_item and target.value->'was_correct'='false'::jsonb)) and q.was_correct=false"));
// Apply final role grants to the full graph. Historical helper nodes remain
// private; public RPCs retain their original student/teacher boundary.
sql += '\n'+p12.slice(p12.indexOf('revoke all on function'),p12.indexOf('create function public.assignment_sentence_sync_version'));
const studentRPC=['ingest_practice_bundle(text,jsonb,jsonb)','get_student_assignments(text)','report_assignment_item(text,jsonb)','curated_sync_version()','assignment_sentence_sync_version()'];
const teacherRPC=['save_assignment(jsonb)','get_teacher_assignments()','get_teacher_assignment_detail(uuid)','get_teacher_assignment_reports(uuid)','resolve_assignment_item_report(uuid,text)','restore_assignment(uuid)','get_class_activity_monitor(uuid,timestamptz,timestamptz,text,text,text,text,uuid,text,boolean)'];
for(const [names,roles] of [[studentRPC,'anon,authenticated'],[teacherRPC,'authenticated']]) for(const name of names)
  sql+=`\nrevoke all on function public.${name} from public,anon,authenticated,service_role;\ngrant execute on function public.${name} to ${roles};`;
sql+=`\nrevoke all on function private.register_assignment_completion_pre_reports(uuid,uuid),private.register_assignment_completion(uuid,uuid),private.assignment_attempt_inserted(),
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
`;
sql+=`
-- SQL Editor-only verification helper. Read-only; no Data API access.
create or replace function private.mon_parcours_upgrade_verification()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare run private.mon_parcours_upgrade_runs%rowtype; r record; current_count bigint;
  counts jsonb := '{}'::jsonb; missing jsonb; drift jsonb; grant_drift jsonb; nullability_drift jsonb; schema_ok boolean;
begin
  select * into run from private.mon_parcours_upgrade_runs order by started_at desc,id desc limit 1;
  select coalesce(jsonb_agg(e.tbl||'.'||e.col),'[]'::jsonb) into missing from
    (values ${Object.entries(expected).flatMap(([table,cols])=>Object.entries(cols).map(([col,type])=>`('${table}','${col}','${type}')`)).join(',\n')}) e(tbl,col,typ)
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
    (values ${Object.entries({...requiredNotNull,assignments:['include_integrative_sentences','use_exercise_variants']}).flatMap(([table,cols])=>cols.map(col=>`('${table}','${col}')`)).join(',\n')}) e(tbl,col)
    where not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||e.tbl)
      and a.attname=e.col and not a.attisdropped and a.attnotnull);
  select coalesce(jsonb_agg(jsonb_build_object('function',e.sig,'role',e.role,'expected_execute',e.allowed)),'[]'::jsonb) into grant_drift from
    (values ${[...studentRPC,'assignment_variant_sync_version()'].flatMap(name=>['anon','authenticated'].map(role=>`('public.${name}','${role}',true)`))
      .concat(teacherRPC.flatMap(name=>[`('public.${name}','anon',false)`,`('public.${name}','authenticated',true)`])).join(',\n')}) e(sig,role,allowed)
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
`;
fs.writeFileSync('supabase/phase10-12-state-aware-upgrade.sql',sql+'\n', 'utf8');
fs.writeFileSync('supabase/phase10-12-state-aware-verification.sql',
  '-- Read-only. Run AFTER phase10-12-state-aware-upgrade.sql in the Supabase SQL Editor.\n'+
  '-- New learner activity can increase counts; original rows were checked inside the migration transaction.\n'+
  'select private.mon_parcours_upgrade_verification() as verification;\n');
console.log('Generated standalone phase 10–12 repair; final amendments are applied below by this builder.');
