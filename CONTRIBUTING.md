# Contributing to CookTrace

Pre-1.0 — the foundation is still being laid out. Issue/PR triage may be
slow until Phase 1 (Recipes) ships. Bug reports are welcome on the public
repo; feature suggestions tracked in [FUTURE.md](FUTURE.md).

## Local dev

```bash
git clone https://github.com/traceapps/cooktrace-public.git
cd cooktrace-public
npm install
npm run dev          # Vite dev server on :5173
node server/index.js # API on :3001
```

## Style

- Match the surrounding code. The codebase inherits NutriTrace conventions
  almost entirely.
- No comments unless the WHY is non-obvious.
- Don't add features beyond what the issue/PR scope demands.
- See `CLAUDE.md` for project-specific notes.

## Brand cohesion

CookTrace, NutriTrace, and LiftTrace share design language and the
`Trace` AI assistant persona. Keep `TraceFace.svelte` identical across
all three repos. If you change the assistant tone or the navigation
chrome here, mirror to LiftTrace + NutriTrace in the same PR cycle.
