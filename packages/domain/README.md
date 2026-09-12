# @growthos/domain

Pure business rules — RFM scoring, audience segmentation, guardrail checks. Zero I/O:
no Prisma, no Supabase, no Express, no LLM calls. See `docs/ARCHITECTURE_V2.md` §5 and
§12 for why this boundary exists and what belongs on which side of it.

**No `package.json` here on purpose.** This package has no dependencies of its own, so
it runs through whichever consumer's toolchain imports it — today that's the backend's
`tsconfig.json` path alias (`@growthos/domain` → `src/index.ts`) and its already-installed
`vitest` (see `backend/vitest.config.ts`'s `include` array). Giving it a separate
`package.json` would mean a second `npm install` for a package with nothing to install,
which is exactly the workspace overhead `docs/ARCHITECTURE_V2.md` §12 argues against.
If a consumer outside the `backend/` toolchain ever needs this package, add a
`tsconfig.json`-only reference there too, rather than reaching for npm workspaces.

## Layout

- `src/rfm/` — recency/frequency/monetary scoring, extracted from
  `backend/src/services/customer-metrics.ts`
- `src/segments/` — which customers belong to which opportunity type, extracted from
  `backend/src/services/opportunity-discovery.ts`
- `src/guardrails/` — deterministic checks the agent cannot skip, extracted from
  `AgentOrchestrator.meetsGuardrails`

## Running the tests

```bash
cd backend && npx vitest run
```

Domain's `*.test.ts` files run alongside the backend's own suite (see
`backend/vitest.config.ts`'s `include`).
