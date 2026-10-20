import type { AssumptionValue, ExtractionResponse } from './extraction';
import type { CalculationRequest, CalculationResponse, SystemAssumption, ValueBinding } from './calculation-contract';
export const label = (variable: string) => variable.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export type Mode = 'quick' | 'guide';
export interface ApplicationState {
  originalQuestion: string; extraction: ExtractionResponse | null;
  edits: Record<number, AssumptionValue>; answers: Record<string, string>; parameters: Record<string, string>;
  systemAssumptions: SystemAssumption[]; answerFactBindings: Record<string, number>;
  result: CalculationResponse | null; lastSupportedResult: CalculationResponse | null; revision: number; resultRevision: number; resultInputKey: string;
  mode: Mode; modeChosen: boolean; confirmations: Record<string, string>; step: number; openSteps: Record<number, boolean>; guideDisclosures: Record<number, boolean>;
}
export const initialApplicationState = (): ApplicationState => ({ originalQuestion: '', extraction: null, edits: {}, answers: {}, parameters: {}, systemAssumptions: [], answerFactBindings: {}, result: null, lastSupportedResult: null, revision: 0, resultRevision: -1, resultInputKey: '', mode: 'guide', modeChosen: false, confirmations: {}, step: 1, openSteps: {}, guideDisclosures: {} });
export type WorkspaceAction =
  | { type: 'load'; question: string; extraction: ExtractionResponse; preserveMode?: boolean }
  | { type: 'mode'; mode: Mode } | { type: 'step'; step: number } | { type: 'toggle'; step: number }
  | { type: 'value'; binding: ValueBinding; value: AssumptionValue }
  | { type: 'revert'; index: number }
  | { type: 'result'; revision: number; response: CalculationResponse }
  | { type: 'disclosure'; step: number; open: boolean }
  | { type: 'confirm'; id: string; signature: string }
  | { type: 'reset' };
export function workspaceReducer(state: ApplicationState, action: WorkspaceAction): ApplicationState {
  switch (action.type) {
    case 'load': return { ...initialApplicationState(), mode: action.preserveMode ? state.mode : 'guide', modeChosen: action.preserveMode ? state.modeChosen : false, originalQuestion: action.question, extraction: structuredClone(action.extraction), revision: state.revision + 1 };
    case 'mode': return { ...state, mode: action.mode, modeChosen: true };
    case 'confirm': return { ...state, confirmations: { ...state.confirmations, [action.id]: state.confirmations[action.id] === action.signature ? '' : action.signature } };
    case 'disclosure': return { ...state, step: action.step, guideDisclosures: { ...state.guideDisclosures, [action.step]: action.open } };
    case 'step': return { ...state, step: action.step };
    case 'toggle': return { ...state, openSteps: { ...state.openSteps, [action.step]: !state.openSteps[action.step] } };
    case 'value': {
      const b = action.binding;
      if (b.kind === 'parameter' && b.key.startsWith('skip_input_')) {
        const variable = b.key.slice('skip_input_'.length);
        const selected = Object.keys(state.parameters).find(k => k.startsWith('skip_input_') && state.parameters[k] === '1');
        const selecting = String(action.value) === '1';
        if (selecting && selected && selected !== b.key) return state;
        const parameters = { ...state.parameters, [b.key]: selecting ? '1' : '0', explore_unresolved: selecting ? '1' : '0' };
        const index = state.extraction?.assumptions.findIndex(a => a.variable === variable) ?? -1;
        const edits = { ...state.edits };
        const answers = { ...state.answers };
        if (selecting) {
          if (index >= 0) edits[index] = null;
          delete answers[`input-${variable}`];
          for (const [key, fact] of Object.entries(state.answerFactBindings)) if (fact === index) delete answers[key];
        }
        return { ...state, parameters, edits, answers, revision: state.revision + 1 };
      }
      if (b.kind === 'fact') {
        const answers = { ...state.answers };
        for (const [key, index] of Object.entries(state.answerFactBindings)) if (index === b.index) delete answers[key];
        return { ...state, answers, edits: { ...state.edits, [b.index]: action.value }, revision: state.revision + 1 };
      }
      const key = b.kind === 'answer' ? 'answers' : 'parameters';
      const edits = { ...state.edits };
      const values = { ...state[key] };
      if (b.kind === 'answer') for (const other of Object.keys(values)) if (other !== b.key && state.answerFactBindings[b.key] !== undefined && state.answerFactBindings[other] === state.answerFactBindings[b.key]) delete values[other];
      if (b.kind === 'answer' && state.answerFactBindings[b.key] !== undefined) delete edits[state.answerFactBindings[b.key]];
      return { ...state, edits, [key]: { ...values, [b.key]: action.value === null ? '' : String(action.value) }, revision: state.revision + 1 };
    }
    case 'revert': { const edits = { ...state.edits }; delete edits[action.index]; return { ...state, edits, revision: state.revision + 1 }; }
    case 'result': {
      if (action.revision !== state.revision) return state;
      // Keep answered input boxes in place so moving to the next field never removes
      // the previous one. Requirements still come only from the latest calculator result.
      const incoming = new Map(action.response.questions.map(q => [q.id, q]));
      const retainedQuestions = (state.result?.questions ?? []).flatMap(q => {
        const updated = incoming.get(q.id);
        if (updated) { incoming.delete(q.id); return [updated]; }
        const value = boundValue(state, q.binding, q.value);
        return value !== null && String(value).trim() !== '' ? [{ ...q, value, required: false }] : [];
      });
      const response = { ...action.response, questions: [...retainedQuestions, ...incoming.values()] };
      return { ...state, result: response, lastSupportedResult: ['ready', 'conditional'].includes(action.response.status) ? action.response : state.lastSupportedResult, resultRevision: action.revision, resultInputKey: JSON.stringify([state.edits, state.answers]), systemAssumptions: action.response.assumptions, answerFactBindings: { ...state.answerFactBindings, ...Object.fromEntries(action.response.questions.flatMap(q => q.binding.kind === 'answer' && q.correctsFactIndex !== undefined ? [[q.binding.key, q.correctsFactIndex]] : [])) } };
    }
    case 'reset': return { ...initialApplicationState(), revision: state.revision + 1 };
  }
}
export function calculationRequest(state: ApplicationState): CalculationRequest | null {
  return state.extraction ? { originalQuestion: state.originalQuestion, extraction: state.extraction, edits: state.edits, answers: state.answers, parameters: state.parameters, answerFactBindings: state.answerFactBindings } : null;
}
export function currentResult(state: ApplicationState, pending = false): CalculationResponse | null {
  return !pending && state.resultRevision === state.revision ? state.result : null;
}
// Parameter-only refreshes can retain the previous result layout without treating it as current.
export function parameterRefreshResult(state: ApplicationState, pending = false): CalculationResponse | null {
  return !pending && state.resultRevision !== state.revision && state.result &&
    ['ready', 'conditional'].includes(state.result.status) &&
    state.resultInputKey === JSON.stringify([state.edits, state.answers]) ? state.result : null;
}
export function boundValue(state: ApplicationState, binding: ValueBinding, fallback: AssumptionValue): AssumptionValue {
  if (binding.kind === 'fact') {
    if (Object.hasOwn(state.edits, binding.index)) return state.edits[binding.index];
    const answerKey = Object.keys(state.answerFactBindings).find(key => state.answerFactBindings[key] === binding.index && Object.hasOwn(state.answers, key));
    return answerKey === undefined ? fallback : state.answers[answerKey];
  }
  if (binding.kind === 'answer' && state.answerFactBindings[binding.key] !== undefined && Object.hasOwn(state.edits, state.answerFactBindings[binding.key])) return state.edits[state.answerFactBindings[binding.key]];
  // A completed calculator response may clamp a What If amount to the new budget.
  // Show the amount actually used in the math; pending requests still show the draft.
  if (binding.kind === 'parameter' && state.resultRevision === state.revision &&
      state.result && ['ready', 'conditional'].includes(state.result.status)) {
    const accepted = state.result.parameters.find(p => p.binding.kind === 'parameter' && p.binding.key === binding.key);
    if (accepted) return accepted.value;
  }
  const values = binding.kind === 'answer' ? state.answers : state.parameters;
  return Object.hasOwn(values, binding.key) ? values[binding.key] : fallback;
}
// Presentation order depends only on result availability, never a topic or fixture.
export function quickSections(result: CalculationResponse): number[] {
  const success = result.status === 'ready' || result.status === 'conditional';
  return success ? [4, ...(result.information.length ? [1] : []), ...(result.questions.length ? [2] : []), ...(result.explanations.length ? [3] : [])]
    : result.status === 'needs_input' ? [2, ...(result.information.length ? [1] : [])]
    : result.status === 'stale' && result.questions.some(q => q.required) ? [2, 4, ...(result.information.length ? [1] : [])] : [4, ...(result.information.length ? [1] : []), ...(result.questions.length ? [2] : [])];
}

// Guide disclosure is independent of Quick's accordion choices and financial state.
export function guideSectionOpen(state: ApplicationState, response: CalculationResponse, section: number): boolean {
  if (Object.hasOwn(state.guideDisclosures ?? {}, section)) return state.guideDisclosures[section];
  return section === 1;
}

// Serialize only effective corrections; calculation proposals are not extraction facts.
export function correctionLines(state: ApplicationState, response: CalculationResponse | null): string[] {
  if (!state.extraction) return [];
  return [
    ...Object.entries(state.edits).filter(([i, value]) => !(value === null && state.parameters[`skip_input_${state.extraction!.assumptions[Number(i)].variable}`] === '1')).map(([i, value]) => `${state.extraction!.assumptions[Number(i)].variable}: ${value === null ? 'not provided' : value}`),
    ...Object.entries(state.answers).filter(([key, value]) => value.trim() && !Object.hasOwn(state.edits, state.answerFactBindings[key])).map(([key, value]) => {
      const index = state.answerFactBindings[key];
      const name = index !== undefined ? state.extraction!.assumptions[index].variable : response?.questions.find(q => q.binding.kind === 'answer' && q.binding.key === key)?.label ?? state.extraction!.clarification_questions[Number(key.replace('extraction-question-', ''))]?.question ?? key;
      return `${name}: ${value}`;
    }),
  ];
}
