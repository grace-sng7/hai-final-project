# Show Your Work — frontend handoff

This Next.js / React frontend preserves the Worked Notebook design. The team's root README and Grace's original notebook remain unchanged.

## Document map

- [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md): single source of truth for HTTP requests, responses, field names and API rules.
- [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md): adapter boundaries, state handling, troubleshooting and unresolved integration gaps. Internal UI types are not another backend API.
- [backend_reference/README.md](backend_reference/README.md): Python implementation entry points.

## Current status

Implemented: Step-by-Step Guide (default), optional Quick Calculate, dynamic information/question arrays, editable facts, optional confirmations, shared state, synchronized inline/What If controls, correction submission, result invalidation and retries. Guide initially expands only Information. No accounts or persistence; refreshing clears the session.

Demo mode is the default. Three example buttons only fill the question input. Mock extraction accepts registered example text; arbitrary text receives an explicit mock limitation. The guarded local savings demo supports the trip/laptop examples; the apartment example returns unsupported.

Live transport is implemented: browser → Next.js proxy → Python FastAPI. Grace's exact cell-4 SYSTEM_PROMPT is copied into `backend_reference/extraction_service.py`; model configuration and correction logic are unchanged. Her root notebook is not executed or modified by the server.

Offline-tested: frontend state/rendering, HTTP adapters with fake fetch, backend-wire example pairs, and FastAPI `/extract` and `/correct` with stubbed model responses. The Python tests also verify exact prompt equality and missing-key handling. These do not prove real LLM output quality or a browser-to-provider round trip.

Still unverified: real OpenRouter extraction/correction and end-to-end live browser behavior. No API key was configured during local verification. The savings reference is one calculation implementation, not support for arbitrary financial questions; new-topic fixtures prove rendering only.

## Run the frontend in demo mode

From the team checkout root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000 (or the port printed by Next.js). Without live-mode configuration the app uses mocks. If an existing `.env.local` selects live mode, set `NEXT_PUBLIC_BACKEND_MODE=demo` and restart. Preserve existing local settings rather than overwriting them.

## Prepare live mode locally

Create an isolated Python environment **outside the repository**, so it cannot accidentally be committed:

```sh
python3 -m venv "$HOME/.venvs/show-your-work"
"$HOME/.venvs/show-your-work/bin/python" -m pip install -r backend_reference/requirements.txt
```

For the current temporary checkout, an environment is already installed at `/private/tmp/syw-team-python-venv`. The checkout and environment under `/private/tmp` are temporary; use a durable local clone for ongoing work. They are not required paths for teammates.

Create `backend_reference/.env.local` with a text editor, storing `OPENROUTER_API_KEY` there. It is ignored by Git. Never put the key in chat, source code, example files, or a `NEXT_PUBLIC_` variable. No credential value is supplied in this repository.

Start Python (terminal 1):

```sh
cd backend_reference
"$HOME/.venvs/show-your-work/bin/python" -m uvicorn main:app \
  --env-file .env.local --reload --port 8000
```

Health: http://localhost:8000/health. Route documentation: http://localhost:8000/docs. Health confirms server startup, not provider credentials or LLM functionality.

In the repository root, create or carefully update the ignored `.env.local` (use `env.example` as a template):

```text
NEXT_PUBLIC_BACKEND_MODE=live
BACKEND_URL=http://localhost:8000
```

Start/restart Next.js (terminal 2):

```sh
npm run dev
```

`components/app-shell.tsx` selects the existing live services when the mode is exactly `live`. No component edits or manual replacement of `lib/services.ts` are required. Do not enable live mode until Python and its credentials are ready. Live mode switches extraction, correction and calculation together.

## Verification and handoff

From the repository root:

```sh
npm test
npm run lint
npm run build
"$HOME/.venvs/show-your-work/bin/python" -B tests/python-extraction.py
```

`npm test` runs contract/state/rendering tests (including 800 response combinations) and backend-wire tests. The separate Python command uses only offline stubs and requires no API key. In the current temporary environment, substitute `/private/tmp/syw-team-python-venv/bin/python` for that interpreter.

Full ESLint passes in the team checkout. If a local untracked `.agents/` installation introduces unrelated lint errors, preserve it and also run the application-scoped check:

```sh
npx eslint app components lib tests/contracts.mjs tests/integration-flow.mjs tests/backend-wire.mjs
```

Before claiming live integration is verified, submit a new question, inspect information and clarification cards, submit a correction, verify the replacement response, and exercise failure/retry. Verify calculation separately; successful extraction does not imply a supported calculation model.

The locked npm dependency installation previously reported 16 security advisories. No dependency upgrades were applied during handoff preparation.
