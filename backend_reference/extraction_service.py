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
SYSTEM_PROMPT = """PASTE SYSTEM_PROMPT FROM THE NOTEBOOK"""

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
