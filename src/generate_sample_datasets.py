"""Generate 5 diverse, realistic sample customer datasets for the Campaign Planner.

All 5 datasets are derived directly from the real Kevin Hillstrom RCT held-out test split,
ensuring zero data leakage and authentic empirical distributions.

Datasets generated in web/public/data/samples/:
1. sample_test_cohort_500.csv      - 500 customers (balanced random benchmark)
2. sample_real_cohort_5000.csv     - 5,000 customers (large real-world experiment cohort)
3. sample_dormant_vips.csv         - 600 customers (history >= $300, recency >= 7)
4. sample_active_multichannel.csv  - 750 customers (recency <= 3, multichannel shoppers)
5. sample_first_time_buyers.csv    - 800 customers (newbie == 1, history < $150)

Also updates web/public/data/samples/manifest.json for client metadata.
"""

import json
from pathlib import Path
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_COLUMNS = [
    "recency",
    "history_segment",
    "history",
    "mens",
    "womens",
    "zip_code",
    "newbie",
    "channel",
]


def main():
    data_path = PROJECT_ROOT / "data" / "hillstrom.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Missing {data_path}")

    df_raw = pd.read_csv(data_path)
    output_dir = PROJECT_ROOT / "web" / "public" / "data" / "samples"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Recreate the exact 60/40 train/test split from seed 0 (matching export_model_params.py)
    import sys
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    from src.preprocess import make_splits

    _, test_idx = make_splits(df_raw, outcome="visit", mode="any", seed=0)
    test_df = df_raw.iloc[test_idx].copy()
    print(f"Total held-out test rows available (seed 0): {len(test_df):,}")

    rng = np.random.RandomState(0)

    # 1. Balanced Random Sample (500)
    # Ensure this matches the existing web/public/data/sample_customers.csv exactly
    sample_500 = test_df.iloc[:500][RAW_COLUMNS].copy()
    p1 = output_dir / "sample_test_cohort_500.csv"
    sample_500.to_csv(p1, index=False)
    print(f"[1/5] Generated {p1.name} with {len(sample_500)} rows")

    # 2. Large Real Cohort (5,000)
    sample_5000 = test_df.iloc[:5000][RAW_COLUMNS].copy()
    p2 = output_dir / "sample_real_cohort_5000.csv"
    sample_5000.to_csv(p2, index=False)
    print(f"[2/5] Generated {p2.name} with {len(sample_5000)} rows")

    # 3. Dormant High-Value VIPs (600)
    vip_pool = test_df[(test_df["history"] >= 300.0) & (test_df["recency"] >= 7)].copy()
    n_vip = min(600, len(vip_pool))
    sample_vips = vip_pool.sample(n=n_vip, random_state=0)[RAW_COLUMNS].copy()
    p3 = output_dir / "sample_dormant_vips.csv"
    sample_vips.to_csv(p3, index=False)
    print(f"[3/5] Generated {p3.name} with {len(sample_vips)} rows (pool: {len(vip_pool)})")

    # 4. Active Omnichannel Shoppers (750)
    omni_pool = test_df[(test_df["recency"] <= 3) & (test_df["channel"] == "Multichannel")].copy()
    n_omni = min(750, len(omni_pool))
    sample_omni = omni_pool.sample(n=n_omni, random_state=0)[RAW_COLUMNS].copy()
    p4 = output_dir / "sample_active_multichannel.csv"
    sample_omni.to_csv(p4, index=False)
    print(f"[4/5] Generated {p4.name} with {len(sample_omni)} rows (pool: {len(omni_pool)})")

    # 5. First-Time Buyers / Newbies (800)
    newbie_pool = test_df[(test_df["newbie"] == 1) & (test_df["history"] < 150.0)].copy()
    n_newbie = min(800, len(newbie_pool))
    sample_newbie = newbie_pool.sample(n=n_newbie, random_state=0)[RAW_COLUMNS].copy()
    p5 = output_dir / "sample_first_time_buyers.csv"
    sample_newbie.to_csv(p5, index=False)
    print(f"[5/5] Generated {p5.name} with {len(sample_newbie)} rows (pool: {len(newbie_pool)})")

    # Manifest file with metadata
    manifest = [
        {
            "id": "test_cohort_500",
            "name": "Standard Benchmark",
            "badge": "Balanced RCT Split",
            "rows": len(sample_500),
            "filename": "sample_test_cohort_500.csv",
            "url": "/data/samples/sample_test_cohort_500.csv",
            "tagline": "500 real customers from test split",
            "description": "Representative cross-section of 500 held-out customers across all channels, history brackets, and urban/rural regions.",
            "scenario": "General promotional campaign evaluating broad-brush baseline targeting vs. causal uplift."
        },
        {
            "id": "real_cohort_5000",
            "name": "Real Full Test Cohort",
            "badge": "Large Real Dataset",
            "rows": len(sample_5000),
            "filename": "sample_real_cohort_5000.csv",
            "url": "/data/samples/sample_real_cohort_5000.csv",
            "tagline": "5,000 real customers directly from RCT",
            "description": "Full 5,000-customer slice from the real 2008 Kevin Hillstrom experiment. Tests client-side browser throughput and large-budget profit optimization.",
            "scenario": "Enterprise campaign planning with high customer volume, realistic contact costs, and substantial dollar returns."
        },
        {
            "id": "dormant_vips",
            "name": "Dormant VIP Customers",
            "badge": "Win-Back Cohort",
            "rows": len(sample_vips),
            "filename": "sample_dormant_vips.csv",
            "url": "/data/samples/sample_dormant_vips.csv",
            "tagline": "600 customers · History ≥ $300 · Recency ≥ 7 mos",
            "description": "High-lifetime-value customers at serious risk of churn who have not purchased in over 7 months.",
            "scenario": "Reactivation / Win-back campaign: isolates Persuadables from Sleeping Dogs who might unsubscribe when nudged."
        },
        {
            "id": "active_multichannel",
            "name": "Active Omnichannel Shoppers",
            "badge": "Sure Thing Risk",
            "rows": len(sample_omni),
            "filename": "sample_active_multichannel.csv",
            "url": "/data/samples/sample_active_multichannel.csv",
            "tagline": "750 customers · Recency ≤ 3 mos · Web + Phone",
            "description": "Highly engaged omnichannel customers who purchased within the last 90 days and shop across multiple touchpoints.",
            "scenario": "Cross-sell campaign: reveals how naive response targeting wastes precious budget on 'Sure Things' who buy anyway."
        },
        {
            "id": "first_time_buyers",
            "name": "First-Time Buyers (Newbies)",
            "badge": "Onboarding Cohort",
            "rows": len(sample_newbie),
            "filename": "sample_first_time_buyers.csv",
            "url": "/data/samples/sample_first_time_buyers.csv",
            "tagline": "800 customers · First-time buyers · Spend < $150",
            "description": "Newly acquired customers with modest initial purchases who are making decisions about their second brand purchase.",
            "scenario": "Onboarding & early-lifecycle activation: identifying which new customers need targeted incentives to repeat buy."
        }
    ]

    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved manifest: {manifest_path}")

    # Also also copy manifest and sample_test_cohort_500 to web/public/data/sample_customers.csv for root compatibility
    root_sample_path = PROJECT_ROOT / "web" / "public" / "data" / "sample_customers.csv"
    sample_500.to_csv(root_sample_path, index=False)
    print(f"Confirmed root sample compatibility: {root_sample_path}")


if __name__ == "__main__":
    main()
