import { redirect } from 'next/navigation';
// The chat is now the home page; keep old links working.
export default function ChatRedirect() { redirect('/'); }
