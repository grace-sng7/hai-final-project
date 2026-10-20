// Saved extraction only; all arithmetic still runs in the integrated Python backend.
import { MockExtractionService } from './mock/extraction-service';
import { samples } from './mock/presentation-samples';
import { liveCalculationService } from './http-services';

export const offlineExtractionService = new MockExtractionService(samples, 0);
export const offlineCalculationService = liveCalculationService;
