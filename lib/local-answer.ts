import type { ExtractionResponse } from './extraction';

// Cheap path for plain numeric replies ("$900", "about 4 months"): no model call.
// Returns null whenever there is any doubt, and the caller then asks the model instead.
const AMBIGUOUS = /(week|year|yr|day|hour|semester|quarter|annual|biweekly|daily|million|\bor\b|\bto\b|\d\s*[-–]\s*\d|not sure|idk|dunno|no idea|unsure)/;

export function parseSimpleAnswer(text: string, unit: string | null): number | null {
  const t = text.trim().toLowerCase();
  const u = unit ?? '';
  const money = u === '$' || u === '$/month';
  if (!t || t.length > 60 || !(money || u === 'months') || AMBIGUOUS.test(t)) return null;
  if (u === 'months' && t.includes('$')) return null;
  if (u === '$' && t.includes('month')) return null;
  const numbers = t.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!numbers || numbers.length !== 1) return null;
  let n = Number(numbers[0].replaceAll(',', ''));
  if (!Number.isFinite(n)) return null;
  if (/\d\s*k\b|grand|thousand/.test(t)) n *= 1000;
  if (u === 'months' && !Number.isInteger(n)) return null;
  return n;
}

// Same effect as a model correction for one value: mark it stated and drop its question.
export function applyLocalAnswer(extraction: ExtractionResponse, variable: string, value: number, said: string): ExtractionResponse {
  return {
    ...extraction,
    assumptions: extraction.assumptions.map(a => a.variable === variable ? { ...a, value, source: 'stated', source_detail: `You said “${said.trim()}”` } : a),
    clarification_questions: extraction.clarification_questions.filter(q => q.target_variable !== variable),
  };
}
