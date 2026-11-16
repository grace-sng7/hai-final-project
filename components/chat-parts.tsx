'use client';
// Presentational pieces for the chat view. No service calls and no state beyond local UI state.
import { useState } from 'react';
import type { CalculationResponse, Verification, VerificationCheck } from '../lib/calculation-contract';
import { AnswerVisuals, CostBreakdown, type CostItem } from './answer-visuals';
import type { Assumption, ExtractionResponse } from '../lib/extraction';
import { fromProfile } from '../lib/profile';
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

const SOURCE_TEXT = { stated: 'You told me', fromProfile: 'From your profile', inferred: 'I worked out', missing: 'Still unknown' } as const;
// Profile values are "stated" for the calculator, but shown separately: the user did not say them in this chat.
const origin = (a: Assumption) => fromProfile(a) ? 'fromProfile' : a.source;

// Read-only summary of what the model understood. Clicking a chip pre-fills the composer, so
// corrections happen in conversation rather than in form fields.
export function Understood({ extraction, onPick }: { extraction: ExtractionResponse; onPick: (text: string) => void }) {
  const rows = extraction.assumptions.filter(a => a.variable !== 'goal_description' && !(a.variable === 'monthly_surplus' && a.source === 'missing'));
  const groups = (['stated', 'fromProfile', 'inferred', 'missing'] as const).map(source => ({ source, items: rows.filter(a => origin(a) === source) })).filter(g => g.items.length);
  return <div>
    <p className={s.bubbleText}>{message(extraction) ?? (extraction.goal_summary || 'Here is what I understood.')}</p>
    {groups.map(g => <div key={g.source} className={s.chipGroup}>
      <span className={s.chipCaption}>{SOURCE_TEXT[g.source]}</span>
      <div className={s.chips}>{g.items.map(a => <button key={a.variable} type="button" className={`${s.chip} ${s[g.source]}`} title={a.source_detail}
        onClick={() => onPick(`Actually, ${label(a.variable).toLowerCase()} is `)}>
        <span>{label(a.variable)}</span>{a.source !== 'missing' && <strong>{show(a)}</strong>}</button>)}</div>
    </div>)}
    <EstimateBreakdown extraction={extraction} />
    <p className={s.hint}>Tap anything to correct it, or just tell me in your own words.</p>
  </div>;
}

// What the model wrote to the user this turn, if anything.
export const message = (e: ExtractionResponse): string | undefined =>
  typeof e.assistant_message === 'string' && e.assistant_message.trim() ? e.assistant_message.trim() : undefined;

// The model's line items for an estimated goal cost. Shown only while the cost is still an estimate.
export function breakdown(e: ExtractionResponse): CostItem[] {
  const goal = e.assumptions.find(a => a.variable === 'goal_amount');
  if (!goal || goal.source !== 'inferred' || !Array.isArray(e.goal_breakdown)) return [];
  return (e.goal_breakdown as unknown[]).flatMap(x => {
    const o = x as Record<string, unknown>;
    return o && typeof o.item === 'string' && typeof o.amount === 'number' && Number.isFinite(o.amount) && o.amount > 0
      ? [{ item: o.item, amount: o.amount, ...(typeof o.note === 'string' && o.note ? { note: o.note } : {}) }] : [];
  });
}

export function EstimateBreakdown({ extraction }: { extraction: ExtractionResponse }) {
  const items = breakdown(extraction);
  if (items.length < 2) return null;
  const goal = extraction.assumptions.find(a => a.variable === 'goal_amount');
  return <div className={s.estimate}><CostBreakdown items={items} total={typeof goal?.value === 'number' ? goal.value : null} /></div>;
}

export function Typing() {
  return <span className={s.typing} aria-label="Thinking"><i /><i /><i /></span>;
}

export function QuickReplies({ replies, onPick, disabled }: { replies: string[]; onPick: (text: string) => void; disabled: boolean }) {
  return <div className={s.replies}>{replies.map(r => <button key={r} type="button" disabled={disabled} onClick={() => onPick(r)}>{r}</button>)}</div>;
}

// The final answer: the calculator's verdict, the LLM's explanation of it, charts and tables of the
// same numbers, and follow-up what-ifs the user can tap.
export function AnswerCard({ response, interactive, onAsk, disabled }: { response: CalculationResponse; interactive: boolean; onAsk: (text: string) => void; disabled: boolean }) {
  const ok = response.status === 'ready' || response.status === 'conditional';
  if (!ok) return <p className={s.bubbleText}>{response.message}</p>;
  const suggestions = response.narrative?.suggestions ?? [];
  return <div className={s.answer}>
    <span className={s.badge}>{response.status === 'conditional' ? 'Estimate, based on some assumptions' : 'Answer'}</span>
    <p className={s.headline}>{response.answer.headline}</p>
    {response.narrative ? <p className={s.explain}>{response.narrative.text}</p> : response.answer.detail && <p className={s.muted}>{response.answer.detail}</p>}
    <VerifiedNote v={response.verification} />
    {response.visuals && <AnswerVisuals v={response.visuals} />}
    <MathPanel response={response} />
    {interactive && suggestions.length > 0 && <div><span className={s.chipCaption}>Try a what-if</span><QuickReplies replies={suggestions} disabled={disabled} onPick={onAsk} /></div>}
  </div>;
}

const fmt = (v: VerificationCheck['llm']) => typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'number' ? money(v) : '—';

// One line on the card: did the AI's own working agree with the calculator?
function VerifiedNote({ v }: { v?: Verification }) {
  if (!v || v.status === 'unavailable') return null;
  if (v.status === 'match') return <p className={`${s.verify} ${s.verifyOk}`}>✓ Double-checked: the AI’s working and the calculator agree.</p>;
  const off = v.checked.filter(c => !c.match);
  return <p className={`${s.verify} ${s.verifyWarn}`}>⚠ The AI’s working differed on {off.map(c => c.label.toLowerCase()).join(', ')}. You’re seeing the calculator’s exact numbers.</p>;
}

function VerificationDetail({ v }: { v: Verification }) {
  return <div className={s.verifyDetail}><strong>AI working vs calculator</strong>
    <table><thead><tr><th scope="col">Figure</th><th scope="col">AI</th><th scope="col">Calculator (used)</th></tr></thead>
      <tbody>{v.checked.map(c => <tr key={c.key} className={c.match ? '' : s.verifyRowOff}><td>{c.label}</td><td>{fmt(c.llm)}</td><td>{fmt(c.calculator)}{c.match ? '' : ' ⚠'}</td></tr>)}</tbody></table>
    {v.reasoning && <p className={s.muted}>AI’s working: {v.reasoning}</p>}</div>;
}

function MathPanel({ response }: { response: CalculationResponse }) {
  const [open, setOpen] = useState(false);
  const checked = response.verification && response.verification.status !== 'unavailable' ? response.verification : null;
  const has = response.explanations.length || response.assumptions.length || response.limitations.length || checked;
  if (!has) return null;
  return <div className={s.math}><button type="button" className={s.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide the math' : 'Show the math'}</button>
    {open && <div>{checked && <VerificationDetail v={checked} />}{response.explanations.map((e, i) => <p key={i}><strong>{e.label}</strong><br />{e.text}</p>)}
      {response.assumptions.map(a => <p key={a.id} className={s.muted}>Assumption: {a.text}</p>)}
      {response.limitations.map((l, i) => <p key={i} className={s.muted}>Limit: {l}</p>)}</div>}</div>;
}

// Always-visible record of every value and where it came from: the "framework in the background".
export function WorkingSheet({ extraction, math }: { extraction: ExtractionResponse | null; math: CalculationResponse | null }) {
  return <aside className={s.sheet} aria-label="Working sheet">
    <h2>Working sheet</h2>
    {!extraction ? <p className={s.muted}>Everything I understand will be listed here, with where it came from.</p> : <ul>
      {extraction.assumptions.map(a => <li key={a.variable} title={a.source_detail}>
        <span className={`${s.dot} ${s[origin(a)]}`} aria-label={fromProfile(a) ? 'from your profile' : a.source} /><span className={s.sheetLabel}>{label(a.variable)}</span><strong>{show(a)}</strong></li>)}</ul>}
    <p className={s.legend}><span className={`${s.dot} ${s.stated}`} /> stated <span className={`${s.dot} ${s.fromProfile}`} /> profile <span className={`${s.dot} ${s.inferred}`} /> inferred <span className={`${s.dot} ${s.missing}`} /> missing</p>
    {math && (math.status === 'ready' || math.status === 'conditional') && math.explanations.length > 0 && <><h2>The math</h2>{math.explanations.map((e, i) => <p key={i} className={s.sheetMath}><strong>{e.label}</strong><br />{e.text}</p>)}</>}
  </aside>;
}

// The four-step progression guides the conversation but is not shown as steps: just a quiet status line.
const STATUS = ['Getting the picture', 'A couple of questions', 'Running the numbers', 'Here’s where you stand'];
export function Status({ stage, active }: { stage: number; active: boolean }) {
  return active ? <p className={s.status} role="status">{STATUS[stage]}</p> : null;
}
