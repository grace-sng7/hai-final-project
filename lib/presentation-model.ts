import type { AssumptionValue, ExtractionResponse } from './extraction';
import type { AnswerContent, CalculationResponse } from './calculation-contract';
import { editingControl } from './field-values';
import { label, money } from './workspace-model';

// Lossless extraction-to-display projection, independent of calculation availability.
export function extractionInformation(raw: ExtractionResponse): CalculationResponse['information'] {
  return raw.assumptions.map((a, index) => ({
    presentation: a.variable === 'goal_description' ? 'detail' : undefined,
    id: `fact-${index}`, label: label(a.variable), value: a.value, unit: a.unit ?? '',
    binding: { kind: 'fact', index },
    control: { type: editingControl(a.value, a.unit) },
    source: a.source, sourceDetail: a.source_detail, confirmable: true,
  }));
}
export function presentResponse(raw: ExtractionResponse, response: CalculationResponse, changed = false, edits: Record<number, AssumptionValue> = {}): CalculationResponse {
  // The calculator owns input requirements. Extraction clarifications remain context,
  // never an additional form that asks for unused or derived variables.
  const information = extractionInformation(raw).map(field => {
    const metadata = response.information.find(f => f.binding.kind === 'fact' && field.binding.kind === 'fact' && f.binding.index === field.binding.index);
    let result = metadata ? { ...field, ...metadata, id: field.id, source: field.source, sourceDetail: field.sourceDetail } : field;
    if (field.binding.kind === 'fact' && Object.hasOwn(edits, field.binding.index)) {
      result = { ...result, value: edits[field.binding.index], source: 'stated', sourceDetail: 'Provided by you' };
    }
    return changed && field.source === 'inferred' ? { ...result, outdated: true, confirmable: false } : result;
  }).filter(field => field.value !== null && String(field.value).trim() !== '' && field.source !== 'missing');
  const extras = response.information.filter(f => f.binding.kind !== 'fact').map(f => ({ ...f, id: `calculation-${f.id}` }));
  return { ...response, information: [...information, ...extras.filter(f => f.value !== null && String(f.value).trim() !== '')], questions: response.questions.filter(q => !(q.binding.kind === 'fact' && raw.assumptions[q.binding.index]?.variable === 'monthly_surplus')).map(q => ({ ...q, id: `calculation-${q.id}` })) };
}

// Quick Calculate asks first; hypothetical exploration requires an explicit Skip.
export function questionFirstResponse(response: CalculationResponse, allowHypothetical: boolean): CalculationResponse {
  if (allowHypothetical || !['conditional', 'stale'].includes(response.status) ||
      !response.parameters.some(p => p.id.startsWith('hypothetical_'))) return response;
  const { answer: _answer, ...content } = response;
  void _answer;
  return { ...content, status: 'needs_input', message: 'Please provide the following information. You can skip a question if you don’t want to provide it.',
    parameters: [], assumptions: [], explanations: [], limitations: [],
    metrics: response.metrics.filter(m => !m.label.startsWith('Hypothetical')) };
}

// Shared direct answer wording built from the calculator's returned values only.
export function conciseScenarioAnswer(response: CalculationResponse, goal: AssumptionValue): AnswerContent | null {
  if (response.status !== 'conditional' || !response.parameters.some(p => p.id.startsWith('hypothetical_'))) return null;
  const metric = (name: string) => response.metrics.find(m => m.label === name)?.value;
  const available = metric('Hypothetical projected at deadline');
  const gap = metric('Hypothetical remaining gap');
  const selectedGoal = response.parameters.find(p => p.id === 'hypothetical_goal_amount')?.value ?? goal;
  const goalNumber = selectedGoal === null || String(selectedGoal).trim() === '' ? NaN : Number(String(selectedGoal).replace(/[$,]/g, ''));
  const target = Number.isFinite(goalNumber) ? `your ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(goalNumber).replace(/\.00$/, '')} goal` : 'your goal';
  if (available && gap) {
    const shortfall = Number(gap.replace(/[$,]/g, ''));
    if (!Number.isFinite(shortfall)) return null;
    const funds = Number(available.replace(/[$,]/g, ''));
    return { headline: shortfall > 0 ? `No, you can't afford it yet. You are ${gap} short of ${target}.` : Number.isFinite(funds) && Number.isFinite(goalNumber) ? `Yes, you can afford it, with ${money(Math.max(0, funds - goalNumber))} left over.` : `Yes, you can afford ${target} with ${available} available.` };
  }
  const monthly = metric('Hypothetical monthly cash after new cost');
  if (!monthly) return null;
  const remaining = Number(monthly.replace(/[$,]/g, ''));
  if (!Number.isFinite(remaining)) return null;
  return { headline: remaining >= 0 ? `Yes, you can afford it, with ${money(remaining)} left each month.` : `No, you can't afford it yet. You are ${money(-remaining)} short each month.` };
}
