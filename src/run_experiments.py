"""Run complete uplift benchmark experiments across 10 seeds.

Generates evaluation metrics, paired statistical tests vs naive baseline,
decile tables, prediction files, and Qini curve visualizations.
"""

import os
from pathlib import Path

# Ensure Matplotlib config dir is inside workspace to avoid permission/scanning hangs
_mpl_cache = Path(__file__).resolve().parent.parent / ".matplotlib_cache"
_mpl_cache.mkdir(parents=True, exist_ok=True)
os.environ["MPLCONFIGDIR"] = str(_mpl_cache)

import json
import time
import sys
from typing import Dict, List, Any
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import sklearn
import xgboost
import sklift
from src.data import load_hillstrom
from src.preprocess import make_treatment, make_splits, build_features, get_seeds
from src.metrics import (
    qini_curve,
    qini_coefficient,
    qini_auc_normalized,
    auuc,
    auuc_normalized_by_perfect,
    uplift_by_decile,
)
from src.models import (
    tune_xgb_classifier,
    predict_random,
    predict_baseline_response,
    predict_s_learner,
    predict_t_learner,
    predict_x_learner,
)

GRID_POINTS = 101
COMMON_GRID = np.linspace(0, 1, GRID_POINTS)


def compute_top_k_uplift(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
    k: float = 0.3,
) -> float:
    """Calculate observed uplift (treated rate - control rate) among the top-k fraction."""
    n_top = int(np.ceil(k * len(y)))
    order = np.argsort(-score, kind="stable")
    y_top = y[order[:n_top]]
    t_top = treated[order[:n_top]]

    n_t = t_top.sum()
    n_c = len(t_top) - n_t
    assert n_t > 0, f"No treated units in top {k*100:.0f}%"
    assert n_c > 0, f"No control units in top {k*100:.0f}%"

    rate_t = y_top[t_top == 1].mean()
    rate_c = y_top[t_top == 0].mean()
    return float(rate_t - rate_c)


def main():
    start_time = time.time()
    results_dir = PROJECT_ROOT / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 86)
    print("STARTING UPLIFT BENCHMARK EXPERIMENT")
    print("=" * 86)

    # 1. Load data & construct features
    print("Loading Hillstrom dataset (mode='any')...")
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")
    X = build_features(df_any)
    y_all = df_any["visit"].values
    t_all = df_any["treated"].values
    seeds = get_seeds()

    print(f"Dataset: {len(df_any):,} rows | 15 engineered features | {len(seeds)} evaluation seeds: {seeds}")

    # 2. Save run configuration
    run_config = {
        "seeds": seeds,
        "mode": "any",
        "outcome": "visit",
        "n_samples": len(df_any),
        "n_features": X.shape[1],
        "feature_names": list(X.columns),
        "library_versions": {
            "python": sys.version,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit-learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "scikit-uplift": sklift.__version__,
        },
    }
    with open(results_dir / "run_config.json", "w", encoding="utf-8") as f:
        json.dump(run_config, f, indent=2)
    print(f"Run configuration saved to {results_dir / 'run_config.json'}")

    # 3. XGBoost Hyperparameter Tuning on Seed 0 Training Split Only
    print("\nTuning XGBoost on seed 0 training split (3-fold CV log loss)...")
    train_idx_0, test_idx_0 = make_splits(df_raw, outcome="visit", mode="any", seed=0)
    X_train_0, y_train_0 = X.iloc[train_idx_0], y_all[train_idx_0]

    tune_start = time.time()
    best_xgb_params = tune_xgb_classifier(X_train_0, y_train_0, seed=0)
    tune_duration = time.time() - tune_start

    print(f"Tuned XGBoost parameters ({tune_duration:.1f}s): {best_xgb_params}")
    with open(results_dir / "xgb_params.json", "w", encoding="utf-8") as f:
        json.dump(best_xgb_params, f, indent=2)
    print(f"XGBoost parameters saved to {results_dir / 'xgb_params.json'}")
    print("NOTE: Selected hyperparameters are frozen across all 10 evaluation seeds.")

    # Model definitions
    model_configs = [
        ("random", "none", predict_random),
        ("baseline_response", "lr", predict_baseline_response),
        ("baseline_response", "xgb", predict_baseline_response),
        ("s_learner", "lr", predict_s_learner),
        ("s_learner", "xgb", predict_s_learner),
        ("t_learner", "lr", predict_t_learner),
        ("t_learner", "xgb", predict_t_learner),
        ("x_learner", "lr", predict_x_learner),
        ("x_learner", "xgb", predict_x_learner),
    ]

    metrics_records: List[Dict[str, Any]] = []
    curve_records: List[Dict[str, Any]] = []
    deciles_seed0: List[pd.DataFrame] = []
    predictions_seed0: Dict[str, np.ndarray] = {}

    print("\nEvaluating models across 10 random stratified splits...")

    for seed_idx, seed in enumerate(seeds):
        seed_t0 = time.time()
        train_idx, test_idx = make_splits(df_raw, outcome="visit", mode="any", seed=seed)
        X_tr, y_tr, t_tr = X.iloc[train_idx], y_all[train_idx], t_all[train_idx]
        X_te, y_te, t_te = X.iloc[test_idx], y_all[test_idx], t_all[test_idx]

        for model_name, base_learner, predict_fn in model_configs:
            # Model prediction
            if model_name == "random":
                score = predict_fn(X_te, seed=seed)
            else:
                score = predict_fn(
                    X_tr, y_tr, t_tr, X_te,
                    base_learner=base_learner,
                    seed=seed,
                    xgb_params=best_xgb_params,
                )

            # Strict validation: no NaN predictions
            if np.isnan(score).any():
                raise ValueError(f"CRITICAL: NaN detected in predictions for {model_name}_{base_learner} at seed {seed}!")

            # If seed 0, store predictions
            if seed == 0:
                pred_col = f"score_{model_name}" if base_learner == "none" else f"score_{model_name}_{base_learner}"
                predictions_seed0[pred_col] = score
                # Also compute and record decile table
                dec_df = uplift_by_decile(y_te, t_te, score, n_bins=10)
                dec_df["model"] = model_name
                dec_df["base_learner"] = base_learner
                dec_df["seed"] = seed
                deciles_seed0.append(dec_df)

            # Metrics
            q_raw = qini_coefficient(y_te, t_te, score)
            q_per_n = q_raw / len(y_te)
            q_norm = qini_auc_normalized(y_te, t_te, score)
            u_norm = auuc(y_te, t_te, score, normalize=True)
            u_perf = auuc_normalized_by_perfect(y_te, t_te, score)
            top30 = compute_top_k_uplift(y_te, t_te, score, k=0.3)

            # Strict metric validation
            for m_val, m_name in [
                (q_raw, "qini_raw"), (q_norm, "qini_normalized"),
                (u_norm, "auuc_norm"), (top30, "uplift_top30")
            ]:
                if np.isnan(m_val):
                    raise ValueError(f"CRITICAL: NaN metric '{m_name}' for {model_name}_{base_learner} at seed {seed}!")

            metrics_records.append({
                "seed": seed,
                "model": model_name,
                "base_learner": base_learner,
                "qini_raw": q_raw,
                "qini_per_N": q_per_n,
                "qini_normalized": q_norm,
                "auuc_norm": u_norm,
                "auuc_perf": u_perf,
                "uplift_top30": top30,
            })

            # Qini curve on common 101-point grid
            x_curve, q_curve = qini_curve(y_te, t_te, score)
            q_interp = np.interp(COMMON_GRID, x_curve, q_curve)
            for frac, q_val in zip(COMMON_GRID, q_interp):
                curve_records.append({
                    "seed": seed,
                    "model": model_name,
                    "base_learner": base_learner,
                    "fraction": frac,
                    "qini_val": q_val,
                })

        seed_elapsed = time.time() - seed_t0
        print(f"  Seed {seed:>2}/9 complete in {seed_elapsed:>4.1f}s")

    # 4. Save metrics_by_seed.csv
    df_metrics = pd.DataFrame(metrics_records)
    metrics_by_seed_path = results_dir / "metrics_by_seed.csv"
    df_metrics.to_csv(metrics_by_seed_path, index=False)
    print(f"\nSaved seed-level metrics: {metrics_by_seed_path}")

    # 5. Save metrics_summary.csv
    summary_cols = ["qini_raw", "qini_per_N", "qini_normalized", "auuc_norm", "auuc_perf", "uplift_top30"]
    summary_records = []
    grouped = df_metrics.groupby(["model", "base_learner"], as_index=False)
    for (model, bl), grp in grouped:
        rec = {"model": model, "base_learner": bl}
        for col in summary_cols:
            rec[f"{col}_mean"] = float(grp[col].mean())
            rec[f"{col}_std"] = float(grp[col].std(ddof=1))
        summary_records.append(rec)
    df_summary = pd.DataFrame(summary_records)
    summary_path = results_dir / "metrics_summary.csv"
    df_summary.to_csv(summary_path, index=False)
    print(f"Saved metrics summary: {summary_path}")

    # 6. Paired Statistical Comparison vs Baseline
    paired_records = []
    for bl in ["lr", "xgb"]:
        base_scores = df_metrics[
            (df_metrics["model"] == "baseline_response") & (df_metrics["base_learner"] == bl)
        ].set_index("seed")["qini_normalized"]

        for model in ["s_learner", "t_learner", "x_learner"]:
            mod_scores = df_metrics[
                (df_metrics["model"] == model) & (df_metrics["base_learner"] == bl)
            ].set_index("seed")["qini_normalized"]

            diff = mod_scores - base_scores
            paired_records.append({
                "model": model,
                "base_learner": bl,
                "baseline_model": f"baseline_response_{bl}",
                "mean_diff_qini_norm": float(diff.mean()),
                "std_diff_qini_norm": float(diff.std(ddof=1)),
                "min_diff": float(diff.min()),
                "max_diff": float(diff.max()),
                "n_seeds_winning": int((diff > 0).sum()),
                "total_seeds": len(diff),
                "win_rate": float((diff > 0).mean()),
            })

    # Also compare random vs baseline_response_lr
    rand_scores = df_metrics[df_metrics["model"] == "random"].set_index("seed")["qini_normalized"]
    base_lr_scores = df_metrics[
        (df_metrics["model"] == "baseline_response") & (df_metrics["base_learner"] == "lr")
    ].set_index("seed")["qini_normalized"]
    diff_rand = rand_scores - base_lr_scores
    paired_records.append({
        "model": "random",
        "base_learner": "none",
        "baseline_model": "baseline_response_lr",
        "mean_diff_qini_norm": float(diff_rand.mean()),
        "std_diff_qini_norm": float(diff_rand.std(ddof=1)),
        "min_diff": float(diff_rand.min()),
        "max_diff": float(diff_rand.max()),
        "n_seeds_winning": int((diff_rand > 0).sum()),
        "total_seeds": len(diff_rand),
        "win_rate": float((diff_rand > 0).mean()),
    })

    df_paired = pd.DataFrame(paired_records)
    paired_path = results_dir / "paired_vs_baseline.csv"
    df_paired.to_csv(paired_path, index=False)
    print(f"Saved paired comparisons: {paired_path}")

    # 7. Aggregate Qini Curves (results/qini_curves.csv)
    df_curves = pd.DataFrame(curve_records)
    curves_agg = df_curves.groupby(["model", "base_learner", "fraction"])["qini_val"].agg(
        mean_q="mean",
        std_q="std"
    ).reset_index()
    curves_path = results_dir / "qini_curves.csv"
    curves_agg.to_csv(curves_path, index=False)
    print(f"Saved Qini curves data: {curves_path}")

    # 8. Decile Tables for Seed 0 (results/decile_seed0.csv)
    df_deciles_seed0 = pd.concat(deciles_seed0, ignore_index=True)
    decile_path = results_dir / "decile_seed0.csv"
    df_deciles_seed0.to_csv(decile_path, index=False)
    print(f"Saved seed-0 decile tables: {decile_path}")

    # 9. Test Predictions for Seed 0 (results/predictions_seed0.csv)
    # Include raw features, original index, treatment, outcomes, and all model predictions
    test_rows_seed0 = df_any.iloc[test_idx_0].copy()
    test_rows_seed0["original_index"] = test_rows_seed0.index

    # Raw features per instruction 7
    raw_feature_cols = ["recency", "history", "mens", "womens", "zip_code", "newbie", "channel"]
    out_cols = ["original_index"] + raw_feature_cols + ["segment", "treated", "visit", "conversion", "spend"]

    df_preds_seed0 = test_rows_seed0[out_cols].copy().reset_index(drop=True)
    for pred_col, scores_arr in predictions_seed0.items():
        df_preds_seed0[pred_col] = scores_arr

    pred_path = results_dir / "predictions_seed0.csv"
    df_preds_seed0.to_csv(pred_path, index=False)
    print(f"Saved seed-0 predictions: {pred_path}")

    # 10. Generate Qini Curve Plot (results/qini_plot.png)
    import matplotlib.pyplot as plt
    plt.figure(figsize=(10, 6.5), dpi=300)
    colors = {
        ("random", "none"): "#7f7f7f",
        ("baseline_response", "lr"): "#1f77b4",
        ("baseline_response", "xgb"): "#aec7e8",
        ("s_learner", "lr"): "#2ca02c",
        ("s_learner", "xgb"): "#98df8a",
        ("t_learner", "lr"): "#ff7f0e",
        ("t_learner", "xgb"): "#ffbb78",
        ("x_learner", "lr"): "#d62728",
        ("x_learner", "xgb"): "#9467bd",
    }
    linestyles = {
        "lr": "-",
        "xgb": "--",
        "none": ":",
    }

    # Plot random diagonal baseline
    total_q_end = curves_agg[curves_agg["fraction"] == 1.0]["mean_q"].mean()
    plt.plot([0, 1], [0, total_q_end], "k:", label="Random targeting line", linewidth=1.5)

    for (model, bl), grp in curves_agg.groupby(["model", "base_learner"]):
        grp_sorted = grp.sort_values("fraction")
        label = f"{model.replace('_', ' ').title()} ({bl.upper()})"
        color = colors.get((model, bl), "#333333")
        ls = linestyles.get(bl, "-")

        plt.plot(grp_sorted["fraction"], grp_sorted["mean_q"], label=label, color=color, linestyle=ls, linewidth=1.8)
        # Add shaded 1-std band for top uplift models
        if model in ["t_learner", "x_learner", "baseline_response"] and bl == "xgb":
            plt.fill_between(
                grp_sorted["fraction"],
                grp_sorted["mean_q"] - grp_sorted["std_q"],
                grp_sorted["mean_q"] + grp_sorted["std_q"],
                color=color,
                alpha=0.15,
            )

    plt.xlabel("Fraction of Population Targeted (ranked descending by score)", fontsize=11)
    plt.ylabel("Cumulative Incremental Responders (Qini Value Q)", fontsize=11)
    plt.title("Mean Qini Curves Across 10 Repeated Stratified Splits (Hillstrom Email)", fontsize=12, pad=12)
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.legend(loc="lower right", fontsize=9, framealpha=0.95)
    plt.tight_layout()

    plot_path = results_dir / "qini_plot.png"
    plt.savefig(plot_path)
    plt.close()
    print(f"Saved Qini curve plot: {plot_path}")

    # 11. Terminal Output Table
    total_runtime = time.time() - start_time
    print("\n" + "=" * 90)
    print(f"BENCHMARK SUMMARY RESULTS ACROSS 10 SEEDS (Total Runtime: {total_runtime:.1f}s)")
    print("=" * 90)
    print(
        f"{'Model':<20} {'Base':<6} "
        f"{'Qini (raw)':>16} "
        f"{'Qini / N':>14} "
        f"{'Qini (sklift)':>15} "
        f"{'Top 30% Uplift':>16}"
    )
    print("-" * 90)

    for _, row in df_summary.iterrows():
        m_name = row["model"]
        bl = row["base_learner"]
        q_raw_str = f"{row['qini_raw_mean']:>7.2f} ± {row['qini_raw_std']:<5.2f}"
        q_per_n_str = f"{row['qini_per_N_mean']:>6.4f} ± {row['qini_per_N_std']:<5.4f}"
        q_norm_str = f"{row['qini_normalized_mean']:>6.4f} ± {row['qini_normalized_std']:<5.4f}"
        top30_str = f"{row['uplift_top30_mean']*100:>5.2f}% ± {row['uplift_top30_std']*100:<4.2f}%"

        print(f"{m_name:<20} {bl:<6} {q_raw_str:>16} {q_per_n_str:>14} {q_norm_str:>15} {top30_str:>16}")

    print("-" * 90)

    print("\n" + "=" * 90)
    print("PAIRED COMPARISON TO NAIVE BASELINE (Normalized Qini Metric across 10 Seeds)")
    print("=" * 90)
    print(f"{'Model':<16} {'Base':<6} {'vs Baseline':<24} {'Mean Diff':>12} {'Std Diff':>10} {'Wins/10':>10} {'Status':>16}")
    print("-" * 90)

    for _, row in df_paired.iterrows():
        m_name = row["model"]
        bl = row["base_learner"]
        base_name = row["baseline_model"]
        mean_d = row["mean_diff_qini_norm"]
        std_d = row["std_diff_qini_norm"]
        wins = f"{int(row['n_seeds_winning'])}/{int(row['total_seeds'])}"
        status = "BEATS BASELINE" if mean_d > 0 and row['n_seeds_winning'] >= 6 else ("TIE / INCONCLUSIVE" if abs(mean_d) < 0.005 else "BELOW BASELINE")
        print(f"{m_name:<16} {bl:<6} {base_name:<24} {mean_d:>+12.4f} {std_d:>10.4f} {wins:>10} {status:>16}")

    print("=" * 90)
    print(f"\nAll benchmark artifacts successfully written to: {results_dir.resolve()}")


if __name__ == "__main__":
    main()
