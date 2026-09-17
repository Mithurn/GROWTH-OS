# GrowthOS evals — Python (pandas + NumPy)

Two scripts, not deployed, run manually or in CI:

## `estimator_calibration.py`

Monte Carlo calibration check for the Bayesian shrinkage revenue estimator in
`packages/domain/src/impact/estimate.ts`. Re-implements the exact same formula
(vectorised in NumPy) and simulates thousands of tenants at known true
conversion rates across a range of history sizes, then measures how often the
estimator's published "90% interval" actually contains the true rate.

**Finding (2026-09-17):** for a cold-start tenant (no campaign history), the
interval's real coverage is far below 90% — as low as 0% in the worst cell —
because with `historyTotal = 0` the formula's uncertainty term is driven
entirely by the prior's assumed weight, not by the tenant's real unknown rate.
Coverage only approaches 90% once a tenant has ~500 real observations. Not
fixed yet — logged in `docs/breaks.md`, since the estimator ships a "90%
interval" today that isn't one for the exact case (new signups) the product
sees most.

```bash
python packages/evals/python/estimator_calibration.py
```

## `rfm_analysis.py`

Pulls real rows from `customer_metrics` (whatever `DATABASE_URL` points at)
and independently re-derives RFM quintile segments and revenue concentration
(Pareto 80/20, Gini coefficient) with pandas/NumPy, as a cross-check on the
app's own `engagement_score`. Customers with zero orders are reported
separately ("Never ordered") rather than folded into the same quintiles as
customers with real purchase history, since they have no real recency or
frequency to rank.

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
    python packages/evals/python/rfm_analysis.py
```

## Setup

```bash
python3 -m venv packages/evals/python/.venv
source packages/evals/python/.venv/bin/activate
pip install -r packages/evals/python/requirements.txt
```
