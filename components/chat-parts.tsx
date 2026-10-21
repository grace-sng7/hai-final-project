'use client';
// Presentational pieces for the chat view. No service calls and no state beyond local UI state.
import { useState } from 'react';
import { canonicalParameters, type CalculationResponse, type EditableField } from '../lib/calculation-contract';
import type { Assumption, ExtractionResponse } from '../lib/extraction';
import { label, money } from '../lib/workspace-model';
import s from '../app/chat/chat.module.css';

export function show(a: Pick<Assumption, 'value' | 'unit'>): string {
  if (a.value === null || a.value === '') return 'unknown';
  const unit = a.unit ?? '';
  if (typeof a.value === 'number') {
    if (unit.startsWith('$')) return `${money(a.value)}${unit === '$/month' ? '/mo' : unit === '$/occurrence' ? ' each time' : ''}`;
    return `${a.value.toLocaleString('en-US')}${unit && unit !== 'text' ? ` ${unit}` : ''}`;
  }
  return a.value;
}

const SOURCE_TEXT = { stated: 'You told me', inferred: 'I worked out', missing: 'Still unknown' } as const;

// Read-only summary of what the model understood. Clicking a chip pre-fills the composer, so
// corrections happen in conversation rather than in form fields.
export function Understood({ extraction, onPick }: { extraction: ExtractionResponse; onPick: (text: string) => void }) {
  const rows = extraction.assumptions.filter(a => a.variable !== 'goal_description' && !(a.variable === 'monthly_surplus' && a.source === 'missing'));
  const groups = (['stated', 'inferred', 'missing'] as const).map(source => ({ source, items: rows.filter(a => a.source === source) })).filter(g => g.items.length);
  return <div>
    <p className={s.bubbleText}>{extraction.goal_summary || 'Here is what I understood.'}</p>
    {groups.map(g => <div key={g.source} className={s.chipGroup}>
      <span className={s.chipCaption}>{SOURCE_TEXT[g.source]}</span>
      <div className={s.chips}>{g.items.map(a => <button key={a.variable} type="button" className={`${s.chip} ${s[g.source]}`} title={a.source_detail}
        onClick={() => onPick(`Actually, ${label(a.variable).toLowerCase()} is `)}>
        <span>{label(a.variable)}</span>{a.source !== 'missing' && <strong>{show(a)}</strong>}</button>)}</div>
    </div>)}
    <p className={s.hint}>Tap anything to correct it, or just tell me in your own words.</p>
  </div>;
}

export function Typing() {
  return <span className={s.typing} aria-label="Thinking"><i /><i /><i /></span>;
}

export function QuickReplies({ replies, onPick, disabled }: { replies: string[]; onPick: (text: string) => void; disabled: boolean }) {
  return <div className={s.replies}>{replies.map(r => <button key={r} type="button" disabled={disabled} onClick={() => onPick(r)}>{r}</button>)}</div>;
}

// The final answer: a sentence with inline numbers, what-if sliders, and the math behind it.
export function AnswerCard({ response, interactive, params, onParam }: { response: CalculationResponse; interactive: boolean; params: Record<string, string>; onParam: (key: string, value: string) => void }) {
  const ok = response.status === 'ready' || response.status === 'conditional';
  const fields = canonicalParameters(response);
  const value = (f: EditableField) => params[f.id] ?? String(f.value ?? '');
  if (!ok) return <p className={s.bubbleText}>{response.message}</p>;
  const sliders = fields.filter(f => f.control.type === 'range');
  return <div className={s.answer}>
    <span className={s.badge}>{response.status === 'conditional' ? 'Conditional estimate' : 'Answer'}</span>
    <p className={s.headline}>{response.answer.segments?.length ? response.answer.segments.map((seg, i) => {
      if (seg.type === 'text') return <span key={i}>{seg.text}</span>;
      const f = fields.find(x => x.id === seg.parameterId);
      return f ? <span key={i} className={s.inline}>{seg.prefix}<input type="number" aria-label={f.label} disabled={!interactive} value={value(f)} min={f.control.min} max={f.control.max} step={f.control.step ?? 'any'} onChange={e => onParam(f.id, e.target.value)} /></span> : null;
    }) : response.answer.headline}</p>
    {response.answer.detail && <p className={s.muted}>{response.answer.detail}</p>}
    {sliders.length > 0 && <div className={s.whatIf}><span className={s.chipCaption}>What if…</span>{sliders.map(f => <label key={f.id}><span>{f.label}</span><strong>{f.unit === '$' ? money(Number(value(f))) : value(f)}</strong>
      <input type="range" disabled={!interactive} min={f.control.min} max={f.control.max} step={f.control.step ?? 1} value={value(f)} onChange={e => onParam(f.id, e.target.value)} /></label>)}</div>}
    <MathPanel response={response} />
  </div>;
}

function MathPanel({ response }: { response: CalculationResponse }) {
  const [open, setOpen] = useState(false);
  const has = response.explanations.length || response.assumptions.length || response.limitations.length;
  if (!has) return null;
  return <div className={s.math}><button type="button" className={s.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide the math' : 'Show the math'}</button>
    {open && <div>{response.explanations.map((e, i) => <p key={i}><strong>{e.label}</strong><br />{e.text}</p>)}
      {response.assumptions.map(a => <p key={a.id} className={s.muted}>Assumption: {a.text}</p>)}
      {response.limitations.map((l, i) => <p key={i} className={s.muted}>Limit: {l}</p>)}</div>}</div>;
}

// Always-visible record of every value and where it came from: the "framework in the background".
export function WorkingSheet({ extraction, math }: { extraction: ExtractionResponse | null; math: CalculationResponse | null }) {
  return <aside className={s.sheet} aria-label="Working sheet">
    <h2>Working sheet</h2>
    {!extraction ? <p className={s.muted}>Everything I understand will be listed here, with where it came from.</p> : <ul>
      {extraction.assumptions.map(a => <li key={a.variable} title={a.source_detail}>
        <span className={`${s.dot} ${s[a.source]}`} aria-label={a.source} /><span className={s.sheetLabel}>{label(a.variable)}</span><strong>{show(a)}</strong></li>)}</ul>}
    <p className={s.legend}><span className={`${s.dot} ${s.stated}`} /> stated <span className={`${s.dot} ${s.inferred}`} /> inferred <span className={`${s.dot} ${s.missing}`} /> missing</p>
    {math && (math.status === 'ready' || math.status === 'conditional') && math.explanations.length > 0 && <><h2>The math</h2>{math.explanations.map((e, i) => <p key={i} className={s.sheetMath}><strong>{e.label}</strong><br />{e.text}</p>)}</>}
  </aside>;
}

// The four-step progression guides the conversation but is not shown as steps: just a quiet status line.
const STATUS = ['Getting the picture', 'A couple of questions', 'Running the numbers', 'Here’s where you stand'];
export function Status({ stage, active }: { stage: number; active: boolean }) {
  return active ? <p className={s.status} role="status">{STATUS[stage]}</p> : null;
}
