# Show Your Work

## Product Requirements Document

Version: October 7, 2026

Platform: Desktop first web app

Design direction: The third reference layout, where a natural language conversation produces one large working card within the conversation.

Phase 1 delivers a frontend prototype for reviewing, confirming, and editing assumptions. The real extraction service and production calculator will be connected later. API routes described here are proposed contracts. Grace's current notebook does not implement these routes.

## 1. Product objective

Users describe their financial situation and goal in natural language. The app organizes this information into an inspectable working card. Users can see which information they provided, which information the AI inferred, and which information is missing. They can correct the interpretation through editable fields, sliders, and clarification answers.

The target audience is college students and young adults. Phase 1 succeeds when users can identify information sources and correct misunderstandings, and when the interface accepts Grace's JSON format without relying on a fixed number or set of assumption cards.

## 2. Findings from Grace's Python prototype

The implementation reference is the notebook supplied in Pasted text.txt, particularly SYSTEM_PROMPT, call_llm, Simulated User Correction, and the apartment example.

| Current behavior | Requirement |
| :--- | :--- |
| call_llm(user_message: str) returns a Python dict | The frontend service must accept the equivalent JSON object |
| The response contains assumptions, clarification_questions, goal_summary, and confidence_note | Preserve these four field names |
| source uses stated, inferred, and missing | Accept these three source values in the API contract |
| The written schema specifies number or null, but actual goal_description values are strings and deadlines can be dates | Support number, string, and null; align the written schema with actual behavior during backend integration |
| The correction loop combines the original input, previous JSON, and new correction into a prompt | The API wrapper must preserve the same context structure |
| The notebook calls the model and prints results | Add a Python HTTP API before connecting the browser |
| The prompt prohibits calculations but also requests surplus, expense totals, and midpoints | Treat extracted calculated values as unverified; use a deterministic calculator for final results |
| The next May example assumes the current month is August | Do not reuse its nine month estimate; supply a reference date and ask users to confirm ambiguous deadlines |

Compatibility means that the frontend data contract and interactions are prepared for integration. It does not mean that the frontend is already connected to the notebook.

## 3. Screens and wireframe requirements

### A. Input state

The header contains Show Your Work and New question. The main area shows What's on your mind?, followed by a multiline text field and a primary Continue button. Supporting text invites users to describe their goal, known numbers, and uncertainties.

Phase 1 displays Demo mode. Sample inputs correspond to specific fixtures. Arbitrary input may remain in the text field, but must not produce an unrelated sample response that claims to understand the input. On submission of arbitrary text, show: “This version uses sample data. Please select an example.” Sample buttons must use text consistent with their fixtures.

### B. Extraction and loading state

Keep the user's input visible as conversation context. During loading, show a card skeleton and Reviewing your description. On failure, preserve the input and offer Retry. Do not display financial amounts or conclusions before a result is available.

### C. Assumptions review state

Place the large working card directly below the conversation context. Use a maximum width of approximately 960 to 1040 px. Organize information vertically and allow the entire page to scroll for long content.

Pinned means that the latest working card retains its identity and entry point within the conversation. The whole card must not be fixed to the viewport. If necessary, make only a compact card header sticky so that content remains accessible.

| Card area | Information | Interaction |
| :--- | :--- | :--- |
| Header | Here's what we understood and goal_summary | Edit the goal to submit a correction |
| Review summary | Counts of unconfirmed inferences and unanswered questions | Jump to outstanding items |
| You told us | Generic rows with source set to stated | Edit values and expand source_detail |
| We inferred | Generic rows with source set to inferred | Looks right, edit values, and expand source details |
| Still missing | Generic rows with source set to missing | Display missing values and link to clarification answers |
| Questions for you | All clarification_questions | Enter answers, expand why_it_matters, and Save answers |
| Extraction note | Original confidence_note text | Display the note without converting it into a confidence score |
| Card footer | Correction status and next action | Apply corrections and Preview example calculation |

Hide empty source groups. Preserve response order within each group. Multiple questions may target the same variable. Questions must not disappear merely because their target variable exists or has a value.

A missing assumption row displays Not provided yet and links to its question below. Avoid requiring the same answer in two places. If no corresponding question exists, provide a generic entry point for additional information.

### D. Scenario preview within the card

Scenario preview is a separate second step after assumption review. Phase 1 provides only a clearly scoped example for a savings goal, labeled Local example calculation. Keep its visuals and data separate from Grace's extraction output.

Show the goal amount, projected amount at the deadline, and remaining gap. Below these results, provide a Monthly contribution slider with a synchronized number input. An expandable Calculation details section shows formulas, actual inputs, and applicable conditions.

Do not automatically use current_savings as the amount allocated to the goal. Require an explicit allocation. If income, expenses, or the deadline have not completed review, identify the outstanding items before enabling preview. Other goal types still support assumption review, but display Calculator not connected for this scenario.

### E. Continued conversation

Keep an Add a correction field below the working card. A correction updates the current extraction rather than creating another conflicting plan. After a successful service response, replace the current card, show an update indicator, and retain the original input and correction history.

In Phase 1, arbitrary corrections remain pending drafts. Only predefined correction fixtures may simulate another extraction. Local field edits may take effect locally, but must display Local edit.

## 4. Visual requirements

Follow the third reference image: a warm background, a large white working card, rounded corners, and a spacious conversation area. Maintain clear contrast between the background and the card. Use subtle dividers to organize content.

Source badges use text with soft background colors. You told us uses a neutral or pale green treatment. We inferred uses pale purple. Still missing uses pale amber.

Colors communicate information sources rather than financial success or failure. Maintain readable contrast for values, labels, and source details. Actions must have clear text and remain available without hover. On desktop, short rows may align the label, value, and actions horizontally. Stack them on smaller screens. All content must fit at 320 px without horizontal overflow.

## 5. Generic assumption row

Use one AssumptionRow component that receives one assumption. Render rows dynamically through assumptions.map. Do not create separate hardcoded IncomeCard or SavingsCard components.

| Field | Display behavior |
| :--- | :--- |
| variable | Use known label mappings where available; otherwise replace underscores with spaces while retaining the original internal name |
| value | Format numbers, display strings, and show Not provided yet for null |
| unit | Display the original unit; omit additional unit text when it is an empty string |
| source | Map to the three source badges |
| source_detail | Expand Why this value? to show the complete original text |

Check for null before checking value types. Zero is a valid value. Preserve negative surplus values rather than converting them to zero. Keep unknown variables visible. Use a generic editor for unknown units without assuming their calculation meaning.

### Slider behavior

Explicitly configured editable numeric amounts and month counts may use a slider paired with a number input. Sliders support quick adjustment; number inputs support precise values. Unknown numeric variables default to a number input. Frontend display configuration may add slider behavior without excluding unknown variables.

Slider bounds and steps come from explicit display configuration. Do not infer them from source_detail prose. Display bounds and steps. Allow valid precise values beyond the initial slider range by extending that range. Do not silently clamp values. Missing values must not receive invented slider defaults before the user supplies a number.

Use text fields for strings. Use date inputs for explicit ISO dates. Preserve other date descriptions as text and request clarification. Preserve percentage units rather than formatting them as currency.

Derived values such as monthly_surplus are read only by default and provide Edit underlying values. If the user explicitly overrides a derived value, record it separately as User override and do not silently mix it with automatic calculations.

## 6. JSON contract

ExtractionResponse field names remain fixed. assumptions and clarification_questions are arrays of variable length. Preserve additional fields returned by the model without making the UI depend on them.

```typescript
type Source = 'stated' | 'inferred' | 'missing';
type AssumptionValue = number | string | null;
interface Assumption {
  variable: string;
  value: AssumptionValue;
  unit: string;
  source: Source;
  source_detail: string;
}
interface ClarificationQuestion {
  target_variable: string;
  question: string;
  why_it_matters: string;
}
interface ExtractionResponse {
  assumptions: Assumption[];
  clarification_questions: ClarificationQuestion[];
  goal_summary: string;
  confidence_note: string;
}
```

Validate response field types at runtime. Invalid source values or field types produce a response format error rather than being converted to stated. Empty arrays may display an empty state. A missing source should have a null value; inconsistent combinations must be flagged as data issues.

Preserve duplicate variable entries in the raw response and flag them for resolution. Do not silently overwrite them through an object map.

Mock fixtures retain this exact response shape. Do not add cards, status, or confidence_score fields. The supplied trip, laptop, and apartment fixtures cover different scenarios. The apartment fixture tests additional variables, strings, and dates. The trip fixture uses an explicitly stated eight month deadline rather than the notebook's unverified next May estimate.

## 7. Edits, confirmations, and provenance

Keep rawExtraction immutable. Maintain reviewState, draftOverrides, questionAnswers, and scenarioDraft separately in the frontend. These are not part of Grace's response schema.

Looks right records agreement with an inference by setting reviewState to confirmed. The source badge remains We inferred and may also display Confirmed by you. Confirmation must not rewrite an AI inference as something the user originally stated.

Editing a value or answering a question creates a pending correction. Local edits in Phase 1 display Local edit. When a real correction API returns new JSON, newly supplied user facts may become stated in the new response. Preserve the original response in history. Changes revoke affected confirmations and invalidate affected results.

A question may target a variable that already has a value. For example, a question targeting current_savings may ask how much the user is willing to allocate rather than their total savings. Store the answer as question content and send it as a correction. Do not replace total current_savings of $1,200 with an allocation answer of $500.

If target_variable does not exist in assumptions, still render the question and save its answer. Do not fabricate an existing assumption. The backend may add a corresponding assumption in a later response.

Saving an answer submits information but does not automatically resolve the question. In live mode, the new clarification_questions response determines which questions remain. In demo mode, display Answer saved locally through local review state and preserve the original question.

## 8. Service layer and future Python integration

Frontend components call ExtractionService rather than calling the model directly.

```typescript
interface ExtractionService {
  extract(request: ExtractRequest): Promise<ExtractionResponse>;
  correct(request: CorrectionRequest): Promise<ExtractionResponse>;
}
interface ExtractRequest {
  user_message: string;
  reference_date: string;
  timezone: string;
}
interface CorrectionRequest extends ExtractRequest {
  previous_extraction: ExtractionResponse;
  user_correction: string;
}
```

MockExtractionService reads fixtures and accepts only matching sample inputs or predefined corrections. HttpExtractionService will implement the same methods. Inject the service into components so switching from mock to HTTP does not require changing the UI.

Proposed endpoints are POST /api/extract and POST /api/correct. Successful response bodies are ExtractionResponse objects. The UI does not parse provider response structures.

For extraction, the Python wrapper supplies the actual reference_date and timezone along with the original user_message, then calls Grace's call_llm. For correction, it reuses the notebook's original input, previous_extraction, and user_correction context structure while also supplying reference_date and timezone. Validate the returned dict before responding. Explicit date context is a necessary addition to the current notebook.

API failures use appropriate HTTP status codes and a separate error body:

```json
{
  "error": {
    "code": "EXTRACTION_FAILED",
    "message": "Please try again."
  }
}
```

Do not render error bodies as extraction responses.

Use an API on the same origin or explicitly configure CORS during deployment. The API base URL may be frontend configuration. Model credentials must remain in Python environment variables. The frontend must not call OpenRouter, Gemini, or Bedrock directly, and must not manage model selection or prompts.

Track request versions for extraction and correction, and coordinate them against the current card revision. A late response must not overwrite newer state. Prevent duplicate submissions while saving and preserve drafts on failure. Slider changes stay local. Submit one correction through Apply corrections rather than calling the LLM on every slider movement.

## 9. Calculator boundaries

Keep CalculatorService separate from ExtractionService. Calculator inputs are reviewed values and scenario configuration. Agree on the production calculator response contract with Sivani. Grace's existing response does not provide scenario_result or calculation_steps.

The Phase 1 savings example uses income, total expenses, savings allocated to the goal, goal amount, months, and monthly contribution. In the current fixture, income is $2,000, expenses are $1,650, and monthly available cash is $350. If the user explicitly allocates $500 of existing savings and contributes $300 per month, they accumulate $2,900 in eight months and remain $100 below a $3,000 goal.

Projected amount equals allocated savings plus monthly contribution multiplied by months. Monthly remaining cash equals income less total expenses less monthly contribution. The target gap equals goal amount less projected amount.

When contribution exceeds monthly available cash, display Cash flow exceeds available amount rather than a success state. This preview requires a positive integer month count. Zero or negative deadlines block the preview. Negative monthly available cash indicates that no monthly surplus can currently be allocated.

Example conditions are constant income and expenses, no interest, no unlisted costs or competing goals, and no automatic allocation of all savings. Display these conditions with results. Do not provide an unconditional You can afford it conclusion.

Do not add expense categories to the expense total again. Use the total as the calculation input and categories as explanatory components. Editing a category marks the old total and surplus as requiring recalculation. Recalculate only when category dependencies are explicitly configured and complete; otherwise request an updated total. Unknown expense variables do not automatically participate in calculations.

LLM source_detail text explains provenance and must not become an executable formula. Production Calculation details come from the deterministic calculator. Any changed calculation input invalidates the previous result. Scenario sliders modify scenarioDraft without changing confirmed financial facts.

## 10. Phase 1 scope

Required features are natural language input, sample selection, dynamic assumptions, source badges, expandable details, confirmations, numeric editing, text and date editing, clarification answers, local correction drafts, loading and error states, and a clearly scoped example calculation with sliders.

The real HTTP service may initially be represented by its contract and an unconnected implementation. Do not claim that integration is complete.

Later phases add the Python API wrapper, live extraction and correction, a production calculator, and additional scenario types. Accounts, bank connections, payments, My plans persistence across devices, and financial recommendations are outside Phase 1.

## 11. Acceptance criteria

| ID | Observable passing condition |
| :--- | :--- |
| A1 | The trip JSON renders all assumption rows without renaming fields |
| A2 | Additional apartment variables, including car payment, student loan payment, and both rent values, appear automatically |
| A3 | Null displays as missing, zero remains zero, and strings and dates are readable and editable |
| A4 | Every source_detail can be expanded, and source badges include text |
| A5 | Looks right does not change the original inferred source |
| A6 | Sliders and number inputs stay synchronized without silent clamping |
| A7 | Missing values do not receive invented default slider amounts |
| A8 | Questions targeting known values remain answerable, and savings allocation does not overwrite total current_savings |
| A9 | Questions targeting variables absent from assumptions remain visible and retain answers |
| A10 | Editing income does not leave old surplus values or results presented as current |
| A11 | Expense categories and expense totals are not counted twice |
| A12 | The example produces 500 + 300 × 8 = 2900, a gap of 100, and monthly remaining cash of 50 |
| A13 | Missing required inputs, negative monthly available cash, and invalid deadlines do not produce misleading success results |
| A14 | Arbitrary mock inputs and corrections are not presented as real AI extraction |
| A15 | Errors preserve user input and unsaved changes |
| A16 | Stale responses cannot overwrite newer requests; interactions support keyboard and touch |
| A17 | At 320, 736, and 1024 px, content does not overflow horizontally and floating elements do not obscure buttons |
| A18 | Replacing the service implementation preserves UI components and response field names |

## 12. Implementation prompt for Web Code

Provide this PRD and the JSON fixtures together with the following implementation instructions.

Build a desktop first React and TypeScript frontend for Show Your Work. Use the third reference layout: natural language conversation creates one large working card inside the conversation. Preserve a warm, calm visual style with a spacious central card, source badges, editable values, and a composer below the card. Stack content on narrow screens. Use a normal page scroll, and at most a compact sticky card header. Do not create accounts or a bank dashboard.

Start with an input view headed “What's on your mind?” and a textarea. Implement a clearly labeled demo mode with sample selectors for the provided trip, laptop, and apartment fixtures. Only sample inputs may return fixture results. Arbitrary text must remain a draft or show the demo limitation, rather than being paired with unrelated sample assumptions.

Use the exact ExtractionResponse interfaces in this PRD. Do not rename assumptions, clarification_questions, goal_summary, confidence_note, variable, value, unit, source, source_detail, target_variable, question, or why_it_matters. Accept number, string, or null values because Grace's actual output includes goal descriptions and dates. Validate incoming JSON at runtime. Preserve the raw response without mutating it.

Render every assumption dynamically from the assumptions array using one generic AssumptionRow. Group by stated, inferred, and missing. Use human readable labels with an underscore replacement fallback for unknown variables. Support arbitrary additional variables. Render null as Not provided yet, preserve zero and negative values, and support text and date editors. Do not hardcode a fixed set of cards. Unknown units and variables must remain visible.

Display source badges as You told us, We inferred, and Still missing. Add expandable source_detail. Looks right changes a separate reviewState only. It must not change inferred to stated. Keep rawExtraction, draftOverrides, questionAnswers, reviewState, and scenarioDraft separate. Show Local edit for local changes and preserve original provenance. Provide edit, save, and cancel states.

Use a slider together with a synchronized number input only for explicitly configured editable numeric variables. Show bounds and steps. Allow valid precise values beyond the initial range by extending the range. Do not initialize missing values to invented defaults. Derived values such as monthly_surplus should offer Edit underlying values. If an explicit override is allowed, keep it separate and visible. Do not run the LLM while a user drags a slider.

Render every clarification question, including questions about known values and target variables absent from assumptions. Keep question answers as correction content. Do not automatically replace the targeted assumption value, because a question about current_savings may ask how much to allocate rather than total savings. Show why_it_matters. Only a new service response can authoritatively remove resolved questions. In demo mode mark answers saved locally and keep the original extraction.

Provide an injected ExtractionService with extract and correct methods matching the PRD. Implement MockExtractionService for fixtures. Prepare a separate HttpExtractionService for the proposed /api/extract and /api/correct contracts, but do not claim those routes already exist. Send original user_message, reference_date, timezone, and for corrections previous_extraction and user_correction. Keep the response body as Grace's exact JSON shape. Never place model credentials or provider calls in browser code. Handle loading, retries, malformed responses, duplicate variables, and stale responses while preserving drafts.

Keep calculator data separate from extraction. Provide only the clearly labeled local example savings preview described in the PRD. Require reviewed income, expenses, deadline and explicit savings allocation. Monthly contribution is a scenario control, not a fact edit. Show projected balance, gap, cash remaining, and expandable deterministic calculations. Do not silently spend all current savings. Do not count total expenses and categories twice. Invalidate derived values when inputs change. Other scenarios may still review assumptions, but show calculator unavailable.

Verify every acceptance criterion in this PRD. Deliver clear setup instructions and show which single service binding will change when Grace's Python API becomes available. Use simple visible product language. Keep implementation details in developer documentation.
