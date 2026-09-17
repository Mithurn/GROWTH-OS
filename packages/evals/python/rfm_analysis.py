"""
RFM segment and revenue-concentration analysis against real GrowthOS customer
data (pandas + NumPy). Reads the same `customer_metrics` table the backend's
RFM scoring (packages/domain/src/rfm/scoring.ts) writes to, so this validates
real output, not synthetic data.

Usage:
    source packages/evals/python/.venv/bin/activate
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
        python packages/evals/python/rfm_analysis.py [--company-id <id>]
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text


def load_customer_metrics(engine, company_id: str | None) -> pd.DataFrame:
    query = text(
        """
        select
            c.id as customer_id,
            c.signup_date,
            m.total_orders,
            m.total_spent,
            m.avg_order_value,
            m.days_since_last_order,
            m.purchase_frequency,
            m.engagement_score
        from customers c
        join customer_metrics m on m.customer_id = c.id
        where (:company_id is null or c.company_id = :company_id)
        """
    )
    return pd.read_sql(query, engine, params={"company_id": company_id})


def gini_coefficient(values: np.ndarray) -> float:
    """Standard Gini via the mean absolute difference formula. 0 = perfectly
    even revenue spread across customers, 1 = one customer holds everything.
    """
    sorted_values = np.sort(values)
    n = len(sorted_values)
    if n == 0 or sorted_values.sum() == 0:
        return 0.0
    cumulative = np.cumsum(sorted_values)
    return float((n + 1 - 2 * (cumulative.sum() / cumulative[-1])) / n)


def revenue_concentration(df: pd.DataFrame) -> dict:
    spend = df["total_spent"].to_numpy(dtype=float)
    sorted_desc = np.sort(spend)[::-1]
    total = sorted_desc.sum()

    top_n = max(1, int(np.ceil(len(sorted_desc) * 0.20)))
    top_20_share = sorted_desc[:top_n].sum() / total if total > 0 else 0.0

    return {
        "customers": len(spend),
        "total_revenue": round(total, 2),
        "top_20pct_customer_count": top_n,
        "top_20pct_revenue_share": round(top_20_share, 4),
        "gini_coefficient": round(gini_coefficient(spend), 4),
    }


def rfm_segments(df: pd.DataFrame) -> pd.DataFrame:
    """Quintile-bucket recency, frequency, and monetary value the standard RFM
    way (5 = best in each dimension), independent of the app's own
    engagement_score, as a cross-check.

    Customers with zero orders have no real recency/frequency/monetary
    ordering — they haven't bought anything, not "recently bought a small
    amount" — so they're scored separately rather than folded into the same
    quintiles as customers with real purchase history.
    """
    working = df.copy()
    never_ordered = working["total_orders"] == 0
    buyers = working[~never_ordered].copy()

    def quintile(series: pd.Series, higher_is_better: bool) -> pd.Series:
        # rank() with ascending=True puts the largest raw value at the largest
        # rank; qcut then assigns that top rank group the largest label — the
        # behaviour we want when a larger raw value should mean "better".
        ranks = series.rank(method="first", ascending=higher_is_better)
        return pd.qcut(ranks, 5, labels=[1, 2, 3, 4, 5]).astype(int)

    buyers["R"] = quintile(buyers["days_since_last_order"], higher_is_better=False)
    buyers["F"] = quintile(buyers["total_orders"], higher_is_better=True)
    buyers["M"] = quintile(buyers["total_spent"], higher_is_better=True)
    buyers["rfm_score"] = buyers["R"] + buyers["F"] + buyers["M"]

    working = working.merge(
        buyers[["customer_id", "R", "F", "M", "rfm_score"]], on="customer_id", how="left"
    )
    working.loc[never_ordered, "R"] = 0
    working.loc[never_ordered, "F"] = 0
    working.loc[never_ordered, "M"] = 0
    working.loc[never_ordered, "rfm_score"] = 0

    def label(score: int) -> str:
        if score == 0:
            return "Never ordered"
        if score >= 13:
            return "Champions"
        if score >= 10:
            return "Loyal"
        return "At risk"

    working["segment"] = working["rfm_score"].apply(label)
    return working


def summarize(df: pd.DataFrame) -> None:
    concentration = revenue_concentration(df)
    print("\nRevenue concentration (real customer_metrics data)\n")
    for key, value in concentration.items():
        print(f"  {key}: {value}")

    segmented = rfm_segments(df)
    counts = segmented["segment"].value_counts()
    revenue_by_segment = segmented.groupby("segment")["total_spent"].sum().round(2)

    print("\nRFM segment distribution\n")
    summary = pd.DataFrame({"customers": counts, "total_revenue": revenue_by_segment}).fillna(0)
    summary["avg_revenue_per_customer"] = (summary["total_revenue"] / summary["customers"]).round(2)
    print(summary.sort_values("total_revenue", ascending=False).to_string())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--company-id", default=None)
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise SystemExit("Set DATABASE_URL (e.g. the local Supabase Postgres URL).")

    engine = create_engine(db_url)
    data = load_customer_metrics(engine, args.company_id)
    if data.empty:
        raise SystemExit("No customer_metrics rows found for that company.")

    summarize(data)

    out_path = "packages/evals/python/rfm_segments.csv"
    rfm_segments(data).to_csv(out_path, index=False)
    print(f"\nPer-customer segment assignments written to {out_path}")
