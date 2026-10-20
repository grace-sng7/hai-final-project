'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { startCalculation } from '@/lib/calculation-runner';
import { presentResponse } from '@/lib/presentation-model';
import DemoInputs from './demo-inputs';
import { categories, sampleFor, uncertaintiesFor, type DemoSample } from '@/lib/mock/data';
import { ResultView } from './result-view';
import { type ExtractionResponse, type ExtractionService, validateExtraction } from '@/lib/extraction';
import { extractionService, calculationService } from '@/lib/services';
import { emptyContent, type CalculationResponse, type CalculationService } from '@/lib/calculation-contract';
import { calculationRequest, correctionLines, currentResult, guideSectionOpen, initialApplicationState, workspaceReducer } from '@/lib/workspace-model';

const assistantMessages = {
  guide: "Let's start with what we know. You can check and change every assumption.",
  quick: "Let's review the details and explore the numbers together.",
  loading: "Let's look at what you shared.",
};

export default function Workspace({ service = extractionService, calculator = calculationService, demoMode = true }: { service?: ExtractionService; calculator?: CalculationService; demoMode?: boolean }) {
  const [app, dispatch] = useReducer(workspaceReducer, undefined, initialApplicationState);
  const [input, setInput] = useState('');
  const raw = app.extraction;
  const original = app.originalQuestion;
  const [correction, setCorrection] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [goalEditing, setGoalEditing] = useState(false);
  const [dirtyEditors, setDirtyEditors] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<{ correction: string; extraction: ExtractionResponse }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const revision = useRef(0);
  const pendingText = !!(correction.trim() || goalDraft.trim() || Object.values(dirtyEditors).some(Boolean));
  const requestKey = raw ? JSON.stringify({ revision: app.revision, retry, request: calculationRequest(app) }) : '';
  // Store proposals when a result arrives without triggering another calculation.
  useEffect(() => {
    if (!requestKey || pendingText) return;
    const snapshot = JSON.parse(requestKey) as { revision: number; request: Parameters<CalculationService['calculate']>[0] };
    return startCalculation(calculator, snapshot.request, response => dispatch({ type: 'result', revision: snapshot.revision, response }));
  }, [requestKey, pendingText, calculator]);
  const current = currentResult(app, pendingText);
  const response: CalculationResponse | null = !raw ? null : presentResponse(raw, current ?? {
    ...emptyContent(), information: app.result?.information ?? [], questions: app.result?.questions ?? [], assumptions: app.result?.assumptions ?? [], parameters: app.result?.parameters ?? [], status: 'stale', message: pendingText ? 'Finish your edits or apply pending corrections before using an answer.' : 'Updating your calculation…',
  }, Object.keys(app.edits).length > 0 || Object.keys(app.answers).length > 0 || pendingText, demoMode ? uncertaintiesFor(original) : undefined);
  const example = demoMode ? sampleFor(original) : undefined;
  const changed = () => { revision.current++; };
  const context = () => ({ user_message: original, reference_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), timezone: 'America/New_York' });
  const reset = () => { version.current++; revision.current++; dispatch({ type: 'reset' }); setInput(''); setCorrection(''); setGoalDraft(''); setGoalEditing(false); setDirtyEditors({}); setHistory([]); setBusy(false); setError(''); setStatus(''); };
  async function extract(message = input) {
    if (busy) return;
    const request = ++version.current; setBusy(true); setError('');
    try { const extraction = validateExtraction(await service.extract({ ...context(), user_message: message })); if (request === version.current) { dispatch({ type: 'load', question: message, extraction }); setStatus('Ready to explore'); } }
    catch (e) { if (request === version.current) setError((e as Error).message); }
    finally { if (request === version.current) setBusy(false); }
  }
  const runExample = (sample: DemoSample) => { setInput(sample.message); void extract(sample.message); };
  async function apply() {
    if (!raw || busy) return;
    const content = [goalDraft && `Goal correction: ${goalDraft}`, correction,
      ...correctionLines(app, response),
    ].filter(Boolean).join('\n');
    if (!content) { setStatus('No corrections to apply.'); return; }
    const request = ++version.current; const editVersion = revision.current; setBusy(true); setError('');
    try {
      const next = validateExtraction(await service.correct({ ...context(), previous_extraction: structuredClone(raw), user_correction: content }));
      if (request !== version.current) return;
      if (editVersion !== revision.current) { setStatus('Your edits changed while saving. Response discarded; drafts retained.'); return; }
      setHistory(h => [...h, { correction: content, extraction: raw }]); dispatch({ type: 'load', question: original, extraction: next, preserveMode: true }); setCorrection(''); setGoalDraft(''); setDirtyEditors({}); setGoalEditing(false); setStatus('Updated just now');
    } catch (e) { if (request === version.current) setError((e as Error).message); }
    finally { if (request === version.current) setBusy(false); }
  }
  const jump = (step: number) => {
    dispatch(app.mode === 'guide' ? { type: 'disclosure', step, open: response ? !guideSectionOpen(app, response, step) : true } : { type: 'toggle', step });
    requestAnimationFrame(() => document.getElementById(`step-${step}`)?.scrollIntoView({ block: 'start' }));
  };
  const reveal = (step: number) => {
    if (app.mode === 'guide') dispatch({ type: 'disclosure', step, open: true });
    else if (!app.openSteps[step]) dispatch({ type: 'toggle', step });
    requestAnimationFrame(() => document.getElementById(`step-${step}`)?.scrollIntoView({ block: 'start' }));
  };
  return <><header className="site-header"><Link className="brand" href="/" onClick={event => { event.preventDefault(); reset(); }} aria-label={demoMode ? 'Show Your Work — reset demo' : 'Show Your Work — new question'}><span className="sun">☀</span>Show Your Work</Link><div className="header-right"><span className="demo">{demoMode ? 'Demo mode' : 'Show Your Work'}</span><button className="new-question" onClick={reset}>{demoMode ? '\u21ba Reset demo' : '＋ New question'}</button></div></header>
    <main className={raw || busy ? 'workspace-page' : 'landing-page'}><div aria-live="polite" className="sr-only">{busy ? 'Reviewing your description' : status}</div>
      {!raw && !busy && <section className="intro"><span className="eyebrow">A little clarity goes a long way</span><h1>What’s on your mind?</h1><p>A trip, a new laptop, a fresh start.<br />Let’s make the numbers a little less mysterious.</p><div className="input-card"><label htmlFor="description">Tell us what you’re working toward</label><textarea id="description" value={input} onChange={e => setInput(e.target.value)} placeholder="Describe your goal, the numbers you know, and anything you’re unsure about…" /><div className="input-footer"><span>{demoMode ? 'Demo mode · choose an example below.' : 'Start with the numbers you know.'}</span><button className="primary" disabled={!input.trim()} onClick={() => extract()}>Continue <span>→</span></button></div></div>{demoMode && <DemoInputs disabled={busy} onSelect={runExample} />}<div className="principles"><span>◉ See every assumption</span><span>✎ Make it yours</span><span>↔ Explore the trade-offs</span></div></section>}
      {(raw || busy) && <><div className="user-message"><div><span className="question-caption">Your question{example && <span className={`category-tag category-${example.category}`}>{example.title} · {categories[example.category].label}</span>}</span>{original || input}</div><span className="avatar">Y</span></div><section className="assistant-message" aria-label="Show Your Work response"><span className="assistant-avatar" aria-hidden="true">☀</span><div>{raw ? assistantMessages[app.mode] : assistantMessages.loading}</div></section></>}
      {busy && !raw && <section className="working-card skeleton" aria-label="Reviewing your description"><div /><div /><div /></section>}
      {error && <div className="error" role="alert">{error}{!raw && <button disabled={busy} onClick={() => extract()}>Retry</button>}</div>}
      {raw && response && <><section className={`working-card dynamic-workspace ${app.mode === 'quick' ? 'quick-view' : 'guide-view'}`}>
        <div className="mode-selector" role="group" aria-label="How would you like to explore?"><button aria-pressed={app.mode === 'quick'} onClick={() => dispatch({ type: 'mode', mode: 'quick' })}>Quick Calculate</button><button aria-pressed={app.mode === 'guide'} onClick={() => dispatch({ type: 'mode', mode: 'guide' })}>Step-by-Step Guide</button></div>
<div className="card-header"><div><span className="eyebrow">Your working card</span><h2>{app.mode === 'guide' ? 'Here’s what we understood' : response.status === 'needs_input' ? 'A few details first' : response.status === 'unsupported' ? 'What we can review' : response.status === 'stale' ? 'Updating your working card' : 'Your answer'}</h2>{goalDraft && <p className="annotation">Pending goal correction · {goalDraft}</p>}</div><button onClick={() => setGoalEditing(!goalEditing)}>Edit goal</button></div>
        {goalEditing && <div className="editor"><label>Goal correction<textarea value={goalDraft} onChange={e => { changed(); setGoalDraft(e.target.value); }} /></label><button onClick={() => setGoalEditing(false)}>Keep draft</button><button onClick={() => { changed(); setGoalDraft(''); setGoalEditing(false); }}>Discard goal draft</button></div>}

        <ResultView response={response} app={app} onChange={(binding, value) => { changed(); dispatch({ type: 'value', binding, value }); }} onRevert={index => { changed(); dispatch({ type: 'revert', index }); }} onDraft={(id, dirty) => { changed(); setDirtyEditors(d => ({ ...d, [id]: dirty })); }} onConfirm={(id, signature) => dispatch({ type: 'confirm', id, signature })} onStep={jump} onAction={action => action === 'retry' ? setRetry(n => n + 1) : reveal(action === 'review_information' ? 1 : 2)} refreshing={!current && !pendingText} />
        <footer className="card-footer"><span>Your edits stay here. Submit corrections when you’d like a new review.</span><button disabled={busy || Object.values(dirtyEditors).some(Boolean)} onClick={apply}>{busy ? 'Submitting…' : 'Submit corrections'}</button></footer>
      </section>
        {history.length > 0 && <details className="history"><summary>Correction history ({history.length})</summary>{history.map((entry, i) => <details key={i}><summary>{entry.correction}</summary><pre>{JSON.stringify(entry.extraction, null, 2)}</pre></details>)}</details>}
        <div className="composer" id="correction"><label className="sr-only" htmlFor="correction-input">Add a correction</label><span>＋</span><textarea id="correction-input" value={correction} onChange={e => { changed(); setCorrection(e.target.value); }} placeholder="Add a correction or another condition…" /><button className="send" aria-label="Apply correction" disabled={busy || !correction.trim() || Object.values(dirtyEditors).some(Boolean)} onClick={apply}>↑</button></div>{demoMode && <p className="demo-footnote">Demo mode · new corrections stay as drafts. No live service is connected.</p>}
      </>}
    </main><footer className="site-footer">Show Your Work <span>Less guessing. More understanding.</span></footer></>;
}
