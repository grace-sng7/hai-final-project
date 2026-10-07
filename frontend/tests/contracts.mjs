import ts from 'typescript';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const testModule=new Module(fileURLToPath(import.meta.url));
import fs from 'node:fs';
import Module from 'node:module';
import assert from 'node:assert/strict';
function load(file) { const m = new Module(file, testModule);m.filename=file;m.paths=require.resolve.paths('typescript');m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports; }
const e=load(require('node:path').resolve('lib/extraction.ts'));
const c=load(require('node:path').resolve('lib/calculator.ts'));
(async()=>{
 for(const sample of e.samples){const out=await new e.MockExtractionService().extract({user_message:sample.message,reference_date:'2026-10-07',timezone:'America/New_York'});assert.deepEqual(out,sample.data);assert.equal(e.dataIssues(out).length,0);}
 await assert.rejects(new e.MockExtractionService().extract({user_message:'unrelated',reference_date:'2026-10-07',timezone:'America/New_York'}),/select an example/);
 const updated=await new e.MockExtractionService().correct({user_message:e.samples[1].message,reference_date:'2026-10-07',timezone:'America/New_York',previous_extraction:e.samples[1].data,user_correction:e.laptopCorrection});assert.equal(updated.clarification_questions.length,0);assert.equal(updated.assumptions[0].value,1800);
 const r=e.validateExtraction(e.samples[0].data);r.assumptions[0].value=0;assert.equal(e.validateExtraction(r).assumptions[0].value,0);r.assumptions[0].value=-50;assert.equal(e.validateExtraction(r).assumptions[0].value,-50);
 r.assumptions.push({...r.assumptions[0]});assert.match(e.dataIssues(r).join(' '),/Duplicate/);
 r.assumptions[0].source='invalid';assert.throws(()=>e.validateExtraction(r),/format error/);
 r.assumptions[0].source='missing';assert.match(e.dataIssues(r).join(' '),/Inconsistent/);
 const i={income:2000,expenses:1650,allocated:500,savings:1200,goal:3000,months:8,contribution:300};assert.deepEqual(c.calculatorService.calculate(i),{projected:2900,gap:100,remaining:50,available:350,exceeds:false});
 for(const months of [0,-1,1.5])assert.throws(()=>c.calculatorService.calculate({...i,months}),/positive whole/);
 assert.throws(()=>c.calculatorService.calculate({...i,income:1000}),/No monthly surplus/);
 assert.throws(()=>c.calculatorService.calculate({...i,allocated:1500}),/allocate/);
 assert.equal(c.calculatorService.calculate({...i,contribution:400}).exceeds,true);
 assert.equal(e.samples[2].data.assumptions.length,8);
 console.log('PASS: fixture contracts, runtime validation, duplicates, zero/negative values, demo restriction, deterministic calculator and invalid inputs');
})().catch(e=>{console.error(e);process.exit(1)});
