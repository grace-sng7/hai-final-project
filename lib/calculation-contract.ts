import { parseEdit } from './field-values';
import type { AssumptionValue, ExtractionResponse } from './extraction';

// Proposed frontend adapter contract. This is NOT an implemented Python API.
export type ResultStatus = 'ready' | 'conditional' | 'needs_input' | 'unsupported' | 'stale';
export type ValueBinding = { kind: 'fact'; index: number } | { kind: 'answer' | 'parameter'; key: string };
export interface Control {
  type: 'number' | 'range' | 'text' | 'date' | 'select';
  min?: number; max?: number; step?: number; options?: { value: string; label: string }[];
}
export interface EditableField {
  id: string; label: string; value: AssumptionValue; unit: string; binding: ValueBinding; control: Control;
  help?: string; presentation?: 'detail'; outdated?: boolean;
}
export interface Question extends EditableField { required: boolean; correctsFactIndex?: number; extractionQuestionIndices?: number[] }
export interface SystemAssumption {
  id: string; text: string; parameter?: EditableField; reviewLabel?: string;
}
export interface CalculationRequest {
  originalQuestion: string;
  extraction: ExtractionResponse;
  edits: Record<number, AssumptionValue>;
  answers: Record<string, string>;
  parameters: Record<string, string>;
  answerFactBindings: Record<string, number>;
}
interface ResponseContent {
  information: (EditableField & { source: string; sourceDetail: string; confirmable: boolean })[];
  questions: Question[];
  assumptions: SystemAssumption[];
  parameters: EditableField[];
  metrics: { label: string; value: string }[];
  explanations: { label: string; text: string }[];
  limitations: string[];
  nextActions: { label: string; action: 'review_information' | 'answer_questions' | 'retry' }[];
}
export type AnswerSegment = { type: 'text'; text: string } | { type: 'parameter'; parameterId: string; prefix?: string; suffix?: string };
export interface AnswerContent { headline: string; detail?: string; segments?: AnswerSegment[] }
export type CalculationResponse = ResponseContent & (
  | { status: 'ready' | 'conditional'; answer: AnswerContent; message?: string }
  | { status: 'needs_input' | 'unsupported' | 'stale'; answer?: never; message: string }
);
export interface CalculationService { calculate(request: CalculationRequest): Promise<CalculationResponse> }
export const emptyContent = (): ResponseContent => ({ information: [], questions: [], assumptions: [], parameters: [], metrics: [], explanations: [], limitations: [], nextActions: [] });

// Reject invalid service payloads at the boundary, before any result becomes current.
export function validateCalculation(value: unknown, extraction?: ExtractionResponse): CalculationResponse {
  const fail = (): never => { throw new Error('Invalid calculation response'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const r = value as CalculationResponse;
  if (!['ready', 'conditional', 'needs_input', 'unsupported', 'stale'].includes(r.status)) return fail();
  for (const key of ['information', 'questions', 'assumptions', 'parameters', 'metrics', 'explanations', 'limitations', 'nextActions'] as const) if (!Array.isArray(r[key])) return fail();
  for (const items of [r.information, r.questions, r.assumptions, r.parameters]) {
    if (items.some(item => !item || typeof item.id !== 'string' || !item.id.trim()) || new Set(items.map(item => item.id)).size !== items.length) return fail();
  }
  const fields = [...r.information, ...r.questions, ...r.parameters, ...r.assumptions.flatMap(a => a.parameter ? [a.parameter] : [])];
  const isValue = (v: unknown) => v === null || typeof v === 'string' || typeof v === 'number' && Number.isFinite(v);
  for (const f of fields) {
    if (!f || typeof f.id !== 'string' || !f.id.trim() || typeof f.label !== 'string' || typeof f.unit !== 'string' || !isValue(f.value) || !f.binding || !f.control) return fail();
    if (f.binding.kind === 'fact' ? !Number.isInteger(f.binding.index) || f.binding.index < 0 : !['answer', 'parameter'].includes(f.binding.kind) || (typeof f.binding.key !== 'string' || !f.binding.key.trim())) return fail();
    if (f.binding.kind === 'fact' && extraction && f.binding.index >= extraction.assumptions.length) return fail();
    if (f.presentation !== undefined && f.presentation !== 'detail') return fail();
    if (f.outdated !== undefined && typeof f.outdated !== 'boolean') return fail();
    if (f.help !== undefined && typeof f.help !== 'string') return fail();
    if (!['text', 'number', 'range', 'date', 'select'].includes(f.control.type)) return fail();
    for (const k of ['min', 'max', 'step'] as const) if (f.control[k] !== undefined && !Number.isFinite(f.control[k])) return fail();
    if (f.control.type === 'range' && (f.control.min === undefined || f.control.max === undefined || f.control.max < f.control.min)) return fail();
    if (f.control.type === 'select' && (!Array.isArray(f.control.options) || f.control.options.some(o => !o || typeof o.value !== 'string' || typeof o.label !== 'string'))) return fail();
  }
  const registry = new Map<string, EditableField>();
  for (const f of fields) {
    const previous = registry.get(f.id);
    if (previous && JSON.stringify([previous.binding, previous.control, previous.value, previous.unit]) !== JSON.stringify([f.binding, f.control, f.value, f.unit])) return fail();
    registry.set(f.id, f);
    const c = f.control;
    if (c.step !== undefined && c.step <= 0 || c.min !== undefined && c.max !== undefined && c.min > c.max) return fail();
    const question = r.questions.includes(f as Question);
    if (r.parameters.includes(f) && c.type === 'number' && (f.value === null || String(f.value).trim() === '')) return fail();
    if (parseEdit(f.value, c) === undefined && !(question && c.type === 'number' && (f.value === null || f.value === ''))) return fail();
    if (c.type === 'range' && (f.value === null || String(f.value).trim() === '' || Number(f.value) < c.min! || Number(f.value) > c.max!)) return fail();
    if (c.type === 'select' && (!c.options!.length || new Set(c.options!.map(o => o.value)).size !== c.options!.length)) return fail();
  }
  for (const a of r.information) if (typeof a.source !== 'string' || typeof a.sourceDetail !== 'string' || typeof a.confirmable !== 'boolean') return fail();
  for (const q of r.questions) if (typeof q.required !== 'boolean') return fail();
  for (const a of r.assumptions) if (!a || typeof a.id !== 'string' || typeof a.text !== 'string' || a.reviewLabel !== undefined && typeof a.reviewLabel !== 'string') return fail();
  for (const [items, keys] of [[r.metrics, ['label', 'value']], [r.explanations, ['label', 'text']]] as const) for (const item of items) for (const key of keys) if (!item || typeof (item as unknown as Record<string, unknown>)[key] !== 'string') return fail();
  if (r.limitations.some(s => typeof s !== 'string') || r.nextActions.some(a => !a || typeof a.label !== 'string' || !['review_information', 'answer_questions', 'retry'].includes(a.action))) return fail();
  if (r.status === 'ready' || r.status === 'conditional') { if (!r.answer || typeof r.answer.headline !== 'string' || !r.answer.headline.trim() || r.answer.detail !== undefined && typeof r.answer.detail !== 'string') return fail(); }
  else if (r.answer !== undefined || typeof r.message !== 'string') return fail();
  for (const q of r.questions) if (q.correctsFactIndex !== undefined && (!Number.isInteger(q.correctsFactIndex) || q.correctsFactIndex < 0 || extraction && q.correctsFactIndex >= extraction.assumptions.length)) return fail();
  for (const q of r.questions) if (q.extractionQuestionIndices !== undefined && (!Array.isArray(q.extractionQuestionIndices) || q.extractionQuestionIndices.some(i => !Number.isInteger(i) || i < 0 || extraction && i >= extraction.clarification_questions.length))) return fail();
  if ((r.status === 'ready' || r.status === 'conditional') && r.answer.segments !== undefined) {
    const parameters = [...r.parameters, ...r.assumptions.flatMap(a => a.parameter ? [a.parameter] : [])];
    if (!Array.isArray(r.answer.segments) || !r.answer.segments.length) return fail();
    for (const segment of r.answer.segments) {
      if (segment && segment.type === 'parameter' && (segment.prefix !== undefined && typeof segment.prefix !== 'string' || segment.suffix !== undefined && typeof segment.suffix !== 'string')) return fail();
      if (!segment || (segment.type === 'text' ? typeof segment.text !== 'string' : segment.type !== 'parameter' || !parameters.some(p => p.id === segment.parameterId))) return fail();
    }
  }
  return structuredClone(r);
}

// One lookup order for inline editing and What If controls.
export function canonicalParameters(response: CalculationResponse): EditableField[] {
  const fields = new Map<string, EditableField>();
  for (const field of [...response.parameters, ...response.assumptions.flatMap(a => a.parameter ? [a.parameter] : [])]) if (!fields.has(field.id)) fields.set(field.id, field);
  return [...fields.values()];
}
