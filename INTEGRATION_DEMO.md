# Midterm integration checkpoint

Branch: `phoebe/midterm-integration-v1`, based on `origin/main` (`1836fdd`).
Imported the calculator and its tests from `origin/calculator` (`5c66730`).
The FastAPI `/calculate` route now uses `savings_goal_model`; the existing extraction,
wire adapters, proxy, UI, and What If controls are retained. No new financial models.

## Run the offline presentation demo (default)

The preview at http://127.0.0.1:3000 uses the original extraction fixtures from
`midterm-presentation-demo`. Click an example to load it immediately:

- **Clean Trip (Complete Information):** $2,500 income, $1,800 expenses, $2,000 savings,
  $3,500 goal in six months. Saving $200/month leaves a $300 gap.
- **Laptop (Missing Information):** the known gap is $500. Provide two of income,
  total expenses and deadline, then skip the last input to explore it hypothetically.
  Try $1,800 income, $1,300 expenses, four months; then change the contribution.
- **Messy Europe Trip (Ambiguous Information):** original amounts, source details,
  clarification questions, and confidence note are preserved. Its saved deadline is
  nine months inferred from August; this fixture does not update relative to today.
  Review or edit that assumption before treating the result as a current-date estimate.

Choose Quick Calculate to see the answer and What If controls, or use Step-by-Step
Guide to review all information, questions, explanations, and the answer. Use New
question to return to the example selector. Numeric edits and What If changes use
the integrated calculator. New prose corrections remain drafts in offline mode;
edit assumptions and missing-input fields directly.

Offline here means **no external model or API key**. Both local servers are needed:

```sh
# Backend terminal (activate your backend virtual environment first)
python -m uvicorn main:app --app-dir backend_reference --host 127.0.0.1 --port 8000
# Frontend terminal
npm run dev -- --hostname 127.0.0.1 --port 3000
```

`.env.local` is ignored by git and currently contains:

```dotenv
NEXT_PUBLIC_BACKEND_MODE=offline
BACKEND_URL=http://localhost:8000
```

The temporary backend test environment is `/private/tmp/hai-integration-venv`.
Use its `bin/python` for the backend command if needed. No old demo calculator is
used by this flow: saved extraction -> existing request adapter -> Next.js proxy ->
FastAPI `/calculate` -> `savings_goal_model` -> existing UI.

## Restore live extraction later

Set `NEXT_PUBLIC_BACKEND_MODE=live` in `.env.local` and provide `OPENROUTER_API_KEY`
in the **backend** process environment. Restart/rebuild Next.js after changing the
public mode flag. The original live extraction/correction services and routes remain
available. No credentials are needed for the offline examples.

## Verification

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
python -m pip install pytest
python -B -m pytest -q -p no:cacheprovider backend_reference/test_savings_goal_model.py
python -B tests/python-extraction.py
PYTHON=/path/to/backend/venv/bin/python npm run test:integration
```

The integration test uses real frontend reducers, HTTP adapters, response validation,
rendering, FastAPI endpoints and calculator arithmetic. Only the external extraction
provider is stubbed. It checks edits, missing inputs, slider changes, and clamped values.

## Remaining limits

- In live mode, a real provider extraction/correction call requires `OPENROUTER_API_KEY` and has not
  been verified in this session. Offline extraction tests do not establish provider access.
- Alternative plans are explanations, using the existing UI; complete calculations expose contribution controls, and a skipped input
  exposes one hypothetical slider.
- The model assumes constant income/spending, no interest, and reserves debts from
  savings immediately. It is not a full budget forecast.
- The older reference calculator remains as historical reference but is no longer routed.

## Unresolved inputs and conditional exploration

At most **one** required independent input may be simulated. Income, total expenses,
and deadline count separately. Derived surplus, output metrics, and irrelevant fields
are excluded. With two or more missing inputs, both modes ask for more information
and show only directly calculable facts. Skip is available on every question. Selecting one disables the other Skip buttons;
the remaining questions must still be answered. With one missing input, the selected
Skip unlocks exactly one hypothetical slider. “Answer instead” releases that selection.
All other provided inputs stay fixed. The result is labeled conditional, with a direct Yes/No summary qualified by
“Based on your selected assumptions.” Supplying the final actual input restores the existing
complete calculator flow.

Laptop recording: open Quick Calculate, enter $1,800 income and $1,300 expenses
(press Enter or leave each field), then click Skip beside deadline. Explore the
hypothetical deadline slider; only that variable changes. A four-month scenario
projects $3,500 including $1,500 savings. The known goal-minus-savings gap remains
$500. You can instead supply any other pair of income, expenses, and deadline.

Provided values appear in Your Information; derived values remain labeled as
inferred. Missing inputs appear in Questions for You. Assumed slider values are
labeled Hypothetical, and calculated metrics remain outputs. Scenario settings use
`hypothetical_` parameter keys and variable-specific `skip_input_` permissions. They
never become fact edits, confirmations, or extraction corrections. Skip permission
for one variable does not authorize a different unknown variable.
