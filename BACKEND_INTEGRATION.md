# Show Your Work: Backend Integration Guide

[BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) is the single source of truth for the HTTP API. [FRONTEND_README.md](FRONTEND_README.md) contains setup, feature status, testing and handoff steps. This English guide describes integration internals; its UI adapter examples are not a second backend API.

By default the app runs on mock services. Live HTTP routes and adapters are implemented, and Grace's exact cell-4 SYSTEM_PROMPT is now copied into the Python reference. FastAPI extraction/correction routes have passed offline tests with stubbed model responses. Real provider calls and browser-to-LLM behavior remain unverified because no API key was configured.

## 1. Extraction compatibility

### Extraction: Grace's current response format

Based on the system prompt, `call_llm(user_message)`, the correction prompt, and the actual printed output in `reference/show_your_work_extraction.ipynb`:

For the authoritative extraction schema, request envelope and examples, see sections 1 and 2 of [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md).

Array length, order, and variable names are not fixed. Real output includes strings, dates, and `unit: null`; the frontend does not force them into numbers. Unrecognized extra fields are preserved as-is. An unknown `source` value or a missing required field is rejected, never disguised as success.

The notebook itself does not provide HTTP routes. `backend_reference/main.py` now implements the agreed `/extract` and `/correct` envelopes; `extraction_service.py` adds `reference_date` and `timezone` to the prompt. The original notebook is unchanged, including its model configuration and correction workflow.

Corrections are submitted through `ExtractionService.correct`: the original question, `previous_extraction`, and the `user_correction` text, and it returns another `ExtractionResponse` of the same shape. The Python reference implements the notebook's composed correction workflow and date context. Live output behavior and authentication still need verification; see the remaining gaps below.

## 2. Internal calculation presentation model (not the HTTP API)

The full internal TypeScript definitions and runtime validation are in `lib/calculation-contract.ts`. The examples below describe frontend state and rendering metadata only. Python receives the different wire format in BACKEND_CONTRACT.md; `lib/backend-wire.ts` converts between the two. Do not implement these UI-specific shapes as Python API responses.

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

In this internal display model, every array must be present, and may be empty or any length. HTTP list optionality remains defined in BACKEND_CONTRACT.md. Information from the original extraction and any clarification questions the calculation does not cover are still added by the generic presentation adapter, so nothing is lost when the calculation service does not support a topic.

Internal display statuses (the HTTP API does not return `stale`):

- `ready`: the calculation is complete; a non-empty `answer.headline` is required.
- `conditional`: a conditional result; an answer is required, and it may include assumptions, parameters, and explanations.
- `needs_input`: only a message and the required questions; no answer.
- `unsupported`: only a message, reviewable information, and optional next actions; no invented conclusion.
- `stale`: frontend-only state for an invalidated result or failed request; only a message. This is not a valid answer or a Python API status.

A failed request or an unknown status is not a success state: the frontend keeps the user's edits, clears the visible old conclusion, and offers Retry. Unknown extra fields may be kept; an unknown status must be rejected and never treated as `ready` by default.

Fields use `binding` to point at the same data source: `{kind:'fact',index}`, `{kind:'answer',key}`, or `{kind:'parameter',key}`. Number, date, and select inputs can only come from explicit control metadata; original clarification questions safely fall back to text input, and types are never guessed from keywords.

`questions[].correctsFactIndex` states explicitly how an answer relates to a fact, and `extractionQuestionIndices` states explicitly which original questions are covered. An identical `target_variable` alone is not enough to merge them. Repeated parameter IDs must have the same binding/control/value/unit; inline answers and What If share one parameter registry. The optional `answer.segments` references a `parameterId`; the page does not parse financial text or guess conclusions.

The HTTP input/output structure is already defined in BACKEND_CONTRACT.md. The calculation teammate still needs to verify model coverage and correctness, constraints, units, precision, defaults and derived-value dependencies against it. The frontend adapter, rather than Python, builds UI bindings and answer segments.

## 3. Current file boundaries and replacement points

- `lib/extraction.ts`: extraction contract, validation, and `TransportExtractionService`. It imports no fixtures and does not match question text.
- `lib/calculation-contract.ts`: the internal presentation model and its validation; not the HTTP contract.
- `lib/calculation-service.ts`: `TransportCalculationService`, which accepts an agreed transport function and assumes no URL.
- `lib/services.ts`: demo defaults only. `components/app-shell.tsx` selects existing live services when NEXT_PUBLIC_BACKEND_MODE is live; no manual binding replacement or UI edits are needed.
- `lib/http-services.ts`: extraction/correction JSON transport and HttpCalculationService.
- `lib/backend-wire.ts`: applies explicit edits and converts HTTP calculation requests/responses.
- `app/api/backend/[action]/route.ts`: server-side proxy to BACKEND_URL; keeps backend configuration out of the browser.
- `lib/mock/data.ts`: the prompts and test extraction data for the three examples. The example buttons only fill the prompt into the input box; the service is requested only when the user clicks Continue.
- `lib/mock/extraction-service.ts`: exact-text matching and a single preset correction inside the mock; it does not parse arbitrary natural language. Extra fixtures can be injected to test other topics.
- `lib/mock/calculation-service.ts`: the mock response provider. It can be injected with ready/conditional/needs_input/unsupported responses or thrown errors without changing the page structure.
- `lib/mock/local-demo-calculation.ts` + `lib/calculator.ts`: an independent savings demo implementation, used only for explicitly registered mock data. It still enforces original-text context, full snapshot, unit, and parameter safety limits. By default only the trip and laptop examples work; the apartment move is unsupported. Real backend output must never fall back to this formula.
- `lib/calculation-runner.ts`: generic request snapshots, validation, converting errors into a retryable state, and canceling stale responses. The page effect reuses this tested logic directly.
- `lib/workspace-model.ts`: the original extraction, edits, answers, parameters, confirmations, and result version shared by both modes.
- `lib/presentation-model.ts`, `components/result-view.tsx`: render only from status, fields, questions, parameters, and results. They never choose a page based on an example name or an amount.

The existing live path is browser → Next.js `/api/backend/*` proxy → Python `/extract`, `/correct` or `/calculate`. Setup is maintained in FRONTEND_README.md. Model calls and credentials stay on the Python server. Extraction remains visible even when calculation is unsupported or fails.

## 4. State, invalidation, and mock scope

The original extraction stays unchanged. Saving a fact, answering a question, or adjusting a parameter creates a new calculation request; an unfinished edit or correction draft hides the old conclusion. Version numbers and request cancellation ensure an old response can never overwrite a newer state. Retry uses the same interface, and switching modes affects only the display.

Submit corrections sends the currently effective correction text to the extraction service; What If parameters are not mixed in with facts. A failed correction keeps the draft, and a successful one accepts the new `ExtractionResponse`. In the mock extraction, only the preset correction succeeds today; any other correction clearly reports the mock limitation. This is not natural-language extraction ability.

After an edit, original inferred values are conservatively marked as needing review until a new extraction arrives; the current metrics in the calculation response are displayed independently. Automatically refreshing the original derived fields requires agreeing dependencies and authoritative update metadata with the backend. React must not guess formulas.

HTTP transport is implemented but its real provider round trip remains unverified. There is no persistence or commitment to arbitrary financial calculation support. Refreshing the page loses the current session. The new-topic fixture only proves that the same frontend flow can display it; it does not mean the backend supports that topic.

## 5. Validation

`npm test` covers the three real examples, compatibility with the notebook's printed JSON, changed amounts, changes to the number and order of fields and questions, the new commute topic, passing valid edits through, parameter requests, null, unknown fields, unknown statuses, request failure/retry, synchronous errors, and canceling stale responses. The original 800 dynamic-response rendering combinations and the P0 regression tests are kept.

The same tests use Workspace's own reducer, request lifecycle, and the Quick/Guide display components directly. An architecture check ensures the production contracts and the display layer never import fixtures or example-matching rules.

The additional `tests/python-extraction.py` runs FastAPI in-process with a stubbed `_call_llm`, checks the copied prompt against notebook cell 4, and checks correction/date context and missing-key handling. It does not contact the provider or prove authentication works.

For maintained test commands, including the separate Python environment, see FRONTEND_README.md. Full ESLint passes in the clean team checkout. A local untracked `.agents/` installation may introduce unrelated lint issues; preserve it and use the documented application-scoped check as well.

## 6. Remaining integration gaps

These are implementation/verification gaps, not changes to the agreed contract:

- **Credentials:** OPENROUTER_API_KEY was absent; real extraction, correction and browser-to-provider behavior remain unverified. FastAPI needs environment configuration at startup, for example Uvicorn's `--env-file` option. A health response does not verify provider access.
- **Prompt semantics:** the prompt is an exact notebook copy, not a revised prompt enforcing all contract recommendations. Confirm numeric-month deadlines, stable core names, total expenses, source/null consistency and optional question_type with Grace. The notebook permits dates and inferred surplus.
- **Validation:** the Python models do not enforce unique variables, source/null equivalence or all status-dependent requirements. Structural validation does not guarantee semantically valid model output.
- **Timeouts:** the browser allows 90 seconds, but the proxy upstream times out after 55 seconds and can return 502 first.
- **Authentication:** the proxy can forward x-api-key, but Python does not validate it. API authentication is not complete.
- **Calculation scope:** the Python reference routes all calculations to one savings model. The apartment mock is unsupported; equivalent apartment data lacks its required goal amount. No new model was implemented, and successful extraction does not imply a supported calculation.
- **Dependencies:** the locked frontend install reported 16 advisories; no upgrades were applied. Python requirements are ranges, so installed versions can vary.
