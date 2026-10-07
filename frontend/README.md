# Show Your Work — Phase 1

A Next.js 16 / React 19 frontend prototype. No model or Python API is connected.

## Run

```sh
cd frontend # from the repository root
npm ci
npm run dev
```

Open http://localhost:3000. Select an example, then Continue. Free-form inputs show the demo limitation and retain the input.

```sh
npm run lint
npm test
npm run build
```

## Structure

- `app/`: page, shared layout, and warm responsive styling.
- `components/workspace.tsx`: input, conversation, generic AssumptionRow, review, questions, correction composer, and savings preview.
- `lib/fixtures/`: Grace's three original response fixtures, copied without modifications; a separate predefined laptop correction fixture.
- `lib/extraction.ts`: exact response/request interfaces, runtime validation, data issue reporting, mock service, and unconnected HTTP adapter.
- `lib/calculator.ts`: separate deterministic local savings calculator.
- `reference/`: the original PRD. Grace’s existing notebook is at [`../show_your_work_extraction.ipynb`](../show_your_work_extraction.ipynb); it is not duplicated or executed by this application.
- `tests/contracts.mjs`: fixture and service contract tests and calculator edge cases.

Raw extraction is never edited. Confirmations, indexed local overrides, answers, scenario controls, and response history are separate state. Index keys preserve duplicate variable entries. Duplicate variables and inconsistent missing source/value combinations block calculation. Saving answers keeps original questions visible and does not overwrite assumption values. Questions targeting inferred variables appear inside the matching purple assumption card rather than being repeated in Questions for you. Unknown variables remain visible. Derived surplus is read only; its Edit action points to underlying inputs, and input edits mark it stale. Explicitly recognized expense category edits require an updated total; unknown variables do not participate automatically.

For the trip example, confirm monthly expenses, answer and save the expenses question, and explicitly allocate $500. Preview uses $300/month for eight months: projected $2,900, gap $100, remaining monthly cash $50. Contribution above $350 produces a cash-flow warning. Apartment calculation is intentionally unavailable.

Only the displayed, exact sample input strings produce a mock extraction. Arbitrary corrections remain drafts. The laptop's “Try a demo correction” button supplies an explicit predefined correction ($1,800 income, $1,300 expenses, four months). Apply it without additional local drafts to simulate a replacement response and inspect correction history. There is no persistence across refreshes.

## Future Python integration

Change the single `extractionService` binding in `lib/extraction.ts` to `new HttpExtractionService()` after implementing the API. UI components accept an injected `ExtractionService`. Proposed endpoints are POST `/api/extract` and `/api/correct`; neither exists here. Both return Grace's JSON directly. Non-2xx errors return `{ "error": { "code": "EXTRACTION_FAILED", "message": "Please try again." } }`.

Extraction sends `user_message`, `reference_date` (current America/New_York calendar date), and `timezone`. Correction also sends `previous_extraction` and `user_correction`. The future Python wrapper should call Grace's unchanged `call_llm` with added date context. For correction, preserve notebook cell 14's original input → previous JSON → correction → update instruction prompt structure. Validate the returned dictionary before returning HTTP success. The notebook schema must be reconciled with its actual string/date values during backend integration. Keep provider credentials in Python environment variables; browser code has no provider prompts, credentials, or calls. Use same-origin HTTP or configure CORS deliberately. Production calculator integration remains a separate contract to agree with Sivani.

Request versions and card revisions reject stale service responses. Duplicate saves are disabled; errors retain drafts. Slider changes are local and do not submit service requests.

## Verification

Contract tests cover all original fixtures, exact field preservation, zero and negative numbers, malformed sources, duplicate variables, inconsistent missing values, arbitrary demo input rejection, the predefined correction, expected calculator output, invalid deadlines, negative cash availability, excess allocation and contribution. Browser checks cover confirmations preserving provenance, saved answers preserving total savings and questions, synchronized precise editing beyond slider bounds, and invalidated surplus/results after income edits. Tested page scroll width at 320, 736, and 1024 pixels. Native inputs, buttons, details, and text labels support keyboard and touch. The original question stays visible in a compact sticky reference area; the working card and composer use normal page scrolling. Stated facts use compact four-column cards on desktop, with inline confirmation and edit actions.

## Verified compatibility with Grace's saved JSON

`Grace’s saved output` is an additional demo sample loaded through the same sample-selection → `ExtractionService.extract` → runtime-validation → dynamic-review path as the original examples. Its response is captured from the root notebook's **cell 16** (`json.dumps(case_3_result, indent=2)`); the original input is recorded in cell 12. `lib/fixtures/grace-notebook-case3.json` preserves the parsed response exactly, including `goal_description.unit: null`. Provenance is separate in `grace-notebook-case3-provenance.json`, not added to Grace's response schema. Regenerate these files with `npm run capture:grace`; this reads saved output only and never runs notebook code or a model.

Compatibility requires `unit: string | null` as well as `value: number | string | null`. Null units are omitted in the display without altering raw JSON. Field names, original sources, questions, and additional response fields are preserved. The saved nine-month deadline assumes the current month is August; it is historical output, not a current date calculation, and must be reviewed before previewing.

`npm test` now also runs `tests/compatibility.mjs`: exact replay against the notebook output; generic row rendering; unknown variables; numeric/string/date/null/zero/negative/percentage values; strict source/type validation; null units; extra fields and duplicate entries; empty question arrays and absent targets; immutable local edits; source-preserving confirmations; and correction/HTTP-adapter contracts. HTTP checks use a captured-response fetch stub, not a live Python backend.

Browser verification on localhost:3001 loaded the actual response and checked all nine rows and three questions, confirmation provenance, allocation answers retaining total savings, category-edit invalidation, and failed corrections retaining drafts. Additional browser checks used the original authored trip/laptop/apartment fixtures for absent-target questions, missing-value display without slider defaults, empty question responses, ISO date editing, and an explicit zero edit. Those edge cases are not claimed to exist in the saved raw notebook JSON.

There is no Python HTTP API in this repository. JSON compatibility is verified for the saved response plus focused edge cases; live request handling, model extraction, correction re-extraction, deployment routing/CORS, and production calculator integration remain unverified.
