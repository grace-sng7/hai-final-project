# hai-final-project

## AI Studio comparison prototype

A separate Vite/React prototype is available in [`prototypes/ai-studio`](prototypes/ai-studio), imported from Phoebe's [AI Studio source repository](https://github.com/phoebeli00/version1personalbudget). See its [setup and integration notes](prototypes/ai-studio/README.md).

```sh
cd prototypes/ai-studio
npm ci
npm run dev
```

Use Node.js 22.12+ and open http://127.0.0.1:3002. This version uses **mock sample data**, not a live model/API. Grace's root notebook is unchanged. The variant remains separate from the `phoebe/frontend-v1` branch; it is provided for comparison and is not claimed to have frontend-v1's compatibility fixes.
