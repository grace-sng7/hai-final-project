export type Source = 'stated' | 'inferred' | 'missing';
export type AssumptionValue = number | string | null;
export interface Assumption { variable: string; value: AssumptionValue; unit: string | null; source: Source; source_detail: string; [key: string]: unknown }
export interface ClarificationQuestion { target_variable: string; question: string; why_it_matters: string; [key: string]: unknown }
export interface ExtractionResponse { assumptions: Assumption[]; clarification_questions: ClarificationQuestion[]; goal_summary: string; confidence_note: string; [key: string]: unknown }
export interface ExtractRequest { user_message: string; reference_date: string; timezone: string }
export interface CorrectionRequest extends ExtractRequest { previous_extraction: ExtractionResponse; user_correction: string }
export interface ExtractionService { extract(request: ExtractRequest): Promise<ExtractionResponse>; correct(request: CorrectionRequest): Promise<ExtractionResponse> }
const object = (v:unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
export function validateExtraction(v:unknown): ExtractionResponse {
 const fail = () => { throw new Error('Response format error. Please retry.'); };
 if (!object(v)) return fail();
 if (typeof v.goal_summary!=='string' || typeof v.confidence_note!=='string' || !Array.isArray(v.assumptions) || !Array.isArray(v.clarification_questions)) return fail();
 for(const a of v.assumptions) if(!object(a) || !['variable','source_detail'].every(k=>typeof a[k]==='string') || !(a.unit===null || typeof a.unit==='string') || (typeof a.source !== 'string' || !['stated','inferred','missing'].includes(a.source)) || !(a.value===null || typeof a.value==='string' || (typeof a.value==='number' && Number.isFinite(a.value)))) return fail();
 for(const q of v.clarification_questions) if(!object(q) || !['target_variable','question','why_it_matters'].every(k=>typeof q[k]==='string')) return fail();
 return structuredClone(v) as ExtractionResponse;
}
export function dataIssues(r:ExtractionResponse) {
 const seen=new Set<string>(); const issues:string[]=[];
 r.assumptions.forEach(a=>{if(seen.has(a.variable)) issues.push(`Duplicate variable: ${a.variable}. Resolve before calculation.`); seen.add(a.variable); if((a.source==='missing') !== (a.value===null)) issues.push(`Inconsistent source/value: ${a.variable}.`);}); return issues;
}
// Inject agreed transport functions when backend routes/authentication are known.
// No endpoint paths or server implementation are assumed here.
export class TransportExtractionService implements ExtractionService {
 constructor(private transport: { extract: (r: ExtractRequest) => Promise<unknown>; correct: (r: CorrectionRequest) => Promise<unknown> }) {}
 async extract(r: ExtractRequest) { return validateExtraction(await this.transport.extract(structuredClone(r))); }
 async correct(r: CorrectionRequest) { return validateExtraction(await this.transport.correct(structuredClone(r))); }
}
