"""Pennyscope: LLM extraction step.

Usage:
    export OPENROUTER_API_KEY=...
    python extraction.py            # run all 7 scenarios + automatic checks
    python extraction.py 4 6        # run only scenarios 4 and 6
"""
import json
import os
import sys

from openai import OpenAI

MODEL = "google/gemini-2.5-flash"
MAX_QUESTIONS = 4

REQUIRED_VARIABLES = [
    "monthly_income",
    "monthly_expenses",
    "monthly_surplus",
    "current_savings",
    "goal_amount",
    "goal_deadline",
    "goal_description",
]

SYSTEM_PROMPT = """\
You are a financial-assumption extractor for a "Can I afford it?" tool for college students and young adults.
You ONLY extract and label. You never do math beyond simple unit conversion, never give advice, and never judge whether the user can afford anything.

# Source labels (every assumption gets exactly one)
- "stated":   the user explicitly gave this number or fact. A pure unit conversion is still "stated" (e.g. "$24k a year" -> 2000 $/month); always show the arithmetic in source_detail.
- "inferred": you derived it from stated values (e.g. surplus = income - expenses) or the user was vague ("a few months", "like 400"). Say exactly how.
- "missing":  needed but not given. value MUST be null.

# Rules
1. Always output ALL of these variables, in this order: monthly_income, monthly_expenses, monthly_surplus, current_savings, goal_amount, goal_deadline, goal_description.
2. If the user gives expense categories, add each as its own extra assumption (e.g. rent, car_payment) AND a monthly_expenses total. If the user's expense list is clearly incomplete (e.g. "I have student loans" with no amount, or only rent is given), do NOT present a partial sum as the total: set monthly_expenses and monthly_surplus to "missing" (value null) and record the known pieces as separate assumptions. A surplus built on partial expenses is misleading.
3. Never invent a number. Vague words ("some", "a bit", "sometimes") are NOT numbers: mark missing, or if a rough figure was given ("like 400"), use it as "inferred" with the wording quoted.
4. Ranges: use the midpoint, mark "inferred", note the range.
5. Contradictions or self-corrections ("1500, well actually 800"): use the user's LATEST preference, mark "inferred", and mention the earlier value in source_detail. Whenever you use a self-correction, the FIRST item in clarification_questions MUST be a confirmation question targeting that variable, before any other question (e.g. "Just to check, are we going with the $800 laptop rather than $1,500?"). Drop the lowest-priority other question if needed to stay within the cap of 4. Never skip this confirmation.
6. Irregular income (random hours, "sometimes"): never turn it into a monthly figure. If only a one-off or occasional amount is given (e.g. "parents send me 200 sometimes"), record it as its own assumption (e.g. parent_support, unit "$/occurrence", "stated") with a note that frequency is unknown; do not add it to monthly_income. If no amount is given for irregular work income, monthly_income is missing.
6b. A salary or yearly pay without "after tax"/"take-home" is probably pre-tax. Convert to monthly, label it "stated", say in source_detail that tax status is unknown, and make asking for take-home pay one of your questions.
7. Debts owed to others (e.g. "owe my friend 300") are not savings and not monthly expenses. Record them as an extra assumption named "debt_owed" (unit "$").
8. Money the user wants to protect ("don't want to use it all") is an extra assumption "savings_floor_to_keep": missing unless a number is given, and ask about it.
9. goal_deadline: use months from now (unit "months"). Convert dates relative to today's date given below (round to the nearest month, label "inferred", show the calculation). Vague timing ("next semester", "sometime") is "inferred" only if you can justify a number; otherwise missing.
10. If there is no clear purchase or goal (e.g. just anxiety), goal_amount and goal_deadline are missing, and goal_description should describe the worry in the user's terms (source "inferred"). Do not invent a goal.
11. unit is always a string, never null. Use "$/month", "$", "months", or "text".
11b. If the goal is a recurring cost change (e.g. moving to a pricier apartment), set goal_amount to the extra recurring cost (inferred, unit "$/month", show the difference) and ask about one-time costs (deposit, moving) only if the cap allows.
12. Clarification questions: ask at most 4, ordered by how much the answer changes the outcome (income, expenses, goal amount, deadline, savings first). One question per variable. Casual, friendly, one sentence, no jargon, matching the user's tone. If more than 4 things are missing, ask the top 4 and mention in confidence_note that more details may be needed later.
13. Every "missing" variable that is critical must have a question, subject to the cap of 4. Do not ask about anything already stated.
14. If a value is already stated, do not ask about it, even if you are only mildly unsure.

# Output
Return ONLY valid JSON, no markdown:
{
  "assumptions": [
    {"variable": str, "value": number | string | null, "unit": str, "source": "stated" | "inferred" | "missing", "source_detail": str}
  ],
  "clarification_questions": [
    {"target_variable": str, "question": str, "why_it_matters": str}
  ],
  "goal_summary": str,
  "confidence_note": str
}
goal_description value is a short string; other values are numbers or null.

# Example 1 (clean input)
User: "I make $3,000 a month after tax. Rent is $1,000 and everything else is about $800. I've got $2,500 saved and want a $1,800 laptop in 6 months."
Output:
{"assumptions":[
{"variable":"monthly_income","value":3000,"unit":"$/month","source":"stated","source_detail":"User said '$3,000 a month after tax'"},
{"variable":"rent","value":1000,"unit":"$/month","source":"stated","source_detail":"User said 'Rent is $1,000'"},
{"variable":"other_spending","value":800,"unit":"$/month","source":"stated","source_detail":"User said 'everything else is about $800'"},
{"variable":"monthly_expenses","value":1800,"unit":"$/month","source":"inferred","source_detail":"Rent 1000 + other spending 800"},
{"variable":"monthly_surplus","value":1200,"unit":"$/month","source":"inferred","source_detail":"Income 3000 - expenses 1800"},
{"variable":"current_savings","value":2500,"unit":"$","source":"stated","source_detail":"User said 'I've got $2,500 saved'"},
{"variable":"goal_amount","value":1800,"unit":"$","source":"stated","source_detail":"User said '$1,800 laptop'"},
{"variable":"goal_deadline","value":6,"unit":"months","source":"stated","source_detail":"User said 'in 6 months'"},
{"variable":"goal_description","value":"laptop","unit":"text","source":"stated","source_detail":"User said 'laptop'"}],
"clarification_questions":[],
"goal_summary":"Buy an $1,800 laptop within 6 months.",
"confidence_note":"High confidence: every key number was stated directly."}

# Example 2 (vague input)
User: "my roommates want to go to a music festival this summer, idk if i can swing it"
Output:
{"assumptions":[
{"variable":"monthly_income","value":null,"unit":"$/month","source":"missing","source_detail":"No income mentioned"},
{"variable":"monthly_expenses","value":null,"unit":"$/month","source":"missing","source_detail":"No spending mentioned"},
{"variable":"monthly_surplus","value":null,"unit":"$/month","source":"missing","source_detail":"Needs income and expenses"},
{"variable":"current_savings","value":null,"unit":"$","source":"missing","source_detail":"No savings mentioned"},
{"variable":"goal_amount","value":null,"unit":"$","source":"missing","source_detail":"Festival cost not given"},
{"variable":"goal_deadline","value":null,"unit":"months","source":"missing","source_detail":"User said 'this summer' with no date"},
{"variable":"goal_description","value":"music festival with roommates","unit":"text","source":"stated","source_detail":"User said 'music festival' with roommates"}],
"clarification_questions":[
{"target_variable":"goal_amount","question":"About how much will the festival cost all-in (ticket, travel, food)? A rough guess is fine!","why_it_matters":"The total cost is the target everything else is compared against."},
{"target_variable":"monthly_income","question":"Roughly how much money comes in each month (job, family, aid)?","why_it_matters":"Income determines how fast you can save."},
{"target_variable":"monthly_expenses","question":"About how much do you spend each month on rent, food and everything else?","why_it_matters":"Income minus spending is what you can actually put toward the trip."},
{"target_variable":"current_savings","question":"How much do you have saved right now?","why_it_matters":"Existing savings may cover part of the cost."}],
"goal_summary":"Figure out whether they can afford a summer music festival with roommates.",
"confidence_note":"Low confidence: only the goal type is known; all numbers are missing."}
"""


def get_client() -> OpenAI:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("Set OPENROUTER_API_KEY in your environment first.")
    return OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)


def extract(client: OpenAI, user_message: str, today: str = "2026-10-19") -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + f"\nToday's date: {today}\n"},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return normalize(json.loads(raw))


def normalize(result: dict) -> dict:
    """Guard against nulls the model sometimes returns instead of strings."""
    for a in result.get("assumptions") or []:
        a["unit"] = a.get("unit") or ""
        a["source_detail"] = a.get("source_detail") or ""
    result["assumptions"] = result.get("assumptions") or []
    result["clarification_questions"] = result.get("clarification_questions") or []
    result["goal_summary"] = result.get("goal_summary") or ""
    result["confidence_note"] = result.get("confidence_note") or ""
    return result


def check(result: dict) -> list[str]:
    """Automatic sanity checks; returns a list of problems."""
    problems = []
    by_var = {a["variable"]: a for a in result["assumptions"]}
    for v in REQUIRED_VARIABLES:
        if v not in by_var:
            problems.append(f"missing required variable {v}")
    for a in result["assumptions"]:
        if a.get("source") not in ("stated", "inferred", "missing"):
            problems.append(f"{a['variable']}: bad source {a.get('source')!r}")
        if a.get("source") == "missing" and a.get("value") is not None:
            problems.append(f"{a['variable']}: source=missing but has a value")
        if a.get("source") in ("stated", "inferred") and a.get("value") is None:
            problems.append(f"{a['variable']}: {a['source']} but value is null")
    qs = result["clarification_questions"]
    for a in result["assumptions"]:
        d = a["source_detail"].lower()
        if a.get("source") == "inferred" and any(w in d for w in ("correct", "initially", "changed", "earlier")):
            if a["variable"] not in [q.get("target_variable") for q in qs]:
                problems.append(f"self-correction on {a['variable']} not confirmed with a question")
    if len(qs) > MAX_QUESTIONS:
        problems.append(f"{len(qs)} questions (cap is {MAX_QUESTIONS})")
    targets = [q.get("target_variable") for q in qs]
    if len(targets) != len(set(targets)):
        problems.append("duplicate question targets")
    for q in qs:
        t = by_var.get(q.get("target_variable"))
        tax_q = any(w in q["question"].lower() for w in ("take-home", "after tax", "before tax", "taxes"))
        if t and t["source"] == "stated" and not tax_q:
            problems.append(f"asked about already-stated {q['target_variable']}")
    if not qs and any(by_var.get(v, {}).get("source") == "missing" for v in
                      ("monthly_income", "goal_amount", "goal_deadline", "current_savings")):
        problems.append("critical variable missing but no questions asked")
    return problems


def show(result: dict) -> None:
    print(f"  Goal: {result['goal_summary']}\n  Confidence: {result['confidence_note']}")
    for a in result["assumptions"]:
        print(f"  [{a['source']:<8}] {a['variable']:<24} {a['value']!s:<28} {a['unit']}")
        print(f"             {a['source_detail']}")
    for i, q in enumerate(result["clarification_questions"], 1):
        print(f"  Q{i} [{q['target_variable']}] {q['question']}")


SCENARIOS = {
    1: "I make $2,000 a month after tax. Rent is $900 and other spending is about $750. I have $1,200 saved, but don't want to use it all. Can I afford a $3,000 Europe trip with friends in 8 months?",
    2: "I have around $1,500 saved and want to buy a $2,000 laptop sometime next semester. Can I afford it?",
    3: "My annual salary is $55,000. My car payment is $350/month and I have student loans. I want to move on February 1, 2027 to an apartment costing $1,400/month instead of my current $1,000 rent. Can I swing it?",
    4: "my friends wanna do spring break in miami but idk if i can afford it lol",
    5: "i make like 24k a year from work study and my parents send me 200 sometimes. rent is 950 with utilities. thinking about getting a car for maybe 8 grand?",
    6: "i keep spending money on food delivery and im scared im not gonna have enough for rent next month. i have like 400 in my account rn",
    7: "so i need a new laptop for school, probably like 1500, well actually maybe i could get away with a cheaper one like 800? i have some money saved but i also owe my friend 300. i work at starbucks but my hours are random",
}


if __name__ == "__main__":
    ids = [int(a) for a in sys.argv[1:]] or list(SCENARIOS)
    client = get_client()
    summary = {}
    for i in ids:
        print(f"\n===== Scenario {i} =====\n  \"{SCENARIOS[i]}\"")
        res = extract(client, SCENARIOS[i])
        show(res)
        summary[i] = check(res)
        print("  CHECKS:", "OK" if not summary[i] else summary[i])
    print("\n===== SUMMARY =====")
    for i, p in summary.items():
        print(f"  Scenario {i}: {'OK' if not p else '; '.join(p)}")
