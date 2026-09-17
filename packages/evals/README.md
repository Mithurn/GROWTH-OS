# @growthos/evals

Golden fixtures the agent loop is scored against. The first suite is the
shadow observe tape (`observe-trajectory.json`), kept in lockstep with
`OBSERVE_SCRIPT_TOOLS` by a vitest case.

A Python/pandas nightly harness and a Go webhook loadtest are still later
CI-only tools. This package is the fixture source they will read — not a
fake report of numbers we have not measured.
