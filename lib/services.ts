import type { ExtractionService } from './extraction';
import type { CalculationService } from './calculation-contract';
import { MockExtractionService } from './mock/extraction-service';
import { MockCalculationService } from './mock/calculation-service';

// Composition point: replace these two bindings with agreed transport adapters.
// Mock fixture selection never enters the production contracts or display components.
export const extractionService: ExtractionService = new MockExtractionService();
export const calculationService: CalculationService = new MockCalculationService();
