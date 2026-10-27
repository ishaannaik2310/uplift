"""Randomization balance check for the Hillstrom email experiment.

Computes Standardized Mean Difference (SMD) across all features to verify
that randomized treatment assignment balanced customer covariates.
"""

import sys
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data import load_hillstrom
from src.preprocess import build_features, make_treatment


def compute_balance(df: pd.DataFrame, mode: str = "any") -> pd.DataFrame:
    """Compute mean in treated vs control and Standardized Mean Difference (SMD).

    Args:
        df: Raw Hillstrom DataFrame.
        mode: Treatment encoding mode ("any" or "mens").

    Returns:
        pd.DataFrame: Table with feature-level means, stds, SMD, and balance flags.
    """
    # Build features from the filtered DataFrame returned by make_treatment
    df_treated = make_treatment(df, mode=mode)
    X = build_features(df_treated)
    treated = df_treated["treated"].values

    t_mask = treated == 1
    c_mask = treated == 0

    records = []
    for col in X.columns:
        x_t = X.loc[t_mask, col].values.astype(float)
        x_c = X.loc[c_mask, col].values.astype(float)

        mean_t = float(np.mean(x_t))
        mean_c = float(np.mean(x_c))
        var_t = float(np.var(x_t, ddof=1))
        var_c = float(np.var(x_c, ddof=1))
        std_t = float(np.sqrt(var_t))
        std_c = float(np.sqrt(var_c))

        pooled_std = float(np.sqrt((var_t + var_c) / 2.0))
        if pooled_std > 0:
            smd = (mean_t - mean_c) / pooled_std
        else:
            smd = 0.0

        abs_smd = abs(smd)
        flagged = abs_smd > 0.1

        records.append({
            "feature": col,
            "mean_treated": mean_t,
            "mean_control": mean_c,
            "std_treated": std_t,
            "std_control": std_c,
            "smd": smd,
            "abs_smd": abs_smd,
            "flagged": flagged,
        })

    return pd.DataFrame(records)


def format_balance_table(balance_df: pd.DataFrame, mode: str = "any") -> str:
    """Format balance results into a readable text table."""
    lines = []
    lines.append("=" * 86)
    lines.append(f"COVARIATE BALANCE CHECK (RANDOMIZATION CHECK) -- MODE: '{mode.upper()}'")
    lines.append("=" * 86)
    lines.append(
        f"{'Feature':<25} {'Mean(T)':>10} {'Mean(C)':>10} {'Std(T)':>10} {'Std(C)':>10} {'SMD':>10} {'Flag (|SMD|>0.1)':>18}"
    )
    lines.append("-" * 86)

    for _, row in balance_df.iterrows():
        flag_str = "FLAGGED" if row["flagged"] else "OK (balanced)"
        lines.append(
            f"{row['feature']:<25} "
            f"{row['mean_treated']:>10.4f} "
            f"{row['mean_control']:>10.4f} "
            f"{row['std_treated']:>10.4f} "
            f"{row['std_control']:>10.4f} "
            f"{row['smd']:>+10.4f} "
            f"{flag_str:>18}"
        )

    lines.append("-" * 86)
    flagged_rows = balance_df[balance_df["flagged"]]
    if len(flagged_rows) > 0:
        lines.append(f"WARNING: {len(flagged_rows)} feature(s) FLAGGED with |SMD| > 0.1:")
        for _, row in flagged_rows.iterrows():
            lines.append(f"  - {row['feature']}: SMD = {row['smd']:+.4f}")
    else:
        lines.append("BALANCE VERIFIED: All features have |SMD| <= 0.1 (no significant covariate imbalance).")
    lines.append("=" * 86)

    return "\n".join(lines)


def run_and_save_balance_check(
    df: Optional[pd.DataFrame] = None,
    mode: str = "any",
    results_dir: Optional[Path] = None,
) -> pd.DataFrame:
    """Compute balance, print formatted table, and persist CSV and TXT artifacts."""
    if df is None:
        df = load_hillstrom()

    out_dir = results_dir if results_dir else PROJECT_ROOT / "results"
    out_dir.mkdir(parents=True, exist_ok=True)

    balance_df = compute_balance(df, mode=mode)
    table_text = format_balance_table(balance_df, mode=mode)

    # Persist CSV and TXT
    csv_path = out_dir / "balance_check.csv"
    txt_path = out_dir / "balance_check.txt"

    balance_df.to_csv(csv_path, index=False)
    txt_path.write_text(table_text, encoding="utf-8")

    return balance_df


if __name__ == "__main__":
    df_raw = load_hillstrom()
    b_df = run_and_save_balance_check(df_raw, mode="any")
    print(format_balance_table(b_df, mode="any"))
