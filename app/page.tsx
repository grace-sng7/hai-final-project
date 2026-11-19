import type { Metadata } from 'next';
import ChatApp from '@/components/chat-app';
export const metadata: Metadata = { title: 'Pennyscope', description: 'Talk it through. See every assumption.' };
// /?chat=<id> reopens a saved chat from the History page.
export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const chat = (await searchParams).chat;
  const id = typeof chat === 'string' ? chat : undefined;
  return <ChatApp key={id ?? 'new'} resumeId={id} />;
}
