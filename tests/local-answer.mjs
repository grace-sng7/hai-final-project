import assert from 'node:assert/strict';
import { parseSimpleAnswer as p, applyLocalAnswer } from '../lib/local-answer.ts';

// Plain numbers are parsed locally.
assert.equal(p('$900', '$'), 900);
assert.equal(p('probably around $1,200', '$'), 1200);
assert.equal(p('about 2k', '$'), 2000);
assert.equal(p('around 1400', '$/month'), 1400);
assert.equal(p('4 months', 'months'), 4);
assert.equal(p('6', 'months'), 6);
// Anything unclear falls back to the model (null).
for (const [text, unit] of [
  ['not sure', '$'], ['maybe 500 or 600', '$'], ['500-600', '$'], ['$50 a week', '$/month'], ['24k a year', '$/month'],
  ['about 100 a month for 4 months', '$'], ['2 years', 'months'], ['1.5 months', 'months'], ['$3', 'months'],
  ['income 2000 and expenses 1400', '$'], ['two thousand', '$'], ['hello', '$'], ['900', 'text'], ['900', null], ['', '$'],
]) assert.equal(p(text, unit), null, `${text} / ${unit}`);

const base = { assumptions: [{ variable: 'rent', value: null, unit: '$/month', source: 'missing', source_detail: 'x' }, { variable: 'other', value: 1, unit: '$', source: 'stated', source_detail: 'y' }],
  clarification_questions: [{ target_variable: 'rent', question: 'q', why_it_matters: 'w' }, { target_variable: 'other', question: 'q2', why_it_matters: 'w' }], goal_summary: 'g', confidence_note: 'c' };
const out = applyLocalAnswer(base, 'rent', 950, ' $950 ');
assert.deepEqual(out.assumptions[0], { variable: 'rent', value: 950, unit: '$/month', source: 'stated', source_detail: 'You said “$950”' });
assert.equal(out.assumptions[1].value, 1);
assert.deepEqual(out.clarification_questions.map(q => q.target_variable), ['other']);
assert.equal(base.assumptions[0].value, null, 'input is not mutated');
console.log('PASS: local answer parsing and application');
