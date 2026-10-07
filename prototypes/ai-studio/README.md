# Show Your Work — AI Studio prototype

This is a separate comparison prototype imported from [phoebeli00/version1personalbudget](https://github.com/phoebeli00/version1personalbudget), source commit `05860d35f5be4f693f7e6d9cb294a5658f53dc6a`. It is independent of Phoebe's `frontend-v1` contribution. Grace's root notebook remains unchanged; no notebook or Git history was copied here.

## Run

Use Node.js **22.12+** (or a newer supported release) and npm. Vite 8 needs a recent Node runtime.

```sh
cd prototypes/ai-studio
npm ci
npm run dev
```

Open **http://127.0.0.1:3002**. The app initially selects the Europe-trip sample. Choose another example to compare layouts and assumption review. The server listens on localhost; this port avoids the other prototype's port 3000.

```sh
npm run lint
npm run build
npm run preview
```

`lint` runs TypeScript (`tsc --noEmit`); this source repository does not supply an automated test suite or test script. `build` writes Vite's production output to ignored `dist/`. Preview serves that build on port 3002. Google Fonts are loaded from Google's font CDN; extraction data remains local in demo mode.

## Mock data, not a live API

`src/services/extractionService.ts` binds `activeExtractionService` to `new MockExtractionService(350)`. It returns in-code, notebook-inspired sample objects and simulates selected corrections. **No live Gemini/model or Python API is connected**, and no API key or `.env` file is needed. The `HttpExtractionService` class is an unconnected adapter for proposed POST `/api/extract` and `/api/correct` routes; no server for those routes is included.

This imported variant uses keyword matching for its mock extraction/correction service. Responses are examples, not a real interpretation of arbitrary text. Its trip fixture is adapted: it currently has an eight-month deadline while its sample title/description mention nine months/next May. Do not treat these fixtures as verbatim saved Grace JSON or as a validated financial recommendation. This contribution preserves the second prototype's existing UI/behavior for comparison; it does not carry over the compatibility fixes from `frontend-v1`.

The generated manifest includes a Gemini SDK and server-related dependencies, and `metadata.json` advertises an AI Studio capability, but those do not mean the runtime uses a real API.

## Future integration work

1. Implement and validate Python HTTP endpoints around Grace's extraction logic, with model credentials kept only in the Python environment.
2. Preserve `assumptions`, `clarification_questions`, `goal_summary`, `confidence_note` and the original input / previous extraction / new correction request context, including explicit reference date and timezone.
3. Reconcile this variant's types and rendering with actual notebook responses, including nullable units, unfamiliar variables, duplicate assumptions, and question meanings. Its existing validator allows nullable units but its written TypeScript assumption interface still declares a string.
4. Review correction behavior, immutable raw-data handling, date assumptions, and calculator guards before connecting live data. The current code has adapted demo behavior, not production guarantees.
5. Configure routing/CORS and select `HttpExtractionService` only after the Python service exists. Agree on a separate production calculator contract.

All `.env*` files, including the source's `.env.example`, are omitted. Dependencies, build output, logs and key files are ignored. The import adds a reproducible lockfile and updates esbuild to satisfy Vite 8's peer dependency and uses an ESM-safe Vite config path; it does not change Grace's Python code.
