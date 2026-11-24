from decimal import Decimal, ROUND_HALF_UP


def cents(value):
    return int(
        (Decimal(str(value).replace("$", "").replace(",", "")) * 100)
        .quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def money(amount_cents):
    return f"${amount_cents / 100:,.2f}"


def calculate(request: dict) -> dict:
    values = {
        a["variable"]: a.get("value")
        for a in request.get("assumptions", [])
    }
    values.update(request.get("extra_inputs", {}))

    def missing(key, question):
        return {
            "status": "needs_input",
            "message": "More information is needed to split the bill.",
            "missing_inputs": [{"variable": key, "label": question, "input_type": "text"}],
        }

    people = values.get("participants")
    method = values.get("split_method")

    if isinstance(people, str) and people.isdigit():
        people = int(people)

    if isinstance(people, int):
        if people <= 0:
            return missing("participants", "How many people are splitting the bill?")
        names = [f"Person {i + 1}" for i in range(people)]
    elif isinstance(people, list) and people:
        names = [str(p) for p in people]
    else:
        return missing("participants", "Who is splitting the bill?")

    if method not in ("equal", "itemized"):
        return missing("split_method", "Split evenly or by what each person ordered?")

    owed = {name: 0 for name in names}

    if method == "equal":
        total = values.get("total_bill")
        if total is None:
            return missing("total_bill", "What is the total bill, including tax and tip?")
        total_cents = cents(total)
        if total_cents < 0:
            return missing("total_bill", "Enter a nonnegative bill total.")
        base, remainder = divmod(total_cents, len(names))
        for i, name in enumerate(names):
            owed[name] = base + (1 if i < remainder else 0)

    else:
        items = values.get("items")
        if not isinstance(items, list) or not items:
            return missing("items", "List each item, its price, and who shared it.")

        for item in items:
            price = cents(item["amount"])
            owners = item["participants"]
            if price < 0 or not owners or any(p not in owed for p in owners):
                return missing("items", "Check the item amounts and participants.")
            base, remainder = divmod(price, len(owners))
            for i, name in enumerate(owners):
                owed[name] += base + (1 if i < remainder else 0)

        tax = cents(values.get("tax_amount") or 0)
        tip = cents(values.get("tip_amount") or 0)
        if tax < 0 or tip < 0:
            return missing("tax_amount", "Tax and tip must be nonnegative.")
        extras = tax + tip
        base, remainder = divmod(extras, len(names))
        for i, name in enumerate(names):
            owed[name] += base + (1 if i < remainder else 0)

    paid = values.get("amounts_paid")
    settlements = []

    if isinstance(paid, dict):
        balances = {
            name: cents(paid.get(name, 0)) - owed[name]
            for name in names
        }
        if sum(balances.values()) != 0:
            return missing("amounts_paid", "How much did each person actually pay?")

        debtors = [[n, -v] for n, v in balances.items() if v < 0]
        creditors = [[n, v] for n, v in balances.items() if v > 0]

        for debtor in debtors:
            for creditor in creditors:
                transfer = min(debtor[1], creditor[1])
                if transfer > 0:
                    settlements.append(
                        f"{debtor[0]} pays {creditor[0]} {money(transfer)}"
                    )
                    debtor[1] -= transfer
                    creditor[1] -= transfer

    return {
        "status": "ready",
        "answer": {
            "headline": "Bill split calculated."
        },
        "metrics": [
            {"label": name, "value": money(amount)}
            for name, amount in owed.items()
        ] + [
            {"label": "Settlement", "value": s}
            for s in settlements
        ],
        "explanations": [
            {"label": "Method", "text": f"Split method: {method}."}
        ],
        "assumptions": [],
        "limitations": [
            "Itemized tax and tip are split equally.",
            "For itemized bills, items must be provided as structured data.",
        ],
    }
