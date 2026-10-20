import { emptyContent, validateCalculation, type CalculationRequest, type CalculationService } from '../calculation-contract';
import { samples } from './data';
import { LocalDemoCalculationService } from './local-demo-calculation';

export type MockCalculationResponder = (request: CalculationRequest) => Promise<unknown> | unknown;
// Fixture routing belongs ONLY to mock infrastructure. The UI knows no scenario IDs.
// An injected responder can simulate any agreed contract, including rejection/errors.
export class MockCalculationService implements CalculationService {
  constructor(private readonly respond: MockCalculationResponder = demoResponse) {}
  async calculate(request: CalculationRequest) {
    return validateCalculation(await this.respond(structuredClone(request)), request.extraction);
  }
}
async function demoResponse(request: CalculationRequest) {
  if (samples.some(sample => sample.message === request.originalQuestion)) {
    // Independent demo implementation, retaining its explicit snapshot safety checks.
    return new LocalDemoCalculationService().calculate(request);
  }
  return { ...emptyContent(), status: 'unsupported', message: 'This mock has no calculation model for these details. You can still review and edit the information.', nextActions: [{ label: 'Review information', action: 'review_information' }] };
}
