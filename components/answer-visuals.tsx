'use client';
// Charts and tables for the chat. They only draw numbers the backend computed; no arithmetic beyond
// widths and percentages for layout. Every chart has a legend with exact amounts, so colour is never
// the only way to read it, and the figures behind each one are also in a table.
import { useState, type ReactNode } from 'react';
import type { BudgetSplit, PlanOption, Visuals } from '../lib/calculation-contract';
import { money } from '../lib/workspace-model';
import s from '../app/chat/chat.module.css';

export interface CostItem { item: string; amount: number; note?: string }

// Series colours by role (validated: blue/aqua/orange pass the CVD and normal-vision checks on light surfaces).
const C = { income: '#2a78d6', savings: '#1baf7a', left: '#eb6834', short: 'transparent' } as const;
const GREYS = ['#B9B4AA', '#CFCAC0', '#A39E94', '#DDD8CE', '#928D84'];
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];

type Segment = { key: string; label: string; value: number; color: string; hatch?: boolean; note?: string };

// One horizontal 100% bar with a 2px surface gap between segments and a hover tooltip.
function StackedBar({ segments, total, ariaLabel }: { segments: Segment[]; total: number; ariaLabel: string }) {
  const [tip, setTip] = useState<{ x: number; seg: Segment } | null>(null);
  const shown = segments.filter(x => x.value > 0.005);
  return <div className={s.barWrap} onMouseLeave={() => setTip(null)}>
    <div className={s.bar} role="img" aria-label={ariaLabel}>
      {shown.map(seg => <span key={seg.key} className={`${s.barSeg} ${seg.hatch ? s.hatch : ''}`}
        style={{ flexGrow: seg.value, background: seg.hatch ? undefined : seg.color }}
        onMouseMove={e => { const box = e.currentTarget.parentElement!.getBoundingClientRect(); setTip({ x: e.clientX - box.left, seg }); }} />)}
    </div>
    {tip && <div className={s.tip} style={{ left: tip.x }}><strong>{tip.seg.label}</strong> {money(tip.seg.value)}{total > 0 ? ` · ${Math.round(tip.seg.value / total * 100)}%` : ''}{tip.seg.note ? <><br /><span>{tip.seg.note}</span></> : null}</div>}
  </div>;
}

function Legend({ segments }: { segments: Segment[] }) {
  return <ul className={s.legendList}>{segments.filter(x => x.value > 0.005).map(seg => <li key={seg.key}>
    <span className={`${s.swatch} ${seg.hatch ? s.hatch : ''}`} style={{ background: seg.hatch ? undefined : seg.color }} aria-hidden="true" />
    <span>{seg.label}</span><strong>{money(seg.value)}</strong></li>)}</ul>;
}

function Figure({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <figure className={s.figure}><figcaption><strong>{title}</strong>{sub && <span>{sub}</span>}</figcaption>{children}</figure>;
}

// "How I estimated the cost": the LLM's line items for an estimated goal.
export function CostBreakdown({ items, total }: { items: CostItem[]; total: number | null }) {
  const sum = items.reduce((a, b) => a + b.amount, 0);
  const segs: Segment[] = items.map((x, i) => ({ key: `${i}`, label: x.item, value: x.amount, color: SERIES[i % SERIES.length], note: x.note }));
  return <Figure title="How I estimated the cost" sub={`about ${money(total ?? sum)} in total`}>
    <StackedBar segments={segs} total={sum} ariaLabel={`Estimated cost: ${items.map(x => `${x.item} ${money(x.amount)}`).join(', ')}`} />
    <table className={s.table}><tbody>{items.map((x, i) => <tr key={i}>
      <td><span className={s.swatch} style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />{x.item}{x.note && <small>{x.note}</small>}</td>
      <td>{money(x.amount)}</td></tr>)}</tbody>
      <tfoot><tr><td>Total</td><td>{money(sum)}</td></tr></tfoot></table>
  </Figure>;
}

function budgetSegments(b: BudgetSplit, goalLabel: string): Segment[] {
  return [
    ...b.expenses.map((e, i) => ({ key: `e${i}`, label: e.label, value: e.amount, color: GREYS[i % GREYS.length] })),
    { key: 'goal', label: goalLabel, value: b.goal, color: C.income },
    ...(b.left_over >= 0 ? [{ key: 'left', label: 'Left over', value: b.left_over, color: C.left }] : []),
  ];
}

function BudgetFigure({ b, title, goalLabel }: { b: BudgetSplit; title: string; goalLabel: string }) {
  const segs = budgetSegments(b, goalLabel);
  const over = b.left_over < 0;
  return <Figure title={title} sub={`out of ${money(b.income)} coming in`}>
    <StackedBar segments={segs} total={Math.max(b.income, segs.reduce((a, x) => a + x.value, 0))} ariaLabel={`${title}: ${segs.map(x => `${x.label} ${money(x.value)}`).join(', ')}`} />
    <Legend segments={segs} />
    {over && <p className={s.warnLine}>⚠ That’s {money(-b.left_over)} more than comes in each month.</p>}
  </Figure>;
}

// Calendar month a few months from today, for the timeline axis.
const monthName = (offset: number) => new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1).toLocaleString('en-US', { month: 'short' });

function Timeline({ timeline, goal, fromSavings }: { timeline: { month: number; set_aside: number }[]; goal: number; fromSavings: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!timeline.length) return null;
  const top = Math.max(goal, ...timeline.map(t => t.set_aside + (t.month === timeline.length ? fromSavings : 0)));
  const h = (v: number) => `${Math.max(2, v / top * 100)}%`;
  const last = timeline.length;
  return <Figure title="Month by month" sub="total set aside toward the goal">
    <div className={s.plot} role="img" aria-label={`Set aside each month: ${timeline.map(t => `${monthName(t.month)} ${money(t.set_aside)}`).join(', ')}. Goal ${money(goal)}.`} onMouseLeave={() => setHover(null)}>
      <div className={s.goalLine} style={{ bottom: h(goal) }}><span>Goal {money(goal)}</span></div>
      {timeline.map(t => <div key={t.month} className={s.col} onMouseEnter={() => setHover(t.month)}>
        {t.month === last && fromSavings > 0.005 && <span className={s.colBar} style={{ height: h(fromSavings), background: C.savings }} />}
        <span className={s.colBar} style={{ height: h(t.set_aside), background: C.income, opacity: hover === null || hover === t.month ? 1 : .55 }} />
        {hover === t.month && <div className={s.tip} style={{ left: '50%', bottom: 'auto', top: 0 }}><strong>{monthName(t.month)}</strong> {money(t.set_aside)} saved{t.month === last && fromSavings > 0.005 ? ` + ${money(fromSavings)} from savings` : ''}<br /><span>{Math.min(100, Math.round((t.set_aside + (t.month === last ? fromSavings : 0)) / goal * 100))}% of the goal</span></div>}
      </div>)}
    </div>
    <div className={s.colLabels} aria-hidden="true">{timeline.map(t => <span key={t.month}>{monthName(t.month)}</span>)}</div>
    <ul className={s.legendList}><li><span className={s.swatch} style={{ background: C.income }} aria-hidden="true" /><span>Set aside from income</span><strong>{money(timeline[last - 1].set_aside)}</strong></li>
      {fromSavings > 0.005 && <li><span className={s.swatch} style={{ background: C.savings }} aria-hidden="true" /><span>From savings at the end</span><strong>{money(fromSavings)}</strong></li>}</ul>
    <button type="button" className={s.link} aria-expanded={table} onClick={() => setTable(o => !o)}>{table ? 'Hide table' : 'Show as a table'}</button>
    {table && <table className={s.table}><thead><tr><th scope="col">Month</th><th scope="col">Total set aside</th><th scope="col">Of goal</th></tr></thead>
      <tbody>{timeline.map(t => <tr key={t.month}><td>{monthName(t.month)}</td><td>{money(t.set_aside)}</td><td>{Math.min(100, Math.round(t.set_aside / goal * 100))}%</td></tr>)}</tbody></table>}
  </Figure>;
}

function OptionsTable({ options, kind }: { options: PlanOption[]; kind: Visuals['kind'] }) {
  if (options.length < 2) return null;
  return <Figure title="Your options" sub="same numbers, different ways to get there">
    <div className={s.tableScroll}><table className={s.table}>
      <thead><tr><th scope="col">Plan</th>{kind === 'one_time'
        ? <><th scope="col">Each month</th><th scope="col">From savings</th><th scope="col">Savings after</th></>
        : <th scope="col">Left each month</th>}<th scope="col">Works?</th></tr></thead>
      <tbody>{options.map((o, i) => <tr key={i} className={o.current ? s.currentRow : ''}>
        <td>{o.label}{o.current && <small>what I calculated</small>}</td>
        {kind === 'one_time'
          ? <><td>{o.months === 0 ? '—' : `${money(o.monthly ?? 0)} × ${o.months}`}</td><td>{money(o.from_savings ?? 0)}</td><td>{o.feasible ? money(o.savings_left ?? 0) : '—'}</td></>
          : <td>{money(o.left_each_month ?? 0)}</td>}
        <td>{o.feasible ? '✓ Yes' : `✕ ${o.short ? `${money(o.short)} short` : 'No'}`}</td></tr>)}</tbody>
    </table></div>
  </Figure>;
}

export function AnswerVisuals({ v }: { v: Visuals }) {
  if (v.kind === 'one_time') {
    const f = v.funding;
    const segs: Segment[] = [
      { key: 'income', label: 'Saved from income', value: f.from_income, color: C.income },
      { key: 'savings', label: 'From your savings', value: f.from_savings, color: C.savings },
      { key: 'short', label: 'Still short', value: f.short, color: C.short, hatch: true },
    ];
    // Only worth a chart when the money comes from more than one place (or falls short).
    const mixed = segs.filter(x => x.value > 0.005).length > 1;
    return <div className={s.visuals}>
      {mixed && <Figure title="Where the money comes from" sub={`for the ${money(f.goal)} goal`}>
        <StackedBar segments={segs} total={f.goal} ariaLabel={`Goal ${money(f.goal)}: ${segs.filter(x => x.value > 0).map(x => `${x.label} ${money(x.value)}`).join(', ')}`} />
        <Legend segments={segs} />
      </Figure>}
      <BudgetFigure b={v.budget} title="Your month with this plan" goalLabel="Toward the goal" />
      <Timeline timeline={v.timeline} goal={f.goal} fromSavings={f.from_savings} />
      <OptionsTable options={v.options} kind={v.kind} />
    </div>;
  }
  return <div className={s.visuals}>
    <BudgetFigure b={v.budget_now} title="Your month now" goalLabel="New cost" />
    <BudgetFigure b={v.budget_after} title="Your month with the new cost" goalLabel="Extra cost" />
    <OptionsTable options={v.options} kind={v.kind} />
  </div>;
}
