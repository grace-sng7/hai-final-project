# Show Your Work

A Next.js frontend for reviewing extracted financial information and exploring supported calculations. The Worked Notebook interface uses shared state across Quick Calculate and Step-by-Step Guide.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The current mock extraction service accepts the example prompts shown on the entry page; arbitrary text is retained and explicitly rejected rather than silently mapped to a demo.

The UI renders a generic calculation/UI adapter contract: information, questions, assumptions, answers, explanation rows, and metadata-selected controls. Ready, conditional, needs-input, unsupported, and stale responses determine the Quick Calculate layout. Every new question starts in Step-by-Step Guide. Guide keeps Information → Questions → Calculations → Answer as freely expandable sections, with only Information expanded initially. Structured answer segments support inline edits synchronized with What If controls. Confirmations persist across modes. Mock matching is isolated under `lib/mock/`; production contracts and display components never select fixtures. The local savings engine remains an independent guarded demo. Grace's extraction response remains unchanged. Replace service bindings in `lib/services.ts` when backend transports are agreed.

See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) for service replacement, shared state, the proposed response contract, correction handling, and mock limitations. No Python calculation API or endpoint is implemented or assumed.

Checks:

```sh
npm test
npx eslint app components lib tests/contracts.mjs tests/integration-flow.mjs
npm run build
```

`npm test` renders synthetic response combinations through the same components used by the application. Published Grace JSON compatibility (including null units), question preservation, adaptive modes, confirmations and correction boundaries are also tested. The untracked `.agents/` skill directory is excluded from the scoped application lint command.

## Live backend mode

Set `NEXT_PUBLIC_BACKEND_MODE=live` and `BACKEND_URL` (see `env.example`) to use the Python backend instead of demo samples. The frontend talks to the backend through `app/api/backend/[action]/route.ts`; formats are defined in [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md), and `backend_reference/` is a runnable starter for the backend team. Demo mode is unchanged and remains the default (`lib/services.ts` supplies the mock services; `components/app-shell.tsx` swaps in the live ones).
