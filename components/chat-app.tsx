'use client';
// Conversational front end. The framework is still: extract -> clarify -> calculate -> answer,
// but each stage is a chat turn instead of a card. Services are the same ones the dashboard uses.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalculationRequest, CalculationResponse, CalculationService } from '../lib/calculation-contract';
import type { ExtractionResponse, ExtractionService } from '../lib/extraction';
import { liveCalculationService, liveExtractionService } from '../lib/http-services';
import { calculationService as mockCalculation, extractionService as mockExtraction } from '../lib/services';
import { label } from '../lib/workspace-model';
import { AnswerCard, QuickReplies, Status, Typing, Understood, WorkingSheet, show } from './chat-parts';
import s from '../app/chat/chat.module.css';

const live = process.env.NEXT_PUBLIC_BACKEND_MODE === 'live';
const extraction: ExtractionService = live ? liveExtractionService : mockExtraction;
const calculator: CalculationService = live ? liveCalculationService : mockCalculation;

const SKIP = 'Not sure, skip this';
const RETRY = 'Try again';
const SUGGESTIONS = [
  'I make $2,400 a month after tax, rent is $1,000 and I spend about $600 on everything else. I have $900 saved. Can I afford a $2,500 laptop by next March?',
  'My friends want to do a spring break trip to Miami but I don’t know if I can afford it',
  'I want to move to a $1,400/month apartment in February, I currently pay $1,000 rent. Can I swing it?',
];

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; kind: 'text'; text: string; note?: string; replies?: string[] }
  | { id: number; role: 'bot'; kind: 'understood'; extraction: ExtractionResponse }
  | { id: number; role: 'bot'; kind: 'answer'; response: CalculationResponse }
  | { id: number; role: 'bot'; kind: 'typing' };
type NewMsg = Msg extends infer M ? M extends { id: number } ? Omit<M, 'id'> : never : never;

const context = () => {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return { reference_date: date, timezone: 'America/New_York' };
};
const request = (original: string, ex: ExtractionResponse, parameters: Record<string, string>): CalculationRequest =>
  ({ originalQuestion: original, extraction: ex, edits: {}, answers: {}, parameters, answerFactBindings: {} });

// Which assumptions did a correction actually change? Used for the "Got it" acknowledgement.
function changes(before: ExtractionResponse, after: ExtractionResponse): string[] {
  const old = new Map(before.assumptions.map(a => [a.variable, a]));
  return after.assumptions.filter(a => a.source !== 'missing' && a.variable !== 'goal_description' && (() => { const p = old.get(a.variable); return !p || p.value !== a.value || p.source === 'missing'; })())
    .slice(0, 4).map(a => `${label(a.variable)}: ${show(a)}`);
}

export default function ChatApp() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [ex, setEx] = useState<ExtractionResponse | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const idRef = useRef(0);
  const exRef = useRef<ExtractionResponse | null>(null);
  const originalRef = useRef('');
  const paramsRef = useRef<Record<string, string>>({});
  const asked = useRef<Record<string, number>>({});
  const skipped = useRef<Set<string>>(new Set());
  const current = useRef<{ target: string; question: string } | null>(null);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const calcSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (m: NewMsg) => setMsgs(list => [...list.filter(x => !('kind' in x && x.kind === 'typing')), { ...m, id: ++idRef.current } as Msg]);
  const bot = (textValue: string, extra: { note?: string; replies?: string[] } = {}) => push({ role: 'bot', kind: 'text', text: textValue, ...extra });
  const typing = () => push({ role: 'bot', kind: 'typing' });
  const setExtraction = (value: ExtractionResponse) => { exRef.current = value; setEx(value); };

  // Next clarification worth asking: skip anything already stated, skipped by the user, or asked twice.
  const nextQuestion = (value: ExtractionResponse) => {
    for (const q of value.clarification_questions) {
      const a = value.assumptions.find(x => x.variable === q.target_variable);
      if (skipped.current.has(q.target_variable) || a?.source === 'stated' || (asked.current[q.target_variable] ?? 0) >= 2) continue;
      return { target: q.target_variable, question: q.question, why: q.why_it_matters };
    }
    return null;
  };
  const ask = (target: string, question: string, why?: string) => {
    asked.current[target] = (asked.current[target] ?? 0) + 1;
    current.current = { target, question };
    setStage(1);
    bot(question, { note: why, replies: [SKIP] });
  };

  async function calculate(value: ExtractionResponse) {
    setStage(2); typing();
    const run = async () => {
      const response = await calculator.calculate(request(originalRef.current, value, paramsRef.current));
      if (response.status === 'ready' || response.status === 'conditional') {
        current.current = null; setStage(3); push({ role: 'bot', kind: 'answer', response }); return;
      }
      if (response.status === 'needs_input') {
        const askable = response.questions.filter(q => q.required).map(q => ({ q, target: q.binding.kind === 'fact' ? value.assumptions[q.binding.index]?.variable ?? q.id : q.binding.key }))
          .filter(x => !skipped.current.has(x.target) && (asked.current[x.target] ?? 0) < 2);
        if (askable.length) { ask(askable[0].target, askable[0].q.label, askable[0].q.help); return; }
        current.current = null; setStage(1);
        bot(`I can’t run the numbers yet. ${response.message} Tell me any of the missing pieces whenever you’re ready, and I’ll pick it back up.`);
        return;
      }
      current.current = null;
      bot(response.message ?? 'I can’t calculate this kind of question yet, but everything you told me is saved on the working sheet.');
    };
    retry.current = async () => { setBusy(true); try { await run(); } catch { failed(); } finally { setBusy(false); } };
    try { await run(); } catch { failed(); }
  }
  const failed = () => bot('Something went wrong on my side. Your details are saved.', { replies: [RETRY] });

  async function proceed(value: ExtractionResponse) {
    const q = nextQuestion(value);
    if (q) ask(q.target, q.question, q.why); else await calculate(value);
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    setText(''); push({ role: 'user', text: message });
    if (message === RETRY && retry.current) { setBusy(true); typing(); try { await retry.current(); } finally { setBusy(false); } return; }
    setBusy(true); typing();
    try {
      const before = exRef.current;
      if (!before) {
        originalRef.current = message;
        const attempt = async () => {
          const result = await extraction.extract({ ...context(), user_message: message });
          setExtraction(result); setStage(0); push({ role: 'bot', kind: 'understood', extraction: result });
          await proceed(result);
        };
        retry.current = async () => { setBusy(true); typing(); try { await attempt(); } catch { failed(); } finally { setBusy(false); } };
        await attempt(); return;
      }
      const q = current.current;
      if (message === SKIP && q) {
        skipped.current.add(q.target); current.current = null;
        bot('No problem, I’ll work without that.'); await proceed(before); return;
      }
      const attempt = async () => {
        const next = await extraction.correct({ ...context(), user_message: originalRef.current, previous_extraction: before, user_correction: q ? `Answering "${q.question}": ${message}` : message });
        const diff = changes(before, next);
        setExtraction(next); current.current = null;
        if (!diff.length && !q) { bot('Thanks, I’ve noted that. Nothing I use in the numbers changed.'); return; }
        bot(diff.length ? `Got it. ${diff.join(' · ')}` : 'Thanks, I’ve noted that.');
        await proceed(next);
      };
      retry.current = async () => { setBusy(true); typing(); try { await attempt(); } catch { failed(); } finally { setBusy(false); } };
      await attempt();
    } catch { failed(); } finally { setBusy(false); }
  }

  // What-if: change a parameter, recalculate quietly, update the latest answer in place.
  const onParam = useCallback((key: string, value: string) => {
    paramsRef.current = { ...paramsRef.current, [key]: value }; setParams(paramsRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const value2 = exRef.current; if (!value2) return;
      const seq = ++calcSeq.current;
      try {
        const response = await calculator.calculate(request(originalRef.current, value2, paramsRef.current));
        if (seq !== calcSeq.current || (response.status !== 'ready' && response.status !== 'conditional')) return;
        setMsgs(list => { const i = list.map(m => 'kind' in m && m.kind === 'answer').lastIndexOf(true); return i < 0 ? list : list.map((m, j) => j === i ? { ...m, response } as Msg : m); });
      } catch { /* keep the previous answer */ }
    }, 250);
  }, []);

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    calcSeq.current++; idRef.current = 0; exRef.current = null; originalRef.current = ''; paramsRef.current = {}; asked.current = {}; skipped.current = new Set(); current.current = null; retry.current = null;
    setMsgs([]); setEx(null); setParams({}); setStage(0); setText(''); setBusy(false);
  };
  const pick = (value: string) => { setText(value); input.current?.focus(); };
  const lastAnswer = [...msgs].reverse().find(m => 'kind' in m && m.kind === 'answer') as Extract<Msg, { kind: 'answer' }> | undefined;
  const lastId = msgs.at(-1)?.id;
  const empty = msgs.length === 0;

  return <div className={s.page}>
    <header className={s.header}>
      <button type="button" className={s.brand} onClick={reset} aria-label="Start over"><span aria-hidden="true">☀</span> Pennyscope</button>
      <Status stage={stage} active={!empty} />
      <div className={s.headerRight}><button type="button" className={s.sheetToggle} onClick={() => setSheetOpen(o => !o)} aria-expanded={sheetOpen}>Working sheet</button><button type="button" onClick={reset}>New chat</button></div>
    </header>
    <div className={s.body}>
      <main className={s.thread} aria-live="polite">
        {empty && <div className={s.welcome}><h1>What are you thinking about buying or doing?</h1>
          <p>Tell me in your own words. I’ll show you what I understood, ask only what I need, then walk you through the numbers.</p>
          <div className={s.suggestions}>{SUGGESTIONS.map(t => <button key={t} type="button" onClick={() => pick(t)}>{t}</button>)}</div></div>}
        {msgs.map(m => m.role === 'user'
          ? <div key={m.id} className={`${s.row} ${s.user}`}><div className={s.bubbleUser}>{m.text}</div></div>
          : <div key={m.id} className={s.row}><span className={s.avatar} aria-hidden="true">☀</span><div className={s.bubble}>
            {m.kind === 'typing' && <Typing />}
            {m.kind === 'text' && <><p className={s.bubbleText}>{m.text}</p>{m.note && <p className={s.note}>{m.note}</p>}
              {m.replies && m.id === lastId && <QuickReplies replies={m.replies} disabled={busy} onPick={send} />}</>}
            {m.kind === 'understood' && <Understood extraction={m.extraction} onPick={pick} />}
            {m.kind === 'answer' && <AnswerCard response={m.response} interactive={m === lastAnswer} params={params} onParam={onParam} />}
          </div></div>)}
        <div ref={bottom} />
      </main>
      <div className={`${s.sheetWrap} ${sheetOpen ? s.sheetOpen : ''}`}><WorkingSheet extraction={ex} math={lastAnswer?.response ?? null} /></div>
    </div>
    <form className={s.composer} onSubmit={e => { e.preventDefault(); void send(text); }}>
      <textarea ref={input} rows={1} value={text} disabled={busy} placeholder={current.current ? 'Type your answer…' : ex ? 'Correct something or ask “what if…”' : 'Describe your goal and what you know…'}
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} aria-label="Message" />
      <button type="submit" disabled={busy || !text.trim()}>Send</button>
    </form>
  </div>;
}
