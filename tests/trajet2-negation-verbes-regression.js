const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../exercise-variants.js");
const policy = require("../exercise-policy.js");

const app = fs.readFileSync("app.js","utf8");
const bank = JSON.parse(fs.readFileSync("data/exercise-variants.json","utf8"));
const course = JSON.parse(fs.readFileSync("data/course.json","utf8"));
const home = fs.readFileSync("index.html","utf8");
const teacherHtml = fs.readFileSync("teacher.html","utf8");
const teacher = fs.readFileSync("teacher.js","utf8");
const unit = course.trajectories[1];
const goals = unit.items.filter(item=>item.lesson==="La négation");
const variants = bank.variants.filter(item=>item.trajectory==="Trajet 2" && item.kind==="grammar");
const id = n => "uf1-item-"+String(n).padStart(6,"0");

assert.equal(unit.items.length,148,"Do not change Trajet 2 course goals");
assert.equal(goals.length,5,"Five stable negation goals");
assert.deepEqual(goals.map(row=>row.id),[276,277,278,279,280].map(id));
assert.deepEqual(engine.validateBank(bank,course),{variants:1797,permanentItems:1036});
assert.equal(variants.length,60);

for (const variant of variants) {
  const question = engine.compileVariant(variant,course);
  const accepted = variant.scoring === "multi_gap"
    ? variant.gaps.map(gap=>gap.accepted_answers[0])
    : variant.accepted_answers[0];
  assert.equal(engine.grade(question,accepted).correct,true,variant.id+" must grade its model answer");
}
for (const [category,count] of [
  ["ne ... pas",14],["ne ... plus",9],["ne ... jamais",9],
  ["article après négation",14],["négation avec être",4]
]) {
  const goal = goals.find(row=>row.category===category);
  const list=engine.eligibleVariants(bank,course,{
    trajectory:"Trajet 2",top_category:"Atelier Grammaire",lesson:"La négation",
    block:"À retenir",subsection:goal.subsection,category
  },[goal.id]);
  assert.equal(list.length,count,category+" exercise coverage");
}
for (const name of ["T2-GRAM-JAM-002","T2-GRAM-JAM-004","T2-GRAM-JAM-005"]) {
  const variant=variants.find(v=>v.id===name);
  assert.ok(variant.gaps.every(g=>g.targets[0]===id(278)),name+" must credit jamais, not pas");
}
for (const [name,target] of [
  ["T2-GRAM-MIX-007",id(277)],["T2-GRAM-MIX-008",id(278)]
]) {
  const variant=variants.find(v=>v.id===name);
  assert.ok(variant.gaps.every(g=>g.targets[0]===target),name+" must credit the actual rule");
}
for (const suffix of ["009","010","011","012"]) {
  const variant=variants.find(v=>v.id==="T2-GRAM-ART-"+suffix);
  assert.equal(engine.compileVariant(variant,course).stableItemId,id(279),
    "A Trajet 2 task must use its own primary goal");
  assert.equal(variant.gaps[1].targets[0],id(279));
  assert.match(variant.gaps[0].targets[0],/^uf1-item-0001(26|28|32)$/);
}
for (const variant of variants.filter(v=>/^T2-GRAM-MIX-00[1-6]$/.test(v.id))) {
  assert.doesNotMatch(variant.prompt,/\(ne\s*\.{3}/i,
    variant.id+" must not give away the negation form");
  assert.match(variant.prompt,/Nee,/,
    variant.id+" must clarify pas/plus/jamais through its meaning");
}
assert.match(variants.find(v=>v.id==="T2-GRAM-JAM-008").prompt,/Vous deux/,
  "Vous must be identified as plural");
assert.doesNotMatch(variants.find(v=>v.id==="T2-GRAM-PLUS-005").prompt,/cohabitons/,
  "Avoid non-textbook verb cohabiter");
assert.doesNotMatch(variants.find(v=>v.id==="T2-GRAM-MIX-009").prompt,/aucune/,
  "Do not require an unknown negation");
for (const suffix of ["013","014"]) {
  const variant=variants.find(v=>v.id==="T2-GRAM-ART-"+suffix);
  assert.match(variant.accepted_answers[0],/d[’'](ami|amis)/);
  const q=engine.compileVariant(variant,course);
  assert.equal(engine.grade(q,variant.accepted_answers[0].replace(/d[’'](ami)/,"de $1")).correct,false);
}
const formOptions=policy.options(goals,bank,course,{
  trajectory:"Trajet 2",top_category:"Atelier Grammaire",lesson:"La négation"
});
assert.ok(formOptions.some(x=>x.key==="grammar_context"));
assert.ok(formOptions.some(x=>x.key==="grammar_mixed"));
assert.ok(policy.candidates(goals,bank,course).some(v=>v.id==="T2-GRAM-ART-009"),
  "Task selection should offer a contrast with a prerequired article target");

function body(start,end) {
  const from=app.indexOf(start),until=app.indexOf(end,from+start.length);
  assert.ok(from>=0 && until>from,"Missing app helper "+start);
  return app.slice(from,until);
}
const makeQuestion=(base,prompt,answers,instruction,context)=>({
  ...base,prompt,answers:[...new Set(answers)],instruction,context:context||""
});
const source=body("function buildQuestions(items, exerciseKey) {","\nfunction grammarRuleQuestion(");
const build=new Function("window","state","makeQuestion","mergeEquivalentQuestions",
  "answerList","dutchAnswers","unique","trajet2FamilyQuestions",
  "isDynamicNumberItem","buildDynamicNumberQuestions","allCourseItems",
  source+"\nreturn { buildQuestions, trajet2DutchConjugationPrompt };")(
  {},{data:course,variantBank:bank},makeQuestion,values=>values,
  answer=>[answer],answer=>[answer],values=>values,()=>[],()=>false,()=>[],()=>[]
);
const verbItems=unit.items.filter(item=>item.type==="verb").map(item=>({...item,_trajectoryIndex:1,_id:item.id}));
assert.equal(verbItems.length,15,"All 15 Trajet 2 verbs must stay in scope");
const dutch=build.buildQuestions(verbItems,"verb-nl-conj");
assert.equal(dutch.length,135,"All 15 verbs x 9 concrete subject forms must be available");
for (const question of dutch) {
  assert.match(question.instruction,/Vertaal en vervoeg/);
  assert.ok(!question.prompt.includes(question.item.infinitive),
    "Dutch question must not give away French infinitive: "+question.prompt);
  assert.match(question.answers[0],/^(je|tu|il|elle|on|nous|vous|ils|elles) /);
}
const lookup=(infinitive,person)=>dutch.find(q=>q.item.infinitive===infinitive && q.itemVariant===person);
assert.deepEqual([lookup("partir","je").prompt,lookup("partir","je").answers[0]],["ik vertrek","je pars"]);
assert.deepEqual([lookup("choisir","nous").prompt,lookup("choisir","nous").answers[0]],["wij kiezen","nous choisissons"]);
assert.deepEqual([lookup("finir","elles").prompt,lookup("finir","elles").answers[0]],
  ["zij eindigen (alleen meisjes)","elles finissent"]);
assert.deepEqual([lookup("réfléchir","tu").prompt,lookup("réfléchir","tu").answers[0]],
  ["jij denkt na","tu réfléchis"]);
assert.deepEqual([lookup("sortir","on").prompt,lookup("sortir","on").answers[0]],
  ["men gaat uit","on sort"]);
const earlier = course.trajectories[0].items.find(item=>item.type==="verb");
const earlierQuestions=build.buildQuestions([{...earlier,_id:earlier.id,_trajectoryIndex:0}],"verb-nl-conj");
assert.ok(earlierQuestions.length>0);
assert.match(earlierQuestions[0].prompt,/ — /,
  "Older Trajets keep their existing prompts");

const hint=new Function(body("function trajet2NegationHint(","\nfunction nearCorrectHint(")+
  "\nreturn trajet2NegationHint;")();
const article=variants.find(v=>v.id==="T2-GRAM-ART-009");
const articleQ=engine.compileVariant(article,course);
const articleWrong=engine.grade(articleQ,["des","des"]);
assert.match(hint(articleQ,["des","des"],articleWrong).nl,/un\/une\/des/);
const plus=variants.find(v=>v.id==="T2-GRAM-PLUS-002");
const plusQ=engine.compileVariant(plus,course);
assert.match(hint(plusQ,["n'","pas"],engine.grade(plusQ,["n'","pas"])).nl,/klinker/);

const mixed=new Function("currentTrajectory","currentUnit","state","curatedVariantsForUnit","window",
  body("function curatedVariantsForScope(","\nfunction curatedKeysForScope(")+
  "\nreturn curatedVariantsForScope;")(
  ()=>unit,()=>unit.units.find(row=>row.title==="La négation"),
  {selectedScope:{category:"Mélange"},variantBank:bank,data:course},
  ()=>variants,{MonParcoursExerciseVariants:engine}
);
assert.equal(mixed("curated-grammar",{category:"Mélange"}).length,14,
  "Mixed practice must be offered as its own scope");
assert.match(app,/scopeChoiceCard\(unit, "", "", "Mélange"/);
assert.match(app,/const defaultExercise = !assignment && unit.top_category === "Atelier Verbes"/);
assert.match(app,/question.variantKind === "grammar"/,
  "Grammar feedback should be next to the input");
assert.match(app,/if \(!round.items\[result.item_id\]\) return;/,
  "Other trajectory prerequisites cannot become new assigned round goals");
assert.match(home,/app\.js\?v=20261127-negation-verbes-1/);
assert.match(home,/exercise-variants\.js\?v=20261127-negation-verbes-1/);
assert.match(home,/exercise-policy\.js\?v=20261127-negation-verbes-1/);
assert.match(teacherHtml,/teacher\.js\?v=20261127-negation-verbes-1/);
assert.match(teacher,/exercise-variants\.json\?v=20261127-negation-verbes-1/);

console.log("NEGATION + NL VERBS OK: 60 negation variants, 135 Dutch conjugation prompts, stable goals and tasks.");
