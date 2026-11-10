import type { Assumption, ExtractionResponse } from './extraction';

// Basic facts the user sets once so the chat doesn't ask every time.
// Privacy: stored only in this browser (localStorage). Financial numbers are applied on the client and
// never sent to the model: every filled row is marked `from_profile`, and stripProfile() blanks those rows
// before a correction request. They do go to the calculator (plain arithmetic, no model).
// age/state/country are sent to the model only if the user turns on "shareContext".
export interface Profile {
  income?: number;          // monthly, after tax
  rent?: number;            // monthly
  otherExpenses?: number;   // monthly, everything besides rent
  savings?: number;
  age?: number;
  state?: string;
  country?: string;
  shareContext?: boolean;
}

const KEY = 'pennyscope-profile-v1';
export function loadProfile(): Profile {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as Profile : {}; } catch { return {}; }
}
export function saveProfile(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode etc.: profile lasts this session only */ }
}
export function clearProfile(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export const hasProfile = (p: Profile) => [p.income, p.rent, p.otherExpenses, p.savings].some(num);
export const monthlyExpenses = (p: Profile) => num(p.rent) || num(p.otherExpenses) ? (p.rent ?? 0) + (p.otherExpenses ?? 0) : undefined;

// Context line for the model: location/age help with typical costs. Only when the user opts in.
export function profileContext(p: Profile): string {
  if (!p.shareContext) return '';
  const where = [p.state, p.country].filter(Boolean).join(', ');
  const parts = [where && `lives in ${where}`, num(p.age) && `is ${p.age} years old`].filter(Boolean);
  return parts.length ? `\n\n(Background from the user's profile: the user ${parts.join(' and ')}.)` : '';
}

export const fromProfile = (a: Assumption) => a.from_profile === true;

// Blank every profile-filled row again. Use this on anything that is about to be sent to the model.
export function stripProfile(extraction: ExtractionResponse): ExtractionResponse {
  return { ...extraction, assumptions: extraction.assumptions.map(a => {
    if (!fromProfile(a)) return a;
    const { from_profile: _flag, ...rest } = a; void _flag;
    return { ...rest, value: null, source: 'missing', source_detail: 'Not mentioned in the conversation' } as Assumption;
  }) };
}

// Fill values the user didn't mention from the profile. Anything said in the conversation wins.
// Safe to call again on an already-filled extraction (after a profile edit or a correction).
export function applyProfile(input: ExtractionResponse, p: Profile): ExtractionResponse {
  const extraction = stripProfile(input);
  const expenses = monthlyExpenses(p);
  const fills: Record<string, { value: number; unit: string; detail: string } | undefined> = {
    monthly_income: num(p.income) ? { value: p.income, unit: '$/month', detail: 'From your profile' } : undefined,
    monthly_expenses: expenses !== undefined ? { value: expenses, unit: '$/month', detail: `From your profile${num(p.rent) ? ` (rent $${p.rent}${num(p.otherExpenses) ? ` + other $${p.otherExpenses}` : ''})` : ''}` } : undefined,
    current_savings: num(p.savings) ? { value: p.savings, unit: '$', detail: 'From your profile' } : undefined,
  };
  const filled = new Set<string>();
  const assumptions: Assumption[] = extraction.assumptions.map(a => {
    const f = fills[a.variable];
    if (!f || a.source !== 'missing') return a;
    filled.add(a.variable);
    return { ...a, value: f.value, unit: a.unit ?? f.unit, source: 'stated', source_detail: f.detail, from_profile: true };
  });
  for (const [variable, f] of Object.entries(fills)) {
    if (f && !extraction.assumptions.some(a => a.variable === variable)) { filled.add(variable); assumptions.push({ variable, value: f.value, unit: f.unit, source: 'stated', source_detail: f.detail, from_profile: true }); }
  }
  // A surplus the model derived from now-known values is stale; let the calculator do the arithmetic.
  if (filled.has('monthly_income') || filled.has('monthly_expenses')) {
    for (const a of assumptions) if (a.variable === 'monthly_surplus' && a.source !== 'stated') Object.assign(a, { value: null, source: 'missing', source_detail: 'Worked out from income and expenses' });
  }
  return { ...extraction, assumptions, clarification_questions: extraction.clarification_questions.filter(q => !filled.has(q.target_variable)) };
}
