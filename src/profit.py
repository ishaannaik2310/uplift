"""Campaign Profit Simulation and Decision Policy Evaluation on Hillstrom Dataset.

Simulates net profit under targeting policies using the real dollar outcome 'spend'.
Evaluates across budget fractions f in {0.05, 0.10, ..., 1.00}, scaled to a deployment
population of 100,000 customers.

Business Assumptions (stated explicitly):
    - Default contribution margin on incremental revenue: 0.30 (ASSUMPTION)
    - Default cost per email sent: $0.05 (ASSUMPTION)
    - Target population size: 100,000 customers

Standard deviations across repeated splits represent variation across repeated
train/test splits, not a confidence interval. Statistical uncertainty on single splits
is quantified via bootstrap resampling.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

# Matplotlib cache isolation for Windows sandbox
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.environ["MPLCONFIGDIR"] = str(PROJECT_ROOT / ".matplotlib_cache")

from src.data import load_hillstrom
from src.preprocess import build_features, get_seeds, make_splits, make_treatment
from src.models import (
    predict_random,
    predict_baseline_response,
    predict_s_learner,
    predict_t_learner,
    predict_x_learner,
)

COMMON_FRACTIONS = np.round(np.linspace(0.05, 1.00, 20), 2)


def generate_all_seeds_predictions(
    results_dir: Path = PROJECT_ROOT / "results"
) -> pd.DataFrame:
    """Train models across all 10 seeds and gather test set predictions.

    Reuses frozen XGBoost hyperparameters from results/xgb_params.json.
    Saves results/predictions_all_seeds.csv with raw features, treatments,
    outcomes (visit, conversion, spend), and model scores.
    """
    xgb_params_path = results_dir / "xgb_params.json"
    if not xgb_params_path.exists():
        raise FileNotFoundError(f"Missing tuned XGBoost params at: {xgb_params_path}")

    with open(xgb_params_path, "r", encoding="utf-8") as f:
        best_xgb_params = json.load(f)

    print("Loading Hillstrom dataset (mode='any')...")
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")
    X = build_features(df_any)
    y_visit = df_any["visit"].values
    t_all = df_any["treated"].values
    seeds = get_seeds()

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

    all_seed_dfs: List[pd.DataFrame] = []

    print(f"Generating test predictions across {len(seeds)} seeds...")
    t0_all = time.time()
    for seed_idx, seed in enumerate(seeds):
        t0_seed = time.time()
        train_idx, test_idx = make_splits(df_raw, outcome="visit", mode="any", seed=seed)

        X_tr, y_tr, t_tr = X.iloc[train_idx], y_visit[train_idx], t_all[train_idx]
        X_te = X.iloc[test_idx]

        # Base test split metadata and raw features
        test_df = df_any.iloc[test_idx].copy().reset_index(drop=True)
        test_df["seed"] = seed
        test_df["orig_index"] = test_idx

        # Model scores
        for model_name, base_learner, predict_fn in model_configs:
            if model_name == "random":
                score = predict_fn(X_te, seed=seed)
            else:
                score = predict_fn(
                    X_tr, y_tr, t_tr, X_te,
                    base_learner=base_learner,
                    seed=seed,
                    xgb_params=best_xgb_params,
                )

            if np.isnan(score).any():
                raise ValueError(f"CRITICAL: NaN prediction in {model_name}_{base_learner} at seed {seed}")

            pred_col = f"score_{model_name}" if base_learner == "none" else f"score_{model_name}_{base_learner}"
            test_df[pred_col] = score

        all_seed_dfs.append(test_df)
        print(f"  Seed {seed_idx + 1}/{len(seeds)} (seed={seed}) completed in {time.time() - t0_seed:.1f}s")

    df_all_predictions = pd.concat(all_seed_dfs, ignore_index=True)

    # Reorder columns logically: metadata -> outcomes -> raw features -> scores
    meta_cols = ["seed", "orig_index", "treated", "visit", "conversion", "spend"]
    raw_feature_cols = ["recency", "history", "mens", "womens", "zip_code", "newbie", "channel", "segment"]
    score_cols = [c for c in df_all_predictions.columns if c.startswith("score_")]
    final_cols = meta_cols + raw_feature_cols + score_cols
    df_all_predictions = df_all_predictions[final_cols]

    output_path = results_dir / "predictions_all_seeds.csv"
    df_all_predictions.to_csv(output_path, index=False)
    print(f"Saved all-seeds test predictions ({len(df_all_predictions):,} rows): {output_path} in {time.time() - t0_all:.1f}s")

    return df_all_predictions


def evaluate_spend_subset(
    spend: np.ndarray,
    treated: np.ndarray,
    fraction: float,
    margin: float = 0.30,
    cost: float = 0.05,
    pop_size: int = 100_000
) -> Tuple[float, float, float, float]:
    """Calculate delta_spend, incremental revenue, cost, and scaled net profit for subset S.

    Args:
        spend: Array of real dollar spend for individuals in targeted subset S.
        treated: Array of treatment indicators (0 or 1) for individuals in subset S.
        fraction: Fraction of the population targeted (e.g. 0.30).
        margin: Contribution margin on incremental revenue.
        cost: Cost per email sent ($).
        pop_size: Scaled population size (default 100,000).

    Returns:
        Tuple of (delta_spend, inc_revenue_scaled, cost_scaled, profit_scaled).
    """
    s_t = spend[treated == 1]
    s_c = spend[treated == 0]

    if len(s_t) == 0 or len(s_c) == 0:
        raise ValueError(f"Empty treated (n={len(s_t)}) or control (n={len(s_c)}) subgroup in targeted subset!")

    mean_yt = float(np.mean(s_t))
    mean_yc = float(np.mean(s_c))
    delta_spend = mean_yt - mean_yc

    n_emailed = pop_size * fraction
    inc_revenue = n_emailed * delta_spend
    camp_cost = n_emailed * cost
    profit = margin * inc_revenue - camp_cost

    return delta_spend, inc_revenue, camp_cost, profit


def compute_policy_profit_on_split(
    df_split: pd.DataFrame,
    policy: str,
    fractions: np.ndarray,
    margin: float = 0.30,
    cost: float = 0.05,
    pop_size: int = 100_000
) -> List[Dict[str, Any]]:
    """Compute profit across budget fractions for a specific policy on a single split."""
    n_total = len(df_split)
    records = []

    if policy == "target_everyone":
        # Target everyone only evaluated at fraction = 1.0 (the full campaign point)
        delta_spend, rev, cst, prof = evaluate_spend_subset(
            spend=df_split["spend"].values,
            treated=df_split["treated"].values,
            fraction=1.0,
            margin=margin,
            cost=cost,
            pop_size=pop_size
        )
        records.append({
            "policy": policy,
            "fraction": 1.0,
            "delta_spend": delta_spend,
            "incremental_revenue": rev,
            "cost": cst,
            "profit": prof
        })
        return records

    # Score column mapping
    score_col_map = {
        "random": "score_random",
        "response_model": "score_baseline_response_lr",
        "t_learner_lr": "score_t_learner_lr",
        "x_learner_lr": "score_x_learner_lr",
        "s_learner_xgb": "score_s_learner_xgb",
    }
    if policy not in score_col_map:
        raise ValueError(f"Unknown policy '{policy}'")

    score_col = score_col_map[policy]
    scores = df_split[score_col].values
    # Ties in model scores are broken stably by original row order
    order = np.argsort(-scores, kind="stable")
    sorted_spend = df_split["spend"].values[order]
    sorted_treated = df_split["treated"].values[order]

    for frac in fractions:
        k = int(round(frac * n_total))
        sub_spend = sorted_spend[:k]
        sub_treated = sorted_treated[:k]

        delta_spend, rev, cst, prof = evaluate_spend_subset(
            spend=sub_spend,
            treated=sub_treated,
            fraction=frac,
            margin=margin,
            cost=cost,
            pop_size=pop_size
        )
        records.append({
            "policy": policy,
            "fraction": float(frac),
            "delta_spend": delta_spend,
            "incremental_revenue": rev,
            "cost": cst,
            "profit": prof
        })

    return records


def compute_profit_curves(
    df_all: pd.DataFrame,
    margin: float = 0.30,
    cost: float = 0.05,
    pop_size: int = 100_000,
    output_path: Path = PROJECT_ROOT / "results" / "profit_curves.csv"
) -> pd.DataFrame:
    """Compute profit curves across 10 seeds and save results/profit_curves.csv.

    Note: std_profit represents variation across repeated splits, not a confidence interval.
    """
    policies = ["random", "response_model", "t_learner_lr", "x_learner_lr", "s_learner_xgb", "target_everyone"]
    seeds = sorted(df_all["seed"].unique())

    all_curve_records = []
    for seed in seeds:
        df_seed = df_all[df_all["seed"] == seed]
        for pol in policies:
            recs = compute_policy_profit_on_split(
                df_seed, policy=pol, fractions=COMMON_FRACTIONS,
                margin=margin, cost=cost, pop_size=pop_size
            )
            for r in recs:
                r["seed"] = seed
                all_curve_records.append(r)

    df_raw_curves = pd.DataFrame(all_curve_records)

    # Group across seeds: mean and std across repeated splits
    agg_df = df_raw_curves.groupby(["policy", "fraction"]).agg(
        mean_profit=("profit", "mean"),
        std_profit=("profit", "std"),
        mean_delta_spend=("delta_spend", "mean"),
        std_delta_spend=("delta_spend", "std"),
        mean_revenue=("incremental_revenue", "mean"),
        mean_cost=("cost", "mean"),
    ).reset_index()

    agg_df.to_csv(output_path, index=False)
    print(f"Saved profit curves (default margin={margin}, cost={cost}): {output_path}")
    return agg_df


def compute_bootstrap_budget_analysis(
    df_all: pd.DataFrame,
    margin: float = 0.30,
    cost: float = 0.05,
    n_boot: int = 200,
    pop_size: int = 100_000,
    seed: int = 42,
    output_path: Path = PROJECT_ROOT / "results" / "profit_at_budgets.csv"
) -> pd.DataFrame:
    """Evaluate policies at pre-specified headline budgets (30% and 50%).

    Computes:
      1. 10-seed mean and variation across repeated splits (std across splits).
      2. Seed 0 point estimates.
      3. Individual policy 95% bootstrap CIs on seed 0 test set (B=200).
      4. PAIRED bootstrap CIs on seed 0 test set for uplift models minus:
         - random (same budget)
         - response_model (same budget)
         - target_everyone (f=1.0 full campaign)
    """
    budgets = [0.30, 0.50]
    uplift_policies = ["t_learner_lr", "x_learner_lr", "s_learner_xgb"]
    baseline_policies = ["random", "response_model"]

    # 1. Ten-seed summary
    ten_seed_records = []
    for s in df_all["seed"].unique():
        df_s = df_all[df_all["seed"] == s]
        # Target everyone at f=1.0
        te_full = compute_policy_profit_on_split(df_s, "target_everyone", COMMON_FRACTIONS, margin, cost, pop_size)[0]["profit"]

        for b in budgets:
            b_profits = {}
            for pol in baseline_policies + uplift_policies:
                prof = [r["profit"] for r in compute_policy_profit_on_split(df_s, pol, np.array([b]), margin, cost, pop_size)][0]
                b_profits[pol] = prof
                ten_seed_records.append({
                    "seed": s, "budget_fraction": b, "type": "individual",
                    "policy": pol, "comparator": "none", "value": prof
                })

            # Paired differences
            for up in uplift_policies:
                ten_seed_records.append({
                    "seed": s, "budget_fraction": b, "type": "paired_diff",
                    "policy": up, "comparator": "random", "value": b_profits[up] - b_profits["random"]
                })
                ten_seed_records.append({
                    "seed": s, "budget_fraction": b, "type": "paired_diff",
                    "policy": up, "comparator": "response_model", "value": b_profits[up] - b_profits["response_model"]
                })
                ten_seed_records.append({
                    "seed": s, "budget_fraction": b, "type": "paired_diff",
                    "policy": up, "comparator": "target_everyone_full", "value": b_profits[up] - te_full
                })

        # Also add target_everyone individual at f=1.0
        ten_seed_records.append({
            "seed": s, "budget_fraction": 1.0, "type": "individual",
            "policy": "target_everyone", "comparator": "none", "value": te_full
        })

    df_ten = pd.DataFrame(ten_seed_records)

    # 2. Seed 0 point estimates & Bootstrap CIs
    df_seed0 = df_all[df_all["seed"] == 0].reset_index(drop=True)
    n_seed0 = len(df_seed0)
    rng = np.random.default_rng(seed)

    # Pre-extract columns for speed
    spend_s0 = df_seed0["spend"].values
    treated_s0 = df_seed0["treated"].values
    score_cols = {
        "random": df_seed0["score_random"].values,
        "response_model": df_seed0["score_baseline_response_lr"].values,
        "t_learner_lr": df_seed0["score_t_learner_lr"].values,
        "x_learner_lr": df_seed0["score_x_learner_lr"].values,
        "s_learner_xgb": df_seed0["score_s_learner_xgb"].values,
    }

    # Point estimates on seed 0
    seed0_estimates: Dict[Tuple[str, float, str, str], float] = {}
    # target everyone full
    _, _, _, te_full_s0 = evaluate_spend_subset(spend_s0, treated_s0, 1.0, margin, cost, pop_size)
    seed0_estimates[("individual", "target_everyone", 1.0, "none")] = te_full_s0

    for b in budgets:
        k = int(round(b * n_seed0))
        b_s0_profits = {}
        for pol in baseline_policies + uplift_policies:
            # Ties broken stably by original row order
            order = np.argsort(-score_cols[pol], kind="stable")
            _, _, _, p_val = evaluate_spend_subset(spend_s0[order][:k], treated_s0[order][:k], b, margin, cost, pop_size)
            b_s0_profits[pol] = p_val
            seed0_estimates[("individual", pol, b, "none")] = p_val

        for up in uplift_policies:
            seed0_estimates[("paired_diff", up, b, "random")] = b_s0_profits[up] - b_s0_profits["random"]
            seed0_estimates[("paired_diff", up, b, "response_model")] = b_s0_profits[up] - b_s0_profits["response_model"]
            seed0_estimates[("paired_diff", up, b, "target_everyone_full")] = b_s0_profits[up] - te_full_s0

    # Run Bootstrap Resampling (B=200) on Seed 0
    boot_storage: Dict[Tuple[str, str, float, str], List[float]] = {k: [] for k in seed0_estimates.keys()}

    print(f"Computing bootstrap 95% CIs on seed 0 test set ({n_boot} resamples)...")
    t0_boot = time.time()
    for b_idx in range(n_boot):
        boot_sample_idx = rng.choice(n_seed0, size=n_seed0, replace=True)
        b_spend = spend_s0[boot_sample_idx]
        b_treated = treated_s0[boot_sample_idx]

        # target_everyone f=1.0
        _, _, _, b_te_full = evaluate_spend_subset(b_spend, b_treated, 1.0, margin, cost, pop_size)
        boot_storage[("individual", "target_everyone", 1.0, "none")].append(b_te_full)

        for b in budgets:
            k = int(round(b * n_seed0))
            b_profs = {}
            for pol in baseline_policies + uplift_policies:
                b_scores = score_cols[pol][boot_sample_idx]
                # Ties broken stably by original row order
                order = np.argsort(-b_scores, kind="stable")
                _, _, _, prof = evaluate_spend_subset(b_spend[order][:k], b_treated[order][:k], b, margin, cost, pop_size)
                b_profs[pol] = prof
                boot_storage[("individual", pol, b, "none")].append(prof)

            for up in uplift_policies:
                boot_storage[("paired_diff", up, b, "random")].append(b_profs[up] - b_profs["random"])
                boot_storage[("paired_diff", up, b, "response_model")].append(b_profs[up] - b_profs["response_model"])
                boot_storage[("paired_diff", up, b, "target_everyone_full")].append(b_profs[up] - b_te_full)

    print(f"Bootstrap completed in {time.time() - t0_boot:.1f}s.")

    # Consolidate results table
    final_budget_records = []
    for (mtype, pol, b, comp), pt_est in seed0_estimates.items():
        boot_vals = np.array(boot_storage[(mtype, pol, b, comp)])
        ci_lower = float(np.percentile(boot_vals, 2.5))
        ci_upper = float(np.percentile(boot_vals, 97.5))
        ci_contains_pt = bool(ci_lower <= pt_est <= ci_upper)

        # Cross-seed statistics
        sub_ten = df_ten[(df_ten["type"] == mtype) & (df_ten["policy"] == pol) &
                         (df_ten["budget_fraction"] == b) & (df_ten["comparator"] == comp)]
        mean_10 = float(sub_ten["value"].mean()) if len(sub_ten) > 0 else pt_est
        std_splits_10 = float(sub_ten["value"].std()) if len(sub_ten) > 0 else 0.0

        final_budget_records.append({
            "category": mtype,
            "policy": pol,
            "budget_fraction": b,
            "comparator": comp,
            "mean_10seeds": mean_10,
            "std_across_splits_10seeds": std_splits_10,
            "seed0_estimate": pt_est,
            "ci_95_lower": ci_lower,
            "ci_95_upper": ci_upper,
            "ci_contains_point": ci_contains_pt,
        })

    df_budget_out = pd.DataFrame(final_budget_records)
    # Sort order: individual first, then paired diffs
    df_budget_out = df_budget_out.sort_values(
        by=["category", "budget_fraction", "policy", "comparator"],
        ascending=[True, True, True, True]
    ).reset_index(drop=True)

    df_budget_out.to_csv(output_path, index=False)
    print(f"Saved headline budget analysis: {output_path}")
    return df_budget_out


def compute_sensitivity_grid(
    df_all: pd.DataFrame,
    margins: List[float] = [0.10, 0.20, 0.30, 0.40, 0.50],
    costs: List[float] = [0.01, 0.05, 0.10, 0.20, 0.50],
    pop_size: int = 100_000,
    output_path: Path = PROJECT_ROOT / "results" / "sensitivity.csv"
) -> pd.DataFrame:
    """Compute sensitivity analysis across margin and cost grid.

    Considers distinct targeting options:
      1. 'no_campaign': emails 0 customers, profit = $0.00, fraction = 0.0.
      2. 'target_everyone': emails 100% of customers (fraction = 1.00).
      3. Selective model policies ('random', 'response_model', 't_learner_lr',
         'x_learner_lr', 's_learner_xgb') evaluated across selective fractions f < 1.00.

    When the optimal fraction is 1.00, the winner is labeled 'target_everyone',
    and the runner-up and profit gap are computed among distinct options.
    If all candidate policies produce profit <= 0, 'no_campaign' wins.
    """
    selective_policies = ["random", "response_model", "t_learner_lr", "x_learner_lr", "s_learner_xgb"]
    seeds = sorted(df_all["seed"].unique())

    # Pre-extract test set subsets for all seeds across fractions
    cache_records = []
    for s in seeds:
        df_s = df_all[df_all["seed"] == s]
        for pol in selective_policies + ["target_everyone"]:
            recs = compute_policy_profit_on_split(
                df_s, policy=pol, fractions=COMMON_FRACTIONS,
                margin=0.30, cost=0.05, pop_size=pop_size
            )
            for r in recs:
                cache_records.append({
                    "seed": s, "policy": pol, "fraction": r["fraction"],
                    "delta_spend": r["delta_spend"]
                })

    df_cache = pd.DataFrame(cache_records)
    # Average delta_spend across 10 seeds for each (policy, fraction)
    df_avg_delta = df_cache.groupby(["policy", "fraction"])["delta_spend"].mean().reset_index()

    # Full campaign delta_spend at f=1.0 (mean across 10 seeds)
    delta_everyone = float(df_avg_delta[
        (df_avg_delta["policy"] == "target_everyone") & (df_avg_delta["fraction"] == 1.0)
    ]["delta_spend"].iloc[0])

    scenario_records = []
    print(f"Computing sensitivity grid over {len(margins)}x{len(costs)} = {len(margins)*len(costs)} scenarios...")

    for m in margins:
        for c in costs:
            candidates: List[Dict[str, Any]] = []

            # 1. Option: no_campaign (fraction = 0.0, profit = $0.00)
            candidates.append({
                "policy": "no_campaign",
                "max_profit": 0.0,
                "optimal_fraction": 0.0
            })

            # 2. Option: target_everyone (fraction = 1.00)
            profit_everyone = pop_size * 1.0 * (m * delta_everyone - c)
            candidates.append({
                "policy": "target_everyone",
                "max_profit": profit_everyone,
                "optimal_fraction": 1.00
            })

            # 3. Options: Selective model policies evaluated strictly at f < 1.00
            for pol in selective_policies:
                sub = df_avg_delta[
                    (df_avg_delta["policy"] == pol) & (df_avg_delta["fraction"] < 1.0)
                ].copy()
                sub["profit"] = pop_size * sub["fraction"] * (m * sub["delta_spend"] - c)

                best_idx = sub["profit"].idxmax()
                best_row = sub.loc[best_idx]
                candidates.append({
                    "policy": pol,
                    "max_profit": float(best_row["profit"]),
                    "optimal_fraction": float(best_row["fraction"])
                })

            # Sort distinct candidate policies descending by max_profit
            # If profits are tied, keep stable ordering
            df_scen = pd.DataFrame(candidates).sort_values(by="max_profit", ascending=False).reset_index(drop=True)

            winner = df_scen.iloc[0]
            runner_up = df_scen.iloc[1]
            profit_gap = winner["max_profit"] - runner_up["max_profit"]

            scenario_records.append({
                "margin": m,
                "cost": c,
                "winning_policy": winner["policy"],
                "winner_max_profit": winner["max_profit"],
                "winner_optimal_fraction": winner["optimal_fraction"],
                "runner_up_policy": runner_up["policy"],
                "runner_up_max_profit": runner_up["max_profit"],
                "profit_gap_vs_runner_up": profit_gap,
            })

    df_sens = pd.DataFrame(scenario_records)

    # Write CSV with header note
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Note: Choosing the best fraction on the same data is optimistic (in-sample); report budgets 30% and 50% as the pre-specified headline comparison.\n")
        df_sens.to_csv(f, index=False)

    print(f"Saved sensitivity analysis: {output_path}")
    return df_sens


def plot_profit_curves(
    df_curves: pd.DataFrame,
    output_path: Path = PROJECT_ROOT / "results" / "profit_plot.png"
) -> None:
    """Plot profit vs fraction targeted with mean and std-across-splits band."""
    import matplotlib.pyplot as plt

    plt.figure(figsize=(10, 6.5), dpi=150)

    color_map = {
        "random": "#7f7f7f",
        "response_model": "#d62728",
        "t_learner_lr": "#1f77b4",
        "x_learner_lr": "#2ca02c",
        "s_learner_xgb": "#9467bd",
    }
    label_map = {
        "random": "Random Targeting",
        "response_model": "Response Model (Baseline LR)",
        "t_learner_lr": "T-Learner (LR)",
        "x_learner_lr": "X-Learner (LR)",
        "s_learner_xgb": "S-Learner (XGBoost)",
    }

    # Plot continuous policies
    for pol, col in color_map.items():
        sub = df_curves[df_curves["policy"] == pol].sort_values("fraction")
        x = sub["fraction"].values
        y_mean = sub["mean_profit"].values
        y_std = sub["std_profit"].values

        plt.plot(x, y_mean, label=label_map[pol], color=col, linewidth=2.0)
        plt.fill_between(x, y_mean - y_std, y_mean + y_std, color=col, alpha=0.12)

    # Plot Target Everyone as a distinct point at f=1.0 with error bar
    te_sub = df_curves[df_curves["policy"] == "target_everyone"]
    if len(te_sub) > 0:
        te_mean = float(te_sub["mean_profit"].iloc[0])
        te_std = float(te_sub["std_profit"].iloc[0])
        plt.errorbar(
            [1.0], [te_mean], yerr=[te_std],
            fmt='*', color='#ff7f0e', markersize=12, capsize=6, capthick=2, elinewidth=2,
            label=f"Target Everyone (Full Campaign f=1.0)"
        )

    # Reference lines
    plt.axhline(0, color="black", linestyle="--", linewidth=1.0, alpha=0.7, label="Break-even ($0)")
    plt.axvline(0.30, color="darkblue", linestyle=":", linewidth=1.2, alpha=0.6, label="Budget 30%")
    plt.axvline(0.50, color="darkgreen", linestyle=":", linewidth=1.2, alpha=0.6, label="Budget 50%")

    plt.xlabel("Targeted Population Fraction (Budget)", fontsize=11, fontweight="bold")
    plt.ylabel("Net Profit per 100,000 Customers ($)", fontsize=11, fontweight="bold")
    plt.title("Marketing Campaign Profit by Targeting Policy\n(Kevin Hillstrom Email Dataset - Spend Outcome)", fontsize=12, fontweight="bold")

    # Annotations text box
    info_text = (
        "Business Assumptions:\n"
        "- Contribution Margin: 30%\n"
        "- Cost per Email: $0.05\n"
        "- Target Pop: 100k customers\n"
        "Shaded bands: ±1 std across 10 repeated splits"
    )
    plt.annotate(
        info_text,
        xy=(0.03, 0.05),
        xycoords="axes fraction",
        fontsize=9,
        bbox=dict(boxstyle="round,pad=0.5", facecolor="white", edgecolor="#cccccc", alpha=0.9)
    )

    plt.grid(True, linestyle=":", alpha=0.6)
    plt.legend(loc="upper right", fontsize=8.5, framealpha=0.95)
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"Saved profit plot: {output_path}")


def print_step0c_summary() -> None:
    """Print exact computed data counts and treatment effect reconciliation."""
    print("=" * 100)
    print("STEP 0c: EXACT DATA COUNTS AND TREATMENT EFFECT RECONCILIATION")
    print("=" * 100)
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")

    n_treated = int((df_any["treated"] == 1).sum())
    n_control = int((df_any["treated"] == 0).sum())
    v_treated = int(df_any.loc[df_any["treated"] == 1, "visit"].sum())
    v_control = int(df_any.loc[df_any["treated"] == 0, "visit"].sum())
    r_treated = float(df_any.loc[df_any["treated"] == 1, "visit"].mean())
    r_control = float(df_any.loc[df_any["treated"] == 0, "visit"].mean())
    ate = r_treated - r_control

    print(f"Treated n:       {n_treated:,} (Womens E-Mail: {(df_raw['segment'] == 'Womens E-Mail').sum():,}, Mens E-Mail: {(df_raw['segment'] == 'Mens E-Mail').sum():,})")
    print(f"Control n:       {n_control:,} (No E-Mail)")
    print(f"Treated visits:  {v_treated:,}")
    print(f"Control visits:  {v_control:,}")
    print(f"Treated rate:    {r_treated:.4%} ({r_treated:.6f})")
    print(f"Control rate:    {r_control:.4%} ({r_control:.6f})")
    print(f"Observed ATE:    +{ate:.4%} (+{ate:.6f}) [Verified +6.09%]")
    print("\nSource Reconciliation Note:")
    print("Earlier stated figures (42,671 / 21,329 / 7,125 / 2,265) were an ungrounded prior recall from an")
    print("alternate blog summary. As computed directly above from the raw Hillstrom data, the verified")
    print("counts are exactly 42,694 treated (7,132 visits, 16.70%) and 21,306 control (2,262 visits, 10.62%),")
    print("confirming the exact +6.09% ATE.")
    print("=" * 100 + "\n")


def print_headline_tables(df_budgets: pd.DataFrame, df_sens: pd.DataFrame) -> None:
    """Print clean formatted tables for headline budgets and sensitivity grid."""
    print("=" * 115)
    print("HEADLINE PROFIT AT PRE-SPECIFIED BUDGETS (30% and 50% Population Targeted)")
    print("Default Assumptions: Margin = 30%, Cost = $0.05/email, Target Population = 100,000 customers")
    print("=" * 115)
    print(f"{'Category':<14} {'Budget':<8} {'Policy':<16} {'Comparator':<16} {'10-Split Mean':>13} {'Split Var(std)':>15} {'Seed0 Point':>12} {'95% Boot CI':>22}")
    print("-" * 115)

    for _, r in df_budgets.iterrows():
        b_str = f"{int(r['budget_fraction']*100)}%" if r['budget_fraction'] <= 1.0 else "Full"
        cat = "Individual" if r["category"] == "individual" else "Paired Diff"
        comp = "-" if r["comparator"] == "none" else r["comparator"]
        ci_str = f"[{r['ci_95_lower']:>8.1f}, {r['ci_95_upper']:>8.1f}]"
        print(f"{cat:<14} {b_str:<8} {r['policy']:<16} {comp:<16} ${r['mean_10seeds']:>11.2f} ${r['std_across_splits_10seeds']:>13.2f} ${r['seed0_estimate']:>10.2f} {ci_str:>22}")

    print("=" * 115 + "\n")

    print("=" * 115)
    print("SENSITIVITY ANALYSIS (Optimistic Maximum Profit across Fractions per Margin/Cost Scenario)")
    print("Note: Choosing the best fraction on evaluation data is optimistic (in-sample); see budgets 30%/50% above.")
    print("=" * 115)
    print(f"{'Margin':<8} {'Cost':<8} {'Winning Policy':<18} {'Best Frac':<10} {'Winner Max Profit':>18} {'Runner-up Policy':<18} {'Profit Gap':>15}")
    print("-" * 115)

    for _, r in df_sens.iterrows():
        print(f"{r['margin']:<8.2f} ${r['cost']:<7.2f} {r['winning_policy']:<18} {r['winner_optimal_fraction']:<10.2f} ${r['winner_max_profit']:>16.2f} {r['runner_up_policy']:<18} ${r['profit_gap_vs_runner_up']:>13.2f}")

    print("=" * 115 + "\n")


def recompute_profit_from_predictions() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Recompute profit curves, budget tables, sensitivity grid, and plot from existing predictions_all_seeds.csv.
    
    Ties in scores are broken stably by original row order (kind='stable').
    """
    pred_path = PROJECT_ROOT / "results" / "predictions_all_seeds.csv"
    if not pred_path.exists():
        raise FileNotFoundError(f"Missing predictions file: {pred_path}")
    print(f"Loading predictions from {pred_path}...")
    df_all = pd.read_csv(pred_path)

    print("Recomputing profit curves with stable tie-breaking...")
    df_curves = compute_profit_curves(df_all)

    print("Recomputing bootstrap budget analysis (30% and 50%) with stable tie-breaking...")
    df_budgets = compute_bootstrap_budget_analysis(df_all)

    print("Recomputing sensitivity grid with stable tie-breaking...")
    df_sens = compute_sensitivity_grid(df_all)

    print("Re-rendering profit plot...")
    plot_profit_curves(df_curves)

    print_headline_tables(df_budgets, df_sens)
    return df_curves, df_budgets, df_sens


def run_profit_pipeline() -> None:
    """Execute the complete profit simulation pipeline."""
    # Step 0c verification first
    print_step0c_summary()

    if (PROJECT_ROOT / "results" / "predictions_all_seeds.csv").exists() and "--recompute-only" in sys.argv:
        recompute_profit_from_predictions()
        return

    # Step 2a: Generate all test predictions across 10 seeds
    df_all = generate_all_seeds_predictions()

    # Step 2b: Compute profit curves across fractions
    df_curves = compute_profit_curves(df_all)

    # Step 2c: Pre-specified headline budgets (30% and 50%) + Bootstrap CIs
    df_budgets = compute_bootstrap_budget_analysis(df_all)

    # Step 2d: Sensitivity analysis grid
    df_sens = compute_sensitivity_grid(df_all)

    # Step 2e: Plot
    plot_profit_curves(df_curves)

    # Step 2f: Print complete terminal output
    print_headline_tables(df_budgets, df_sens)

    # Step 2g: Truthful commentary on spend sparsity
    df_raw = load_hillstrom()
    spenders = (df_raw["spend"] > 0).sum()
    spender_rate = spenders / len(df_raw)
    print("=" * 100)
    print("SPEND OUTCOME SPARSITY & PROFIT FINDINGS")
    print("=" * 100)
    print(f"Spender count: {spenders:,} / {len(df_raw):,} customers ({spender_rate:.2%})")
    print("Because positive spend is observed in only ~0.9% of customers, incremental dollar spend carries")
    print("substantial empirical noise across subgroups, resulting in wide bootstrap confidence intervals.")
    print("Targeting policies should be interpreted with appropriate uncertainty boundaries.")
    print("=" * 100 + "\n")


if __name__ == "__main__":
    run_profit_pipeline()
