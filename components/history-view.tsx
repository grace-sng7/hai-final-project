'use client';
// History tab: every chat saved in this browser, newest first. Open one to read it and keep going.
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { clearHistory, deleteChat, historySnapshot, lastHeadline, subscribeHistory } from '../lib/history';
import s from '../app/chat/chat.module.css';

const when = (ms: number) => {
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return today ? `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export default function HistoryView() {
  // Browser storage isn't available during server rendering (null there); updates when chats are deleted.
  const chats = useSyncExternalStore(subscribeHistory, historySnapshot, () => null);

  const remove = (id: string) => deleteChat(id);
  const clearAll = () => { if (window.confirm('Delete all saved chats from this browser? This can’t be undone.')) clearHistory(); };

  return <div className={s.page}>
    <header className={s.header}>
      <Link href="/" className={s.brand}><span aria-hidden="true">☀</span> Pennyscope</Link>
      <div className={s.headerRight}><Link href="/" className={s.headerLink}>New chat</Link></div>
    </header>
    <main className={s.history}>
      <div className={s.historyTop}>
        <h1>History</h1>
        {chats && chats.length > 0 && <button type="button" className={s.link} onClick={clearAll}>Clear all</button>}
      </div>
      <p className={s.muted}>🔒 Saved only in this browser. Nothing here is sent anywhere.</p>
      {chats === null ? null : chats.length === 0
        ? <div className={s.historyEmpty}><p>No chats yet. Your conversations will show up here.</p><Link href="/" className={s.headerLink}>Start a chat</Link></div>
        : <ul className={s.historyList}>{chats.map(c => {
          const headline = lastHeadline(c);
          return <li key={c.id}>
            <Link href={`/?chat=${encodeURIComponent(c.id)}`} className={s.historyItem}>
              <span className={s.historyTitle}>{c.title}</span>
              <span className={headline ? s.historyAnswer : s.muted}>{headline ?? 'No answer yet'}</span>
              <span className={s.historyMeta}>{when(c.updatedAt)} · {c.messages.filter(m => m.role === 'user').length} {c.messages.filter(m => m.role === 'user').length === 1 ? 'message' : 'messages'}</span>
            </Link>
            <button type="button" className={s.historyDelete} onClick={() => remove(c.id)} aria-label={`Delete chat: ${c.title}`}>Delete</button>
          </li>;
        })}</ul>}
    </main>
  </div>;
}
