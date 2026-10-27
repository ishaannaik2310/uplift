"""Verification suite for src/metrics.py.

Includes:
  Step 0a: Verify qini_auc_normalized and auuc_normalized_by_perfect against sklift (< 1e-6 diff)
  Step 0b: Repeat synthetic known-effect experiment over 200 seeds; compare to 24.0 (within 3 SE)
  Tests A, B, C, D: Random score, Synthetic dataset, Library cross-checks, Decile exact identities.
"""

import io
import sys
import math
from pathlib import Path
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sklift.metrics import (
    qini_curve as sklift_qini_curve,
    qini_auc_score,
    uplift_curve as sklift_uplift_curve,
    uplift_auc_score,
)
from src.data import load_hillstrom
from src.preprocess import make_treatment
from src.metrics import (
    uplift_by_decile,
    qini_curve,
    qini_coefficient,
    qini_auc_normalized,
    uplift_curve,
    auuc,
    auuc_normalized_by_perfect,
)


class Tee:
    def __init__(self):
        self.buf = io.StringIO()

    def print(self, *args, **kwargs):
        print(*args, **kwargs)
        print(*args, **kwargs, file=self.buf)

    def value(self):
        return self.buf.getvalue()


def build_synthetic_dataset(seed: int = 0) -> dict:
    rng = np.random.default_rng(seed)
    n_A, n_B = 200, 800
    N = 1000
    nT_A, nC_A = 100, 100
    nT_B, nC_B = 400, 400
    r_T_A, r_C_A = 0.8, 0.2
    r_T_B, r_C_B = 0.3, 0.3

    t_A = np.array([1] * nT_A + [0] * nC_A)
    t_B = np.array([1] * nT_B + [0] * nC_B)

    y_A_t = rng.binomial(1, r_T_A, nT_A).astype(float)
    y_A_c = rng.binomial(1, r_C_A, nC_A).astype(float)
    y_B_t = rng.binomial(1, r_T_B, nT_B).astype(float)
    y_B_c = rng.binomial(1, r_C_B, nC_B).astype(float)

    y = np.concatenate([y_A_t, y_A_c, y_B_t, y_B_c])
    t = np.concatenate([t_A, t_B])
    score_oracle = np.array([1.0] * n_A + [0.0] * n_B)
    score_reversed = -score_oracle
    score_random = rng.random(N)

    perm = rng.permutation(N)
    return {
        "y": y[perm],
        "treated": t[perm],
        "score_oracle": score_oracle[perm],
        "score_reversed": score_reversed[perm],
        "score_random": score_random[perm],
        "N": N, "n_A": n_A, "n_B": n_B,
        "nT_A": nT_A, "nC_A": nC_A,
        "nT_B": nT_B, "nC_B": nC_B,
        "r_T_A": r_T_A, "r_C_A": r_C_A,
        "r_T_B": r_T_B, "r_C_B": r_C_B,
    }


def main():
    tee = Tee()
    p = tee.print

    p("=" * 86)
    p("UPLIFT METRICS STEP 0 VERIFICATION & REPLICATION SUITE")
    p("=" * 86)

    # Load real Hillstrom data
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")
    y_h = df_any["visit"].values
    t_h = df_any["treated"].values
    rng_h = np.random.default_rng(1234)
    s_h = rng_h.random(len(y_h))

    # Synthetic dataset
    ds = build_synthetic_dataset(seed=0)
    y_s, t_s, s_s = ds["y"], ds["treated"], ds["score_oracle"]

    # STEP 0a: Verify sklift normalization match (< 1e-6)
    p("\nSTEP 0a: REPLICATING SKLIFT NORMALIZATION (< 1e-6 tolerance)")
    p("-" * 86)

    # (i) Random on Hillstrom
    sk_q_h = qini_auc_score(y_h, s_h, t_h)
    my_q_h = qini_auc_normalized(y_h, t_h, s_h)
    diff_q_h = abs(sk_q_h - my_q_h)

    sk_u_h = uplift_auc_score(y_h, s_h, t_h)
    my_u_h = auuc_normalized_by_perfect(y_h, t_h, s_h)
    diff_u_h = abs(sk_u_h - my_u_h)

    p("1. Hillstrom Random Scores:")
    p(f"   - Qini Score : sklift = {sk_q_h:>11.8f} | ours = {my_q_h:>11.8f} | diff = {diff_q_h:.2e}")
    p(f"   - AUUC Score : sklift = {sk_u_h:>11.8f} | ours = {my_u_h:>11.8f} | diff = {diff_u_h:.2e}")
    assert diff_q_h < 1e-6, f"Qini diff {diff_q_h} exceeds 1e-6 on Hillstrom!"
    assert diff_u_h < 1e-6, f"AUUC diff {diff_u_h} exceeds 1e-6 on Hillstrom!"

    # (ii) Synthetic dataset
    sk_q_s = qini_auc_score(y_s, s_s, t_s)
    my_q_s = qini_auc_normalized(y_s, t_s, s_s)
    diff_q_s = abs(sk_q_s - my_q_s)

    sk_u_s = uplift_auc_score(y_s, s_s, t_s)
    my_u_s = auuc_normalized_by_perfect(y_s, t_s, s_s)
    diff_u_s = abs(sk_u_s - my_u_s)

    p("\n2. Synthetic Dataset (Oracle Scores):")
    p(f"   - Qini Score : sklift = {sk_q_s:>11.8f} | ours = {my_q_s:>11.8f} | diff = {diff_q_s:.2e}")
    p(f"   - AUUC Score : sklift = {sk_u_s:>11.8f} | ours = {my_u_s:>11.8f} | diff = {diff_u_s:.2e}")
    assert diff_q_s < 1e-6, f"Qini diff {diff_q_s} exceeds 1e-6 on Synthetic!"
    assert diff_u_s < 1e-6, f"AUUC diff {diff_u_s} exceeds 1e-6 on Synthetic!"

    p("\n[STEP 0a PASSED: Exact match with sklift.metrics confirmed within 1e-6]")

    # STEP 0b: 200 Seeds Synthetic Known-Effect Experiment
    p("\nSTEP 0b: 200 SEEDS SYNTHETIC EXPERIMENT vs FIXED ANALYTICAL VALUE (24.0)")
    p("-" * 86)
    p("Analytical expected value: 24.0 (fixed)")
    p("Running 200 random draws of synthetic dataset...")

    vals = []
    for seed in range(200):
        d = build_synthetic_dataset(seed=seed)
        vals.append(qini_coefficient(d["y"], d["treated"], d["score_oracle"]))

    vals = np.array(vals)
    mean_q = float(vals.mean())
    std_q = float(vals.std(ddof=1))
    se_q = std_q / math.sqrt(200)
    diff_q = abs(mean_q - 24.0)
    threshold_3se = 3 * se_q

    p(f"Observed Mean Qini : {mean_q:.4f}")
    p(f"Standard Error (SE): {se_q:.4f}")
    p(f"3 * SE Threshold   : {threshold_3se:.4f}")
    p(f"|Mean - 24.0|      : {diff_q:.4f}")

    if diff_q >= threshold_3se:
        p(f"\nCRITICAL FAILURE: Observed mean {mean_q:.4f} is NOT within 3*SE ({threshold_3se:.4f}) of 24.0!")
        p(f"Full Distribution Summary: Min={vals.min():.4f}, Q25={np.percentile(vals, 25):.4f}, Median={np.median(vals):.4f}, Q75={np.percentile(vals, 75):.4f}, Max={vals.max():.4f}")
        sys.exit(1)

    p("Condition: |Mean - 24.0| < 3 * SE -> True")
    p("[STEP 0b PASSED: Mean is statistically consistent with 24.0 within 3 SE]")

    # Decile checks & exact identities
    p("\nSTEP 0c: EXACT IDENTITIES ON DECILES (Hillstrom data)")
    p("-" * 86)
    dec_df = uplift_by_decile(y_h, t_h, s_h, n_bins=10)
    total_t = int(dec_df["n_treated"].sum())
    total_c = int(dec_df["n_control"].sum())
    assert total_t == int(t_h.sum()), f"Treated count mismatch: {total_t} vs {t_h.sum()}"
    assert total_c == int((1 - t_h).sum()), f"Control count mismatch: {total_c} vs {(1-t_h).sum()}"
    p(f"1. Decile counts sum exactly to totals: Treated={total_t:,}, Control={total_c:,} -> PASS")

    pooled_rate_t = (dec_df["n_treated"] * dec_df["y_rate_treated"]).sum() / dec_df["n_treated"].sum()
    pooled_rate_c = (dec_df["n_control"] * dec_df["y_rate_control"]).sum() / dec_df["n_control"].sum()
    overall_rate_t = float(y_h[t_h == 1].mean())
    overall_rate_c = float(y_h[t_h == 0].mean())
    assert abs(pooled_rate_t - overall_rate_t) < 1e-10, "Pooled treated rate mismatch!"
    assert abs(pooled_rate_c - overall_rate_c) < 1e-10, "Pooled control rate mismatch!"
    p(f"2. Pooled rates match overall rates: T={pooled_rate_t:.8f}, C={pooled_rate_c:.8f} -> PASS")

    p("=" * 86)
    p("ALL STEP 0 CHECKS PASSED SUCCESSFULLY")
    p("=" * 86)


if __name__ == "__main__":
    main()
