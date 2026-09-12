# @growthos/contracts

Zod schemas that cross a boundary — today the HTTP request bodies the backend's routers
validate, from Phase 2 onward also the agent tool-arg schemas that the LangGraph tool
registry and the MCP server both read (one schema, converted to JSON Schema once for
both). See `docs/ARCHITECTURE_V2.md` §3.4 and §12.

**No `package.json` here, same as `packages/domain`.** Its one dependency, `zod`, is
already installed by every consumer that would import it, so a second `npm install` for
an already-present dependency is the workspace overhead §12 argues against.

Resolution takes two mappings, not one, and both are load-bearing:

- **The consumer maps the package.** `backend/tsconfig.json` maps
  `@growthos/contracts` → `src/index.ts`, which is what lets the routers import it.
- **This package maps its own npm dependency.** `tsconfig.json` here maps `zod` into
  `backend/node_modules`. Without it the real `render.yaml` esbuild build fails to
  resolve `zod`, because esbuild reads the tsconfig nearest the importing file and so
  never sees the consumer's mapping. `tsc` is satisfied by the consumer's mapping alone
  and therefore does **not** catch this — which is why the backend's CI now runs the
  actual bundle, not just `tsc --noEmit`. See the comment in that file for the full
  reasoning and for when to stop patching it and move to npm workspaces instead.

Both mappings point at the same physical copy of `zod`, so there is no risk of two
instances with incompatible schema types. If a consumer outside the `backend/` toolchain
ever imports this package, it needs both mappings of its own — and `zod` on a compatible
major, since Zod schema objects are not interchangeable across majors.

Unlike `packages/domain`, this package is not pure-by-rule: schemas are declarative and
side-effect free, but the constraint that matters here is *no I/O and no runtime
imports* — a schema must be describable to an MCP client that has never seen our
database.

## Layout

- `src/http/` — request-body schemas, one file per router, moved verbatim out of
  `backend/src/lib/schemas.ts`

## Running the tests

```bash
cd backend && npx vitest run
```

This package's `*.test.ts` files run alongside the backend's own suite (see
`backend/vitest.config.ts`'s `include`).
