"""Export uplift benchmark results and evaluation data for web frontend visualization.

Generates three strictly validated JSON artifacts in web/public/data/:
1. results.json: Metadata, model metrics, corrected t-tests, Qini curves, deciles.
2. profit_grid.json: Incremental spend arrays, break-even thresholds, full-campaign metrics.
3. customers.json: Seed 0 customer test split with raw features and model scores.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.data import load_hillstrom
from src.preprocess import make_treatment


def export_results_json(
    output_path: Path,
    predictions_df: pd.DataFrame
) -> Dict[str, Any]:
    """Build and write web/public/data/results.json."""
    print("Building results.json...")

    # 1. Dataset metadata computed from the FULL 64,000 dataset
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")

    n_rows = len(df_any)
    n_treated = int((df_any["treated"] == 1).sum())
    n_control = int((df_any["treated"] == 0).sum())

    v_treated_rate = float(df_any.loc[df_any["treated"] == 1, "visit"].mean())
    v_control_rate = float(df_any.loc[df_any["treated"] == 0, "visit"].mean())
    ate_visit = float(v_treated_rate - v_control_rate)

    spend_treated_rate = float(df_any.loc[df_any["treated"] == 1, "spend"].mean())
    spend_control_rate = float(df_any.loc[df_any["treated"] == 0, "spend"].mean())
    ate_spend = float(spend_treated_rate - spend_control_rate)

    spend_mens = float(df_any.loc[df_any["segment"] == "Mens E-Mail", "spend"].sum())
    spend_womens = float(df_any.loc[df_any["segment"] == "Womens E-Mail", "spend"].sum())
    spend_control = float(df_any.loc[df_any["segment"] == "No E-Mail", "spend"].sum())

    n_spenders = int((df_any["spend"] > 0).sum())
    spender_rate = float(n_spenders / n_rows)

    # Compute test-split mean incremental spend from predictions_all_seeds.csv
    # On each test split (f=1.0), delta_spend = mean(treated) - mean(control)
    split_deltas = []
    for s in sorted(predictions_df["seed"].unique()):
        sub_s = predictions_df[predictions_df["seed"] == s]
        yt = sub_s.loc[sub_s["treated"] == 1, "spend"].mean()
        yc = sub_s.loc[sub_s["treated"] == 0, "spend"].mean()
        split_deltas.append(float(yt - yc))

    delta_spend_splits_mean = float(np.mean(split_deltas))
    delta_spend_splits_std = float(np.std(split_deltas, ddof=1))

    # Read run config & xgb params
    with open(PROJECT_ROOT / "results" / "run_config.json", "r", encoding="utf-8") as f:
        run_config = json.load(f)
    with open(PROJECT_ROOT / "results" / "xgb_params.json", "r", encoding="utf-8") as f:
        xgb_params = json.load(f)

    meta = {
        "dataset": "Kevin Hillstrom MineThatData E-Mail Analytics",
        "n_rows": n_rows,
        "n_treated": n_treated,
        "n_control": n_control,
        "visit_rate_treated": v_treated_rate,
        "visit_rate_control": v_control_rate,
        "ate_visit": ate_visit,
        "spend_rate_treated": spend_treated_rate,
        "spend_rate_control": spend_control_rate,
        "ate_spend": ate_spend,
        "spend_total_mens": spend_mens,
        "spend_total_womens": spend_womens,
        "spend_total_control": spend_control,
        "n_spenders": n_spenders,
        "spender_rate": spender_rate,
        "delta_spend_everyone_test_splits_mean": delta_spend_splits_mean,
        "delta_spend_everyone_test_splits_std": delta_spend_splits_std,
        "seeds": run_config["seeds"],
        "mode": run_config["mode"],
        "outcome": run_config["outcome"],
        "n_train": 44800,
        "n_test": 19200,
        "default_margin": 0.30,
        "default_cost": 0.05,
        "assumptions_note": "Default contribution margin (0.30) and cost per email ($0.05) are business assumptions.",
        "xgb_params": xgb_params,
        "library_versions": run_config["library_versions"],
    }

    # 2. Metric units explanation
    units = {
        "qini_raw": "Cumulative incremental visits above control across targeted population",
        "qini_per_N": "Incremental visits per customer targeted (qini_raw / N_test)",
        "qini_normalized": "Normalized Qini coefficient replicating sklift (area between curve and random diagonal, divided by maximum possible area)",
        "auuc_norm": "Area Under Uplift Curve above random targeting diagonal (raw incremental visit units)",
        "auuc_perf": "AUUC normalized by the theoretical perfect uplift curve replicating sklift (ratio in [0, 1])",
        "uplift_top30": "Observed percentage point uplift in visit rate (treated rate minus control rate) within the top 30% scored customers"
    }

    # 3. Model metrics from metrics_summary.csv
    df_metrics = pd.read_csv(PROJECT_ROOT / "results" / "metrics_summary.csv")
    models = []
    for _, row in df_metrics.iterrows():
        mid = f"{row['model']}_{row['base_learner']}" if row["base_learner"] != "none" else row["model"]
        models.append({
            "model": row["model"],
            "base_learner": row["base_learner"],
            "model_id": mid,
            "qini_raw_mean": float(row["qini_raw_mean"]),
            "qini_raw_std": float(row["qini_raw_std"]),
            "qini_per_N_mean": float(row["qini_per_N_mean"]),
            "qini_per_N_std": float(row["qini_per_N_std"]),
            "qini_normalized_mean": float(row["qini_normalized_mean"]),
            "qini_normalized_std": float(row["qini_normalized_std"]),
            "auuc_norm_mean": float(row["auuc_norm_mean"]),
            "auuc_norm_std": float(row["auuc_norm_std"]),
            "auuc_perf_mean": float(row["auuc_perf_mean"]),
            "auuc_perf_std": float(row["auuc_perf_std"]),
            "uplift_top30_mean": float(row["uplift_top30_mean"]),
            "uplift_top30_std": float(row["uplift_top30_std"]),
        })

    # 4. Corrected paired tests from corrected_tests.csv
    df_tests = pd.read_csv(PROJECT_ROOT / "results" / "corrected_tests.csv")
    paired_tests = []
    for _, row in df_tests.iterrows():
        paired_tests.append({
            "comparison_group": row["comparison_group"],
            "model_a": row["model_a"],
            "model_b": row["model_b"],
            "mean_diff": float(row["mean_diff"]),
            "std_diff": float(row["std_diff"]),
            "t_stat": float(row["t_stat"]),
            "p_value_raw": float(row["p_value_raw"]),
            "p_value_holm": float(row["p_value_holm"]),
            "significance": str(row["significance"]),
        })

    # 5. Qini curves from qini_curves.csv
    df_qini = pd.read_csv(PROJECT_ROOT / "results" / "qini_curves.csv")
    qini_curves: Dict[str, Dict[str, List[float]]] = {}
    for (model, base), g in df_qini.groupby(["model", "base_learner"]):
        mid = f"{model}_{base}" if base != "none" else model
        g_sorted = g.sort_values("fraction")
        qini_curves[mid] = {
            "fraction": [float(x) for x in g_sorted["fraction"].values],
            "mean": [float(x) for x in g_sorted["mean_q"].values],
            "std": [float(x) for x in g_sorted["std_q"].values],
        }

    # 6. Deciles on seed 0 from decile_seed0.csv
    df_dec = pd.read_csv(PROJECT_ROOT / "results" / "decile_seed0.csv")
    deciles_seed0: Dict[str, List[Dict[str, Any]]] = {}
    for (model, base), g in df_dec.groupby(["model", "base_learner"]):
        mid = f"{model}_{base}" if base != "none" else model
        g_sorted = g.sort_values("decile")
        dec_list = []
        for _, r in g_sorted.iterrows():
            dec_list.append({
                "decile": int(r["decile"]),
                "n_treated": int(r["n_treated"]),
                "n_control": int(r["n_control"]),
                "rate_t": float(r["y_rate_treated"]),
                "rate_c": float(r["y_rate_control"]),
                "uplift": float(r["uplift"]),
            })
        deciles_seed0[mid] = dec_list

    payload = {
        "meta": meta,
        "units": units,
        "models": models,
        "paired_tests": paired_tests,
        "qini_curves": qini_curves,
        "deciles_seed0": deciles_seed0,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Saved results.json ({output_path.stat().st_size:,} bytes): {output_path}")
    return payload


def export_profit_grid_json(
    output_path: Path,
    predictions_df: pd.DataFrame,
    pop_size: int = 100_000
) -> Dict[str, Any]:
    """Build and write web/public/data/profit_grid.json."""
    print("Building profit_grid.json...")

    fractions = np.round(np.linspace(0.05, 1.00, 20), 2)
    breakeven_fractions = np.round(np.linspace(0.05, 0.95, 19), 2)

    policy_col_map = {
        "random": "score_random",
        "response_lr": "score_baseline_response_lr",
        "t_learner_lr": "score_t_learner_lr",
        "x_learner_lr": "score_x_learner_lr",
        "s_learner_xgb": "score_s_learner_xgb",
    }

    seeds = sorted(predictions_df["seed"].unique())
    n_splits = len(seeds)

    # Storage: policy -> frac -> list of split values
    delta_spend_splits: Dict[str, Dict[float, List[float]]] = {
        pol: {float(f): [] for f in fractions} for pol in policy_col_map.keys()
    }
    # Storage for break-even: (delta_all - f * delta_p(f)) / (1 - f)
    breakeven_splits: Dict[str, Dict[float, List[float]]] = {
        pol: {float(f): [] for f in breakeven_fractions} for pol in policy_col_map.keys()
    }
    everyone_delta_splits: List[float] = []

    for s in seeds:
        df_s = predictions_df[predictions_df["seed"] == s].reset_index(drop=True)
        spend = df_s["spend"].values
        treated = df_s["treated"].values
        n_total = len(df_s)

        # Full campaign delta_spend for split s
        yt_all = spend[treated == 1].mean()
        yc_all = spend[treated == 0].mean()
        delta_all_s = float(yt_all - yc_all)
        everyone_delta_splits.append(delta_all_s)

        for pol, score_col in policy_col_map.items():
            scores = df_s[score_col].values
            # Ties broken stably by original row order
            order = np.argsort(-scores, kind="stable")
            sorted_spend = spend[order]
            sorted_treated = treated[order]

            for frac in fractions:
                f_val = float(frac)
                k = int(round(frac * n_total))
                sub_spend = sorted_spend[:k]
                sub_tr = sorted_treated[:k]

                s_t = sub_spend[sub_tr == 1]
                s_c = sub_spend[sub_tr == 0]
                if len(s_t) == 0 or len(s_c) == 0:
                    raise ValueError(f"Empty subgroup in split {s}, policy {pol}, fraction {frac}")

                delta_p_s = float(s_t.mean() - s_c.mean())
                delta_spend_splits[pol][f_val].append(delta_p_s)

                if f_val < 1.0:
                    be_val = float((delta_all_s - f_val * delta_p_s) / (1.0 - f_val))
                    breakeven_splits[pol][f_val].append(be_val)

    # Aggregate across splits
    everyone_payload = {
        "delta_spend_mean": float(np.mean(everyone_delta_splits)),
        "delta_spend_std": float(np.std(everyone_delta_splits, ddof=1)),
    }

    policies_payload = {}
    for pol in policy_col_map.keys():
        means = [float(np.mean(delta_spend_splits[pol][float(f)])) for f in fractions]
        stds = [float(np.std(delta_spend_splits[pol][float(f)], ddof=1)) for f in fractions]
        policies_payload[pol] = {
            "delta_spend_mean": means,
            "delta_spend_std": stds,
        }

    breakeven_payload = {
        "breakeven_note": "Targeting the top-f beats emailing everyone only when cost > margin * this quantity, which represents the incremental spend of the excluded (1-f) population.",
        "fractions": [float(f) for f in breakeven_fractions],
        "policies": {}
    }
    for pol in policy_col_map.keys():
        be_means = [float(np.mean(breakeven_splits[pol][float(f)])) for f in breakeven_fractions]
        be_stds = [float(np.std(breakeven_splits[pol][float(f)], ddof=1)) for f in breakeven_fractions]
        breakeven_payload["policies"][pol] = {
            "mean": be_means,
            "std": be_stds,
        }

    payload = {
        "n_pop": pop_size,
        "fractions": [float(f) for f in fractions],
        "profit_formula": "profit(f) = n_pop * f * (margin * delta_spend(f) - cost)",
        "default_margin": 0.30,
        "default_cost": 0.05,
        "assumptions_note": "Default contribution margin (0.30) and cost per email ($0.05) are business assumptions.",
        "everyone": everyone_payload,
        "policies": policies_payload,
        "breakeven": breakeven_payload,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Saved profit_grid.json ({output_path.stat().st_size:,} bytes): {output_path}")
    return payload


def export_customers_json(
    output_path: Path,
    predictions_df: pd.DataFrame
) -> Dict[str, Any]:
    """Build and write web/public/data/customers.json for seed 0's test split."""
    print("Building customers.json (seed 0 test split)...")

    df_s0 = predictions_df[predictions_df["seed"] == 0].copy().reset_index(drop=True)
    if len(df_s0) != 19200:
        raise ValueError(f"Expected 19,200 rows for seed 0 test set, found {len(df_s0)}")

    columns = [
        "id",
        "recency",
        "history",
        "mens",
        "womens",
        "zip_code",
        "newbie",
        "channel",
        "treated",
        "visit",
        "spend",
        "score_random",
        "score_response_lr",
        "score_t_learner_lr",
        "score_x_learner_lr",
        "score_s_learner_xgb",
    ]

    rows = []
    for _, r in df_s0.iterrows():
        rows.append([
            int(r["orig_index"]),
            int(r["recency"]),
            float(round(r["history"], 2)),
            int(r["mens"]),
            int(r["womens"]),
            str(r["zip_code"]),
            int(r["newbie"]),
            str(r["channel"]),
            int(r["treated"]),
            int(r["visit"]),
            float(round(r["spend"], 2)),
            float(round(r["score_random"], 5)),
            float(round(r["score_baseline_response_lr"], 5)),
            float(round(r["score_t_learner_lr"], 5)),
            float(round(r["score_x_learner_lr"], 5)),
            float(round(r["score_s_learner_xgb"], 5)),
        ])

    payload = {
        "columns": columns,
        "rows": rows,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        # Compact single-line rows for fast parsing and minimal size
        json.dump(payload, f, separators=(',', ':'))

    print(f"Saved customers.json ({output_path.stat().st_size:,} bytes, {output_path.stat().st_size / (1024*1024):.2f} MB): {output_path}")
    return payload


def verify_exports(
    results_json_path: Path,
    profit_grid_path: Path,
    customers_json_path: Path
) -> None:
    """Rigorous verification of exported JSON files."""
    print("\n" + "=" * 90)
    print("VERIFICATION OF EXPORTED JSON FILES")
    print("=" * 90)

    # 1. Strict parser test (reject NaN/null/Infinity)
    for p in [results_json_path, profit_grid_path, customers_json_path]:
        raw_text = p.read_text(encoding="utf-8")
        if "NaN" in raw_text or "Infinity" in raw_text or "null" in raw_text:
            raise ValueError(f"CRITICAL: Forbidden constant (NaN/null/Infinity) found in {p.name}!")
        parsed = json.loads(raw_text)
        print(f"Strict JSON parsing PASSED: {p.name} ({p.stat().st_size:,} bytes)")

    # 2. Reconstruct profit(f) from profit_grid.json and verify against profit_curves.csv
    with open(profit_grid_path, "r", encoding="utf-8") as f:
        pg = json.load(f)

    df_curves = pd.read_csv(PROJECT_ROOT / "results" / "profit_curves.csv")
    pop_size = pg["n_pop"]
    margin = pg["default_margin"]
    cost = pg["default_cost"]

    policy_name_map = {
        "random": "random",
        "response_lr": "response_model",
        "t_learner_lr": "t_learner_lr",
        "x_learner_lr": "x_learner_lr",
        "s_learner_xgb": "s_learner_xgb",
    }

    max_diff = 0.0
    for grid_pol, curve_pol in policy_name_map.items():
        delta_means = pg["policies"][grid_pol]["delta_spend_mean"]
        for frac, d_mean in zip(pg["fractions"], delta_means):
            # profit formula: pop * frac * (margin * delta - cost)
            reconstructed_profit = pop_size * frac * (margin * d_mean - cost)
            # lookup in profit_curves.csv
            match = df_curves[(df_curves["policy"] == curve_pol) & (np.isclose(df_curves["fraction"], frac))]
            if len(match) == 0:
                raise ValueError(f"Missing curve match for {curve_pol} at fraction {frac}")
            orig_profit = float(match["mean_profit"].iloc[0])
            diff = abs(reconstructed_profit - orig_profit)
            if diff > max_diff:
                max_diff = diff

    # Also check "everyone" at f=1.0 matches target_everyone profit
    everyone_delta = pg["everyone"]["delta_spend_mean"]
    everyone_profit = pop_size * 1.0 * (margin * everyone_delta - cost)
    te_match = df_curves[(df_curves["policy"] == "target_everyone") & (np.isclose(df_curves["fraction"], 1.0))]
    te_orig_profit = float(te_match["mean_profit"].iloc[0])
    te_diff = abs(everyone_profit - te_orig_profit)
    if te_diff > max_diff:
        max_diff = te_diff

    print(f"\nProfit Reconstruction Check:")
    print(f"  Target Everyone Reconstructed Profit (f=1.0): ${everyone_profit:.2f} (Expected: ${te_orig_profit:.2f}, diff={te_diff:.2e})")
    print(f"  Max absolute profit difference across all policies and fractions: {max_diff:.2e}")
    assert max_diff < 1e-6, f"Profit reconstruction failed! Max diff: {max_diff}"
    print("  Profit reconstruction test PASSED (max diff < 1e-6).")

    # 3. Print full-data vs test-split spend figures side by side
    with open(results_json_path, "r", encoding="utf-8") as f:
        rj = json.load(f)

    meta = rj["meta"]
    print("\nFull-Data vs Test-Split Incremental Spend Comparison:")
    print(f"  Full Dataset Treated Spend Rate:       ${meta['spend_rate_treated']:.6f}")
    print(f"  Full Dataset Control Spend Rate:       ${meta['spend_rate_control']:.6f}")
    print(f"  Full Dataset Observed ATE Spend:       +${meta['ate_spend']:.6f}")
    print(f"  Test-Splits Mean ATE Spend (f=1.0):    +${meta['delta_spend_everyone_test_splits_mean']:.6f} (std across splits: ${meta['delta_spend_everyone_test_splits_std']:.6f})")

    # 4. Print Meta block of results.json
    print("\nMeta block in results.json:")
    print(json.dumps(meta, indent=2))

    # 5. Print first 2 rows of customers.json
    with open(customers_json_path, "r", encoding="utf-8") as f:
        cj = json.load(f)

    print("\nFirst 2 rows of customers.json:")
    print("Columns:", cj["columns"])
    print("Row 0:  ", cj["rows"][0])
    print("Row 1:  ", cj["rows"][1])
    print("=" * 90 + "\n")


def run_export() -> None:
    data_dir = PROJECT_ROOT / "web" / "public" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    pred_path = PROJECT_ROOT / "results" / "predictions_all_seeds.csv"
    if not pred_path.exists():
        raise FileNotFoundError(f"Missing {pred_path}. Run profit pipeline first.")

    print(f"Loading predictions from {pred_path}...")
    predictions_df = pd.read_csv(pred_path)

    results_json_path = data_dir / "results.json"
    profit_grid_path = data_dir / "profit_grid.json"
    customers_json_path = data_dir / "customers.json"

    export_results_json(results_json_path, predictions_df)
    export_profit_grid_json(profit_grid_path, predictions_df)
    export_customers_json(customers_json_path, predictions_df)

    verify_exports(results_json_path, profit_grid_path, customers_json_path)


if __name__ == "__main__":
    run_export()
