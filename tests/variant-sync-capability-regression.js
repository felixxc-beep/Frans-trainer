const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const storage=new Map([['monParcoursProgressV1','bestaande voortgang']]);
const calls=[];let ready=false;
const context=vm.createContext({console,setTimeout(){},localStorage:{
  getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  window:{addEventListener(){},StudentIdentity:{
    getCurrentStudentIdentity:()=>({verified:true,provider:'school_email',subject:'student'}),getSyncCredential:()=> 'token'},
    MonParcoursSupabase:{isConfigured:()=>true,async rpc(name){calls.push(name);
      if(name==='assignment_variant_sync_version') return ready?1:null;
      if(name==='assignment_sentence_sync_version'||name==='curated_sync_version') return 1;
      return {accepted:true};}}}});
vm.runInContext(fs.readFileSync('sync-manager.js','utf8'),context);
(async()=>{
  context.window.MonParcoursSync.enqueueSession({client_session_id:'numbers',identity_subject:'student',
    session:{exercise_key:'number-nl-fr',question_submissions:[{variant_id:'T6-NUM-GENERATED-078814'}]},
    attempts:[{client_attempt_id:'evidence',client_submission_id:'question'}]});
  const first=await context.window.MonParcoursSync.flush();
  assert.equal(first.sent,0);assert.equal(first.pending,1);
  assert.ok(!calls.includes('ingest_practice_bundle'),'unsupported server must not acknowledge new number evidence as a question outcome');
  ready=true;
  const second=await context.window.MonParcoursSync.flush();
  assert.equal(second.sent,1);assert.equal(second.pending,0);
  assert.equal(calls.filter(n=>n==='ingest_practice_bundle').length,1);
  assert.equal(storage.get('monParcoursProgressV1'),'bestaande voortgang');
  console.log('VARIANT-SYNC GESLAAGD: queue blijft intact zonder capability; exacte inzending verstuurd na upgrade.');
})().catch(e=>{console.error(e);process.exitCode=1;});
