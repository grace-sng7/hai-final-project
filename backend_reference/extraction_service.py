"""Grace: move your notebook logic here. Only the three marked places need your input.

Key differences from the notebook:
  1. The API key comes from the environment (never write it in code):  export OPENROUTER_API_KEY=...
  2. The user's "today" (reference_date) is given to the model, so "next May" / "by February" can
     become a correct number of months.
  3. Failures raise HTTPException (the frontend shows a retry message) instead of crashing.
"""
from __future__ import annotations
import json
import os
from fastapi import HTTPException
from openai import OpenAI

MODEL = "google/gemini-2.5-flash"

# >>> 1. PASTE your SYSTEM_PROMPT from the notebook here (unchanged) <<<
SYSTEM_PROMPT = """\
You are a financial-assumption extractor for a "Can I afford it?" decision tool.

Your job:
1. Read the user's plain-language description of their financial situation and goal.
2. Extract every relevant financial variable into structured JSON.
3. Label each variable's source:
   - "stated"   → the user explicitly said this
   - "inferred" → you calculated or reasoned this from what they said
   - "missing"  → you need this but the user didn't mention it
4. For "missing" or uncertain variables, write a SHORT, friendly clarification question.
5. Do NOT give financial advice. Do NOT run calculations. Just extract and label.

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):

{
  "assumptions": [
    {
      "variable": "monthly_income",
      "value": <number or null if missing>,
      "unit": "$/month",
      "source": "stated" | "inferred" | "missing",
      "source_detail": "Brief explanation of where this came from or why it's missing"
    }
  ],
  "clarification_questions": [
    {
      "target_variable": "variable_name",
      "question": "The friendly question to ask the user",
      "why_it_matters": "One sentence on how this affects the outcome"
    }
  ],
  "goal_summary": "One-sentence restatement of what the user wants to figure out",
  "confidence_note": "One sentence about overall confidence in the extraction"
}

Guidelines for the assumptions array — include ALL of these variables, marking as
"missing" if not mentioned:
  - monthly_income
  - monthly_expenses (total, or broken into categories if user gave them)
  - monthly_surplus (income minus expenses — inferred if both are stated)
  - current_savings
  - goal_amount
  - goal_deadline (in months from now, or a date)
  - goal_description

If the user gives expense categories (rent, food, etc.), include each as a separate
assumption AND a total. If they give a range ("$700-800"), use the midpoint and note
the range in source_detail.

Be conservative: if something is ambiguous, mark it "inferred" and add a
clarification question. Never silently assume critical values.
"""

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENROUTER_API_KEY")
        if not key:
            raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not set on the server")
        _client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
    return _client


def _call_llm(prompt: str) -> dict:
    # >>> 2. If you switch to AWS Bedrock later, only this function changes. <<<
    try:
        response = _get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        cleaned = response.choices[0].message.content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(cleaned)
    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="The model returned invalid JSON. Please retry.")
    except Exception as e:  # network / provider errors
        raise HTTPException(status_code=502, detail=f"Model call failed: {type(e).__name__}")


def _dated(message: str, reference_date: str, timezone: str) -> str:
    return (f"Today's date is {reference_date} ({timezone}). Convert relative dates such as 'next May' "
            f"or 'by February' into a number of months from today.\n\nUser message:\n{message}")


def extract(user_message: str, reference_date: str, timezone: str) -> dict:
    return _call_llm(_dated(user_message, reference_date, timezone))


def correct(user_message: str, reference_date: str, timezone: str, previous_extraction: dict, user_correction: str) -> dict:
    # >>> 3. Same composed prompt as notebook cell 14, plus the date. <<<
    prompt = f"""Today's date is {reference_date} ({timezone}).
The user originally said:
\"{user_message}\"

You previously extracted these assumptions:
{json.dumps(previous_extraction, indent=2)}

The user has now provided corrections and clarifications:
\"{user_correction}\"

Update the assumptions JSON to reflect the user's corrections.
Change the source to "stated" for any variable the user just clarified.
Remove any clarification questions that are now answered.
Return the updated JSON in the same schema as before."""
    return _call_llm(prompt)
