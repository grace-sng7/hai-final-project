import type { ExtractionResponse } from './extraction';
import type { CalculationResponse } from './calculation-contract';
import { editingControl } from './field-values';
import { label } from './workspace-model';

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
export function presentResponse(raw: ExtractionResponse, response: CalculationResponse, changed = false): CalculationResponse {
  const covered = new Set(response.questions.flatMap(q => q.extractionQuestionIndices ?? []));
  const originals = raw.clarification_questions.flatMap((q, index) => covered.has(index) ? [] : [{
    id: `extraction-question-${index}`, label: q.question, help: q.why_it_matters, unit: '', value: '',
    binding: { kind: 'answer' as const, key: `extraction-question-${index}` }, control: { type: 'text' as const }, required: false, extractionQuestionIndices: [index],
  }]);
  const information = extractionInformation(raw).map(field => {
    const metadata = response.information.find(f => f.binding.kind === 'fact' && field.binding.kind === 'fact' && f.binding.index === field.binding.index);
    const result = metadata ? { ...field, ...metadata, id: field.id, source: field.source, sourceDetail: field.sourceDetail } : field;
    return changed && field.source === 'inferred' ? { ...result, outdated: true, confirmable: false } : result;
  });
  const extras = response.information.filter(f => f.binding.kind !== 'fact').map(f => ({ ...f, id: `calculation-${f.id}` }));
  return { ...response, information: [...information, ...extras], questions: [...response.questions.map(q => ({ ...q, id: `calculation-${q.id}` })), ...originals].sort((a, b) => Number(b.required) - Number(a.required)) };
}
