"""Reference calculation: "Can I afford a goal by a deadline?"  (pure Python, no dependencies)

This is the TEMPLATE for the calculation teammate. Copy the pattern for new question types:
    request dict in  ->  response dict out, following BACKEND_CONTRACT.md.
Rules this file demonstrates:
  * Read only the variables you need; ignore everything else.
  * Never guess a missing input -> return status "needs_input" with `missing_inputs`.
  * If the question is not your model's kind -> return status "unsupported" (honest > wrong).
  * `parameters` in the request holds ONLY what the user changed; missing key = your default.
  * All numbers shown to the user are pre-formatted strings you create.
"""
from __future__ import annotations
import math

CORE = {
    "monthly_income": ("$/month", "What is your monthly income after tax?"),
    "monthly_expenses": ("$/month", "What are your total monthly expenses?"),
    "current_savings": ("$", "How much do you currently have saved?"),
    "goal_amount": ("$", "How much does this goal cost?"),
    "goal_deadline": ("months", "How many months until you need the money?"),
}
SUPPORTED_TYPES = {None, "save_for_goal"}   # Grace may add a top-level `question_type` later


def money(n: float) -> str:
    s = f"{n:,.2f}"
    return "$" + (s[:-3] if s.endswith(".00") else s)


def _to_number(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        x = float(str(v).replace(",", "").replace("$", "").strip())
    except ValueError:
        return None
    return x if math.isfinite(x) and x >= 0 else None


def calculate(req: dict) -> dict:
    meta = req.get("extraction_meta") or {}
    if meta.get("question_type") not in SUPPORTED_TYPES:
        return _unsupported("This looks like a different kind of question than a savings goal. A calculation model for it hasn't been added yet.")

    variables = {a["variable"] for a in req["assumptions"]} | set(req.get("extra_inputs", {}))
    if "goal_amount" not in variables:
        return _unsupported("This question doesn't have a savings goal, and the savings calculator is the only model available so far.")

    # 1. Collect inputs (first non-null wins; extra_inputs cover variables the extraction never mentioned)
    values: dict[str, float] = {}
    for a in req["assumptions"]:
        n = _to_number(a["value"]) if a["variable"] in CORE else None
        if n is not None and a["variable"] not in values:
            values[a["variable"]] = n
    for k, v in req.get("extra_inputs", {}).items():
        n = _to_number(v) if k in CORE else None
        if n is not None and k not in values:
            values[k] = n

    # 2. Ask for anything missing; never guess
    missing = [v for v in CORE if v not in values or (v == "goal_deadline" and (values[v] < 1 or values[v] != int(values[v])))]
    if missing:
        return {
            "status": "needs_input",
            "message": "A few details are needed before we can calculate an answer.",
            "missing_inputs": [{"variable": v, "unit": CORE[v][0], "label": CORE[v][1]} for v in missing],
        }

    income, expenses, savings = values["monthly_income"], values["monthly_expenses"], values["current_savings"]
    goal, months = values["goal_amount"], int(values["goal_deadline"])
    available = income - expenses
    if available < 0:
        return {
            "status": "needs_input",
            "message": "Monthly expenses are higher than income. Please double-check these two amounts.",
            "missing_inputs": [{"variable": v, "unit": CORE[v][0], "label": CORE[v][1]} for v in ("monthly_income", "monthly_expenses")],
        }

    # 3. Parameters: user's value if they changed it, otherwise our default
    p = req.get("parameters", {})
    default_contribution = min(math.ceil(goal / months * 100) / 100, available)
    contribution = p.get("monthly_contribution", default_contribution)
    gap_without_savings = max(0.0, goal - contribution * months)
    needed = max(0.0, math.ceil((gap_without_savings - 1e-8) * 100) / 100)
    used = p.get("use_from_savings", min(needed, savings))
    used = min(used, savings)

    projected = used + contribution * months
    gap = round(max(0.0, goal - projected), 2)
    remaining = available - contribution

    # 4. Build the response. {monthly_contribution} in the headline becomes an inline editable number.
    if contribution > available:
        headline = "This monthly saving amount is more than your available cash."
        status = "conditional"
    elif gap > 0:
        headline = f"No, saving {{monthly_contribution}} per month still leaves a {money(gap)} shortfall."
        status = "conditional"
    elif used > 0:
        headline = f"Yes, if you save {{monthly_contribution}} per month, you'll use {money(used)} from your existing savings."
        status = "conditional"
    else:
        headline = "Yes, if you save {monthly_contribution} per month, you won't need your existing savings."
        status = "conditional"

    return {
        "status": status,
        "answer": {"headline": headline, "detail": "Based on the values and assumptions shown here."},
        "parameters": [
            {"key": "monthly_contribution", "label": "Save each month", "value": round(contribution, 2), "unit": "$", "min": 0, "max": round(max(available, contribution), 2), "step": 0.01},
            {"key": "use_from_savings", "label": "Use from existing savings", "value": round(used, 2), "unit": "$", "min": 0, "max": savings, "step": 0.01},
        ],
        "metrics": [
            {"label": "Goal amount", "value": money(goal)},
            {"label": "Projected at deadline", "value": money(projected)},
            {"label": "Remaining gap", "value": money(gap)},
            {"label": "Monthly cash remaining", "value": money(remaining)},
        ],
        "explanations": [
            {"label": "Monthly available cash", "text": f"{money(income)} − {money(expenses)} = {money(available)}"},
            {"label": "Projected savings", "text": f"{money(used)} + {money(contribution)} × {months} months = {money(projected)}"},
            {"label": "Remaining gap", "text": f"max(0, {money(goal)} − {money(projected)}) = {money(gap)}"},
        ],
        "assumptions": [
            {"id": "starting-contribution", "text": f"Would saving {money(contribution)} each month work for you?", "parameter_key": "monthly_contribution", "review_label": "Review"},
            {"id": "constant-values", "text": "Income and spending stay constant. No interest, unlisted costs, or competing goals are included."},
        ],
        "limitations": ["A proposed savings amount is not a user commitment."],
    }


def _unsupported(message: str) -> dict:
    return {"status": "unsupported", "message": message}
