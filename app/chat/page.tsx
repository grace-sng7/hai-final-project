import type { Metadata } from 'next';
import ChatApp from '@/components/chat-app';
export const metadata: Metadata = { title: 'Pennyscope', description: 'Talk it through. See every assumption.' };
export default function ChatPage() { return <ChatApp />; }
