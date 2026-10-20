// Real frontend reducers/adapters/rendering -> FastAPI routes -> integrated calculator.
// Only the external extraction provider is stubbed for reproducibility.
import ts from 'typescript';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const testModule=new Module(fileURLToPath(import.meta.url));
function load(file){const m=new Module(file,testModule);m.filename=file;m.paths=require.resolve.paths('typescript');const orig=m.require.bind(m);m.require=(id)=>{const base=path.resolve(path.dirname(file),id);const c=[base+'.ts',base+'.tsx'].find(p=>fs.existsSync(p));return id.startsWith('.')&&c?load(c):orig(id);};m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);return m.exports;}

import { spawnSync } from 'node:child_process';
const { TransportExtractionService } = load(path.resolve('lib/extraction.ts'));
const { HttpCalculationService } = load(path.resolve('lib/http-services.ts'));
const model = load(path.resolve('lib/workspace-model.ts'));
const { presentResponse } = load(path.resolve('lib/presentation-model.ts'));
const { ResultView } = load(path.resolve('components/result-view.tsx'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const fixture = JSON.parse(fs.readFileSync('backend_reference/examples/savings-ready.extraction.json', 'utf8'));
function api(action, body, modelResponse) {
  const child = spawnSync(process.env.PYTHON || 'python3', ['-B', 'tests/calculator-api.py'], {
    input: JSON.stringify({ path: '/' + action, body, model_response: modelResponse }), encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const response = JSON.parse(child.stdout);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}
const extractor = new TransportExtractionService({
  extract: body => api('extract', body, fixture),
  correct: body => api('correct', body, fixture),
});
const calculator = new HttpCalculationService(async (url, options) =>
  new Response(JSON.stringify(api('calculate', JSON.parse(options.body))), {
    status: 200, headers: { 'content-type': 'application/json' },
  }));
const extraction = await extractor.extract({ user_message: 'A trip in eight months', reference_date: '2026-10-20', timezone: 'America/New_York' });
let app = model.workspaceReducer(model.initialApplicationState(), { type: 'load', question: 'A trip', extraction });
async function calculate() {
  const result = await calculator.calculate(model.calculationRequest(app));
  app = model.workspaceReducer(app, { type: 'result', revision: app.revision, response: result });
  return result;
}
function metric(result, label) { return result.metrics.find(m => m.label === label)?.value; }
let result = await calculate();
assert.match(result.answer.headline, /use \$200/);
assert.equal(result.parameters[0].control.type, 'range');
const expenseIndex = extraction.assumptions.findIndex(a => a.variable === 'monthly_expenses');
app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'fact', index: expenseIndex }, value: 1750 });
assert.equal(model.currentResult(app), null, 'Edits immediately invalidate an old answer');
result = await calculate();
assert.equal(metric(result, 'Monthly available cash'), '$250');
assert.match(result.answer.headline, /use \$1,000/);
app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'parameter', key: 'monthly_contribution' }, value: 200 });
assert.equal(model.currentResult(app), null, 'Old result is not current while a slider changes');
const retainedDuringDrag = model.parameterRefreshResult(app);
assert.ok(retainedDuringDrag, 'Parameter changes retain the previous layout');
const pendingMarkup = renderToStaticMarkup(React.createElement(ResultView, {
  response: presentResponse(extraction, retainedDuringDrag), app: { ...app, mode: 'quick' },
  refreshing: true, onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
}));
assert.ok(pendingMarkup.includes('Updating — previous result shown'));
assert.ok(pendingMarkup.includes('Explore What If'));
assert.ok(pendingMarkup.includes('Supporting details'));
assert.ok(pendingMarkup.includes('value="250"'), 'Previous inline answer keeps the amount used in its calculation');
assert.ok(pendingMarkup.includes('value="200"'), 'Slider shows the requested new value');
assert.equal(model.parameterRefreshResult(app, true), null, 'Uncommitted text does not retain an answer');
const factChange = model.workspaceReducer(app, { type: 'value', binding: { kind: 'fact', index: expenseIndex }, value: 1800 });
assert.equal(model.parameterRefreshResult(factChange), null, 'Changes to facts still invalidate the answer');
result = await calculate();
assert.equal(metric(result, 'Projected at deadline'), '$2,800');
assert.equal(metric(result, 'Remaining gap'), '$200');
assert.equal(metric(result, 'Monthly cash remaining'), '$50');
assert.match(result.answer.headline, /\$200 short/);
assert.ok(result.explanations.some(e => e.label === 'Option: Save $250 each month'));
const html = renderToStaticMarkup(React.createElement(ResultView, {
  response: presentResponse(extraction, result, true), app: { ...app, mode: 'quick' },
  refreshing: false, onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
}));
assert.ok(html.includes('Explore What If'));
assert.ok(html.includes('$200'));
assert.deepEqual(extraction, fixture, 'Edits do not mutate the original extraction');
// Missing values become editable fact fields and run through the same API.
app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'fact', index: expenseIndex }, value: null });
result = await calculate();
assert.equal(result.status, 'needs_input');
const question = result.questions.find(q => q.binding.kind === 'fact' && q.binding.index === expenseIndex);
assert.ok(question);
app = model.workspaceReducer(app, { type: 'value', binding: question.binding, value: 1650 });
assert.equal((await calculate()).status, 'conditional');
// The backend clamps an oversized request; the visible control must match its math.
app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'parameter', key: 'monthly_contribution' }, value: 9999 });
result = await calculate();
assert.equal(result.parameters[0].value, 350);
assert.equal(model.boundValue(app, result.parameters[0].binding, result.parameters[0].value), 350);
console.log('PASS: extraction route -> editable assumptions -> calculator route -> What If -> rendered results -> missing-input recovery');

// Presentation examples use saved extraction, never provider-backed extraction or demo math.
const { samples: presentationSamples } = load(path.resolve('lib/mock/presentation-samples.ts'));
const { offlineExtractionService } = load(path.resolve('lib/offline-demo-services.ts'));
assert.deepEqual(presentationSamples.map(s => s.title), ['Clean Trip', 'Laptop', 'Messy Europe Trip']);
for (const sample of presentationSamples) {
  const saved = await offlineExtractionService.extract({ user_message: sample.message, reference_date: '2026-10-20', timezone: 'America/New_York' });
  assert.deepEqual(saved, sample.data);
  app = model.workspaceReducer(model.initialApplicationState(), { type: 'load', question: sample.message, extraction: saved });
  result = await calculate();
  assert.equal(result.status, sample.id === 'laptop' ? 'needs_input' : 'conditional');
  if (sample.id === 'laptop') {
    assert.equal(result.questions.length, 3);
    assert.ok(result.questions.every(q => q.required));
    assert.equal(result.parameters.length, 0);
    assert.equal(metric(result, 'Goal minus current savings (before reserves)'), '$500');
    const { toCalculateWire } = load(path.resolve('lib/backend-wire.ts'));
    for (const [variable, value] of Object.entries({ monthly_income: 1800, monthly_expenses: 1300 })) {
      app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'fact', index: saved.assumptions.findIndex(a => a.variable === variable) }, value });
      result = await calculate();
      assert.equal(result.status, 'needs_input');
      assert.equal(result.parameters.length, 0);
      assert.equal(app.result.questions.length, 3, 'All original question boxes stay mounted after answers arrive');
      const review = presentResponse(saved, app.result, true, app.edits);
      assert.equal(review.questions[0].binding.index, saved.assumptions.findIndex(a => a.variable === 'monthly_income'));
    }
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].required, false);
    const retainedMarkup = renderToStaticMarkup(React.createElement(ResultView, {
      response: presentResponse(saved, app.result, true, app.edits), app: { ...app, mode: 'quick' }, refreshing: false,
      onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
    }));
    assert.ok(retainedMarkup.includes('value="1800"'));
    assert.ok(retainedMarkup.includes('value="1300"'));
    assert.equal((retainedMarkup.match(/aria-label="Skip:/g) || []).length, 3, 'Each question keeps its Skip action until one is selected');

    for (const mode of ['quick', 'guide']) {
      const markup = renderToStaticMarkup(React.createElement(ResultView, {
        response: presentResponse(saved, result), app: { ...app, mode }, refreshing: false,
        onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
      }));
      assert.equal((markup.match(/aria-label="Skip:/g) || []).length, 1);
      assert.ok(!markup.includes('Explore What If'));
    }
    for (const [key,value] of Object.entries({ skip_input_goal_deadline: 1, explore_unresolved: 1, hypothetical_goal_deadline: 4 })) {
      app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'parameter', key }, value });
    }
    const locked = model.workspaceReducer(app, { type: 'value', binding: { kind: 'parameter', key: 'skip_input_monthly_income' }, value: 1 });
    assert.equal(locked, app, 'A second Skip is rejected until the selected Skip is undone');
    result = await calculate();
    assert.equal(result.status, 'conditional');
    assert.equal(result.parameters.length, 1);
    assert.equal(result.parameters[0].id, 'hypothetical_goal_deadline');
    const { conciseScenarioAnswer } = load(path.resolve('lib/presentation-model.ts'));
    assert.equal(conciseScenarioAnswer(result, 2000).headline, 'Yes, you can afford it, with $1,500 left over.');
    const shortScenario = { ...result, metrics: result.metrics.map(m => m.label === 'Hypothetical projected at deadline' ? { ...m, value: '$1,800' } : m.label === 'Hypothetical remaining gap' ? { ...m, value: '$200' } : m) };
    assert.equal(conciseScenarioAnswer(shortScenario, 2000).headline, "No, you can't afford it yet. You are $200 short of your $2,000 goal.");
    for (const mode of ['quick', 'guide']) {
      const card = renderToStaticMarkup(React.createElement(ResultView, {
        response: presentResponse(saved, app.result, true, app.edits), app: { ...app, mode }, refreshing: false,
        onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
      }));
      assert.ok(card.includes('Yes, you can afford it, with $1,500 left over.'));
      assert.ok(card.includes('Based on your selected assumptions.'));
      assert.ok(!card.includes('Hypothetical only'));
      assert.ok(!card.includes('affordability is not yet verified'));
      assert.ok(card.indexOf('Based on your selected assumptions.') < card.indexOf('Explore What If'));

    }

    const selectedMarkup = renderToStaticMarkup(React.createElement(ResultView, {
      response: presentResponse(saved, app.result, true, app.edits), app: { ...app, mode: 'guide' }, refreshing: false,
      onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
    }));
    assert.equal((selectedMarkup.match(/aria-label="Skip:[^"]*" disabled=""/g) || []).length, 2);
    assert.ok(selectedMarkup.includes('Answer instead:'));

    assert.equal(metric(result, 'Hypothetical projected at deadline'), '$3,500');
    assert.match(result.answer.headline, /affordability is not yet verified/);
    const wireRequest = toCalculateWire(model.calculationRequest(app));
    assert.equal(wireRequest.assumptions.find(a => a.variable === 'goal_deadline').value, null);
    assert.ok(!model.correctionLines(app, result).some(line => line.includes('goal_deadline')));
    const deadline = saved.assumptions.findIndex(a => a.variable === 'goal_deadline');
    app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'fact', index: deadline }, value: 4 });
    result = await calculate();
    assert.ok(!result.parameters.some(p => p.id.startsWith('hypothetical_')));
    assert.equal(metric(result, 'Monthly available cash'), '$500');
  }
  const fields = presentResponse(saved, result, false, app.edits);
  assert.equal(fields.information.length, saved.assumptions.filter((a,i) => (Object.hasOwn(app.edits,i) ? app.edits[i] : a.value) !== null).length);
  if (sample.id === 'messy-trip') {
    assert.equal(fields.questions.length, 0);
    assert.equal(saved.assumptions.find(a => a.variable === 'goal_deadline').value, 9);
    assert.ok(fields.information.some(f => f.sourceDetail.includes('August')));
  }
  for (const mode of ['quick', 'guide']) {
    const markup = renderToStaticMarkup(React.createElement(ResultView, {
      response: fields, app: { ...app, mode }, refreshing: false,
      onChange() {}, onDraft() {}, onRevert() {}, onStep() {}, onAction() {},
    }));
    assert.ok(markup.includes('Explore What If'));
    assert.ok(markup.includes('Your information'));
  }
  app = model.workspaceReducer(app, { type: 'value', binding: { kind: 'parameter', key: 'monthly_contribution' }, value: 0 });
  result = await calculate();
  assert.ok(Number(result.parameters[0].value) === 0);
  assert.equal(metric(result, 'Projected at deadline'), sample.id === 'clean-trip' ? '$2,000' : sample.id === 'laptop' ? '$1,500' : '$1,200');
  assert.deepEqual(saved, sample.data, 'Original Grace fixture remains immutable');
}
console.log('PASS: three original presentation fixtures -> real calculator -> missing-input completion -> both modes -> What If recalculation');
