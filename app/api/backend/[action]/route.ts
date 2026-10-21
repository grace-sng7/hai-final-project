// Server-side proxy: browser -> Next.js -> Python backend.
// Keeps the backend URL / key out of the browser and avoids CORS setup.
// Set BACKEND_URL in .env.local (see env.example).
const ALLOWED = new Set(['extract', 'correct', 'calculate']);
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Best-effort per-IP limit on the two routes that call the LLM. In-memory, so it resets per server
// instance; it stops accidental floods and casual abuse, not a determined attacker.
const LIMIT = Number(process.env.LLM_RATE_LIMIT_PER_HOUR ?? 40);
const hits = new Map<string, number[]>();
function limited(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [key, times] of hits) if (!times.some(t => now - t < 3_600_000)) hits.delete(key);
  return recent.length > LIMIT;
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ALLOWED.has(action)) return Response.json({ detail: 'Unknown action' }, { status: 404 });
  if (action !== 'calculate' && limited(request)) return Response.json({ detail: 'Too many requests. Please wait a bit and try again.' }, { status: 429 });
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
