// Server-side proxy: browser -> Next.js -> Python backend.
// Keeps the backend URL / key out of the browser and avoids CORS setup.
// Set BACKEND_URL in .env.local (see env.example).
const ALLOWED = new Set(['extract', 'correct', 'calculate']);
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ALLOWED.has(action)) return Response.json({ detail: 'Unknown action' }, { status: 404 });
  const base = process.env.BACKEND_URL;
  if (!base) return Response.json({ detail: 'BACKEND_URL is not set. Copy env.example to .env.local and restart.' }, { status: 500 });
  try {
    const upstream = await fetch(`${base.replace(/\/$/, '')}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(process.env.BACKEND_API_KEY ? { 'x-api-key': process.env.BACKEND_API_KEY } : {}) },
      body: await request.text(),
      signal: AbortSignal.timeout(55_000),
      cache: 'no-store',
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ detail: 'Cannot reach the backend. Is it running at BACKEND_URL?' }, { status: 502 });
  }
}
