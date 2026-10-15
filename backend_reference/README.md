# backend_reference

Starter FastAPI backend that already satisfies `../BACKEND_CONTRACT.md`.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENROUTER_API_KEY=...        # only needed for /extract and /correct
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs to try each endpoint. `examples/*.request.json` can be pasted into `/calculate`.

- `extraction_service.py` — Grace: paste the notebook `SYSTEM_PROMPT` in (3 marked spots).
- `savings_model.py` — calculation teammate: working example, no dependencies; copy its pattern.
- `contract.py` — Pydantic models. Do not rename fields.
