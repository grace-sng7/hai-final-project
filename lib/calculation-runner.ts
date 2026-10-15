import { emptyContent, validateCalculation, type CalculationRequest, type CalculationResponse, type CalculationService } from './calculation-contract';

// Shared request lifecycle; cancellation suppresses late responses, including failures.
export function startCalculation(service: CalculationService, request: CalculationRequest, accept: (result: CalculationResponse) => void): () => void {
  let cancelled = false;
  const snapshot = structuredClone(request);
  Promise.resolve().then(() => service.calculate(snapshot))
    .then(value => { const result = validateCalculation(value, snapshot.extraction); if (!cancelled) accept(result); })
    .catch(() => { if (!cancelled) accept({ ...emptyContent(), status: 'stale', message: 'Calculation unavailable. Your changes are saved on this page. Please retry.', nextActions: [{ label: 'Retry calculation', action: 'retry' }] }); });
  return () => { cancelled = true; };
}
