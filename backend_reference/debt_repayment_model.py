
"""Debt repayment calculator with monthly compounding."""

from decimal import Decimal, ROUND_HALF_UP


def dec(value):
    try:
        return Decimal(str(value).replace("$", "").replace(",", "").replace("%", ""))
    except Exception:
        return None


def rounded(value):
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def money(value):
    return f"${value:,.2f}"


def calculate(request: dict) -> dict:
    values = {
        a["variable"]: a.get("value")
        for a in request.get("assumptions", [])
    }
    values.update(request.get("extra_inputs", {}))

    def need(key, label):
        return {
            "status": "needs_input",
            "message": "I need another detail to calculate debt repayment.",
            "missing_inputs": [
                {"variable": key, "label": label, "input_type": "number"}
            ],
        }

    principal = dec(values.get("principal_balance", values.get("balance")))
    apr = dec(values.get("apr"))
    payment = dec(values.get("monthly_payment"))
    months = dec(values.get("payoff_months"))

    if principal is None:
        return need("principal_balance", "What is your outstanding balance?")
    if apr is None:
        return need("apr", "What is the annual percentage rate (APR)?")
    if principal < 0 or apr < 0:
        return {
            "status": "unsupported",
            "message": "Balance and APR must be nonnegative.",
        }

    monthly_rate = apr / Decimal("1200")

    # Find the payment required to clear debt by a deadline.
    if payment is None and months is not None:
        if months <= 0 or months != int(months):
            return need("payoff_months", "Enter a positive whole number of months.")

        if monthly_rate == 0:
            payment = rounded(principal / months)
        else:
            factor = (1 + monthly_rate) ** int(months)
            payment = rounded(
                principal * monthly_rate * factor / (factor - 1)
            )

        # Round up to ensure the payment is sufficient.
        if payment * months < principal and monthly_rate == 0:
            payment += Decimal("0.01")

        return {
            "status": "ready",
            "answer": {
                "headline": f"You need approximately {money(payment)} per month."
            },
            "metrics": [
                {"label": "Required monthly payment", "value": money(payment)}
            ],
            "explanations": [
                {"label": "Payoff period", "text": f"{int(months)} months at {apr}% APR."}
            ],
            "assumptions": [],
            "limitations": ["Assumes fixed APR and no fees or new charges."],
        }

    if payment is None:
        return need("monthly_payment", "How much will you pay each month?")

    if payment <= 0:
        return need("monthly_payment", "Enter a positive monthly payment.")

    if principal == 0:
        return {
            "status": "ready",
            "answer": {"headline": "The balance is already paid off."},
            "metrics": [
                {"label": "Estimated payoff months", "value": "0"},
                {"label": "Total interest", "value": "$0.00"},
            ],
            "assumptions": [],
            "limitations": [],
        }

    if payment <= rounded(principal * monthly_rate):
        return {
            "status": "conditional",
            "answer": {
                "headline": "This payment is too low to reliably pay off the debt."
            },
            "metrics": [],
            "explanations": [],
            "assumptions": [],
            "limitations": ["Increase the payment to cover interest and reduce principal."],
        }

    balance = principal
    total_interest = Decimal("0")
    count = 0
    final_payment = Decimal("0")

    while balance > 0 and count < 1200:
        interest = rounded(balance * monthly_rate)
        due = balance + interest
        actual = min(payment, due)
        balance = rounded(due - actual)
        total_interest += interest
        final_payment = actual
        count += 1

    if balance > 0:
        return {
            "status": "unsupported",
            "message": "The payoff exceeds the model's 100-year calculation limit.",
        }

    return {
        "status": "ready",
        "answer": {
            "headline": f"You can pay off the debt in {count} months."
        },
        "metrics": [
            {"label": "Estimated payoff months", "value": str(count)},
            {"label": "Total interest", "value": money(total_interest)},
            {"label": "Final payment", "value": money(final_payment)},
            {"label": "Total repayment", "value": money(principal + total_interest)},
        ],
        "explanations": [
            {"label": "Interest", "text": f"Fixed APR: {apr}%, charged monthly."}
        ],
        "assumptions": [],
        "limitations": ["Assumes no fees, new charges, or APR changes."],
    }
