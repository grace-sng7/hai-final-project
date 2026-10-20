import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

// Exercise the same adapters, reducer, request lifecycle and renderer as Workspace.
export async function testServiceFlow(load, render) {
 const extraction=load(path.resolve('lib/extraction.ts'));
 const {MockExtractionService}=load(path.resolve('lib/mock/extraction-service.ts'));
 const {MockCalculationService}=load(path.resolve('lib/mock/calculation-service.ts'));
 const {LocalDemoCalculationService}=load(path.resolve('lib/mock/local-demo-calculation.ts'));
 const {TransportCalculationService}=load(path.resolve('lib/calculation-service.ts'));
 const {samples}=load(path.resolve('lib/mock/data.ts'));
 const contract=load(path.resolve('lib/calculation-contract.ts'));
 const model=load(path.resolve('lib/workspace-model.ts'));
 const {presentResponse}=load(path.resolve('lib/presentation-model.ts'));
 const {startCalculation}=load(path.resolve('lib/calculation-runner.ts'));
 const context={reference_date:'2026-10-15',timezone:'America/New_York'};
 for(const sample of samples) {
  const raw=await new MockExtractionService(undefined,0).extract({...context,user_message:sample.message});
  const state=model.workspaceReducer(model.initialApplicationState(),{type:'load',question:sample.message,extraction:raw});
  const result=await new MockCalculationService().calculate(model.calculationRequest(state));
  assert.equal(result.status,sample.id==='trip'?'conditional':sample.id==='laptop'?'needs_input':'unsupported');
  assert.ok(render(presentResponse(raw,result),state).includes('Your information'));
 }
 // New topic: a transport contract demonstration, NOT an implemented finance model.
 const newTopic={assumptions:[
  {variable:'goal_description',value:'Compare two commute options',unit:null,source:'stated',source_detail:'User description'},
  {variable:'travel_days',value:null,unit:'days',source:'missing',source_detail:'Not supplied'},
  {variable:'preferred_route',value:'Train',unit:null,source:'stated',source_detail:'User preference'},
 ],clarification_questions:[{target_variable:'travel_days',question:'How many travel days?',why_it_matters:'Needed for this mock comparison'}],goal_summary:'Compare commute options',confidence_note:'Fixture only',future_metadata:{revision:2}};
 const prompt='Please compare my commute options.';
 const raw=await new MockExtractionService([{message:prompt,data:newTopic}],0).extract({...context,user_message:prompt});
 assert.deepEqual(raw,newTopic);
 let state=model.workspaceReducer(model.initialApplicationState(),{type:'load',question:prompt,extraction:raw});
 const calls=[];
 const question={id:'days',label:'How many travel days?',value:'',unit:'days',binding:{kind:'answer',key:'days'},control:{type:'number',min:1,step:1},required:true,correctsFactIndex:1,extractionQuestionIndices:[0]};
 const backend=new MockCalculationService(request=>{
  calls.push(structuredClone(request));
  const value=Object.hasOwn(request.edits,1)?request.edits[1]:request.answers.days;
  if(value===null || value===undefined || value==='') return {...contract.emptyContent(),status:'needs_input',message:'Please enter travel days.',questions:[question]};
  return {...contract.emptyContent(),status:'ready',answer:{headline:'Mock comparison supplied by the service.'},parameters:[{id:'flex',label:'Flexible days',value:request.parameters.flex??'2',unit:'days',binding:{kind:'parameter',key:'flex'},control:{type:'range',min:0,max:10,step:1}}],questions:[{...question,value,required:false}],explanations:[{label:'Mock explanation',text:'No real transport costs were calculated.'}],limitations:['Contract fixture; no real backend support implied.'],future_metadata:{kept:true}};
 });
 // Use the future transport adapter with an in-memory backend, without network endpoints.
 const service=new TransportCalculationService(request=>backend.calculate(request));
 let result=await service.calculate(model.calculationRequest(state));
 assert.equal(result.status,'needs_input');
 state=model.workspaceReducer(state,{type:'result',revision:state.revision,response:result});
 state=model.workspaceReducer(state,{type:'value',binding:question.binding,value:'18'});
 assert.equal(model.currentResult(state),null);
 result=await service.calculate(model.calculationRequest(state));
 assert.equal(result.status,'ready');assert.deepEqual(result.future_metadata,{kept:true});
 assert.equal(calls.at(-1).answers.days,'18');assert.equal(calls.at(-1).answerFactBindings.days,1);
 state=model.workspaceReducer(state,{type:'result',revision:state.revision,response:result});
 for(const mode of ['quick','guide']) {
  state=model.workspaceReducer(state,{type:'mode',mode});
  const html=render(presentResponse(raw,result),state);
  assert.ok(html.includes('Mock comparison supplied by the service.'));
  assert.ok(html.includes('Flexible days'));
 }
 state=model.workspaceReducer(state,{type:'value',binding:{kind:'fact',index:1},value:21});
 await service.calculate(model.calculationRequest(state));
 assert.equal(calls.at(-1).edits[1],21);assert.equal(calls.at(-1).answers.days,undefined);
 state=model.workspaceReducer(state,{type:'value',binding:{kind:'parameter',key:'flex'},value:4});
 result=await service.calculate(model.calculationRequest(state));assert.equal(result.parameters[0].value,'4');
 state=model.workspaceReducer(state,{type:'value',binding:{kind:'fact',index:1},value:null});
 assert.equal((await service.calculate(model.calculationRequest(state))).status,'needs_input');
 assert.deepEqual(raw,newTopic,'All service interactions preserve the original extraction');
 // Correction round trip: effective edits go to extraction, not calculation proposals.
 let correctionRequest;
 const corrected=structuredClone(raw);corrected.assumptions[1]={...corrected.assumptions[1],value:21,source:'stated',source_detail:'User correction'};corrected.clarification_questions=[];
 const extractionTransport=new extraction.TransportExtractionService({extract:async()=>raw,correct:async request=>{correctionRequest=structuredClone(request);request.previous_extraction.assumptions[0].value='Transport mutation';return corrected;}});
 const updated=await extractionTransport.correct({...context,user_message:prompt,previous_extraction:raw,user_correction:'travel_days: 21'});
 assert.equal(correctionRequest.previous_extraction.assumptions[1].value,null);
 assert.equal(updated.assumptions[1].value,21);assert.deepEqual(raw,newTopic,'Transport cannot mutate the original snapshot');
 assert.deepEqual(model.correctionLines({...state,edits:{1:21}},result),['travel_days: 21']);
 const replaced=model.workspaceReducer(state,{type:'load',question:prompt,extraction:updated,preserveMode:true});
 assert.deepEqual(replaced.edits,{});assert.deepEqual(replaced.answers,{});assert.deepEqual(replaced.parameters,{});assert.equal(model.currentResult(replaced),null);
 // Variation in amount, count and order is confined to mock registration, never UI rules.
 for(const [amount,extraCount,questionCount] of [[4100,0,0],[7654.25,7,5]]) {
  const variant=structuredClone(samples[0].data);
  variant.assumptions.find(a=>a.variable==='goal_amount').value=amount;
  variant.assumptions.reverse();
  variant.assumptions.push(...Array.from({length:extraCount},(_,i)=>({variable:`context_${i}`,value:i%2?'Description':null,unit:null,source:i%2?'stated':'missing',source_detail:'Additional fixture context'})));
  variant.clarification_questions=Array.from({length:questionCount},(_,i)=>({target_variable:`context_${i}`,question:`Additional question ${i}`,why_it_matters:'Contract test'})).reverse();
  const mock=new MockCalculationService(request=>new LocalDemoCalculationService([variant]).calculate(request));
  const app=model.workspaceReducer(model.initialApplicationState(),{type:'load',question:'Unrelated fixture label',extraction:variant});
  const output=presentResponse(variant,await mock.calculate(model.calculationRequest(app)));
  assert.equal(output.status,'conditional');assert.equal(output.information.length,variant.assumptions.filter(a=>a.value!==null).length);assert.equal(output.questions.length,0);
  assert.ok(output.metrics.some(m=>m.value===model.money(amount)));
  for(const mode of ['quick','guide']) assert.ok(render(output,{...app,mode}).includes('Your information'));
 }
 // Unknown response statuses fail closed, without making up a result.
 await assert.rejects(new MockCalculationService(()=>({...contract.emptyContent(),status:'future_status',message:'Unknown'})).calculate(model.calculationRequest(state)));
 await assert.rejects(new extraction.TransportExtractionService({extract:async()=>({assumptions:[]}),correct:async()=>null}).extract({...context,user_message:prompt}));
 // Real request lifecycle: failures/retry, synchronous throws and canceled/late payloads.
 const request=model.calculationRequest(state);
 let attempts=0;
 const transient=new MockCalculationService(()=>{if(++attempts===1)throw new Error('Simulated connection failure');return {...contract.emptyContent(),status:'ready',answer:{headline:'Recovered response'}};});
 const run=service=>new Promise(resolve=>startCalculation(service,request,resolve));
 const failed=await run(transient);assert.equal(failed.status,'stale');assert.equal(failed.answer,undefined);assert.equal(failed.nextActions[0].action,'retry');
 assert.equal((await run(transient)).answer.headline,'Recovered response');
 const unknown=await run(new MockCalculationService(()=>({...contract.emptyContent(),status:'unknown'})));assert.equal(unknown.status,'stale');
 const syncFailure=await run({calculate(){throw new Error('sync error');}});assert.equal(syncFailure.status,'stale');
 let release;
 const old=new Promise(resolve=>{release=resolve;});
 const received=[];
 const cancel=startCalculation({calculate:()=>old},request,result=>received.push(result));
 await Promise.resolve();cancel();
 const fresh=await run(new MockCalculationService(()=>({...contract.emptyContent(),status:'ready',answer:{headline:'New current result'}})));
 release({...contract.emptyContent(),status:'ready',answer:{headline:'Old result'}});
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(received,[]);assert.equal(fresh.answer.headline,'New current result');
 const pending={...contract.emptyContent(),status:'stale',message:'Updating…'};
 assert.ok(!render(presentResponse(raw,pending),{...state,lastSupportedResult:fresh}).includes('New current result'));
 // Architectural guard: production contracts, orchestration and rendering cannot match fixtures.
 for(const file of ['lib/extraction.ts','lib/calculation-service.ts','lib/calculation-runner.ts','lib/workspace-model.ts','lib/presentation-model.ts','components/workspace.tsx','components/result-view.tsx']) {
  const source=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(source,/samples\[|samples\.|from ['"].*fixtures|snapshot => JSON\.stringify/);
 }
 console.log('PASS: service-driven new topic, three samples, reordered/variable arrays, changed amounts, effective requests, failures/retry, unknown status and canceled requests');
}
