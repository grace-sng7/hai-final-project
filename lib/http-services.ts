// Real network services. They call the Next.js proxy (app/api/backend/[action]) which forwards
// to the Python backend at BACKEND_URL. Nothing here knows any financial logic.
import { TransportExtractionService, type CorrectionRequest, type ExtractRequest } from './extraction';
import { type CalculationRequest, type CalculationResponse, type CalculationService } from './calculation-contract';
import { fromCalculateWire, toCalculateWire } from './backend-wire';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const FRIENDLY: Record<string, string> = { extract: 'We couldn’t review your description right now. Please retry.', correct: 'We couldn’t apply your corrections right now. Your edits are kept — please retry.', calculate: 'Calculation unavailable.' };

export async function postJson(action: 'extract' | 'correct' | 'calculate', body: unknown, fetchImpl: Fetch = (i, init) => fetch(i, init), base = '/api/backend'): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  } catch {
    throw new Error(`${FRIENDLY[action]} (could not reach the server)`);
  }
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* non-JSON body */ }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? (payload as { detail: unknown }).detail : undefined;
    console.error(`[backend] ${action} failed`, response.status, detail);
    throw new Error(`${FRIENDLY[action]}${typeof detail === 'string' ? ` (${detail})` : ` (status ${response.status})`}`);
  }
  return payload;
}

export class HttpCalculationService implements CalculationService {
  constructor(private readonly fetchImpl?: Fetch, private readonly base?: string) {}
  async calculate(request: CalculationRequest): Promise<CalculationResponse> {
    return fromCalculateWire(await postJson('calculate', toCalculateWire(request), this.fetchImpl, this.base), request);
  }
}

export const liveExtractionService = new TransportExtractionService({
  extract: (r: ExtractRequest) => postJson('extract', r),
  correct: (r: CorrectionRequest) => postJson('correct', r),
});
export const liveCalculationService: CalculationService = new HttpCalculationService();
