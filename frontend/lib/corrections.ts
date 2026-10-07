import type { AssumptionValue, CorrectionRequest, ExtractRequest, ExtractionResponse } from './extraction';
export function buildCorrectionRequest(context: ExtractRequest, previous_extraction: ExtractionResponse, drafts: {
 goal: string; correction: string; overrides: Record<number, AssumptionValue>; answers: Record<number, string>;
}): CorrectionRequest {
 const user_correction = [
  drafts.goal && `Goal correction: ${drafts.goal}`,
  drafts.correction,
  ...Object.entries(drafts.overrides).map(([i, value]) => `${previous_extraction.assumptions[Number(i)].variable}: ${value}`),
  ...Object.entries(drafts.answers).map(([i, answer]) => answer.trim() ? `${previous_extraction.clarification_questions[Number(i)].question} Answer: ${answer}` : ''),
 ].filter(Boolean).join('\n');
 return {...context, previous_extraction, user_correction};
}
