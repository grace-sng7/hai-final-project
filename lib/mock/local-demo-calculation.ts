import { extractionInformation } from '../presentation-model';
import { calculatorService } from '../calculator';
import updated from '../fixtures/laptop-correction.json';
import { dataIssues, type ExtractionResponse, type AssumptionValue } from '../extraction';
import { samples } from './data';
import { emptyContent, type CalculationRequest, type CalculationResponse, type CalculationService, type EditableField, type Question } from '../calculation-contract';
export type { CalculationRequest, CalculationResponse, CalculationService, ResultStatus } from '../calculation-contract';

const title = (v: string) => v.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const requirements = [
  { variable: 'monthly_income', unit: '$/month', question: 'What is your monthly income after tax?' },
  { variable: 'monthly_expenses', unit: '$/month', question: 'What are your total monthly expenses?' },
  { variable: 'current_savings', unit: '$', question: 'How much do you currently have saved?' },
  { variable: 'goal_amount', unit: '$', question: 'How much does this goal cost?' },
  { variable: 'goal_deadline', unit: 'months', question: 'How many months until you need the money?' },
];
// Only explicitly registered mock snapshots may use this limited local savings model.
// New backend extraction output must never silently fall back to this calculator.
export class LocalDemoCalculationService implements CalculationService {
  constructor(private readonly supportedExtractions?: ExtractionResponse[]) {}
  async calculate(request: CalculationRequest): Promise<CalculationResponse> {
    const { extraction: raw, edits, answers, parameters } = request;
    const base = emptyContent();
    const effective = (index: number): AssumptionValue => Object.hasOwn(edits, index) ? edits[index] : raw.assumptions[index].value;
    base.information = extractionInformation(raw);
    // No calculations are permitted for ambiguous or internally inconsistent extraction.
    if (dataIssues(raw).length) return { ...base, status: 'unsupported', message: 'Some extracted details conflict. Review the information and request a corrected extraction.', nextActions: [{ label: 'Review information', action: 'review_information' }] };
    const registered = this.supportedExtractions ?? [...samples.filter(s => s.message === request.originalQuestion).map(s => s.data as ExtractionResponse), ...(request.originalQuestion === samples[1].message ? [updated as ExtractionResponse] : [])];
    const supported = registered.some(snapshot => JSON.stringify(snapshot) === JSON.stringify(raw));
    if (!supported || Object.keys(parameters).some(key => !['monthly-contribution', 'existing-savings'].includes(key))) return { ...base, status: 'unsupported', message: 'The connected demo calculator supports only a simple savings goal with a month-based deadline. These details are available to review, but this question needs another calculation model.', nextActions: [{ label: 'Review information', action: 'review_information' }] };
    // When rent and other spending are itemized, their edits flow into total monthly expenses.
    const expenseIndex = raw.assumptions.findIndex(a => a.variable === 'monthly_expenses');
    const rentIndex = raw.assumptions.findIndex(a => a.variable === 'monthly_expenses_rent');
    const otherIndex = raw.assumptions.findIndex(a => a.variable === 'monthly_expenses_other');
    const itemized = expenseIndex >= 0 && rentIndex >= 0 && otherIndex >= 0;
    const itemizedTotal = (): number | undefined => {
      if (!itemized || Object.hasOwn(edits, expenseIndex)) return undefined;
      const parts = [effective(rentIndex), effective(otherIndex)];
      return parts.every(p => p !== null && String(p).trim() !== '' && Number.isFinite(Number(p))) ? parts.reduce<number>((sum, p) => sum + Number(p), 0) : undefined;
    };
    const consumedQuestions = new Set<number>();
    const values: number[] = [];
    const required: Question[] = [];
    requirements.forEach((r, index) => {
      const fi = raw.assumptions.findIndex(a => a.variable === r.variable);
      const qi = raw.clarification_questions.findIndex(q => q.target_variable === r.variable);
      const originalMissing = fi < 0 || raw.assumptions[fi].value === null;
      const questionIndex = originalMissing ? qi : -1;
      const answerKey = questionIndex >= 0 ? `extraction-question-${questionIndex}` : `input-${r.variable}`;
      const derivedTotal = r.variable === 'monthly_expenses' ? itemizedTotal() : undefined;
      const value = derivedTotal !== undefined ? derivedTotal : fi >= 0 && Object.hasOwn(edits, fi) ? effective(fi) : Object.hasOwn(answers, answerKey) ? answers[answerKey] : fi >= 0 ? effective(fi) : null;
      const valid = value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && (r.variable !== 'goal_deadline' || Number(value) > 0 && Number.isInteger(Number(value)));
      values[index] = Number(value);
      // Retain fields for originally missing values so answers remain editable after completion.
      if (!valid || fi < 0 || raw.assumptions[fi].value === null) {
        if (questionIndex >= 0) consumedQuestions.add(questionIndex);
        required.push({ id: r.variable, label: raw.clarification_questions[questionIndex]?.question ?? r.question, help: raw.clarification_questions[questionIndex]?.why_it_matters ?? 'Needed by the connected demo savings model.', unit: r.unit, value: valid ? value : '', binding: originalMissing ? { kind: 'answer', key: answerKey } : { kind: 'fact', index: fi }, correctsFactIndex: originalMissing && fi >= 0 ? fi : undefined, extractionQuestionIndices: questionIndex >= 0 ? [questionIndex] : [], control: { type: 'number', min: 0, step: r.unit === 'months' ? 1 : 0.01 }, required: !valid });
      }
    });
    base.questions = required;
    // The local engine cannot reinterpret arbitrary edits or prose answers safely.
    const unmodeled = Object.keys(edits).some(i => !requirements.some(r => r.variable === raw.assumptions[Number(i)]?.variable) && !(itemized && [rentIndex, otherIndex].includes(Number(i))));
    const prose = Object.entries(answers).some(([key, value]) => key.startsWith('extraction-question-') && !consumedQuestions.has(Number(key.replace('extraction-question-', ''))) && value.trim());
    if (unmodeled || prose) return { ...base, status: 'stale', message: 'These changes need a new extraction before the local calculation can use them. Apply corrections or undo the changes.' };
    if (required.some(q => q.required)) return { ...base, status: 'needs_input', message: 'A few details are needed before we can calculate an answer.' };
    const [income, expenses, savings, goal, months] = values;
    const contribution = Object.hasOwn(parameters, 'monthly-contribution') ? parameters['monthly-contribution'] : String(Math.min(Math.ceil(goal / months * 100) / 100, Math.max(0, income - expenses)));
    const allocated = parameters['existing-savings'];
    const field = (id: string, label: string, value: AssumptionValue, max: number, range = false): EditableField => ({ id, label, value, unit: '$', binding: { kind: 'parameter', key: id }, control: { type: range ? 'range' : 'number', min: 0, max, step: 0.01 } });
    const contributionField = field('monthly-contribution', 'Save each month', contribution, Math.max(0, income - expenses, Number(contribution) || 0), true);
    const invalid = !contribution.trim() || !Number.isFinite(Number(contribution)) || Number(contribution) < 0 || allocated !== undefined && (!allocated.trim() || !Number.isFinite(Number(allocated)) || Number(allocated) < 0 || Number(allocated) > savings);
    if (invalid) return { ...base, status: 'needs_input', message: 'Check the amounts below.', questions: [...base.questions, { ...contributionField, value: Number.isFinite(Number(contribution)) && contribution.trim() ? contribution : '', control: { type: 'number', min: 0, step: 0.01 }, required: true }, { ...field('existing-savings', 'Use from existing savings', allocated !== undefined && Number.isFinite(Number(allocated)) ? allocated : '', savings), required: true }] };
    if (income < expenses) return { ...base, status: 'needs_input', message: 'Monthly expenses exceed income. Review these amounts before planning additional saving.', questions: requirements.slice(0, 2).map(r => { const index = raw.assumptions.findIndex(a => a.variable === r.variable); return { id: r.variable, label: r.question, unit: r.unit, value: index >= 0 ? effective(index) : answers[r.variable] ?? '', binding: index >= 0 ? { kind: 'fact', index } : { kind: 'answer', key: r.variable }, control: { type: 'number', min: 0 }, required: true }; }) };
    try {
      const inputs = { income, expenses, savings, goal, months, contribution: Number(contribution), allocated: 0 };
      const without = calculatorService.calculate(inputs);
      const needed = Math.max(0, Math.ceil((without.gap - 1e-8) * 100) / 100);
      inputs.allocated = allocated === undefined ? Math.min(needed, savings) : Number(allocated);
      const r = calculatorService.calculate(inputs);
      const gap = Math.round(r.gap * 100) / 100;
      const prefix = r.exceeds ? 'This monthly saving amount exceeds your available cash.' : gap > 0 ? 'No, saving ' : 'Yes, if you save ';
      const outcome = gap > 0 ? ` per month still leaves a ${money(gap)} shortfall.` : inputs.allocated > 0 ? ` per month, you’ll ${allocated === undefined ? 'need' : 'use'} ${money(inputs.allocated)} from your existing savings.` : ' per month, you won’t need to use your existing savings.';
      const headline = r.exceeds ? prefix : `${prefix}${money(inputs.contribution)}${outcome}`;
      if (!Object.hasOwn(parameters, 'monthly-contribution')) base.assumptions.push({ id: 'starting-contribution', text: `Would saving ${money(Number(contribution))} each month work for you?`, parameter: contributionField, reviewLabel: 'Review' });
      if (needed > 0 || inputs.allocated > 0) base.assumptions.push({ id: 'existing-savings', text: allocated === undefined ? needed > savings ? `This plan needs ${money(needed)} from savings; you have ${money(savings)}.` : `Would you be comfortable using ${money(needed)} of your current ${money(savings)} savings?` : `Your plan uses ${money(inputs.allocated)} of your existing savings.`, parameter: field('existing-savings', 'Use from existing savings', inputs.allocated, savings), reviewLabel: 'Edit' });
      for (const a of raw.assumptions.filter((a, index) => a.source === 'inferred' && requirements.some(r => r.variable === a.variable) && !Object.hasOwn(edits, index))) base.assumptions.push({ id: `inferred-${a.variable}`, text: `${title(a.variable)} uses the extracted inference. ${a.source_detail}` });
      // Ambiguous values keep their uncertainty visible until the user edits them.
      const uncertain = samples.find(s => s.message === request.originalQuestion)?.uncertainties ?? {};
      raw.assumptions.forEach((a, index) => { const u = uncertain[a.variable]; if (u && !Object.hasOwn(edits, index)) base.assumptions.push({ id: `ambiguous-${a.variable}`, kind: 'ambiguous', text: `${title(a.variable)}: ${u.note} ${u.assumption}` }); });
      base.assumptions.push({ id: 'constant-values', text: 'Income and spending stay constant. No interest, unlisted costs, or competing goals are included.' });
      return { ...base, status: 'conditional', answer: { headline, segments: r.exceeds ? [{ type: 'text', text: headline }] : [{ type: 'text', text: prefix }, { type: 'parameter', parameterId: contributionField.id, prefix: '$' }, { type: 'text', text: outcome }], detail: 'Based on the values and assumptions shown here.' }, parameters: [contributionField], metrics: [{ label: 'Goal amount', value: money(goal) }, { label: 'Projected at deadline', value: money(r.projected) }, { label: 'Remaining gap', value: money(gap) }, { label: 'Monthly cash remaining', value: money(r.remaining) }], explanations: [{ label: 'Monthly available cash', text: `${money(income)} − ${money(expenses)} = ${money(r.available)}` }, { label: 'Projected savings', text: `${money(inputs.allocated)} + ${money(inputs.contribution)} × ${months} months = ${money(r.projected)}` }, { label: 'Remaining gap', text: `max(0, ${money(goal)} − ${money(r.projected)}) = ${money(gap)}` }], limitations: ['A proposed savings amount is not a user commitment.'] };
    } catch { return { ...base, status: 'unsupported', message: 'The local calculator cannot produce a reliable result with these values.', nextActions: [{ label: 'Review information', action: 'review_information' }] }; }
  }
}
