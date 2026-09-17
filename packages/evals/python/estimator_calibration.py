"""
Monte Carlo calibration check for the Bayesian shrinkage revenue estimator in
backend/../packages/domain/src/impact/estimate.ts (`estimateImpact`).

The estimator publishes a ~90% interval around a shrunk conversion rate. This
script is the only honest way to know whether that "90%" means anything: it
re-implements the exact same formula in Python, then simulates thousands of
campaigns at known true conversion rates and checks how often the published
interval actually contains the rate that generated the data.

Why simulation, not a backtest against real campaigns: there is no real
campaign outcome history yet (see docs/PROGRESS.md Phase 1). Simulating known
ground truth tests the *algorithm's* calibration, which is a well-defined,
honest question, independent of whether real campaigns exist yet. It does not
claim anything about real business outcomes.

Usage:
    source packages/evals/python/.venv/bin/activate
    python packages/evals/python/estimator_calibration.py
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# ── Constants, must match packages/domain/src/impact/estimate.ts exactly ──────
DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE = 0.05
DEFAULT_PRIOR_WEIGHT = 20
Z_90 = 1.645

RNG = np.random.default_rng(seed=42)


def estimate_rate_interval(
    observed_conversions: np.ndarray,
    observed_total: np.ndarray,
    global_prior: float = DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE,
    prior_weight: float = DEFAULT_PRIOR_WEIGHT,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Vectorised port of estimateImpact's shrinkage + interval math.

    Operates on arrays so a whole Monte Carlo batch runs in one NumPy call
    instead of a Python loop per trial.
    """
    effective_n = observed_total + prior_weight
    shrunk_rate = (observed_conversions + prior_weight * global_prior) / effective_n

    standard_error = np.sqrt(shrunk_rate * (1 - shrunk_rate) / np.maximum(effective_n, 1))
    low_rate = np.clip(shrunk_rate - Z_90 * standard_error, 0, None)
    high_rate = np.clip(shrunk_rate + Z_90 * standard_error, None, 1)

    return shrunk_rate, low_rate, high_rate


def run_calibration(
    true_rates: list[float],
    history_sizes: list[int],
    trials_per_cell: int = 2000,
) -> pd.DataFrame:
    """For each (true conversion rate, tenant history size) cell, simulate
    `trials_per_cell` tenants, each with that much real campaign history drawn
    from a binomial at the true rate, and record whether the estimator's 90%
    interval contained the true rate.
    """
    rows = []
    for true_rate in true_rates:
        for history_size in history_sizes:
            observed_total = np.full(trials_per_cell, history_size)
            observed_conversions = RNG.binomial(history_size, true_rate, size=trials_per_cell)

            _, low, high = estimate_rate_interval(observed_conversions, observed_total)
            covered = (true_rate >= low) & (true_rate <= high)

            rows.append(
                {
                    "true_rate": true_rate,
                    "history_size": history_size,
                    "trials": trials_per_cell,
                    "empirical_coverage": covered.mean(),
                    "mean_interval_width": (high - low).mean(),
                }
            )
    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame) -> None:
    by_history = df.groupby("history_size").agg(
        mean_coverage=("empirical_coverage", "mean"),
        min_coverage=("empirical_coverage", "min"),
        max_coverage=("empirical_coverage", "max"),
        mean_interval_width=("mean_interval_width", "mean"),
    )
    print("\nCalibration by tenant history size (target: mean_coverage ≈ 0.90)\n")
    print(by_history.round(4).to_string())

    overall = df["empirical_coverage"].mean()
    worst_cell = df.loc[df["empirical_coverage"].idxmin()]
    print(f"\nOverall empirical coverage across all {len(df)} cells: {overall:.4f}")
    print(
        "Worst single cell: true_rate="
        f"{worst_cell['true_rate']:.3f}, history_size={int(worst_cell['history_size'])}, "
        f"coverage={worst_cell['empirical_coverage']:.4f}"
    )


if __name__ == "__main__":
    true_rates = [0.01, 0.03, 0.05, 0.08, 0.12, 0.20, 0.35]
    history_sizes = [0, 5, 20, 50, 100, 500, 2000]

    results = run_calibration(true_rates, history_sizes, trials_per_cell=5000)
    summarize(results)

    out_path = "packages/evals/python/estimator_calibration_results.csv"
    results.to_csv(out_path, index=False)
    print(f"\nFull cell-by-cell results written to {out_path}")
