// Tests for the real-backend adapter (lib/backend-wire.ts, lib/http-services.ts).
// Run with: npm test
import ts from 'typescript';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const testModule=new Module(fileURLToPath(import.meta.url));
function load(file){const m=new Module(file,testModule);m.filename=file;m.paths=require.resolve.paths('typescript');const orig=m.require.bind(m);m.require=(id)=>{const base=path.resolve(path.dirname(file),id);const c=[base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p));return id.startsWith('.')&&c?load(c):orig(id);};m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);return m.exports;}
const wire=load(path.resolve('lib/backend-wire.ts'));
const http=load(path.resolve('lib/http-services.ts'));
const ex=load(path.resolve('lib/extraction.ts'));const md=load(path.resolve('lib/mock/data.ts'));ex.samples=md.samples;
const trip=ex.samples[0].data, laptop=ex.samples[1].data;
const req=(extraction,over={})=>({originalQuestion:'q',extraction,edits:{},answers:{},parameters:{},...over});
const idx=(e,v)=>e.assumptions.findIndex(a=>a.variable===v);

(async()=>{
// ---- request: toCalculateWire ----
let w=wire.toCalculateWire(req(laptop));
assert.equal(w.assumptions.length,laptop.assumptions.length);
assert.equal(w.assumptions[0].edited_by_user,false);
assert.ok(!('clarification_questions' in w.extraction_meta)&&!('assumptions' in w.extraction_meta));
assert.equal(w.extraction_meta.goal_summary,laptop.goal_summary);
const inc=idx(laptop,'monthly_income');
w=wire.toCalculateWire(req(laptop,{edits:{[inc]:1800},answers:{'input-foo_bar':'12.5','extraction-question-0':'about 40 hours','extraction-question-1':'  '},parameters:{monthly_contribution:'350','x':'', 'y':'abc'}}));
assert.deepEqual([w.assumptions[inc].value,w.assumptions[inc].source,w.assumptions[inc].edited_by_user],[1800,'stated',true]);
assert.deepEqual(w.extra_inputs,{foo_bar:12.5});
assert.equal(w.answers.length,1);assert.equal(w.answers[0].answer,'about 40 hours');assert.equal(w.answers[0].target_variable,laptop.clarification_questions[0].target_variable);
assert.deepEqual(w.parameters,{monthly_contribution:350});
w=wire.toCalculateWire(req(laptop,{edits:{[inc]:null}}));assert.equal(w.assumptions[inc].source,'missing');

// ---- response: needs_input maps to editable question bound to the fact ----
let r=wire.fromCalculateWire({status:'needs_input',message:'Need more',missing_inputs:[{variable:'monthly_income',unit:'$/month'},{variable:'brand_new_var',label:'Brand new?'}]},req(laptop));
assert.equal(r.status,'needs_input');assert.equal(r.questions.length,2);
assert.deepEqual(r.questions[0].binding,{kind:'fact',index:inc});assert.equal(r.questions[0].required,true);
assert.deepEqual(r.questions[0].extractionQuestionIndices,[laptop.clarification_questions.findIndex(q=>q.target_variable==='monthly_income')]);
assert.deepEqual(r.questions[1].binding,{kind:'answer',key:'input-brand_new_var'});
// edited value shows up in the question
r=wire.fromCalculateWire({status:'needs_input',message:'m',missing_inputs:[{variable:'monthly_income'}]},req(laptop,{edits:{[inc]:1800}}));assert.equal(r.questions[0].value,1800);

// ---- ready: placeholder -> inline segments ----
const readyWire={status:'conditional',answer:{headline:'Yes, if you save {monthly_contribution} per month.',detail:'d'},
 parameters:[{key:'monthly_contribution',label:'Save each month',value:350,unit:'$',min:0,max:500,step:0.01}],
 metrics:[{label:'Goal',value:'$3,000'}],explanations:[{label:'a',text:'b'}],limitations:['l'],
 assumptions:[{id:'s',text:'ok?',parameter_key:'monthly_contribution'},{text:'plain'}]};
r=wire.fromCalculateWire(readyWire,req(trip));
assert.equal(r.status,'conditional');assert.equal(r.answer.headline,'Yes, if you save $350 per month.');
assert.deepEqual(r.answer.segments.map(s=>s.type),['text','parameter','text']);assert.equal(r.answer.segments[1].prefix,'$');
assert.equal(r.parameters[0].control.type,'range');assert.equal(r.assumptions[0].parameter.id,'monthly_contribution');assert.equal(r.assumptions[1].id,'assumption-1');
// out-of-range default must not break the slider
r=wire.fromCalculateWire({...readyWire,parameters:[{...readyWire.parameters[0],value:900}]},req(trip));assert.equal(r.parameters[0].control.max,900);
// headline without placeholders stays plain
r=wire.fromCalculateWire({status:'ready',answer:{headline:'All good.'}},req(trip));assert.equal(r.answer.segments,undefined);
// unknown placeholder is left alone
r=wire.fromCalculateWire({status:'ready',answer:{headline:'Save {nope}.'}},req(trip));assert.equal(r.answer.headline,'Save {nope}.');
// null lists from Python are tolerated
r=wire.fromCalculateWire({status:'unsupported',message:'nope',parameters:null,metrics:null,missing_inputs:null},req(trip));assert.equal(r.nextActions[0].action,'review_information');

// ---- invalid payloads are rejected (silence the expected console noise) ----
const err=console.error;console.error=()=>{};
for(const bad of [null,[],{status:'stale',message:'x'},{status:'ready'},{status:'ready',answer:{headline:' '}},{status:'conditional',answer:{headline:'x'},parameters:[{key:'a b',label:'l',value:1}]},{status:'conditional',answer:{headline:'x'},parameters:[{key:'a',label:'l',value:'1'}]},{status:'conditional',answer:{headline:'x'},parameters:[{key:'a',label:'l',value:1},{key:'a',label:'l',value:2}]},{status:'ready',answer:{headline:'x'},metrics:[{label:'a'}]},{status:'ready',answer:{headline:'x'},assumptions:[{text:'t',parameter_key:'missing'}]}])
  assert.throws(()=>wire.fromCalculateWire(bad,req(trip)),/Invalid calculation response/,JSON.stringify(bad));
console.error=err;

// ---- HttpCalculationService with fake fetch ----
const ok=(body,status=200)=>async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
let seen;
const svc=new http.HttpCalculationService(async(u,i)=>{seen={u,body:JSON.parse(i.body)};return ok(readyWire)();});
r=await svc.calculate(req(trip,{parameters:{monthly_contribution:'200'}}));
assert.equal(seen.u,'/api/backend/calculate');assert.deepEqual(seen.body.parameters,{monthly_contribution:200});assert.equal(r.status,'conditional');
const quiet=console.error;console.error=()=>{};
await assert.rejects(new http.HttpCalculationService(ok({detail:'boom'},500)).calculate(req(trip)),/Calculation unavailable\. \(boom\)/);
await assert.rejects(new http.HttpCalculationService(async()=>{throw new TypeError('x')}).calculate(req(trip)),/could not reach the server/);
await assert.rejects(new http.HttpCalculationService(ok({status:'ready'})).calculate(req(trip)),/Invalid calculation response/);
// extraction transport validates Grace's schema
await assert.rejects(http.postJson('extract',{},ok({detail:'Model call failed'},502)),/Model call failed/);
console.error=quiet;
assert.equal((await http.postJson('extract',{},ok(trip))).goal_summary,trip.goal_summary);

// ---- every example file in backend_reference/examples is accepted ----
const dir=path.resolve('backend_reference/examples');
for(const f of fs.readdirSync(dir).filter(n=>n.endsWith('.response.json'))){
  const reqFile=JSON.parse(fs.readFileSync(path.join(dir,f.replace('.response.json','.request.json')),'utf8'));
  assert.ok(reqFile.assumptions&&reqFile.original_question!==undefined,f);
  const out=wire.fromCalculateWire(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),req(ex.validateExtraction(JSON.parse(fs.readFileSync(path.join(dir,f.replace('.response.json','.extraction.json')),'utf8')))));
  assert.ok(out.status,f);
}
console.log('backend-wire tests passed');
})().catch(e=>{console.error(e);process.exit(1)});
