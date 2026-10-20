'use client';
import { useId, useState, type ReactNode } from 'react';
import { parseEdit } from '../lib/field-values';
import { canonicalParameters } from '../lib/calculation-contract';
import type { AssumptionValue } from '../lib/extraction';
import type { CalculationResponse, AnswerContent, EditableField, ValueBinding } from '../lib/calculation-contract';
import { boundValue, guideSectionOpen, money, quickSections, type ApplicationState } from '../lib/workspace-model';
export type ChangeValue = (binding: ValueBinding, value: AssumptionValue) => void;
function display(value: AssumptionValue, unit: string) {
  if (value === null || value === '') return 'Not provided yet';
  const v = typeof value === 'number' ? unit.startsWith('$') ? money(value) : value.toLocaleString('en-US') : value;
  return `${v}${unit === '$/month' ? ' / month' : unit && unit !== '$' ? ` ${unit}` : ''}`;
}
export function FieldControl({ field, app, onChange, disabled = false, valueOverride, scenario = false }: { scenario?: boolean; valueOverride?: AssumptionValue; field: EditableField; app: ApplicationState; onChange: ChangeValue; disabled?: boolean }) {
  const id = useId();
  const value = valueOverride === undefined ? boundValue(app, field.binding, field.value) : valueOverride;
  const c = field.control;
  const update = (v: string) => onChange(field.binding, c.type === 'number' || c.type === 'range' ? v.trim() && Number.isFinite(Number(v)) ? Number(v) : v : v);
  const currency = scenario && field.unit === '$';
  const shownValue = value !== null && String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : value;
  return <div className={`parameter-field${scenario ? ' scenario-field' : ''}`}><label htmlFor={id}>{field.label}{field.unit && !currency ? ` (${field.unit})` : ''}</label>
    {scenario && c.type === 'range' && <output className="scenario-amount" htmlFor={id}>{display(shownValue, field.unit)}</output>}
    {c.type === 'select' ? <select id={id} value={String(value ?? '')} disabled={disabled} onChange={e => update(e.target.value)}><option value="">Choose…</option>{c.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <>
      <div className={scenario && c.type !== 'range' ? 'scenario-value-input' : undefined}>{currency && c.type !== 'range' && <span aria-hidden="true">$</span>}<input id={id} type={c.type} value={value ?? ''} min={c.min} max={c.max} step={c.step ?? 'any'} disabled={disabled} onChange={e => update(e.target.value)} aria-describedby={field.help ? `${id}-help` : undefined} /></div>
      {c.type === 'range' && !scenario && <input aria-label={`${field.label} exact amount`} type="number" min={c.min} max={c.max} step={c.step ?? 'any'} value={value ?? ''} disabled={disabled} onChange={e => update(e.target.value)} />}
    </>}{field.help && <small id={`${id}-help`} className="muted">{field.help}</small>}</div>;
}
export function InformationCard({ field, app, onChange, onDraft, onRevert, onConfirm }: { onConfirm?: (id: string, signature: string) => void; field: CalculationResponse['information'][number]; app: ApplicationState; onChange: ChangeValue; onDraft: (id: string, dirty: boolean) => void; onRevert: (index: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [draft, setDraft] = useState<AssumptionValue>('');
  const confirmation = app.confirmations[field.id] ?? '';
  const value = boundValue(app, field.binding, field.value);
  const signature = JSON.stringify([value, field.source, field.sourceDetail]);
  const shownValue = (field.control.type === 'number' || field.control.type === 'range') && value !== null && String(value).trim() && Number.isFinite(Number(value)) ? Number(value) : value;
  const local = field.binding.kind === 'fact' && Object.hasOwn(app.edits, field.binding.index);
  const ambiguous = !!field.uncertainty && !local;
  const parsed = parseEdit(draft, field.control);
  const valid = parsed !== undefined;
  const close = () => { setEditing(false); onDraft(field.id, false); };
  return <article className={`assumption ${field.source === 'inferred' || ambiguous ? 'to-confirm' : 'subdued'} ${ambiguous ? 'is-ambiguous' : ''} ${editing ? 'is-editing' : ''}`}>
    <div className="row-main"><div className="row-label"><strong>{field.label}</strong><span className="row-value">{field.outdated && value === field.value ? 'Needs review after changes' : display(shownValue, field.unit)}</span><div className="tags">{ambiguous && <span className="annotation ambiguity-tag">Ambiguous</span>}{local && <span className="annotation">Your edit</span>}{editing && <button className="source-toggle" aria-expanded={sourceOpen} onClick={() => setSourceOpen(!sourceOpen)}>Source {sourceOpen ? '−' : '+'}</button>}</div>{ambiguous && <p className="uncertainty-note">{field.uncertainty!.note} <strong>{field.uncertainty!.assumption}</strong></p>}{editing && sourceOpen && <p className="source-detail">{field.source} · {field.sourceDetail}</p>}<div className="row-actions">{field.confirmable && <button className="confirm-action" aria-pressed={confirmation === signature && !editing} disabled={editing || value === null} onClick={() => onConfirm?.(field.id, signature)}>{confirmation === signature ? 'Confirmed' : 'Looks right'}</button>}<button onClick={() => { setDraft(value ?? ''); setEditing(true); }}>Edit</button></div></div></div>
    {editing && <div className="editor"><FieldControl field={{ ...field, label: `Edit ${field.label}` }} app={app} valueOverride={draft} onChange={(_, value) => { setDraft(value); onDraft(field.id, true); }} /><div className="actions"><button className="primary small" disabled={!valid} onClick={() => { onChange(field.binding, parsed!); close(); }}>Save change</button><button onClick={close}>Cancel</button>{local && field.binding.kind === 'fact' && <button onClick={() => { if (field.binding.kind === 'fact') onRevert(field.binding.index); close(); }}>Undo edit</button>}</div></div>}
  </article>;
}
function SupportingSection({ number, title, open, onToggle, children }: { number: number; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return <section className={`dynamic-step ${open ? 'step-open' : ''}`} id={`step-${number}`}><h3><button className="step-heading" aria-expanded={open} aria-controls={id} onClick={onToggle}><span className="step-number">0{number}</span><span>{title}</span><span className="step-toggle" aria-hidden="true">{open ? '⌄' : '›'}</span></button></h3><div id={id} hidden={!open}>{children}</div></section>;
}
export function ResultView({ response, app, onChange, onDraft, onRevert, onStep, onAction, onConfirm, refreshing = false }: { onConfirm?: (id: string, signature: string) => void; response: CalculationResponse; app: ApplicationState; onChange: ChangeValue; onDraft: (id: string, dirty: boolean) => void; onRevert: (index: number) => void; onStep: (step: number) => void; onAction: (action: CalculationResponse['nextActions'][number]['action']) => void; refreshing?: boolean }) {
  const success = response.status === 'ready' || response.status === 'conditional';
  const stale = response.status === 'stale';
  const titles: Record<number, string> = { 1: 'Your information', 2: 'Questions for you', 3: 'Explore the numbers', 4: 'Answer' };
  const [activeInline, setActiveInline] = useState<string | null>(null);
  const retained = app.lastSupportedResult;
  const template = success ? response.answer : retained && (retained.status === 'ready' || retained.status === 'conditional') ? retained.answer : null;
  const templateFields = success ? canonicalParameters(response) : retained ? canonicalParameters(retained) : [];
  const controls = canonicalParameters(response);
  const baseSections = app.mode === 'quick' ? quickSections(response) : [1, 2, 3, 4];
  const sections = activeInline && !baseSections.includes(4) ? [4, ...baseSections] : baseSections;
  const content: Record<number, ReactNode> = {
    1: <>{response.information.length ? <InformationGroups response={response} app={app} onChange={onChange} onDraft={onDraft} onRevert={onRevert} onConfirm={onConfirm} /> : <p className="muted">No information returned yet.</p>}<p className="muted information-hint">Confirmation is optional.</p>{app.extraction && <details className="additional-context"><summary>More context</summary><p>{app.extraction.goal_summary}</p><p>{app.extraction.confidence_note}</p></details>}</>,
    2: <>{!response.questions.length && <p className="muted">No questions need answering here.</p>}{response.status === 'needs_input' && response.message && <p role="status">{response.message}</p>}{response.questions.map(q => <div className="question" key={q.id}><FieldControl field={q} app={app} onChange={onChange} />{q.extractionQuestionIndices?.some(i => app.extraction?.clarification_questions[i]?.question !== q.label) && <details><summary>Original extraction questions</summary>{q.extractionQuestionIndices.map(i => <p key={i}>{app.extraction?.clarification_questions[i]?.question}</p>)}</details>}<small className="annotation">{q.required ? 'Required' : 'Optional clarification'}</small></div>)}</>,
    3: <div className="formula-list">{(!success || !response.explanations.length) && <p className="muted">Calculations will appear when a supported result is available.</p>}{success && response.explanations.map((step, i) => <div key={i}><strong>{step.label}</strong><p>{step.text}</p></div>)}</div>,
    4: <div className="dynamic-answer" data-result-status={response.status}><span className="answer-status">{({ ready: 'Ready', conditional: 'Conditional estimate', needs_input: 'More information needed', unsupported: 'Calculation unavailable', stale: refreshing ? 'Updating' : 'Needs recalculation' })[response.status]}</span>{template && (success || activeInline) && <InlineAnswer answer={template} fields={templateFields} app={app} onChange={onChange} current={success} onFocus={setActiveInline} onBlur={() => setActiveInline(null)} />}{!success && <p role="status">{response.message}</p>}
      {success && response.assumptions.length > 0 && <ReviewReminder assumptions={response.assumptions} onReview={id => document.getElementById(`parameter-${id}`)?.querySelector<HTMLElement>('input, select')?.focus()} />}
    {(success || stale && refreshing) && controls.length > 0 && <ScenarioControls fields={controls} app={app} onChange={onChange} />}
            {(success || response.status === 'unsupported') && (response.metrics.length > 0 || success && !!response.answer.detail) && <details className="answer-limitations"><summary>Supporting details</summary><dl className="scenario-summary">{response.metrics.map((m, i) => <div key={i}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}</dl>{success && response.answer.detail && <p>{response.answer.detail}</p>}</details>}
      {success && response.limitations.length > 0 && <details className="answer-limitations"><summary>Limitations</summary><ul>{response.limitations.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
    {response.nextActions.map((a, i) => <button key={i} onClick={() => onAction(a.action)}>{a.label}</button>)}{stale && refreshing && <span className="sr-only" role="status">Updating calculation</span>}</div>,
  };
  return <>{sections.map((number, index) => {
    const forced = app.mode === 'quick' && (number === 4 || (response.status === 'needs_input' || stale && response.questions.some(q => q.required)) && number === 2);
    const open = app.mode === 'quick' ? forced || !!app.openSteps[number] : guideSectionOpen(app, response, number) || number === 4 && !!activeInline;
    return <div key={number}>{success && app.mode === 'quick' && index === 1 && <h3 className="behind-answer-heading">Behind your answer</h3>}<SupportingSection number={number} title={titles[number]} open={open} onToggle={() => onStep(number)}>{content[number]}</SupportingSection></div>;
  })}</>;
}

export function InlineAnswer({ answer, fields, app, onChange, current, onFocus, onBlur }: { answer: AnswerContent; fields: EditableField[]; app: ApplicationState; onChange: ChangeValue; current: boolean; onFocus: (id: string) => void; onBlur: () => void }) {
  return <h3 className={current ? 'answer-heading' : 'inline-pending'}>{answer.segments?.length ? answer.segments.map((segment, index) => {
    if (segment.type === 'text') return <span key={index}>{current ? segment.text : ''}</span>;
    const field = fields.find(f => f.id === segment.parameterId);
    if (!field) return null;
    const value = boundValue(app, field.binding, field.value);
    if (field.control.type === 'select') return <select key={index} className="inline-parameter" aria-label={`Answer: ${field.label}`} value={String(value ?? '')} onFocus={() => onFocus(field.id)} onBlur={onBlur} onChange={e => onChange(field.binding, e.target.value)}><option value="">Choose…</option>{field.control.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    return <span key={index} className="inline-editable">{segment.prefix}<input className="inline-parameter" aria-label={`Answer: ${field.label}`} type={field.control.type === 'number' || field.control.type === 'range' ? 'number' : field.control.type === 'date' ? 'date' : 'text'} value={value ?? ''} min={field.control.min} max={field.control.max} step={field.control.step ?? 'any'} style={{ width: `${Math.max(4, String(value ?? '').length + 1)}ch` }} onFocus={() => onFocus(field.id)} onBlur={onBlur} onChange={e => onChange(field.binding, e.target.value)} />{segment.suffix}</span>;
  }) : current ? answer.headline : null}</h3>;
}
export function ReviewReminder({ assumptions: all, onReview }: { assumptions: CalculationResponse['assumptions']; onReview: (id: string) => void }) {
  const ambiguous = all.filter(a => a.kind === 'ambiguous');
  const assumptions = all.filter(a => a.kind !== 'ambiguous');
  const notice = ambiguous.length > 0 && <aside className="ambiguity-notice"><strong>Assumed for this answer</strong><p className="muted">Some of what you shared was vague, so these values stand in until you confirm them.</p><ul>{ambiguous.map(a => <li key={a.id}>{a.text}</li>)}</ul></aside>;
  if (!assumptions.length) return <>{notice}</>;
  const actionable = assumptions.filter(a => a.reviewLabel && a.parameter);
  if (!actionable.length) return <>{notice}<details className="answer-limitations"><summary>Assumptions ({assumptions.length})</summary>{assumptions.map(a => <p key={a.id}>{a.text}</p>)}</details></>;
  const primary = actionable[0];
  return <>{notice}<aside className="review-reminder"><div><span className="review-dot" aria-hidden="true">!</span><strong>One thing to confirm</strong></div><p>{primary.text} <button onClick={() => onReview(primary.parameter!.id)}>Edit</button></p>{assumptions.length > 1 && <details><summary>More assumptions ({assumptions.length - 1})</summary>{assumptions.filter(a => a.id !== primary.id).map(a => <p key={a.id}>{a.text}{a.parameter && <button onClick={() => onReview(a.parameter!.id)}>{a.reviewLabel ?? 'Review'}</button>}</p>)}</details>}</aside></>;
}

export function ScenarioControls({ fields, app, onChange }: { fields: EditableField[]; app: ApplicationState; onChange: ChangeValue }) {
  return <section className="scenario-controls" aria-label="Explore What If"><h3>Explore What If</h3><div className="scenario-control-grid">{fields.map(field => <div key={field.id} id={`parameter-${field.id}`}><FieldControl field={field} app={app} onChange={onChange} scenario /></div>)}</div></section>;
}
function InformationGroups(props: { response: CalculationResponse; app: ApplicationState; onChange: ChangeValue; onDraft: (id: string, dirty: boolean) => void; onRevert: (index: number) => void; onConfirm?: (id: string, signature: string) => void }) {
  const primary = props.response.information.filter(field => field.presentation !== 'detail');
  const details = props.response.information.filter(field => field.presentation === 'detail');
  const groupOf = (field: CalculationResponse['information'][number]) => field.uncertainty && !(field.binding.kind === 'fact' && Object.hasOwn(props.app.edits, field.binding.index)) ? 'ambiguous' : field.source;
  const order = ['stated', 'ambiguous', 'inferred', 'missing'];
  const sources = [...new Set(primary.map(groupOf))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const card = (field: CalculationResponse['information'][number]) => <InformationCard key={field.id} field={field} app={props.app} onChange={props.onChange} onDraft={props.onDraft} onRevert={props.onRevert} onConfirm={props.onConfirm} />;
  return <><div className="information-grid">{sources.map(source => <div className="information-source" key={source}><p className="source-caption">{source === 'stated' ? 'You told us' : source === 'inferred' ? 'We inferred' : source === 'missing' ? 'Still to clarify' : source === 'ambiguous' ? 'Ambiguous \u00b7 assumed for now' : source}</p>{primary.filter(field => groupOf(field) === source).map(card)}</div>)}</div>{details.length > 0 && <details className="metadata-details"><summary>Other details ({details.length})</summary>{details.map(card)}</details>}</>;
}
