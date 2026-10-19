// Wire format between this frontend and the Python backend (see BACKEND_CONTRACT.md).
// The Python side only ever sees these simple shapes. All UI-specific structure
// (bindings, controls, answer segments) is built HERE so backend authors never need it.
import type { AssumptionValue } from './extraction';
import { emptyContent, validateCalculation, type AnswerContent, type AnswerSegment, type CalculationRequest, type CalculationResponse, type Control, type EditableField, type Question, type SystemAssumption } from './calculation-contract';
import { money } from './workspace-model';

// ---------- Request: frontend -> POST /calculate ----------
export interface WireAssumption { variable: string; value: AssumptionValue; unit: string | null; source: 'stated' | 'inferred' | 'missing'; source_detail: string; edited_by_user: boolean }
export interface CalculateWireRequest {
  original_question: string;
  assumptions: WireAssumption[];                 // effective values: the user's edits are already applied
  extra_inputs: Record<string, number | string>; // answers for variables that were NOT in the extraction
  answers: { target_variable: string; question: string; answer: string }[]; // free-text answers to extraction questions
  parameters: Record<string, number>;            // what-if values the user changed; absent key = use your default
  extraction_meta: Record<string, unknown>;      // every top-level extraction field except assumptions/clarification_questions
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

export function toCalculateWire(request: CalculationRequest): CalculateWireRequest {
  const { extraction, edits, answers, parameters } = request;
  const assumptions: WireAssumption[] = extraction.assumptions.map((a, index) => Object.hasOwn(edits, index)
    ? { variable: a.variable, value: edits[index], unit: a.unit, source: blank(edits[index]) ? 'missing' : 'stated', source_detail: 'Edited by the user', edited_by_user: true }
    : { variable: a.variable, value: a.value, unit: a.unit, source: a.source, source_detail: a.source_detail, edited_by_user: false });
  const extra_inputs: Record<string, number | string> = {};
  const free: CalculateWireRequest['answers'] = [];
  for (const [key, value] of Object.entries(answers)) {
    if (blank(value)) continue;
    if (key.startsWith('input-')) extra_inputs[key.slice('input-'.length)] = Number.isFinite(Number(value)) ? Number(value) : value;
    else if (key.startsWith('extraction-question-')) {
      const q = extraction.clarification_questions[Number(key.slice('extraction-question-'.length))];
      if (q) free.push({ target_variable: q.target_variable, question: q.question, answer: value });
    }
  }
  const params: Record<string, number> = {};
  for (const [key, value] of Object.entries(parameters)) if (!blank(value) && Number.isFinite(Number(value))) params[key] = Number(value);
  const { assumptions: _a, clarification_questions: _q, ...meta } = extraction;
  void _a; void _q;
  return { original_question: request.originalQuestion, assumptions, extra_inputs, answers: free, parameters: params, extraction_meta: meta };
}

// ---------- Response: POST /calculate -> frontend ----------
export interface WireMissingInput { variable: string; label?: string | null; unit?: string | null; help?: string | null; input_type?: 'number' | 'text' | 'date' | null }
export interface WireParameter { key: string; label: string; value: number; unit?: string | null; min?: number | null; max?: number | null; step?: number | null }
export interface CalculateWireResponse {
  status: 'ready' | 'conditional' | 'needs_input' | 'unsupported';
  message?: string | null;
  answer?: { headline: string; detail?: string | null } | null;
  missing_inputs?: WireMissingInput[] | null;
  parameters?: WireParameter[] | null;
  metrics?: { label: string; value: string }[] | null;
  explanations?: { label: string; text: string }[] | null;
  assumptions?: { id?: string | null; text: string; parameter_key?: string | null; review_label?: string | null }[] | null;
  limitations?: string[] | null;
}

const fail = (why: string): never => { console.error(`[backend-wire] ${why}`); throw new Error(`Invalid calculation response from backend: ${why}`); };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const rec = (v: unknown, name: string) => isObj(v) ? v : fail(`${name} must be an object`);
const list = (v: unknown, name: string): unknown[] => v === null || v === undefined ? [] : Array.isArray(v) ? v : fail(`${name} must be a list`);
const text = (v: unknown, name: string) => typeof v === 'string' ? v : fail(`${name} must be a string`);
const optText = (v: unknown) => typeof v === 'string' && v.trim() ? v : undefined;
const optNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const KEY = /^[A-Za-z0-9_-]+$/;

function buildParameter(raw: unknown, i: number): EditableField {
  const o = rec(raw, `parameters[${i}]`);
  const key = text(o.key, `parameters[${i}].key`);
  if (!KEY.test(key)) fail(`parameters[${i}].key may only use letters, digits, _ and -`);
  const value = optNum(o.value) ?? fail(`parameters[${i}].value must be a finite number`);
  let min = optNum(o.min), max = optNum(o.max);
  const step = optNum(o.step) !== undefined && optNum(o.step)! > 0 ? optNum(o.step) : undefined;
  const range = min !== undefined && max !== undefined;
  if (range) { min = Math.min(min!, value); max = Math.max(max!, value); } // never let a stray default break the slider
  const control: Control = { type: range ? 'range' : 'number', ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), ...(step !== undefined ? { step } : {}) };
  return { id: key, label: text(o.label, `parameters[${i}].label`), value, unit: optText(o.unit) ?? '', binding: { kind: 'parameter', key }, control };
}

// "Yes, if you save {monthly_contribution} per month." -> inline editable number inside the sentence.
function buildAnswer(headline: string, detail: string | undefined, parameters: EditableField[]): AnswerContent {
  const byKey = new Map(parameters.map(p => [p.id, p]));
  const segments: AnswerSegment[] = [];
  let plain = '', last = 0;
  for (const m of headline.matchAll(/\{([A-Za-z0-9_-]+)\}/g)) {
    const p = byKey.get(m[1]);
    if (!p) continue;
    const before = headline.slice(last, m.index);
    if (before) segments.push({ type: 'text', text: before });
    segments.push({ type: 'parameter', parameterId: p.id, ...(p.unit === '$' ? { prefix: '$' } : {}) });
    plain += `${before}${p.unit === '$' ? money(Number(p.value)) : p.value}`;
    last = m.index! + m[0].length;
  }
  if (!segments.length) return { headline, ...(detail ? { detail } : {}) };
  const rest = headline.slice(last);
  if (rest) segments.push({ type: 'text', text: rest });
  return { headline: plain + rest, segments, ...(detail ? { detail } : {}) };
}

export function fromCalculateWire(raw: unknown, request: CalculationRequest): CalculationResponse {
  const w = rec(raw, 'response');
  const status = w.status;
  if (status !== 'ready' && status !== 'conditional' && status !== 'needs_input' && status !== 'unsupported') return fail(`status must be ready, conditional, needs_input or unsupported (got ${String(status)})`);
  const { extraction, edits, answers } = request;
  const base = emptyContent();

  const parameters = list(w.parameters, 'parameters').map(buildParameter);
  if (new Set(parameters.map(p => p.id)).size !== parameters.length) fail('parameters contain a duplicate key');
  base.parameters = parameters;

  const seen = new Set<string>();
  base.questions = list(w.missing_inputs, 'missing_inputs').flatMap((item, i): Question[] => {
    const o = rec(item, `missing_inputs[${i}]`);
    const variable = text(o.variable, `missing_inputs[${i}].variable`);
    if (seen.has(variable)) return [];
    seen.add(variable);
    const factIndex = extraction.assumptions.findIndex(a => a.variable === variable);
    const qIndex = extraction.clarification_questions.findIndex(q => q.target_variable === variable);
    const kind = o.input_type === 'text' || o.input_type === 'date' ? o.input_type : 'number';
    const unit = optText(o.unit) ?? (factIndex >= 0 ? extraction.assumptions[factIndex].unit ?? '' : '');
    const answerKey = `input-${variable}`;
    const current: AssumptionValue = factIndex >= 0 ? (Object.hasOwn(edits, factIndex) ? edits[factIndex] : extraction.assumptions[factIndex].value) : (answers[answerKey] ?? '');
    return [{
      id: `missing-${variable}`,
      label: optText(o.label) ?? (qIndex >= 0 ? extraction.clarification_questions[qIndex].question : `What is ${variable.replaceAll('_', ' ')}?`),
      help: optText(o.help) ?? (qIndex >= 0 ? extraction.clarification_questions[qIndex].why_it_matters : undefined),
      unit, value: blank(current) ? '' : current,
      binding: factIndex >= 0 ? { kind: 'fact', index: factIndex } : { kind: 'answer', key: answerKey },
      control: kind === 'number' ? { type: 'number', min: 0, step: unit === 'months' ? 1 : 0.01 } : { type: kind },
      required: true,
      extractionQuestionIndices: qIndex >= 0 ? [qIndex] : [],
    }];
  });

  base.metrics = list(w.metrics, 'metrics').map((m, i) => { const o = rec(m, `metrics[${i}]`); return { label: text(o.label, `metrics[${i}].label`), value: text(o.value, `metrics[${i}].value`) }; });
  base.explanations = list(w.explanations, 'explanations').map((m, i) => { const o = rec(m, `explanations[${i}]`); return { label: text(o.label, `explanations[${i}].label`), text: text(o.text, `explanations[${i}].text`) }; });
  base.limitations = list(w.limitations, 'limitations').map((s, i) => text(s, `limitations[${i}]`));
  base.assumptions = list(w.assumptions, 'assumptions').map((item, i): SystemAssumption => {
    const o = rec(item, `assumptions[${i}]`);
    const param = optText(o.parameter_key) ? parameters.find(p => p.id === o.parameter_key) ?? fail(`assumptions[${i}].parameter_key does not match any parameter`) : undefined;
    return { id: optText(o.id) ?? `assumption-${i}`, text: text(o.text, `assumptions[${i}].text`), ...(param ? { parameter: param, reviewLabel: optText(o.review_label) ?? 'Review' } : {}) };
  });

  const message = optText(w.message);
  if (status === 'ready' || status === 'conditional') {
    const answer = rec(w.answer, 'answer');
    const headline = text(answer.headline, 'answer.headline');
    if (!headline.trim()) fail('answer.headline is empty');
    return validateCalculation({ ...base, status, ...(message ? { message } : {}), answer: buildAnswer(headline, optText(answer.detail), parameters) }, extraction);
  }
  if (status === 'unsupported') base.nextActions = [{ label: 'Review information', action: 'review_information' }];
  return validateCalculation({ ...base, status, message: message ?? (status === 'needs_input' ? 'A few details are needed before we can calculate an answer.' : 'This question needs a calculation model that is not available yet.') }, extraction);
}
