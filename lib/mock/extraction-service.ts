import { validateExtraction, type ExtractionService, type ExtractRequest, type CorrectionRequest, type ExtractionResponse } from '../extraction';
import laptopUpdated from '../fixtures/laptop-correction.json';
import { samples, laptopCorrection } from './data';

export interface MockExtractionCase { message: string; data: unknown }
export class MockExtractionService implements ExtractionService {
 constructor(private readonly cases: readonly MockExtractionCase[] = samples, private readonly latencyMs = 350) {}
 async extract(r:ExtractRequest) { await new Promise(resolve=>setTimeout(resolve,this.latencyMs)); const sample=this.cases.find(s=>s.message===r.user_message.trim()); if(!sample) throw new Error('This version uses sample data. Please select an example.'); return validateExtraction(sample.data); }
 async correct(r:CorrectionRequest):Promise<ExtractionResponse> { await new Promise(resolve=>setTimeout(resolve,this.latencyMs)); if(r.user_message===samples[1].message && r.user_correction===laptopCorrection) return validateExtraction(laptopUpdated); throw new Error('Demo mode: this correction remains a pending draft. No live extraction is connected.'); }
}
