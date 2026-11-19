import type { Metadata } from 'next';
import HistoryView from '@/components/history-view';
export const metadata: Metadata = { title: 'History · Pennyscope', description: 'Your past Pennyscope chats, saved in this browser.' };
export default function HistoryPage() { return <HistoryView />; }
