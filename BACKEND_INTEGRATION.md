# Show Your Work: Backend Integration Guide

> **Live backend integration is ready.** Network calls are in `lib/http-services.ts`, format conversion is in `lib/backend-wire.ts`, the interface contract for teammates is in `BACKEND_CONTRACT.md`, and a runnable Python starter project is in `backend_reference/`. Set `NEXT_PUBLIC_BACKEND_MODE=live` to switch (see `env.example`). The internal frontend contracts described below remain valid.

By default the app runs on mock services, not a connected Python backend. The page, editing, mode switching, parameter syncing, load invalidation, and retry are real frontend features; extraction ability and calculation conclusions still come from mocks.

## 1. Two independent contracts

### Extraction: Grace's current response format

Based on the system prompt, `call_llm(user_message)`, the correction prompt, and the actual printed output in `reference/show_your_work_extraction.ipynb`:

```ts
interface ExtractionResponse {
  assumptions: {
    variable: string;
    value: number | string | null;
    unit: string | null;
    source: 'stated' | 'inferred' | 'missing';
    source_detail: string;
    [key: string]: unknown;
  }[];
  clarification_questions: {
    target_variable: string;
    question: string;
    why_it_matters: string;
    [key: string]: unknown;
  }[];
  goal_summary: string;
  confidence_note: string;
  [key: string]: unknown;
}
```

Array length, order, and variable names are not fixed. Real output includes strings, dates, and `unit: null`; the frontend does not force them into numbers. Unrecognized extra fields are preserved as-is. An unknown `source` value or a missing required field is rejected, never disguised as success.

The notebook does not yet provide HTTP routes or a formal request envelope. The request shape below is a **frontend proposal that Grace needs to confirm**; the date and timezone are not parameters the notebook implements today:

```json
{
  "user_message": "Please compare my commute options.",
  "reference_date": "2026-10-15",
  "timezone": "America/New_York"
}
```

A valid extraction example:

```json
{
  "assumptions": [
    {"variable":"preferred_route","value":"Train","unit":null,"source":"stated","source_detail":"User preference"},
    {"variable":"travel_days","value":null,"unit":"days","source":"missing","source_detail":"Not supplied"}
  ],
  "clarification_questions": [
    {"target_variable":"travel_days","question":"How many travel days?","why_it_matters":"Needed for the comparison"}
  ],
  "goal_summary":"Compare commute options",
  "confidence_note":"Contract example only"
}
```

Corrections are submitted through `ExtractionService.correct`: the original question, `previous_extraction`, and the `user_correction` text, and it returns another `ExtractionResponse` of the same shape. The notebook's current correction example also composes the text and calls the model again; how the server wraps this, handles authentication, and handles dates still needs to be confirmed.

## 2. Calculation: provisional interface, not yet confirmed by the calculation teammate

The full TypeScript definitions and runtime validation are in `lib/calculation-contract.ts`. What follows is the adapter contract the frontend needs. It is not an existing Python API.

Input example:

```json
{
  "originalQuestion": "Please compare my commute options.",
  "extraction": {
    "assumptions": [
      {"variable":"preferred_route","value":"Train","unit":null,"source":"stated","source_detail":"User preference"},
      {"variable":"travel_days","value":null,"unit":"days","source":"missing","source_detail":"Not supplied"}
    ],
    "clarification_questions": [
      {"target_variable":"travel_days","question":"How many travel days?","why_it_matters":"Needed for the comparison"}
    ],
    "goal_summary":"Compare commute options",
    "confidence_note":"Contract example only"
  },
  "edits": {"1": 21},
  "answers": {},
  "parameters": {"flex": "4"},
  "answerFactBindings": {"days": 1}
}
```

- `edits`: original extraction array index → the user's edit; supports number/string/null.
- `answers`: stable clarification key → the user's answer. An answer does not necessarily equal the fact with the same name. For example, "how much savings are you willing to use" must not overwrite "total savings".
- `answerFactBindings`: a mapping, declared explicitly by the service only, of which fact an answer actually corrects. The latest fact edit clears older linked answers; a new answer replaces an older edit, so contradictory values are never sent.
- `parameters`: calculation parameters declared by the service → the user's choice. They are not sent to Grace as extracted facts.
- All indices are valid only for this one extraction. After a correction, the extraction is replaced and old mappings are cleared. If the backend adopts stable IDs, the adapter needs to convert them.

Output example (a static interface test; **no real commute calculation was performed**):

```json
{
  "status":"ready",
  "answer":{"headline":"Mock comparison supplied by the service."},
  "information":[],
  "questions":[],
  "assumptions":[],
  "parameters":[
    {"id":"flex","label":"Flexible days","value":4,"unit":"days","binding":{"kind":"parameter","key":"flex"},"control":{"type":"range","min":0,"max":10,"step":1}}
  ],
  "metrics":[],
  "explanations":[{"label":"Mock explanation","text":"No real transport costs were calculated."}],
  "limitations":["Contract fixture only."],
  "nextActions":[]
}
```

Every array must be present, and may be empty or any length. Information from the original extraction and any clarification questions the calculation does not cover are still added by the generic presentation adapter, so nothing is lost when the calculation service does not support a topic.

Supported statuses:

- `ready`: the calculation is complete; a non-empty `answer.headline` is required.
- `conditional`: a conditional result; an answer is required, and it may include assumptions, parameters, and explanations.
- `needs_input`: only a message and the required questions; no answer.
- `unsupported`: only a message, reviewable information, and optional next actions; no invented conclusion.
- `stale`: the result cannot currently be used; only a message. This is not a valid answer.

A failed request or an unknown status is not a success state: the frontend keeps the user's edits, clears the visible old conclusion, and offers Retry. Unknown extra fields may be kept; an unknown status must be rejected and never treated as `ready` by default.

Fields use `binding` to point at the same data source: `{kind:'fact',index}`, `{kind:'answer',key}`, or `{kind:'parameter',key}`. Number, date, and select inputs can only come from explicit control metadata; original clarification questions safely fall back to text input, and types are never guessed from keywords.

`questions[].correctsFactIndex` states explicitly how an answer relates to a fact, and `extractionQuestionIndices` states explicitly which original questions are covered. An identical `target_variable` alone is not enough to merge them. Repeated parameter IDs must have the same binding/control/value/unit; inline answers and What If share one parameter registry. The optional `answer.segments` references a `parameterId`; the page does not parse financial text or guess conclusions.

Still to be confirmed with the calculation teammate: the real input/output structure, which models are supported, required values and constraints, units and currency, precision, stable IDs, the difference between assumptions and user choices, dependencies between derived values, the error format, and who converts actual results into this provisional contract.

## 3. Current file boundaries and replacement points

- `lib/extraction.ts`: extraction contract, validation, and `TransportExtractionService`. It imports no fixtures and does not match question text.
- `lib/calculation-contract.ts`: the provisional calculation contract and its validation.
- `lib/calculation-service.ts`: `TransportCalculationService`, which accepts an agreed transport function and assumes no URL.
- `lib/services.ts`: the single default service composition point. To integrate, replace the two mock bindings with transport adapters, and set `demoMode={false}` to hide the example entry points. No display component needs to change.
- `lib/mock/data.ts`: the prompts and test extraction data for the three examples. The example buttons only fill the prompt into the input box; the service is requested only when the user clicks Continue.
- `lib/mock/extraction-service.ts`: exact-text matching and a single preset correction inside the mock; it does not parse arbitrary natural language. Extra fixtures can be injected to test other topics.
- `lib/mock/calculation-service.ts`: the mock response provider. It can be injected with ready/conditional/needs_input/unsupported responses or thrown errors without changing the page structure.
- `lib/mock/local-demo-calculation.ts` + `lib/calculator.ts`: an independent savings demo implementation, used only for explicitly registered mock data. It still enforces original-text context, full snapshot, unit, and parameter safety limits. By default only the trip and laptop examples work; the apartment move is unsupported. Real backend output must never fall back to this formula.
- `lib/calculation-runner.ts`: generic request snapshots, validation, converting errors into a retryable state, and canceling stale responses. The page effect reuses this tested logic directly.
- `lib/workspace-model.ts`: the original extraction, edits, answers, parameters, confirmations, and result version shared by both modes.
- `lib/presentation-model.ts`, `components/result-view.tsx`: render only from status, fields, questions, parameters, and results. They never choose a page based on an example name or an amount.

Suggested composition for real services (not an implemented endpoint):

```ts
const extractionService = new TransportExtractionService({
  extract: agreedExtractionTransport,
  correct: agreedCorrectionTransport,
});
const calculationService = new TransportCalculationService(agreedCalculationTransport);
```

The transport must be implemented by the team according to the real routes, authentication, timeouts, and error protocol. Do not put API keys in client-side code; the notebook's model calls should stay on the server.

## 4. State, invalidation, and mock scope

The original extraction stays unchanged. Saving a fact, answering a question, or adjusting a parameter creates a new calculation request; an unfinished edit or correction draft hides the old conclusion. Version numbers and request cancellation ensure an old response can never overwrite a newer state. Retry uses the same interface, and switching modes affects only the display.

Submit corrections sends the currently effective correction text to the extraction service; What If parameters are not mixed in with facts. A failed correction keeps the draft, and a successful one accepts the new `ExtractionResponse`. In the mock extraction, only the preset correction succeeds today; any other correction clearly reports the mock limitation. This is not natural-language extraction ability.

After an edit, original inferred values are conservatively marked as needing review until a new extraction arrives; the current metrics in the calculation response are displayed independently. Automatically refreshing the original derived fields requires agreeing dependencies and authoritative update metadata with the backend. React must not guess formulas.

There is currently no real HTTP connection, persistence, or commitment to real calculation ability. Refreshing the page loses the current session. The new-topic fixture only proves that the same frontend flow can display it; it does not mean the backend supports that topic.

## 5. Validation

`npm test` covers the three real examples, compatibility with the notebook's printed JSON, changed amounts, changes to the number and order of fields and questions, the new commute topic, passing valid edits through, parameter requests, null, unknown fields, unknown statuses, request failure/retry, synchronous errors, and canceling stale responses. The original 800 dynamic-response rendering combinations and the P0 regression tests are kept.

The same tests use Workspace's own reducer, request lifecycle, and the Quick/Guide display components directly. An architecture check ensures the production contracts and the display layer never import fixtures or example-matching rules.

Validation commands:

```sh
npm test
npx eslint app components lib tests/contracts.mjs tests/integration-flow.mjs
npm run build
```

`.agents/` stays untracked and unmodified; a repository-wide lint would include the existing standalone script issues in it, so application-scoped lint is used here.
