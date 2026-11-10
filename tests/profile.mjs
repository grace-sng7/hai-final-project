import assert from 'node:assert/strict';
import { applyProfile, profileContext, monthlyExpenses, hasProfile } from '../lib/profile.ts';

const miss = (variable, unit) => ({ variable, value: null, unit, source: 'missing', source_detail: 'Not mentioned' });
const base = {
  assumptions: [miss('monthly_income', '$/month'), miss('monthly_expenses', '$/month'), { variable: 'monthly_surplus', value: 0, unit: '$/month', source: 'inferred', source_detail: 'x' }, miss('current_savings', '$'),
    { variable: 'goal_amount', value: 900, unit: '$', source: 'stated', source_detail: 'User said' }],
  clarification_questions: [{ target_variable: 'monthly_income', question: 'q1', why_it_matters: 'w' }, { target_variable: 'goal_deadline', question: 'q2', why_it_matters: 'w' }],
  goal_summary: 'g', confidence_note: 'c',
};

const out = applyProfile(base, { income: 2000, rent: 900, otherExpenses: 500 });
const get = v => out.assumptions.find(a => a.variable === v);
assert.deepEqual([get('monthly_income').value, get('monthly_income').source], [2000, 'stated']);
assert.equal(get('monthly_expenses').value, 1400);
assert.match(get('monthly_expenses').source_detail, /profile.*rent \$900 \+ other \$500/);
assert.equal(get('monthly_surplus').source, 'missing', 'derived surplus is cleared');
assert.equal(get('current_savings').source, 'missing', 'no savings in profile, still asked');
assert.deepEqual(out.clarification_questions.map(q => q.target_variable), ['goal_deadline']);
assert.equal(base.assumptions[0].value, null, 'input not mutated');

// What the user says in the conversation beats the profile.
const said = { ...base, assumptions: base.assumptions.map(a => a.variable === 'monthly_income' ? { ...a, value: 3100, source: 'stated' } : a) };
assert.equal(applyProfile(said, { income: 2000 }).assumptions[0].value, 3100);
// Missing variables are added.
assert.equal(applyProfile({ ...base, assumptions: [] }, { savings: 400 }).assumptions[0].variable, 'current_savings');
// Privacy: no context unless opted in, and never financial numbers.
assert.equal(profileContext({ state: 'CA', country: 'USA', age: 20, income: 5000 }), '');
const ctx = profileContext({ state: 'CA', country: 'USA', age: 20, income: 5000, shareContext: true });
assert.match(ctx, /CA, USA/); assert.match(ctx, /20 years/); assert.doesNotMatch(ctx, /5000/);
assert.equal(monthlyExpenses({}), undefined);
assert.equal(hasProfile({ state: 'CA' }), false);
assert.equal(hasProfile({ rent: 0 }), true);
console.log('PASS: profile fill, precedence, surplus reset and privacy');
