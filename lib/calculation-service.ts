import { validateCalculation, type CalculationRequest, type CalculationResponse, type CalculationService } from './calculation-contract';
export type { CalculationRequest, CalculationResponse, CalculationService, ResultStatus } from './calculation-contract';

// Future transport adapter. No URL, authentication, or Python endpoint is assumed.
export class TransportCalculationService implements CalculationService {
  constructor(private readonly transport: (request: CalculationRequest) => Promise<unknown>) {}
  async calculate(request: CalculationRequest): Promise<CalculationResponse> {
    return validateCalculation(await this.transport(structuredClone(request)), request.extraction);
  }
}
