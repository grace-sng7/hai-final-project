import cleanTrip from '../fixtures/clean-trip.json';
import laptop from '../fixtures/laptop.json';
import messyTrip from '../fixtures/messy-trip.json';

// Original prompts and extraction fixtures from midterm-presentation-demo (406cff0).

// The extraction challenge each example demonstrates. Categories describe the input, not the calculator,
// so future calculators and frontends can reuse them without depending on any one fixture.
export type DemoCategory = 'complete' | 'missing' | 'ambiguous';
export const categories: Record<DemoCategory, { label: string; challenge: string }> = {
  complete: { label: 'Complete information', challenge: 'Everything needed is stated.' },
  missing: { label: 'Missing information', challenge: 'Key details are absent, so we ask instead of guessing.' },
  ambiguous: { label: 'Ambiguous information', challenge: 'Values are vague or uncertain, so assumptions stay visible.' },
};

export interface DemoSample {
  id: string; category: DemoCategory; title: string; icon: string; message: string; description: string;
  data: unknown;
}
export const samples: DemoSample[] = [
  { id: 'clean-trip', category: 'complete', title: 'Clean Trip', icon: '\u2708', description: 'Every number is stated. Only the monthly surplus is inferred.', message: 'I make $2,500 a month after tax and spend about $1,800. I have $2,000 saved. I want to take a $3,500 trip in 6 months. Can I afford it?', data: cleanTrip },
  { id: 'laptop', category: 'missing', title: 'Laptop', icon: '\u25B1', description: 'Income, expenses and the deadline are missing, so we ask.', message: 'I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?', data: laptop },
  { id: 'messy-trip', category: 'ambiguous', title: 'Messy Europe Trip', icon: '\u2248', description: 'Ranges, \u201cnext May\u201d and reluctance to spend savings. Uncertainty stays visible.', message: "I make around $2k most months from my campus job and tutoring, but it changes. Rent is like $900 and I probably spend another $700\u2013800? I have $1,200 saved but don't really want to use all of it. My friends want to go to Europe next May and it'll probably be around $3k. Is that realistic?", data: messyTrip },
];

export const sampleFor = (question: string) => samples.find(sample => sample.message === question.trim());
