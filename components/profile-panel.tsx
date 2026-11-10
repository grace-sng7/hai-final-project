'use client';
// "Your profile": basic facts set once so the chat doesn't have to ask each time.
import { useState } from 'react';
import type { Profile } from '../lib/profile';
import s from '../app/chat/chat.module.css';

type Field = 'income' | 'rent' | 'otherExpenses' | 'savings' | 'age';
const MONEY: [Field, string, string][] = [
  ['income', 'Monthly income', 'After tax, from all sources'],
  ['rent', 'Monthly rent', 'Including utilities, if you pay them'],
  ['otherExpenses', 'Other monthly spending', 'Food, phone, transport, subscriptions…'],
  ['savings', 'Current savings', 'Optional'],
];

export function ProfilePanel({ profile, onSave, onClear, onClose }: { profile: Profile; onSave: (p: Profile) => void; onClear: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Profile>(profile);
  const setNum = (k: Field, v: string) => setDraft(d => ({ ...d, [k]: v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? undefined : Number(v) }));
  return <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={onClose}>
    <form className={s.profile} onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSave(draft); }}>
      <h2 id="profile-title">Your profile</h2>
      <p className={s.muted}>Fill in what you’re comfortable with. I’ll use it instead of asking, and anything you say in a chat overrides it.</p>
      <fieldset><legend>Money</legend>
        {MONEY.map(([k, title, hint]) => <label key={k}><span>{title}</span>
          <span className={s.moneyInput}><span aria-hidden="true">$</span><input type="number" inputMode="decimal" min={0} step="any" value={draft[k] ?? ''} onChange={e => setNum(k, e.target.value)} aria-describedby={`${k}-hint`} /></span>
          <small id={`${k}-hint`} className={s.muted}>{hint}</small></label>)}
      </fieldset>
      <fieldset><legend>About you</legend>
        <label><span>Age</span><input type="number" min={13} max={120} value={draft.age ?? ''} onChange={e => setNum('age', e.target.value)} /></label>
        <label><span>State / region</span><input value={draft.state ?? ''} onChange={e => setDraft(d => ({ ...d, state: e.target.value || undefined }))} placeholder="e.g. California" /></label>
        <label><span>Country</span><input value={draft.country ?? ''} onChange={e => setDraft(d => ({ ...d, country: e.target.value || undefined }))} placeholder="e.g. United States" /></label>
        <label className={s.check}><input type="checkbox" checked={!!draft.shareContext} onChange={e => setDraft(d => ({ ...d, shareContext: e.target.checked }))} />
          <span>Let the assistant use my age and location to suggest typical costs</span></label>
      </fieldset>
      <p className={s.privacy}>🔒 Saved only in this browser. Your money figures are filled in on your device and never sent to the AI model. Age and location are sent only if you tick the box above.</p>
      <div className={s.profileActions}>
        <button type="button" onClick={() => { onClear(); setDraft({}); }}>Clear profile</button>
        <span />
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className={s.primary}>Save</button>
      </div>
    </form>
  </div>;
}
