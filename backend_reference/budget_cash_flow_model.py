
import re


def number(value):
    if value is None or isinstance(value, bool):
        return None
    match = re.search(r"-?\d[\d,]*(?:\.\d+)?", str(value))
    return float(match.group().replace(",", "")) if match else None


def money(value):
    return f"${value:,.2f}"


def calculate(request: dict) -> dict:
    values = {
        a["variable"]: number(a.get("value"))
        for a in request.get("assumptions", [])
    }
    values.update({
        k: number(v)
        for k, v in request.get("extra_inputs", {}).items()
    })

    def get(*keys):
        for key in keys:
            if values.get(key) is not None:
                return values[key]
        return None

    income = get("monthly_income")
    spending = get("monthly_spending", "monthly_expenses")
    surplus = get("monthly_surplus")
    old_cost = get("replaced_recurring_cost")
    new_cost = get("recurring_cost")

    if surplus is None and income is not None and spending is not None:
        surplus = income - spending

    missing = []

    if surplus is None:
        if income is None:
            missing.append(("monthly_income", "What is your monthly take-home income?"))
        if spending is None:
            missing.append(("monthly_spending", "What are your total monthly expenses?"))

    question = request.get("original_question", "").lower()
    replacement = (
        old_cost is not None or new_cost is not None
        or "switch" in question or "replace" in question
    )

    if replacement:
        if old_cost is None:
            missing.append(("replaced_recurring_cost", "What is the current monthly cost?"))
        if new_cost is None:
            missing.append(("recurring_cost", "What is the new monthly cost?"))

    if missing:
        return {
            "status": "needs_input",
            "message": "I need a little more information to calculate your budget.",
            "missing_inputs": [
                {"variable": key, "label": label, "unit": "$/month"}
                for key, label in missing
            ],
        }

    if replacement:
        change = new_cost - old_cost
        projected = surplus - change
        return {
            "status": "ready",
            "answer": {
                "headline": f"You would have {money(projected)} left each month."
            },
            "metrics": [
                {"label": "Current monthly surplus", "value": money(surplus)},
                {"label": "Spending change", "value": money(change)},
                {"label": "Projected monthly surplus", "value": money(projected)},
                {"label": "Affordability status",
                 "value": "Affordable within stated budget" if projected >= 0 else "Budget shortfall"},
            ],
            "explanations": [
                {"label": "Change in spending",
                 "text": f"{money(new_cost)} - {money(old_cost)} = {money(change)}"},
                {"label": "Projected surplus",
                 "text": f"{money(surplus)} - {money(change)} = {money(projected)}"},
            ],
            "assumptions": [],
            "limitations": ["Assumes all other income and expenses stay the same."],
        }

    return {
        "status": "ready",
        "answer": {
            "headline": f"You have {money(surplus)} left each month."
        },
        "metrics": [
            {"label": "Monthly surplus", "value": money(surplus)}
        ],
        "explanations": [
            {"label": "Monthly cash flow",
             "text": f"{money(income)} - {money(spending)} = {money(surplus)}"
             if income is not None and spending is not None
             else "Based on your stated monthly surplus."}
        ],
        "assumptions": [],
        "limitations": ["Assumes the stated monthly budget is complete."],
    }
