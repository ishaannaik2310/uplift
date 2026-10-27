"""Nadeau-Bengio corrected resampled t-tests and Holm-Bonferroni adjustments.

Computes statistical significance on paired differences in sklift-normalized
Qini across repeated train-test splits (10 seeds) on the Hillstrom dataset.
"""

from pathlib import Path
from typing import List, Tuple
import numpy as np
import pandas as pd
from scipy import stats

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def nadeau_bengio_ttest(
    diffs: np.ndarray,
    n_train: int = 44800,
    n_test: int = 19200
) -> Tuple[float, float, float, float]:
    """Compute the Nadeau-Bengio (2003) corrected resampled t-test.

    Accounting for the overlap between training sets across repeated splits:
        Var_corrected(d) = (1/J + n_test / n_train) * Var(d)
        t = mean(d) / sqrt(Var_corrected(d))
        df = J - 1

    Args:
        diffs: Array of paired metric differences across J splits.
        n_train: Number of training samples per split (default 44,800).
        n_test: Number of test samples per split (default 19,200).

    Returns:
        Tuple of (mean_diff, std_diff, t_stat, p_value).
    """
    j_splits = len(diffs)
    if j_splits < 2:
        raise ValueError("At least 2 splits are required to compute sample variance.")

    mean_d = float(np.mean(diffs))
    var_d = float(np.var(diffs, ddof=1))
    std_d = float(np.sqrt(var_d))

    # Variance correction factor
    correction = (1.0 / j_splits) + (float(n_test) / float(n_train))
    corrected_var = correction * var_d
    corrected_se = float(np.sqrt(corrected_var))

    if corrected_se == 0.0:
        t_stat = 0.0
        p_val = 1.0
    else:
        t_stat = mean_d / corrected_se
        df = j_splits - 1
        p_val = float(2.0 * stats.t.sf(np.abs(t_stat), df=df))

    return mean_d, std_d, t_stat, p_val


def holm_adjust(p_values: List[float]) -> np.ndarray:
    """Compute step-down Holm-Bonferroni adjusted p-values.

    For m ordered p-values p_(1) <= ... <= p_(m):
        p_adj_(k) = min(1.0, max_{i <= k} (m - i + 1) * p_(i))

    Args:
        p_values: List or array of raw p-values.

    Returns:
        Array of adjusted p-values in the original order.
    """
    m = len(p_values)
    if m == 0:
        return np.array([], dtype=float)

    p_arr = np.array(p_values, dtype=float)
    order = np.argsort(p_arr)
    sorted_p = p_arr[order]

    adjusted_sorted = np.zeros(m, dtype=float)
    running_max = 0.0
    for i in range(m):
        # i is 0-indexed, so rank is i + 1, multiplier is (m - i)
        val = (m - i) * sorted_p[i]
        running_max = max(running_max, val)
        adjusted_sorted[i] = min(1.0, running_max)

    # Invert permutation back to original order
    rev_order = np.empty(m, dtype=int)
    rev_order[order] = np.arange(m)
    return adjusted_sorted[rev_order]


def run_stats_tests(
    metrics_path: Path = PROJECT_ROOT / "results" / "metrics_by_seed.csv",
    output_path: Path = PROJECT_ROOT / "results" / "corrected_tests.csv"
) -> pd.DataFrame:
    """Run all specified corrected t-tests and save results/corrected_tests.csv."""
    if not metrics_path.exists():
        raise FileNotFoundError(f"Missing metrics file: {metrics_path}")

    df_metrics = pd.read_csv(metrics_path)

    # Pivot to get seeds as rows and (model, base_learner) as columns for qini_normalized
    # Model identifier: model_base
    df_metrics["model_key"] = df_metrics["model"] + "_" + df_metrics["base_learner"]
    piv = df_metrics.pivot(index="seed", columns="model_key", values="qini_normalized")

    # Family 1: 6 comparisons vs matching baseline
    comparisons_f1 = [
        ("s_learner_lr", "baseline_response_lr"),
        ("t_learner_lr", "baseline_response_lr"),
        ("x_learner_lr", "baseline_response_lr"),
        ("s_learner_xgb", "baseline_response_xgb"),
        ("t_learner_xgb", "baseline_response_xgb"),
        ("x_learner_xgb", "baseline_response_xgb"),
    ]

    records = []

    # Process Family 1
    raw_p_f1 = []
    f1_stats = []
    for model_a, model_b in comparisons_f1:
        diffs = (piv[model_a] - piv[model_b]).values
        mean_d, std_d, t_stat, p_val = nadeau_bengio_ttest(diffs)
        f1_stats.append((mean_d, std_d, t_stat, p_val))
        raw_p_f1.append(p_val)

    adj_p_f1 = holm_adjust(raw_p_f1)
    for (model_a, model_b), (mean_d, std_d, t_stat, p_val), p_holm in zip(comparisons_f1, f1_stats, adj_p_f1):
        status = "significant at 0.05 after Holm adjustment" if p_holm < 0.05 else "not significant"
        records.append({
            "comparison_group": "uplift_vs_matching_baseline",
            "model_a": model_a,
            "model_b": model_b,
            "mean_diff": mean_d,
            "std_diff": std_d,
            "t_stat": t_stat,
            "p_value_raw": p_val,
            "p_value_holm": p_holm,
            "significance": status
        })

    # Family 2: Pairwise among top 3 uplift models (x_learner_lr, t_learner_lr, s_learner_xgb)
    comparisons_f2 = [
        ("x_learner_lr", "t_learner_lr"),
        ("x_learner_lr", "s_learner_xgb"),
        ("t_learner_lr", "s_learner_xgb"),
    ]

    raw_p_f2 = []
    f2_stats = []
    for model_a, model_b in comparisons_f2:
        diffs = (piv[model_a] - piv[model_b]).values
        mean_d, std_d, t_stat, p_val = nadeau_bengio_ttest(diffs)
        f2_stats.append((mean_d, std_d, t_stat, p_val))
        raw_p_f2.append(p_val)

    adj_p_f2 = holm_adjust(raw_p_f2)
    for (model_a, model_b), (mean_d, std_d, t_stat, p_val), p_holm in zip(comparisons_f2, f2_stats, adj_p_f2):
        status = "significant at 0.05 after Holm adjustment" if p_holm < 0.05 else "not significant"
        records.append({
            "comparison_group": "top3_uplift_pairwise",
            "model_a": model_a,
            "model_b": model_b,
            "mean_diff": mean_d,
            "std_diff": std_d,
            "t_stat": t_stat,
            "p_value_raw": p_val,
            "p_value_holm": p_holm,
            "significance": status
        })

    df_out = pd.DataFrame(records)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_csv(output_path, index=False)
    print(f"Saved corrected statistical test results: {output_path}")

    return df_out


def print_table(df_tests: pd.DataFrame) -> None:
    """Print clean formatted table of test results to terminal."""
    print("\n" + "=" * 110)
    print("NADEAU-BENGIO CORRECTED RESAMPLED T-TESTS (Normalized Qini, J=10 seeds, n_test/n_train = 3/7)")
    print("=" * 110)
    print(f"{'Comparison':<34} {'Mean Diff':>10} {'Std Diff':>10} {'t-stat':>9} {'p (raw)':>9} {'p (Holm)':>9}  {'Status':<30}")
    print("-" * 110)

    current_group = None
    for _, row in df_tests.iterrows():
        if row["comparison_group"] != current_group:
            current_group = row["comparison_group"]
            group_label = "--- Uplift vs Matching Baseline ---" if current_group == "uplift_vs_matching_baseline" else "--- Top 3 Uplift Models Pairwise ---"
            print(f"{group_label}")

        pair_name = f"{row['model_a']} vs {row['model_b']}"
        print(f"  {pair_name:<32} {row['mean_diff']:+10.4f} {row['std_diff']:10.4f} {row['t_stat']:9.3f} {row['p_value_raw']:9.4f} {row['p_value_holm']:9.4f}  {row['significance']}")

    print("=" * 110 + "\n")


if __name__ == "__main__":
    df_res = run_stats_tests()
    print_table(df_res)
