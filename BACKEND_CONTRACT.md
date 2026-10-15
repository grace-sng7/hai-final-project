# Backend contract (v1) — the frontend is fixed, the backend adapts to this

The frontend is finished against this contract. **Backend code should be written to match it; please don't
change field names.** If something here is infeasible, tell Phoebe which line and why, and we'll adjust the doc first.

```
Browser ──> Next.js (/api/backend/*, proxy) ──> Python FastAPI (BACKEND_URL)
                                                  ├─ POST /extract    (Grace)   text -> assumptions JSON
                                                  ├─ POST /correct    (Grace)   previous JSON + correction -> new JSON
                                                  └─ POST /calculate  (Calc teammate)  assumptions + user edits -> answer
```

A working skeleton lives in `backend_reference/` (FastAPI + Pydantic + one example calculation). Copy it, don't start from zero.

| Who | Owns | Files in `backend_reference/` |
|---|---|---|
| Grace | `/extract`, `/correct` | `extraction_service.py` (paste the notebook prompt in) |
| Calculation teammate | `/calculate` | `savings_model.py` (template), add one module per question type |
| Shared | field names / JSON shapes | `contract.py` (Pydantic models = this document) |

All bodies are JSON. On failure return a non-2xx status with `{"detail": "short human-readable reason"}`
(FastAPI's `HTTPException` does exactly this). The UI shows a retry message and keeps the user's edits.

---

## 1. `POST /extract`  (Grace)

Request
```json
{ "user_message": "I make $2,500 a month ...", "reference_date": "2026-10-15", "timezone": "America/New_York" }
```
Response: **exactly the notebook schema** (unchanged). Extra top-level fields are allowed and passed through.
```json
{ "assumptions": [ { "variable": "monthly_income", "value": 2500, "unit": "$/month", "source": "stated", "source_detail": "..." } ],
  "clarification_questions": [ { "target_variable": "current_savings", "question": "...", "why_it_matters": "..." } ],
  "goal_summary": "...", "confidence_note": "..." }
```
Rules the frontend relies on
- `value` is a number, a string, or `null`. `source: "missing"` **if and only if** `value` is `null`.
- `source` is one of `stated | inferred | missing`. `unit` may be `null`.
- `variable` names must be unique within one response (don't output the same variable twice).

Requests to Grace (feasibility-checked against the notebook; all are prompt-level changes)
1. **Use `reference_date`.** Put it in the prompt so "next May" / "by February" become a correct number of months. (`extraction_service.py` already does this.)
2. **Keep these core names stable** — the calculator reads them: `monthly_income`, `monthly_expenses`, `current_savings`, `goal_amount`, `goal_deadline` (months, number), `goal_description`. Other names are fine; they are shown to the user and forwarded, not interpreted.
3. **`monthly_expenses` is the total.** If you also output categories (`monthly_expenses_rent`, ...), the calculator will use the total only and never add categories on top.
4. *Recommended:* add a top-level `"question_type"`: `"save_for_goal"` (a goal amount by a deadline) or `"other"`. The calculator uses it to decide whether it can answer. It passes through automatically.
5. *Nice to have:* don't compute `monthly_surplus` yourself; the calculator does arithmetic. Leave it `missing` or drop it.

## 2. `POST /correct`  (Grace)

Request = the `/extract` request plus:
```json
{ "...": "...", "previous_extraction": { "...the full /extract response..." }, "user_correction": "monthly_income: 1800\nmonthly_expenses: 1300" }
```
`user_correction` is plain text assembled by the UI (`variable: value` lines and/or free text). Response: same schema as `/extract`.

## 3. `POST /calculate`  (Calculation teammate)

Called on every edit, including each slider movement → **must be stateless and fast (< 1 s). No LLM calls here.**

Request
```json
{
  "original_question": "...",
  "assumptions": [ { "variable": "monthly_income", "value": 1800, "unit": "$/month", "source": "stated",
                     "source_detail": "Edited by the user", "edited_by_user": true } ],
  "extra_inputs": { "some_variable_not_in_extraction": 12 },
  "answers": [ { "target_variable": "current_savings", "question": "...", "answer": "about half of it" } ],
  "parameters": { "monthly_contribution": 150 },
  "extraction_meta": { "goal_summary": "...", "confidence_note": "...", "question_type": "save_for_goal" }
}
```
- `assumptions`: the extraction with the user's edits **already applied**. Read from here. `source` is `missing` when value is `null`.
- `extra_inputs`: values the user typed for variables you asked for (`missing_inputs`) that the extraction never contained.
- `answers`: free-text replies to Grace's questions. Optional to use; ignoring them is allowed.
- `parameters`: **only the what-if values the user changed**. A missing key means "use your default".
- `extraction_meta`: all other top-level extraction fields (e.g. `question_type`).
- Treat derived values (`monthly_surplus`, totals) as hints; recompute from raw inputs.

Response
```json
{
  "status": "conditional",
  "answer": { "headline": "Yes, if you save {monthly_contribution} per month, you'll use $200 from your savings.",
              "detail": "Based on the values and assumptions shown here." },
  "parameters": [ { "key": "monthly_contribution", "label": "Save each month", "value": 350, "unit": "$", "min": 0, "max": 350, "step": 0.01 } ],
  "metrics":      [ { "label": "Goal amount", "value": "$3,000" } ],
  "explanations": [ { "label": "Monthly available cash", "text": "$2,000 − $1,650 = $350" } ],
  "assumptions":  [ { "id": "start", "text": "Would saving $350 each month work for you?", "parameter_key": "monthly_contribution", "review_label": "Review" },
                    { "text": "Income and spending stay constant." } ],
  "limitations":  [ "A proposed savings amount is not a user commitment." ]
}
```

| `status` | When | Required fields |
|---|---|---|
| `ready` | Answer is firm. | `answer` |
| `conditional` | Answer depends on assumptions/what-if values (most answers). | `answer` |
| `needs_input` | Something required is missing. **Never guess it.** | `message`, `missing_inputs` |
| `unsupported` | Not a question your model can answer. Honest beats wrong. | `message` |

Field notes
- Every list field is optional (omit or `[]`/`null`). All numbers shown to the user are **strings you format** (`"$3,000"`), except `parameters[].value/min/max/step`, which are numbers.
- `missing_inputs`: `[{ "variable": "monthly_income", "unit": "$/month", "label": "What is your monthly income?", "help": "why it matters", "input_type": "number" }]`. Only `variable` is required; `input_type` is `number` (default), `text` or `date`.
- `parameters`: each becomes a what-if control. Give both `min` and `max` to get a slider, otherwise a number box. `key`: letters, digits, `_`, `-`. `unit: "$"` shows a currency symbol. Return the value you actually used (the user's, or your default).
- `{key}` placeholders in `answer.headline` turn into editable numbers inside the sentence (optional). Unknown keys are left as text.
- `assumptions[].parameter_key` (optional) attaches an edit button to that assumption.
- Don't return HTML, URLs, or code; text only.

## Adding a new kind of question (calculation teammate)
1. New module with `calculate(req: dict) -> dict` like `savings_model.py`.
2. In `main.py`, choose the module from `req.extraction_meta.get("question_type")` (or by which variables exist).
3. Return `needs_input` for missing inputs, `unsupported` when unsure. Add a request/response pair to `backend_reference/examples/`
   (`name.request.json`, `name.response.json`, `name.extraction.json`) — `npm test` checks every pair against the frontend.

## Run it all locally
```bash
# backend (terminal 1)
cd backend_reference && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENROUTER_API_KEY=...          # Grace's key; only needed for /extract and /correct
uvicorn main:app --reload --port 8000  # test pages: http://localhost:8000/docs

# frontend (terminal 2, repo root)
cp env.example .env.local              # sets NEXT_PUBLIC_BACKEND_MODE=live and BACKEND_URL
npm install && npm run dev             # http://localhost:3000
```
Remove `.env.local` (or set `NEXT_PUBLIC_BACKEND_MODE=demo`) to return to the sample-only demo.
`/calculate` can be developed with no LLM and no Grace code: POST any `examples/*.request.json` to it.

## Known limits of v1 (deliberate)
- One calculation model (savings goal) ships as the reference. Other questions return `unsupported`, and the UI says so honestly.
- No accounts, no persistence: state lives in the browser tab.
- No streaming; `/extract` may take several seconds (UI shows a loading state, 90 s timeout).
