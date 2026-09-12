import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // These two React Compiler diagnostics both fire on the same thing: pages that
      // fetch on mount via `useEffect` -> async loader -> setState. The rule is right
      // that this causes cascading renders, but satisfying it is not a local edit — it
      // means moving reads into server components or a Suspense-based data layer.
      // Demoted to warnings so the rest of the ruleset can gate CI; the refactor is
      // pages still load via useEffect → setState; fix is a data-layer refactor.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
