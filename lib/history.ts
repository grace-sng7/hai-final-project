import type { CalculationResponse } from './calculation-contract';
import type { ExtractionResponse } from './extraction';

// Chat history. Like the profile, it is stored only in this browser (localStorage) and never sent anywhere.

export type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot'; kind: 'text'; text: string; note?: string; replies?: string[]; extraction?: ExtractionResponse }
  | { id: number; role: 'bot'; kind: 'understood'; extraction: ExtractionResponse }
  | { id: number; role: 'bot'; kind: 'answer'; response: CalculationResponse }
  | { id: number; role: 'bot'; kind: 'typing' };

export interface ChatRecord {
  id: string;
  title: string;                        // the user's first message
  startedAt: number;                    // ms since epoch
  updatedAt: number;
  messages: Msg[];                      // never includes the typing indicator
  extraction: ExtractionResponse | null; // the working sheet at the last save
  original: string;                     // the question the extraction came from
  pending?: Pending | null;             // the question the chat was waiting on, if any
}

export interface Pending { targets: string[]; question: string; required: boolean }

const KEY = 'pennyscope-history-v1';
export const MAX_CHATS = 50;

export const newChatId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecord = (x: unknown): x is ChatRecord => {
  const r = x as ChatRecord;
  return !!r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.updatedAt === 'number' && Array.isArray(r.messages);
};

const readRaw = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
function parse(raw: string | null): ChatRecord[] {
  try {
    const list = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(list) ? list.filter(isRecord).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch { return []; }
}

// Newest first.
export function loadHistory(): ChatRecord[] { return parse(readRaw()); }

// For useSyncExternalStore: a cached snapshot that only changes when storage does,
// and a subscription to changes from this tab (writes below) and other tabs (storage event).
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
let cachedRaw: string | null | undefined;
let cached: ChatRecord[] = [];
export function historySnapshot(): ChatRecord[] {
  const raw = readRaw();
  if (raw !== cachedRaw) { cachedRaw = raw; cached = parse(raw); }
  return cached;
}
export function subscribeHistory(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) fn(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

function write(list: ChatRecord[]): void {
  // If the browser is out of space, drop the oldest chats until it fits (or nothing is left).
  for (let keep = list.length; keep >= 0; keep--) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, keep))); notify(); return; } catch { /* quota or private mode: try smaller */ }
  }
}

// Build the record for a conversation. Returns null for a chat with nothing the user said yet.
export function toRecord(id: string, messages: Msg[], extraction: ExtractionResponse | null, original: string, startedAt: number, pending: Pending | null = null, now = Date.now()): ChatRecord | null {
  const kept = messages.filter(m => !('kind' in m && m.kind === 'typing'));
  const first = kept.find(m => m.role === 'user') as Extract<Msg, { role: 'user' }> | undefined;
  if (!first) return null;
  return { id, title: first.text.length > 120 ? `${first.text.slice(0, 117)}…` : first.text, startedAt, updatedAt: now, messages: kept, extraction, original, pending };
}

// Pure: put a record at the front, replacing an older copy, and cap the list.
export function upsert(list: ChatRecord[], record: ChatRecord, max = MAX_CHATS): ChatRecord[] {
  return [record, ...list.filter(r => r.id !== record.id)].slice(0, max);
}

export function saveChat(record: ChatRecord): void { write(upsert(loadHistory(), record)); }
export function getChat(id: string): ChatRecord | undefined { return loadHistory().find(r => r.id === id); }
export function deleteChat(id: string): void { write(loadHistory().filter(r => r.id !== id)); }
export function clearHistory(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } notify(); }

// The latest answer's headline, for the history list.
export function lastHeadline(r: ChatRecord): string | undefined {
  const answer = [...r.messages].reverse().find(m => 'kind' in m && m.kind === 'answer') as Extract<Msg, { kind: 'answer' }> | undefined;
  const res = answer?.response;
  return res && (res.status === 'ready' || res.status === 'conditional') ? res.answer.headline : undefined;
}

// A saved chat, ready to continue. Quick replies stay only on the last message, and only while its
// question is still pending; anything else (e.g. "Try again" for a request that is gone) is dropped.
export function forResume(r: ChatRecord): Msg[] {
  const last = r.messages.at(-1)?.id;
  return r.messages.map(m => m.role === 'bot' && m.kind === 'text' && m.replies && !(r.pending && m.id === last)
    ? (({ replies: _r, ...rest }) => { void _r; return rest; })(m) : m);
}
