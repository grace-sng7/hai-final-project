# hai-final-project

## Show Your Work frontend

The Phase 1 Next.js / React prototype is in [`frontend/`](frontend/). Grace's existing [`show_your_work_extraction.ipynb`](show_your_work_extraction.ipynb) is unchanged and remains the extraction reference.

### Run locally

Use Node.js 20.9 or later and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000. Choose a trip, laptop, or apartment example, then Continue. This version uses **mock JSON only**; arbitrary input is not sent to a model. Local edits and clarification answers are retained in memory. Only the predefined laptop correction simulates a new extraction. No credentials are needed to run the frontend.

### Checks and production build

Run from `frontend/`:

```sh
npm run lint
npm test
npm run build
npm start
```

### What still needs backend integration

The notebook currently exposes `call_llm(user_message)`, not HTTP endpoints. The frontend includes an unconnected HTTP adapter; it does not implement the Python API or call a provider directly.

1. Add a Python HTTP wrapper for POST `/api/extract` and `/api/correct`. Keep Grace's extraction logic intact. Credentials belong in Python environment variables, never browser code or committed files.
2. Accept `user_message`, `reference_date`, and `timezone`; correction requests also carry `previous_extraction` and `user_correction`. Preserve the notebook's original-input → previous-JSON → correction context structure, adding explicit date context.
3. Validate responses as Grace's exact `assumptions`, `clarification_questions`, `goal_summary`, and `confidence_note` object. Assumption values must support numbers, strings, and null, including ISO dates. Reject invalid source values and use a separate non-2xx error body.
4. Configure same-origin routing/reverse proxy or deliberate CORS. Then change the single `extractionService` binding in `frontend/lib/extraction.ts` from `MockExtractionService` to `HttpExtractionService` with the chosen base URL.
5. Agree on a separate production calculator contract. The frontend savings example is deterministic and local; it is not Grace's model output or a production affordability calculation. Other scenario calculators are not connected.

See [`frontend/README.md`](frontend/README.md) for fixture behavior, code structure, and detailed integration notes. Accounts, persistence, bank connections, and live extraction are outside this contribution. Environment files, dependencies, build artifacts, and notebook checkpoints are ignored.
