'use client';
// Composition root. Services are created here, on the client, so no functions cross
// the Server/Client boundary. Set NEXT_PUBLIC_BACKEND_MODE=live to use the Python backend.
import Workspace from './workspace';
import { liveCalculationService, liveExtractionService } from '@/lib/http-services';

const live = process.env.NEXT_PUBLIC_BACKEND_MODE === 'live';

export default function AppShell() {
  return live
    ? <Workspace service={liveExtractionService} calculator={liveCalculationService} demoMode={false} />
    : <Workspace />;
}
