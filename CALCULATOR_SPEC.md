# Calculator requirements from the extraction prompt (for Sivani)

Source: `extraction.py` (prompt + 7 test scenarios). Request/response shapes are in `BACKEND_CONTRACT.md`.
Checked against the placeholder `backend_reference/savings_model.py` on 2026-10-19.

## Variables the extractor can emit

Always present (value `null` when `source` is `missing`):
`monthly_income`, `monthly_expenses`, `monthly_surplus`, `current_savings`, `goal_amount`, `goal_deadline` (months), `goal_description` (string).

Extra variables, present only when relevant:

| variable | unit | meaning | placeholder handles it? |
|---|---|---|---|
| `savings_floor_to_keep` | $ | savings the user won't spend | No. Ignored, so it can recommend using more savings than allowed |
| `debt_owed` | $ | money owed to a person (not monthly) | No |
| `parent_support` | $/occurrence | irregular money from family, frequency unknown, NOT included in income | No |
| `car_payment`, `student_loans`, `rent`, `current_rent`, `food_delivery`, ... | $/month | expense pieces; a total is only given when the list is complete | Ignored (uses totals only) |
| `goal_amount` with unit `$/month` | $/month | recurring cost increase (e.g. move: 1400 - 1000 = 400) | No. Treats every goal_amount as a one-time $ |

Notes:
- `monthly_income` may be pre-tax; `source_detail` says so when tax status is unknown, and the user is asked.
- When expenses are incomplete, `monthly_expenses` and `monthly_surplus` are `missing` on purpose.
- `goal_deadline` is rounded to whole months and labeled `inferred` when derived from a date.

## Results on the 6 harder scenarios (extract -> placeholder /calculate)

All six returned `needs_input` (correct, nothing guessed). Missing inputs after first extraction:

- S2 laptop: income, expenses
- S3 move: expenses, savings (goal is a $400/month increase, not a one-time cost)
- S4 Miami: income, expenses, savings, goal amount
- S5 car: expenses, savings, deadline
- S6 rent anxiety: income, expenses, goal amount (rent)
- S7 laptop: income, expenses, savings, deadline

So the UI mostly shows step 2 (questions) first, as intended. The calculator only matters after the user answers.

## Needed beyond the placeholder

1. Compare 2-3 scenarios (CLAUDE.md step 3), not one.
2. Respect `savings_floor_to_keep` and subtract `debt_owed` from usable savings.
3. Support a recurring-cost goal (`$/month`), e.g. "can I afford rent $400/month higher".
4. Return `unsupported` rather than a wrong answer for goal types it can't model.
