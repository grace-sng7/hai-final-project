import trip from './fixtures/trip.json';
import laptop from './fixtures/laptop.json';
import apartment from './fixtures/apartment.json';
import laptopUpdated from './fixtures/laptop-correction.json';
export const laptopCorrection = 'I make $1,800/month after tax and spend $1,300/month. I need the laptop in 4 months.';
export type Source = 'stated' | 'inferred' | 'missing';
export type AssumptionValue = number | string | null;
export interface Assumption { variable: string; value: AssumptionValue; unit: string; source: Source; source_detail: string; [key: string]: unknown }
export interface ClarificationQuestion { target_variable: string; question: string; why_it_matters: string; [key: string]: unknown }
export interface ExtractionResponse { assumptions: Assumption[]; clarification_questions: ClarificationQuestion[]; goal_summary: string; confidence_note: string; [key: string]: unknown }
export interface ExtractRequest { user_message: string; reference_date: string; timezone: string }
export interface CorrectionRequest extends ExtractRequest { previous_extraction: ExtractionResponse; user_correction: string }
export interface ExtractionService { extract(request: ExtractRequest): Promise<ExtractionResponse>; correct(request: CorrectionRequest): Promise<ExtractionResponse> }
export const samples = [
 { id:'trip', title:'Europe trip', icon:'✈', message:'I make $2,000 a month after tax. Rent is $900 and other spending is about $750. I have $1,200 saved, but don’t want to use it all. Can I afford a $3,000 Europe trip with friends in 8 months?', data:trip },
 { id:'laptop', title:'A new laptop', icon:'▱', message:'I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?', data:laptop },
 { id:'apartment', title:'Moving apartments', icon:'⌂', message:'My annual salary is $55,000. My car payment is $350/month and I have student loans. I want to move on February 1, 2027 to an apartment costing $1,400/month instead of my current $1,000 rent. Can I swing it?', data:apartment }
];
const object = (v:unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
export function validateExtraction(v:unknown): ExtractionResponse {
 const fail = () => { throw new Error('Response format error. Please retry.'); };
 if (!object(v)) return fail();
 if (typeof v.goal_summary!=='string' || typeof v.confidence_note!=='string' || !Array.isArray(v.assumptions) || !Array.isArray(v.clarification_questions)) return fail();
 for(const a of v.assumptions) if(!object(a) || !['variable','unit','source_detail'].every(k=>typeof a[k]==='string') || !['stated','inferred','missing'].includes(String(a.source)) || !(a.value===null || typeof a.value==='string' || (typeof a.value==='number' && Number.isFinite(a.value)))) return fail();
 for(const q of v.clarification_questions) if(!object(q) || !['target_variable','question','why_it_matters'].every(k=>typeof q[k]==='string')) return fail();
 return structuredClone(v) as ExtractionResponse;
}
export function dataIssues(r:ExtractionResponse) {
 const seen=new Set<string>(); const issues:string[]=[];
 r.assumptions.forEach(a=>{if(seen.has(a.variable)) issues.push(`Duplicate variable: ${a.variable}. Resolve before calculation.`); seen.add(a.variable); if((a.source==='missing') !== (a.value===null)) issues.push(`Inconsistent source/value: ${a.variable}.`);}); return issues;
}
export class MockExtractionService implements ExtractionService {
 async extract(r:ExtractRequest) { await new Promise(resolve=>setTimeout(resolve,650)); const sample=samples.find(s=>s.message===r.user_message.trim()); if(!sample) throw new Error('This version uses sample data. Please select an example.'); return validateExtraction(sample.data); }
 async correct(r:CorrectionRequest):Promise<ExtractionResponse> { await new Promise(resolve=>setTimeout(resolve,650)); if(r.user_message===samples[1].message && r.user_correction===laptopCorrection) return validateExtraction(laptopUpdated); throw new Error('Demo mode: this correction remains a pending draft. No live extraction is connected.'); }
}
export class HttpExtractionService implements ExtractionService {
 constructor(private baseUrl='') {}
 private async post(path:string,body:ExtractRequest|CorrectionRequest) {const res=await fetch(`${this.baseUrl}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await res.json(); if(!res.ok) throw new Error(data?.error?.message || 'Please try again.'); return validateExtraction(data);}
 extract(r:ExtractRequest) {return this.post('/api/extract',r);}
 correct(r:CorrectionRequest) {return this.post('/api/correct',r);}
}
// Change this single binding when the Python HTTP API is available.
export const extractionService:ExtractionService = new MockExtractionService();
