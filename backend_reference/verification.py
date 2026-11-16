"""LLM-led calculation, verified by the deterministic calculator.

Pipeline for a confirmed answer:
  1. The LLM works the problem from the confirmed assumptions and shows its figures.
  2. savings_goal_model computes the same figures exactly.
  3. Each figure is compared. Where they differ, the calculator wins: the user always sees the
     calculator's numbers, plus a note on what the AI got differently.

Only runs when the request asks for it (verify=true), so what-if slider moves stay fast and LLM-free.
"""
from __future__ import annotations

import json
import re

import extraction_service

# Figure key -> metric label in savings_goal_model's response, per goal type.
FIGURES = {
    "one_time": {
        "monthly_surplus": "Monthly available cash",
        "usable_savings": "Usable savings",
        "min_monthly_saving": "Minimum to save each month",
    },
    "recurring": {
        "monthly_surplus": "Monthly available cash now",
        "new_surplus": "Monthly available cash after",
        "usable_savings": "Usable savings",
    },
}
LABELS = {
    "monthly_surplus": "Money left each month",
    "usable_savings": "Savings you can use",
    "min_monthly_saving": "Minimum to save each month",
    "new_surplus": "Money left each month after the new cost",
    "feasible": "Whether the goal is reachable",
}

LLM_CALC_PROMPT = """\
You are checking a "Can I afford it?" question by working the arithmetic yourself.
Use ONLY the numbers given. Do not invent or adjust any value.

Definitions:
- monthly_surplus = monthly_income - monthly_expenses
- usable_savings = current_savings - debt_owed - savings_floor_to_keep (treat missing ones as 0)
- If goal_amount's unit is "$/month" the goal is RECURRING (an extra monthly cost):
    new_surplus = monthly_surplus - goal_amount;  feasible = new_surplus >= 0
- Otherwise the goal is ONE-TIME, due in goal_deadline months:
    min_monthly_saving = max(0, goal_amount - usable_savings) / goal_deadline
    feasible = usable_savings + max(monthly_surplus, 0) * goal_deadline >= goal_amount

Return ONLY JSON:
{"goal_type": "one_time" | "recurring", "monthly_surplus": number, "usable_savings": number,
 "min_monthly_saving": number | null, "new_surplus": number | null, "feasible": true | false,
 "reasoning": "2-4 short lines showing the arithmetic"}
"""


def _money(text: str) -> float | None:
    m = re.search(r"(-?)\$?(-?[\d,]+(?:\.\d+)?)", text or "")
    if not m:
        return None
    n = float(m.group(2).replace(",", ""))
    return -abs(n) if m.group(1) == "-" else n


def calculator_figures(response: dict) -> dict:
    """Read the exact figures back out of the calculator's response."""
    metrics = {m["label"]: m["value"] for m in response.get("metrics") or []}
    goal_type = "recurring" if "Monthly available cash after" in metrics else "one_time"
    figs = {"goal_type": goal_type}
    for key, label in FIGURES[goal_type].items():
        if label in metrics:
            figs[key] = _money(metrics[label])
    headline = (response.get("answer") or {}).get("headline", "")
    figs["feasible"] = headline.startswith("Yes")
    return figs


def llm_calculate(question: str, assumptions: list[dict]) -> dict:
    facts = [{k: a.get(k) for k in ("variable", "value", "unit")} for a in assumptions if a.get("value") is not None]
    prompt = f"User's question:\n{question}\n\nConfirmed values:\n{json.dumps(facts, indent=2)}"
    return extraction_service._call_llm(prompt, system=LLM_CALC_PROMPT)


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= max(1.0, 0.01 * abs(b))


def compare(llm: dict, calc: dict) -> dict:
    checked = []
    for key in list(FIGURES[calc["goal_type"]]) + ["feasible"]:
        if key not in calc or calc[key] is None:
            continue
        mine, theirs = llm.get(key), calc[key]
        if key == "feasible":
            ok = isinstance(mine, bool) and mine == theirs
        else:
            ok = isinstance(mine, (int, float)) and not isinstance(mine, bool) and _close(float(mine), theirs)
        checked.append({"key": key, "label": LABELS[key], "llm": mine, "calculator": theirs, "match": ok})
    mismatches = [c for c in checked if not c["match"]]
    return {
        "status": "mismatch" if mismatches else "match",
        "checked": checked,
        "reasoning": str(llm.get("reasoning") or "")[:1200],
    }


def verify(request: dict, calc_response: dict) -> dict:
    """LLM works it first, calculator checks it. Never blocks the answer if the LLM is unavailable."""
    try:
        llm = llm_calculate(request.get("original_question", ""), request.get("assumptions") or [])
    except Exception:  # missing key, provider error, bad JSON
        return {"status": "unavailable", "checked": [], "reasoning": ""}
    return compare(llm if isinstance(llm, dict) else {}, calculator_figures(calc_response))
