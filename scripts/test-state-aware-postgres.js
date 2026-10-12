// Optional, REAL PostgreSQL integration test in an in-memory PGlite database.
// No network or production connection. Install @electric-sql/pglite locally,
// then pass its module path, e.g. node scripts/test-state-aware-postgres.js ./tmp/sql-test/node_modules/@electric-sql/pglite
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(path.resolve(process.argv[2] || 'tmp/sql-test/node_modules/@electric-sql/pglite'));
const read=n=>fs.readFileSync('supabase/'+n+'.sql','utf8');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for(const n of ['schema','rls','phase4-management','phase5-school-email','phase5-active-time','phase5-mastery',
    'phase6-multi-teacher','phase7-assignments','phase7b-verb-mastery','phase8-class-monitor',
    'phase8b-student-detail-hotfix','phase8c-mastery-growth','phase9-task-rounds']) {
    await db.exec(read(n).replace(/create extension if not exists pgcrypto;/i,''));
  }
  await db.exec(`insert into auth.users(id,email) values('${uuid(1)}','teacher@example.test');
    insert into public.teachers(auth_user_id,email,display_name,role,is_active) values('${uuid(1)}','teacher@example.test','Test','admin',true)
      on conflict(auth_user_id) do update set role='admin',is_active=true;
    select set_config('request.jwt.claim.sub','${uuid(1)}',false);
    insert into public.classes(id,owner_id,name,class_code) values('${uuid(2)}','${uuid(1)}','Test','TEST');
    insert into public.students(id,class_id,display_name) values('${uuid(3)}','${uuid(2)}','Fictieve leerling');
    insert into public.assignments(id,created_by_teacher_id,title,status,published_at,completion_strategy,required_rounds)
      values('${uuid(4)}','${uuid(1)}','35/42 bewaard','published',now(),'rounds',3);
    insert into public.assignment_classes(assignment_id,class_id) values('${uuid(4)}','${uuid(2)}');
    insert into public.assignment_items(assignment_id,item_id,item_order)
      select '${uuid(4)}','uf1-item-'||lpad(n::text,6,'0'),n from generate_series(1,42) n;
    insert into public.assignment_rounds(assignment_id,student_id,round_number,selected_item_ids)
      select '${uuid(4)}','${uuid(3)}',1,array_agg(item_id order by item_order) from public.assignment_items;
    insert into public.assignment_round_items(assignment_id,student_id,round_number,item_id,selection_reason,completed_at)
      select '${uuid(4)}','${uuid(3)}',1,item_id,'full_round',case when item_order<=35 then now() else null end from public.assignment_items;`);
  return db;
}
async function exerciseReports(db) {
  await db.exec(`insert into public.assignments(id,created_by_teacher_id,title,status,published_at,completion_strategy,required_rounds,include_integrative_sentences,use_exercise_variants)
    values('${uuid(100)}','${uuid(1)}','Fictieve zinnentaak','published',now(),'rounds',2,true,true);
    insert into public.assignment_classes values('${uuid(100)}','${uuid(2)}',now());
    insert into public.assignment_items values('${uuid(100)}','uf1-item-000001',1),('${uuid(100)}','uf1-item-000002',2);`);
  const token=(await db.query(`select sync_token::text token from public.students where id='${uuid(3)}'`)).rows[0].token;
  const timestamp=()=>new Date().toISOString();
  const session={client_session_id:uuid(101),assignment_id:uuid(100),assignment_round_number:1,
    assignment_round_selected_item_ids:['uf1-item-000001','uf1-item-000002'],assignment_round_consulted_item_ids:[],
    course_key:'UF1',trajectory:'Trajet 1',top_category:'Atelier Parole',lesson:'Test',exercise_key:'assignment-mixed',
    mode:'practice',question_count:2,attempt_count:2,started_at:timestamp(),question_submissions:[
      {client_submission_id:uuid(102),variant_id:'T1-REV-001',item_id:'uf1-item-000001',was_correct:false,created_at:timestamp()},
      {client_submission_id:uuid(103),variant_id:'T1-REV-001',item_id:'uf1-item-000001',was_correct:false,created_at:timestamp()}]};
  const ingest=(s,a)=>db.query('select public.ingest_practice_bundle($1,$2::jsonb,$3::jsonb) result',[token,JSON.stringify(s),JSON.stringify(a)]);
  await ingest(session,[]);await ingest(session,[]);
  assert.equal(Number((await db.query('select count(*) n from public.practice_attempts')).rows[0].n),0,'wrong full sentence has no negative evidence');
  assert.equal(Number((await db.query('select count(*) n from public.practice_question_submissions')).rows[0].n),2,'question submissions are idempotent');
  const report={client_report_id:uuid(104),assignment_id:uuid(100),round_number:1,item_id:'uf1-item-000001',prompt:'Testzin',
    exercise_direction:'full-sentence-nl-fr',submitted_answers:['fout 1','fout 2'],accepted_answers:['Testantwoord'],app_version:'test'};
  await db.query('select public.report_assignment_item($1,$2::jsonb)',[token,JSON.stringify(report)]);
  assert.equal((await db.query(`select completion_kind from public.assignment_round_items where assignment_id='${uuid(100)}' and item_id='uf1-item-000001'`)).rows[0].completion_kind,'reported_pending');
  const attempt={client_attempt_id:uuid(105),item_id:'uf1-item-000002',equivalent_item_ids:['uf1-item-000002'],
    item_type:'vocabulary',exercise_key:'vocab-nl-fr',mode:'practice',trajectory:'Trajet 1',top_category:'Atelier Parole',
    lesson:'Test',prompt:'Test',correct_answers:['Testantwoord'],was_correct:true,attempt_number:1,created_at:timestamp()};
  await ingest({...session,attempt_count:3},[attempt]);
  const later={...session,client_session_id:uuid(106),assignment_round_number:2,attempt_count:0,question_submissions:[]};
  await ingest(later,[]);
  assert.equal(Number((await db.query(`select count(*) n from public.assignment_rounds where assignment_id='${uuid(100)}'`)).rows[0].n),2,'pending report does not block the next round');
  // Simulate a historical completion created by an older partially installed
  // pipeline. The repair must retain the original event after rejection.
  await db.exec(`insert into public.assignment_completions(assignment_id,student_id,acquired_count_at_completion,total_count_at_completion,acquired_percentage_at_completion)
    values('${uuid(100)}','${uuid(3)}',0,2,0);`);
  await db.query('select public.resolve_assignment_item_report($1,$2)',[uuid(104),'rejected']);
  assert.equal(Number((await db.query(`select count(*) n from public.assignment_completions where assignment_id='${uuid(100)}' and reopened_at is not null`)).rows[0].n),1,'original completion event remains');
  assert.equal(Number((await db.query('select count(*) n from public.assignment_completion_reopenings')).rows[0].n),1,'reopening is audited');
  await ingest(session,[attempt]);await ingest(later,[]);
  assert.equal((await db.query(`select completed_at from public.assignment_round_items where assignment_id='${uuid(100)}' and round_number=1 and item_id='uf1-item-000001'`)).rows[0].completed_at,null,'old replay cannot complete a rejected sentence');
  assert.equal(Number((await db.query(`select count(*) n from public.assignment_rounds where assignment_id='${uuid(100)}'`)).rows[0].n),2,'later rounds survive the rejection and replay');
}
(async()=>{
  for(const state of ['phase9','partial10-and-life','phase10-life','phase11','phase12']) {
    const db=await setup();
    try {
      if(state==='partial10-and-life') await db.exec(`alter table public.assignment_round_items add column completion_kind text;
        create function private.assignment_auto_archive_grace_days() returns integer language sql as $$ select 99 $$;
        alter table public.assignments add column include_integrative_sentences boolean not null default false;`);
      if(['phase10-life','phase11','phase12'].includes(state)) {
        await db.exec(read('phase10-item-reports')); await db.exec(read('phase11-teacher-task-lifecycle'));
      }
      if(['phase11','phase12'].includes(state)) await db.exec(read('phase11-curated-variants'));
      if(state==='phase12') await db.exec(read('phase12-report-reliability'));
      for(let run=0;run<2;run++) {
        await db.exec(read('phase10-12-state-aware-upgrade'));
        const result=await db.query('select private.mon_parcours_upgrade_verification() v');
        assert.equal(result.rows[0].v.schema_ready,true);
        assert.equal(result.rows[0].v.original_rows_verified_at_commit,true);
        assert.deepEqual(result.rows[0].v.function_definition_drift,[]);
        const progress=await db.query(`select count(*) total,count(completed_at) done from public.assignment_round_items`);
        assert.equal(Number(progress.rows[0].total),42); assert.equal(Number(progress.rows[0].done),35);
        const flags=await db.query('select include_integrative_sentences,use_exercise_variants from public.assignments');
        assert.deepEqual(flags.rows[0],{include_integrative_sentences:false,use_exercise_variants:false});
      }
      await exerciseReports(db);
      console.log('PostgreSQL upgrade + repeat passed:',state);
    } finally { await db.close(); }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
