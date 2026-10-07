/**
 * Core type definitions matching the PRD specification for Show Your Work
 */

export type Source = 'stated' | 'inferred' | 'missing';

export type AssumptionValue = number | string | null;

export interface Assumption {
  variable: string;
  value: AssumptionValue;
  unit: string;
  source: Source;
  source_detail: string;
}

export interface ClarificationQuestion {
  target_variable: string;
  question: string;
  why_it_matters: string;
}

export interface ExtractionResponse {
  assumptions: Assumption[];
  clarification_questions: ClarificationQuestion[];
  goal_summary: string;
  confidence_note: string;
}

export interface ExtractRequest {
  user_message: string;
  reference_date: string;
  timezone: string;
}

export interface CorrectionRequest extends ExtractRequest {
  previous_extraction: ExtractionResponse;
  user_correction: string;
}

export type ReviewStatus = 'unreviewed' | 'confirmed' | 'edited';

export interface LocalAssumptionState {
  reviewStatus: ReviewStatus;
  userOverrideValue?: AssumptionValue;
  isUserOverridden?: boolean;
}

export interface ScenarioDraft {
  allocatedSavings: number | null;
  monthlyContribution: number;
}
