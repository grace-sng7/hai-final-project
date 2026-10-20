"""
Savings-goal calculator for POST /calculate  (BACKEND_CONTRACT.md v1).

    from savings_goal_model import calculate
    response_dict = calculate(request_dict)

Pure Python, stateless, no LLM calls. All arithmetic lives here.
Handles one-time goals ($) and recurring-cost goals ($/month).
"""
import math
import re
from dataclasses import dataclass, replace

# Variables that are not ordinary monthly expense categories.
NON_EXPENSE = {
    "monthly_income", "monthly_expenses", "monthly_surplus", "current_savings",
    "goal_amount", "goal_deadline", "goal_description",
    "savings_floor_to_keep", "debt_owed", "parent_support",
}
# Categories we never suggest cutting in a plan.
DONT_CUT = re.compile(r"rent|housing|mortgage|tuition|loan|insurance|utilit|debt|payment", re.I)

# variable -> (unit, question shown to the user, why it matters)
INPUT_INFO = {
    "monthly_income": ("$/month", "What is your monthly income?",
                       "It sets how much you can set aside each month."),
    "monthly_expenses": ("$/month", "What do you spend in a typical month, in total?",
                         "Rent, food, bills, subscriptions: everything. Savings come from what is left."),
    "current_savings": ("$", "How much do you have saved right now?",
                        "This is what you could draw on if monthly saving falls short."),
    "goal_amount": ("$", "How much does your goal cost?",
                    "It is the target your savings plan is compared against."),
    "savings_floor_to_keep": ("$", "How much savings do you want to keep untouched?",
                              "This amount will not be used for the goal."),
    "debt_owed": ("$", "How much do you owe?",
                  "This is reserved from savings before planning the goal."),
    "goal_deadline": ("months", "How many months from now do you need it?",
                      "A shorter deadline means saving more each month."),
}


# ------------------------------------------------------------------ helpers

def money(x: float) -> str:
    if abs(x) < 0.005:
        x = 0.0
    sign = "-" if x < 0 else ""
    x = abs(x)
    return f"{sign}${x:,.0f}" if abs(x - round(x)) < 0.005 else f"{sign}${x:,.2f}"


def _num(v):
    """Accept 1800, '1800', '$1,800' or '6 months'; return float or None."""
    if v is None or isinstance(v, bool):
        return None
    try:
        # Accept a single number with an optional currency or months suffix.
        # Never silently turn ranges, prose, or scientific notation into another number.
        cleaned = str(v).strip().replace(",", "").replace("$", "")
        cleaned = re.sub(r"\s+months?$", "", cleaned, flags=re.I)
        n = float(cleaned)
    except (ValueError, TypeError, OverflowError):
        return None
    return n if math.isfinite(n) else None


def _pretty(name: str) -> str:
    return name.replace("monthly_expenses_", "").replace("_", " ")


# ------------------------------------------------------------------ model

@dataclass(frozen=True)
class Scenario:
    goal_type: str                 # "one_time" or "recurring"
    current_savings: float
    monthly_income: float
    expenses: dict                 # $/month pieces; always sums to the stated total
    goal_amount: float             # $ if one_time, $/month if recurring
    deadline_months: int = 0       # one_time only
    savings_floor: float = 0.0     # savings the user won't spend
    debt_owed: float = 0.0         # owed to a person; comes out of savings

    @property
    def surplus(self) -> float:
        return self.monthly_income - sum(self.expenses.values())

    @property
    def usable_savings(self) -> float:
        return self.current_savings - self.debt_owed - self.savings_floor


def contribution_for(s: Scenario, requested=None) -> float:
    """Monthly amount set aside. Can't exceed the surplus; a deficit erodes savings."""
    sur = math.floor((s.surplus + 1e-9) * 100) / 100
    if sur <= 0:
        return sur
    return sur if requested is None else min(max(requested, 0.0), sur)


def evaluate(s: Scenario, requested=None) -> dict:
    if s.goal_type == "one_time":
        n, c = s.deadline_months, contribution_for(s, requested)
        saved = c * n
        balance = s.usable_savings + saved
        margin = balance - s.goal_amount
        need = s.goal_amount - s.usable_savings
        if need <= 0:
            months = 0
        elif c > 0:
            months = math.ceil(need / c - 1e-9)
        else:
            months = None
        return {
            "goal_type": "one_time", "surplus": s.surplus, "contribution": c,
            "usable_savings": s.usable_savings, "saved": saved,
            "draw": max(0.0, s.goal_amount - saved),      # taken from savings
            "balance": balance, "margin": margin,
            "shortfall": max(0.0, -margin), "months_to_goal": months,
            "min_monthly_saving": max(0.0, need) / n if n > 0 else None,
            "feasible": margin >= -0.005,
        }
    new_surplus = s.surplus - s.goal_amount
    if new_surplus >= 0:
        cushion = None
    elif s.usable_savings > 0:
        cushion = math.floor(s.usable_savings / -new_surplus)
    else:
        cushion = 0
    return {
        "goal_type": "recurring", "surplus": s.surplus,
        "usable_savings": s.usable_savings, "new_surplus": new_surplus,
        "gap": max(0.0, -new_surplus), "cushion_months": cushion,
        "feasible": new_surplus >= 0,
    }


def _outcome(s: Scenario) -> float:
    e = evaluate(s)
    return e["margin"] if s.goal_type == "one_time" else e["new_surplus"]


# ------------------------------------------------------------------ plans

def _cut(s: Scenario, cat: str, amount: float) -> Scenario:
    e = dict(s.expenses)
    e[cat] = max(0.0, e[cat] - amount)
    return replace(s, expenses=e)


def make_plans(s: Scenario, requested=None) -> dict:
    """Up to 3 deterministic alternatives {name: Scenario}. Empty if already feasible."""
    base = evaluate(s)
    if evaluate(s, requested)["feasible"]:
        return {}
    if base["feasible"]:
        return {f"Save {money(s.surplus)} each month": s}
    plans = {}
    cuttable = {k: v for k, v in s.expenses.items() if not DONT_CUT.search(k) and v > 0}

    if s.goal_type == "one_time":
        if cuttable and s.deadline_months > 0:
            cat = max(cuttable, key=cuttable.get)
            amt = min(math.ceil(base["shortfall"] / s.deadline_months), cuttable[cat])
            plans[f"Cut {_pretty(cat)} by {money(amt)}/month"] = _cut(s, cat, amt)
        m = base["months_to_goal"]
        if m is not None and m > s.deadline_months:
            plans[f"Delay the goal by {m - s.deadline_months} months"] = replace(s, deadline_months=m)
        reachable = max(0.0, s.usable_savings + s.surplus * s.deadline_months)
        plans[f"Lower the goal to {money(reachable)}"] = replace(s, goal_amount=reachable)
    else:
        if cuttable:
            cat = max(cuttable, key=cuttable.get)
            amt = min(math.ceil(base["gap"]), cuttable[cat])
            plans[f"Cut {_pretty(cat)} by {money(amt)}/month"] = _cut(s, cat, amt)
        if s.surplus > 0:
            plans[f"Limit the increase to {money(s.surplus)}/month"] = replace(s, goal_amount=s.surplus)
    return plans


def sensitivity(s: Scenario, delta: float = 0.10) -> list:
    """Rank assumptions by how much a +/-10% change moves the outcome."""
    knobs = {
        "monthly_income": lambda f: replace(s, monthly_income=s.monthly_income * f),
        "current_savings": lambda f: replace(s, current_savings=s.current_savings * f),
        "goal_amount": lambda f: replace(s, goal_amount=s.goal_amount * f),
    }
    for c in s.expenses:
        knobs[c] = lambda f, c=c: replace(s, expenses={**s.expenses, c: s.expenses[c] * f})
    rows = [{"assumption": k, "swing": abs(_outcome(fn(1 + delta)) - _outcome(fn(1 - delta)))}
            for k, fn in knobs.items()]
    return sorted(rows, key=lambda r: r["swing"], reverse=True)


# ------------------------------------------------------------------ responses

def _needs_input(keys, message="I need a few more numbers before I can answer this."):
    return {
        "status": "needs_input", "message": message,
        "missing_inputs": [
            {"variable": k, "unit": INPUT_INFO[k][0], "label": INPUT_INFO[k][1],
             "help": INPUT_INFO[k][2], "input_type": "number"} for k in keys],
    }


def _unsupported(message):
    return {"status": "unsupported", "message": message}


def _describe_plan(ps: Scenario, pe: dict) -> str:
    if ps.goal_type == "one_time":
        verdict = "Meets the goal" if pe["feasible"] else "Still short"
        return (f"{verdict}: {money(pe['contribution'])}/month for {ps.deadline_months} months "
                f"plus {money(pe['usable_savings'])} of usable savings = {money(pe['balance'])} "
                f"vs a {money(ps.goal_amount)} goal.")
    verdict = "Affordable" if pe["feasible"] else "Still short"
    return f"{verdict}: monthly cash after the new cost would be {money(pe['new_surplus'])}."


def _unresolved(req, val, missing, goal_type):
    """Explore exactly one missing model input, only after an explicit Skip."""
    budget_unknown = any(k in missing for k in ("monthly_income", "monthly_expenses"))
    independent = list(missing)
    out = _needs_input(missing)
    facts = []
    if val.get("goal_amount") is not None and val.get("current_savings") is not None:
        facts.append({"label": "Goal minus current savings (before reserves)",
                      "value": money(max(0, val["goal_amount"] - val["current_savings"]))})
    if not budget_unknown:
        facts.append({"label": "Monthly available cash", "value": money(val["monthly_income"] - val["monthly_expenses"])})
    out["metrics"] = facts
    if len(independent) > 1:
        out["message"] = (f"There are {len(independent)} unresolved independent inputs. "
                          "Please provide more information until only one input is unknown. Known facts are shown below.")
        return out

    params = req.get("parameters") or {}
    for question in out["missing_inputs"]:
        question["required"] = False
    out["message"] = "Please provide the remaining information, or skip this one input to explore a hypothetical value."
    if _num(params.get("skip_input_" + independent[0])) != 1:
        return out
    controls = []
    hypothetical = {}
    defaults = {"monthly_income": 2000, "monthly_expenses": 1500, "goal_deadline": 6, "current_savings": 0,
                "goal_amount": 1000, "savings_floor_to_keep": 0, "debt_owed": 0}
    for key in independent:
        parameter = "hypothetical_" + key
        value = _num(params.get(parameter))
        if value is None or value < 0 or (key == "goal_deadline" and (value < 1 or not value.is_integer())):
            value = defaults[key]
        hypothetical[key] = value
        controls.append({"key": parameter, "label": "Hypothetical " + _pretty(key),
                         "value": value, "unit": "months" if key == "goal_deadline" else "$/month" if key in ("monthly_income", "monthly_expenses") else "$",
                         "min": 1 if key == "goal_deadline" else 0,
                         "max": max(value, 60 if key == "goal_deadline" else 10000),
                         "step": 1 if key == "goal_deadline" else 0.01})
    effective = {**val, **hypothetical}
    requested = _num(params.get("monthly_contribution"))
    goal = effective["goal_amount"]
    # Keep every other input fixed; only the unresolved independent input is simulated.
    scenario = Scenario(goal_type or "one_time", effective["current_savings"], effective["monthly_income"],
                        {"all expenses": effective["monthly_expenses"]}, goal,
                        int(effective.get("goal_deadline") or 0),
                        effective.get("savings_floor_to_keep") or 0, effective.get("debt_owed") or 0)
    evaluated = evaluate(scenario, requested)
    if goal_type == "recurring":
        remaining = evaluated["new_surplus"]
        detail = f"Hypothetical monthly cash after the extra cost: {money(remaining)}."
        scenario_metrics = [{"label": "Hypothetical monthly cash after new cost", "value": money(remaining)}]
    else:
        projected = evaluated["balance"]
        gap = evaluated["shortfall"]
        detail = f"In this scenario, projected funds are {money(projected)}, with a {money(gap)} remaining gap."
        scenario_metrics = [{"label": "Hypothetical projected at deadline", "value": money(projected)},
                            {"label": "Hypothetical remaining gap", "value": money(gap)}]
    out.update({"status": "conditional", "message": "One input is hypothetical. All other provided inputs are held constant.",
                "answer": {"headline": detail + " Hypothetical only — affordability is not yet verified.", "detail": detail},
                "parameters": controls, "metrics": facts + scenario_metrics,
                "assumptions": [{"text": "Hypothetical slider values are exploration only, not confirmed user inputs."}],
                "limitations": ["Unverified income, spending, savings, costs or timing can change the outcome.",
                                "Exploring a monthly saving amount does not establish that your budget can support it."],
                "explanations": [{"label": "Unresolved independent inputs", "text": ", ".join(_pretty(k) for k in independent)},
                                 {"label": "Hypothetical calculation", "text": detail}]})
    for question in out["missing_inputs"]:
        question["required"] = False
    return out


# ------------------------------------------------------------------ entry point

def calculate(req: dict) -> dict:
    meta = req.get("extraction_meta") or {}
    params = req.get("parameters") or {}

    # --- read inputs (user edits are already applied; extra_inputs fill gaps)
    assumptions_in = req.get("assumptions") or []
    names = [a.get("variable") for a in assumptions_in if a.get("variable")]
    if len(names) != len(set(names)):
        return _unsupported("Some variables appear more than once. Please correct the extraction first.")
    items = {a["variable"]: a for a in (req.get("assumptions") or []) if a.get("variable")}
    val = {k: _num(a.get("value")) for k, a in items.items()}
    src = {k: ("stated" if a.get("edited_by_user") else a.get("source", "missing"))
           for k, a in items.items()}
    for k, v in (req.get("extra_inputs") or {}).items():
        n = _num(v)
        if n is not None and val.get(k) is None:
            val[k], src[k] = n, "stated"
            items.setdefault(k, {"variable": k, "unit": INPUT_INFO.get(k, ("",))[0]})

    # --- goal type
    unit = (items.get("goal_amount", {}).get("unit") or "").lower()
    warnings = []
    if "/month" in unit:
        goal_type = "recurring"
    elif val.get("goal_amount") is None:
        goal_type = None
    elif unit in ("$", "usd", "dollars", ""):
        goal_type = "one_time"
        if unit == "":
            warnings.append("The goal had no unit, so it was treated as a one-time cost.")
    else:
        return _unsupported("This goal isn't a one-time cost or a monthly cost, "
                            "so I can't calculate it reliably.")
    if meta.get("question_type") == "other" and goal_type != "recurring":
        return _unsupported("This isn't a savings-goal question, so I can't calculate it reliably.")

    # --- required inputs (never guessed)
    required = ["monthly_income", "monthly_expenses", "current_savings", "goal_amount"]
    if goal_type != "recurring":
        required.append("goal_deadline")
    required += [k for k in ("savings_floor_to_keep", "debt_owed") if k in items]
    invalid_supplied = [k for k in required if items.get(k, {}).get("value") is not None and val.get(k) is None]
    if invalid_supplied:
        return _needs_input(invalid_supplied, "Please correct these numbers before exploring a scenario.")
    invalid_known = [k for k in required if val.get(k) is not None and
                     (val[k] < 0 or (k == "goal_amount" and val[k] == 0) or
                      (k == "goal_deadline" and (val[k] < 1 or not val[k].is_integer())))]
    if invalid_known:
        return _needs_input(invalid_known, "Please correct these numbers before exploring a scenario.")
    missing = [k for k in required if val.get(k) is None]
    if missing:
        return _unresolved(req, val, missing, goal_type)

    invalid = []
    if val["goal_amount"] <= 0:
        invalid.append("goal_amount")
    if val["monthly_income"] < 0:
        invalid.append("monthly_income")
    if val["monthly_expenses"] < 0:
        invalid.append("monthly_expenses")
    if val["current_savings"] < 0:
        invalid.append("current_savings")
    if goal_type == "one_time" and (val["goal_deadline"] < 1 or not val["goal_deadline"].is_integer()):
        invalid.append("goal_deadline")
    invalid += [k for k in ("savings_floor_to_keep", "debt_owed")
                if k in required and val[k] < 0]
    if invalid:
        return _needs_input(invalid, "Some of these numbers don't look right. "
                                     "Please check them and try again.")

    # --- expenses: the stated total is the truth; categories only name the pieces
    total = val["monthly_expenses"]
    cats = {k: v for k, v in val.items()
            if k not in NON_EXPENSE and v is not None and v >= 0 and "/month" in (items[k].get("unit") or "")}
    cat_sum = sum(cats.values())
    if cat_sum > total + 0.01:
        warnings.append("Listed expense categories add up to more than your total, "
                        "so only the total was used.")
        expenses = {"all expenses": total}
    else:
        expenses = dict(cats)
        if total - cat_sum > 0:
            expenses["other"] = total - cat_sum

    # --- optional extras
    floor, debt = val.get("savings_floor_to_keep"), val.get("debt_owed")
    limitations = []
    if (floor or 0) + (debt or 0) > val["current_savings"]:
        return _needs_input(["current_savings", "savings_floor_to_keep", "debt_owed"],
                            "The savings to keep and debt to reserve exceed your current savings. Please check these amounts.")
    if floor:
        limitations.append(f"{money(floor)} of savings is kept untouched, as you asked.")
    if debt:
        limitations.append(f"{money(debt)} you owe is paid from savings first.")
    for name in ("savings_floor_to_keep", "debt_owed"):
        if name in items and val.get(name) is None:
            warnings.append(f"You mentioned {_pretty(name)} but no amount, so it was counted as $0.")
    if val.get("parent_support"):
        warnings.append("Irregular family support is not counted as income.")
    if re.search(r"pre-?tax|before tax|gross|tax status",
                 items["monthly_income"].get("source_detail") or "", re.I):
        warnings.append("Income may be before tax, so the result could be too optimistic.")

    s = Scenario(goal_type, val["current_savings"], val["monthly_income"], expenses,
                 val["goal_amount"],
                 int(val["goal_deadline"]) if goal_type == "one_time" else 0,
                 floor or 0.0, debt or 0.0)
    used = [k for k in required]
    all_stated = all(src.get(k) == "stated" for k in used)
    ai_assumed = [_pretty(k) for k in used if src.get(k) != "stated"]

    requested = _num(params.get("monthly_contribution"))
    # Currency controls operate in cents; use the same amount in math and display.
    if requested is not None:
        requested = round(requested, 2)
    ev = evaluate(s, requested)
    plans = [(name, ps, evaluate(ps)) for name, ps in make_plans(s, requested).items()]
    ranking = sensitivity(s)

    explanations = []
    metrics = []
    parameters = []
    assumptions = []

    if s.goal_type == "one_time":
        c, n = ev["contribution"], s.deadline_months
        if ev["feasible"]:
            if ev["draw"] > 0.005:
                headline = ("Yes, if you save {monthly_contribution} per month, "
                            f"you'll use {money(ev['draw'])} from your savings.")
            else:
                headline = ("Yes, if you save {monthly_contribution} per month, "
                            "you'll reach your goal without touching your savings.")
        else:
            headline = ("Not yet: saving {monthly_contribution} per month leaves you "
                        f"{money(ev['shortfall'])} short of your {money(s.goal_amount)} goal "
                        f"after {n} months.")
        if s.surplus <= 0 and not ev["feasible"]:
            headline = (f"Not with your current budget: you have {money(s.surplus)} left each "
                        f"month, so the {money(s.goal_amount)} goal isn't reachable in {n} months.")
        if s.surplus <= 0 and ev["feasible"]:
            headline = (f"Yes: your savings cover the {money(s.goal_amount)} goal "
                        f"after allowing for your budget over {n} months.")
        detail = "Based on the values and assumptions shown here."
        metrics = [
            {"label": "Goal amount", "value": money(s.goal_amount)},
            {"label": "Deadline", "value": f"{n} months"},
            {"label": "Monthly available cash", "value": money(s.surplus)},
            {"label": "Usable savings", "value": money(s.usable_savings)},
            {"label": "Minimum to save each month", "value": money(math.ceil(ev["min_monthly_saving"] * 100 - 1e-9) / 100)},
            {"label": "Projected at deadline", "value": money(ev["balance"])},
            {"label": "Remaining gap", "value": money(ev["shortfall"])},
            {"label": "Monthly cash remaining", "value": money(s.surplus - c)},
        ]
        explanations.append({"label": "Monthly available cash",
                             "text": f"{money(s.monthly_income)} − {money(sum(s.expenses.values()))} = {money(s.surplus)}"})
        if floor or debt:
            explanations.append({"label": "Usable savings",
                                 "text": f"{money(s.current_savings)} − {money(debt or 0)} owed − {money(floor or 0)} kept = {money(s.usable_savings)}"})
        explanations.append({"label": "Saved by the deadline",
                             "text": f"{money(c)} × {n} months = {money(ev['saved'])}"})
        explanations.append({"label": "Taken from savings",
                             "text": f"max(0, {money(s.goal_amount)} − {money(ev['saved'])}) = {money(ev['draw'])} "
                                     f"(you have {money(s.usable_savings)} usable)"})
        if s.surplus > 0:
            parameters.append({"key": "monthly_contribution", "label": "Save each month",
                               "value": round(c, 2), "unit": "$", "min": 0,
                               "max": round(s.surplus, 2), "step": 0.01})
            assumptions.append({"id": "start",
                                "text": f"Would saving {money(c)} each month work for you?",
                                "parameter_key": "monthly_contribution", "review_label": "Review"})
        firm = all_stated and not warnings and (s.usable_savings >= s.goal_amount or s.surplus <= 0) and (requested is None or s.surplus <= 0)
    else:
        extra = s.goal_amount
        if ev["feasible"]:
            headline = (f"Yes: you'd still have {money(ev['new_surplus'])} left each month "
                        f"after the extra {money(extra)}/month.")
        elif ev["cushion_months"]:
            headline = (f"Not as things stand: you'd be {money(ev['gap'])} short each month, "
                        f"and your usable savings would cover that for about "
                        f"{ev['cushion_months']} months.")
        else:
            headline = (f"Not as things stand: you'd be {money(ev['gap'])} short each month "
                        f"and have no usable savings to cover it.")
        detail = "Based on the values and assumptions shown here."
        metrics = [
            {"label": "Extra monthly cost", "value": money(extra)},
            {"label": "Monthly available cash now", "value": money(s.surplus)},
            {"label": "Monthly available cash after", "value": money(ev["new_surplus"])},
            {"label": "Usable savings", "value": money(s.usable_savings)},
        ]
        explanations.append({"label": "Monthly available cash now",
                             "text": f"{money(s.monthly_income)} − {money(sum(s.expenses.values()))} = {money(s.surplus)}"})
        explanations.append({"label": "After the new cost",
                             "text": f"{money(s.surplus)} − {money(extra)} = {money(ev['new_surplus'])}"})
        firm = all_stated and not warnings

    for name, ps, pe in plans:
        explanations.append({"label": f"Option: {name}", "text": _describe_plan(ps, pe)})

    top = ranking[0] if ranking and ranking[0]["swing"] > 0.005 else None
    if top:
        who = "assumed by the AI" if src.get(top["assumption"], "inferred") != "stated" else "stated by you"
        explanations.append({"label": "Biggest driver",
                             "text": f"The result depends most on {_pretty(top['assumption'])} "
                                     f"(a 10% change moves it by about {money(top['swing'] / 2)}). "
                                     f"That value was {who}."})

    assumptions.append({"text": "Income and spending stay constant."})
    if ai_assumed:
        assumptions.append({"text": "These values were assumed by the AI rather than stated by you: "
                                    + ", ".join(ai_assumed) + "."})
    limitations = warnings + limitations
    if s.goal_type == "one_time":
        limitations.append("A proposed savings amount is not a commitment.")
    limitations.append("No interest or investment returns are included.")

    out = {"status": "ready" if firm else "conditional",
           "answer": {"headline": headline, "detail": detail},
           "metrics": metrics, "explanations": explanations,
           "assumptions": assumptions, "limitations": limitations}
    if parameters:
        out["parameters"] = parameters
    return out
