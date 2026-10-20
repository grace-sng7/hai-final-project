import cleanTrip from '../fixtures/clean-trip.json';
import laptop from '../fixtures/laptop.json';
import messyTrip from '../fixtures/messy-trip.json';
import type { Uncertainty } from '../calculation-contract';

export const laptopCorrection = 'I make $1,800/month after tax and spend $1,300/month. I need the laptop in 4 months.';

// The extraction challenge each example demonstrates. Categories describe the input, not the calculator,
// so future calculators and frontends can reuse them without depending on any one fixture.
export type DemoCategory = 'complete' | 'missing' | 'ambiguous';
export const categories: Record<DemoCategory, { label: string; challenge: string }> = {
  complete: { label: 'Complete information', challenge: 'Everything needed is stated.' },
  missing: { label: 'Missing information', challenge: 'Key details are absent, so we ask instead of guessing.' },
  ambiguous: { label: 'Ambiguous information', challenge: 'Values are vague or uncertain, so assumptions stay visible.' },
};

// Values extracted with a number that remain uncertain. Extraction source labels
// (stated / inferred / missing) are preserved unchanged; this is a separate presentation layer.
const messyUncertainties: Record<string, Uncertainty> = {
  monthly_income: { note: 'You said \u201caround $2k most months\u201d and that it \u201cchanges\u201d.', assumption: 'The calculation treats income as a steady $2,000 each month.' },
  monthly_expenses_other: { note: 'You gave a range of $700\u2013800.', assumption: 'The calculation uses the $750 midpoint.' },
  current_savings: { note: 'You don\u2019t want to use all of your savings but didn\u2019t say how much you would commit.', assumption: 'Savings are used only as needed; set an exact amount in What If.' },
  goal_deadline: { note: '\u201cNext May\u201d depends on today\u2019s date.', assumption: 'The calculation assumes 9 months, counting from August.' },
};

export interface DemoSample {
  id: string; category: DemoCategory; title: string; icon: string; message: string; description: string;
  data: unknown; uncertainties?: Record<string, Uncertainty>;
}
export const samples: DemoSample[] = [
  { id: 'clean-trip', category: 'complete', title: 'Clean Trip', icon: '\u2708', description: 'Every number is stated. Only the monthly surplus is inferred.', message: 'I make $2,500 a month after tax and spend about $1,800. I have $2,000 saved. I want to take a $3,500 trip in 6 months. Can I afford it?', data: cleanTrip },
  { id: 'laptop', category: 'missing', title: 'Laptop', icon: '\u25B1', description: 'Income, expenses and the deadline are missing, so we ask.', message: 'I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?', data: laptop },
  { id: 'messy-trip', category: 'ambiguous', title: 'Messy Europe Trip', icon: '\u2248', description: 'Ranges, \u201cnext May\u201d and reluctance to spend savings. Uncertainty stays visible.', message: "I make around $2k most months from my campus job and tutoring, but it changes. Rent is like $900 and I probably spend another $700\u2013800? I have $1,200 saved but don't really want to use all of it. My friends want to go to Europe next May and it'll probably be around $3k. Is that realistic?", data: messyTrip, uncertainties: messyUncertainties },
];

export const sampleFor = (question: string) => samples.find(sample => sample.message === question.trim());
export const uncertaintiesFor = (question: string) => sampleFor(question)?.uncertainties;
