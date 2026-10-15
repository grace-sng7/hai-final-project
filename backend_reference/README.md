# Python backend reference

FastAPI routes and a savings-goal reference implementation for the team's frontend.

- [../BACKEND_CONTRACT.md](../BACKEND_CONTRACT.md): authoritative HTTP API.
- [../FRONTEND_README.md](../FRONTEND_README.md): isolated environment setup, secure credentials, frontend live mode and test commands.
- [../BACKEND_INTEGRATION.md](../BACKEND_INTEGRATION.md): adapter boundaries and unresolved gaps.

Implementation entry points:

- `main.py`: routes and current savings-model dispatch.
- `extraction_service.py`: Grace's exact notebook prompt is already copied. `extract` adds date context; `correct` reuses the notebook's composed correction workflow. Model configuration is preserved.
- `contract.py`: Pydantic models implementing the agreed API; semantic validation gaps are recorded in the integration notes.
- `savings_model.py`: one local reference model; not a general financial calculator.
- `examples/`: calculation request/response/extraction pairs exercised by frontend adapter tests.

`tests/python-extraction.py` checks extraction and correction routes offline using stubbed model responses. Actual provider calls and browser-to-LLM behavior remain unverified because no API key was configured. Configure a server-side key before attempting live extraction; never commit it.
