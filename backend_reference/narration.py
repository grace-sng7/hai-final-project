"""Plain-language explanation of a calculated answer, written by the LLM from the calculator's numbers.

The calculator decides the answer; this only explains it. The model is given the exact figures and may
not introduce new ones: any dollar amount in its text that doesn't match a known figure (allowing for
rounding) throws the whole explanation away, and the UI falls back to the calculator's own wording.
Runs only for confirmed answers (verify=true), in parallel with the verification call.
"""
from __future__ import annotations

import json
import re

import extraction_service

NARRATE_PROMPT = """\
You explain the result of a "Can I afford it?" calculation to a college student or young adult.
The calculation is already done. You are given the user's question, the values used (with where each came from),
and the calculator's result. Explain it like a friend who is good with money.

Write "explanation": 3-5 short sentences, second person, plain words, no headings or lists.
- Start with what the answer means for them in practice (not a repeat of the headline).
- Walk through the 2-3 numbers that matter most and where they came from.
- If any value was estimated or inferred (source "inferred"), say which, and how the answer would change if it is off
  (use the options or the margin you are given; do not compute new figures).
- End with one concrete, practical next step. No investment, credit or tax advice.
Use ONLY dollar figures that appear in the data (you may round to the nearest $10). Never invent a number.

Write "suggestions": 2-3 short follow-up messages the USER might send next, in the user's voice, each under 60 characters,
each a what-if that changes one value (e.g. "What if the trip costs $2,000?", "What if I only save $300 a month?",
"What if I go in 6 months instead?"). Make them specific to this goal.

Return ONLY JSON: {"explanation": str, "suggestions": [str, ...]}
"""


def _numbers(value, out: list[float]) -> None:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)):
        out.append(abs(float(value)))
    elif isinstance(value, str):
        out.extend(abs(float(m.replace(",", ""))) for m in re.findall(r"\d[\d,]*(?:\.\d+)?", value))
    elif isinstance(value, dict):
        for v in value.values():
            _numbers(v, out)
    elif isinstance(value, list):
        for v in value:
            _numbers(v, out)


def grounded(text: str, known: list[float]) -> bool:
    """Every $ amount in the text must be within rounding distance of a figure we gave the model."""
    for m in re.findall(r"\$\s?(\d[\d,]*(?:\.\d+)?)(\s?[kK]\b)?", text):
        n = float(m[0].replace(",", "")) * (1000 if m[1] else 1)
        if not any(abs(n - k) <= max(10.0, 0.03 * k) for k in known):
            return False
    return True


def narrate(request: dict, result: dict) -> dict | None:
    facts = [{k: a.get(k) for k in ("variable", "value", "unit", "source", "source_detail")}
             for a in request.get("assumptions") or [] if a.get("value") is not None]
    meta = request.get("extraction_meta") or {}
    data = {
        "question": request.get("original_question", ""),
        "values_used": facts,
        "cost_breakdown": meta.get("goal_breakdown") or [],
        "result": {k: result.get(k) for k in ("status", "answer", "metrics", "visuals", "limitations")},
    }
    try:
        out = extraction_service._call_llm(json.dumps(data, indent=1), system=NARRATE_PROMPT)
    except Exception:  # missing key, provider error, bad JSON: the answer still shows without it
        return None
    if not isinstance(out, dict) or not isinstance(out.get("explanation"), str):
        return None
    text = out["explanation"].strip()
    known: list[float] = []
    _numbers(data, known)
    if not text or not grounded(text, known):
        return None
    suggestions = [s.strip() for s in out.get("suggestions") or [] if isinstance(s, str) and 0 < len(s.strip()) <= 80][:3]
    return {"text": text[:1200], "suggestions": suggestions}
