import assert from 'node:assert/strict';
import { applyProfile, stripProfile, fromProfile, profileContext, monthlyExpenses, hasProfile } from '../lib/profile.ts';
import { applyLocalAnswer } from '../lib/local-answer.ts';

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

// Provenance: profile rows are flagged so the UI can label them and so they can be withheld from the model.
assert.equal(fromProfile(get('monthly_income')), true);
assert.equal(fromProfile(get('goal_amount')), false, 'what the user said is not flagged');

// Privacy: nothing from the profile survives stripProfile (this is what a correction request carries).
const full = applyProfile({ ...base, assumptions: [...base.assumptions] }, { income: 2000, rent: 900, otherExpenses: 500, savings: 4321 });
const sent = stripProfile(full);
assert.doesNotMatch(JSON.stringify(sent), /2000|1400|4321|900.*rent|from_profile|profile/i, 'no profile figures or markers in the outgoing extraction');
for (const v of ['monthly_income', 'monthly_expenses', 'current_savings']) assert.deepEqual([sent.assumptions.find(a => a.variable === v).value, sent.assumptions.find(a => a.variable === v).source], [null, 'missing']);
assert.equal(sent.assumptions.find(a => a.variable === 'goal_amount').value, 900, 'what the user said is still sent');
assert.equal(full.assumptions.find(a => a.variable === 'monthly_income').value, 2000, 'stripProfile does not mutate');

// Round trip of a correction: strip -> model changes income -> re-apply. The chat wins; the rest is refilled.
const corrected = { ...sent, assumptions: sent.assumptions.map(a => a.variable === 'monthly_income' ? { ...a, value: 2600, source: 'stated', source_detail: 'User said 2600' } : a) };
const back = applyProfile(corrected, { income: 2000, rent: 900, otherExpenses: 500, savings: 4321 });
const at = v => back.assumptions.find(a => a.variable === v);
assert.deepEqual([at('monthly_income').value, fromProfile(at('monthly_income'))], [2600, false]);
assert.deepEqual([at('monthly_expenses').value, fromProfile(at('monthly_expenses'))], [1400, true]);
assert.equal(at('current_savings').value, 4321);

// Editing the profile mid-chat: re-applying replaces old profile values, and clearing removes them.
const edited = applyProfile(full, { income: 2500 });
assert.equal(edited.assumptions.find(a => a.variable === 'monthly_income').value, 2500);
assert.equal(edited.assumptions.find(a => a.variable === 'current_savings').source, 'missing', 'removed profile field is blanked');
assert.equal(applyProfile(full, {}).assumptions.some(fromProfile), false);
assert.deepEqual(applyProfile(full, { income: 2000, rent: 900, otherExpenses: 500, savings: 4321 }), full, 're-applying the same profile changes nothing');

// A plain numeric answer in the chat replaces a profile value and drops the flag.
assert.equal(fromProfile(applyLocalAnswer(full, 'monthly_income', 3000, '3000').assumptions.find(a => a.variable === 'monthly_income')), false);

console.log('PASS: profile fill, precedence, surplus reset, provenance and privacy');
