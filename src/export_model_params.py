"""Export trained X-Learner (LR) parameters and verification sample datasets for web client.

Exports:
1. web/public/data/xlearner_params.json:
   - Ordered 15 feature names
   - Scaler mean and scale parameters for numeric columns ("recency", "log_history")
   - Model coefficients and intercepts for mu0, mu1, tau0, tau1
   - Propensity score g
   - Link functions and model metadata
2. web/public/data/sample_customers.csv:
   - 500 held-out test customers in raw format (8 original feature columns, no leakage)
3. web/public/data/sample_scores_python.json:
   - Python-computed uplift predictions and mu0 baseline probabilities for those 500 rows
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import pandas as pd

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data import load_hillstrom
from src.preprocess import make_treatment, make_splits, build_features
from src.models import get_lr_classifier, get_lr_regressor, predict_x_learner

RAW_CUSTOMER_COLUMNS: List[str] = [
    "recency",
    "history_segment",
    "history",
    "mens",
    "womens",
    "zip_code",
    "newbie",
    "channel",
]

NUMERIC_COLS: List[str] = ["recency", "log_history"]


def extract_pipeline_params(pipeline: Any) -> Dict[str, Any]:
    """Extract scaler and linear model parameters from a scikit-learn Pipeline."""
    scaler = pipeline.named_steps["preprocessor"].named_transformers_["scaler"]
    mean = [float(x) for x in scaler.mean_]
    scale = [float(x) for x in scaler.scale_]

    if "clf" in pipeline.named_steps:
        estimator = pipeline.named_steps["clf"]
        coef = [float(x) for x in estimator.coef_[0]]
        intercept = float(estimator.intercept_[0])
        link = "logit"
        model_type = "classifier"
    elif "reg" in pipeline.named_steps:
        estimator = pipeline.named_steps["reg"]
        coef = [float(x) for x in estimator.coef_]
        intercept = float(estimator.intercept_)
        link = "identity"
        model_type = "regressor"
    else:
        raise ValueError("Unknown estimator step in pipeline")

    return {
        "type": model_type,
        "link": link,
        "intercept": intercept,
        "coefficients": coef,
        "scaler": {
            "features": NUMERIC_COLS,
            "mean": mean,
            "scale": scale,
        },
    }


def export_xlearner_params(
    seed: int = 0,
    n_sample_customers: int = 500,
    output_dir: Path = PROJECT_ROOT / "web" / "public" / "data",
) -> None:
    """Train Seed 0 X-Learner (LR), export model parameters and test verification data."""
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Loading Hillstrom dataset...")
    df_raw = load_hillstrom()
    df_any = make_treatment(df_raw, mode="any")

    print(f"Building 15 engineered features...")
    X = build_features(df_any)
    feature_names = list(X.columns)
    y_all = df_any["visit"].values
    t_all = df_any["treated"].values

    print(f"Splitting data with Seed {seed} (60% train / 40% test)...")
    train_idx, test_idx = make_splits(df_raw, outcome="visit", mode="any", seed=seed)
    X_tr, y_tr, t_tr = X.iloc[train_idx], y_all[train_idx], t_all[train_idx]
    X_te, y_te, t_te = X.iloc[test_idx], y_all[test_idx], t_all[test_idx]

    # Split training by treatment
    X1, y1 = X_tr[t_tr == 1], y_tr[t_tr == 1]
    X0, y0 = X_tr[t_tr == 0], y_tr[t_tr == 0]

    print("Fitting Stage 1 models (mu1 on treated, mu0 on control)...")
    mu1 = get_lr_classifier(seed=seed).fit(X1, y1)
    mu0 = get_lr_classifier(seed=seed).fit(X0, y0)

    # Imputed counterfactual treatment effects
    D1 = y1 - mu0.predict_proba(X1)[:, 1]
    D0 = mu1.predict_proba(X0)[:, 1] - y0

    print("Fitting Stage 2 models (tau1 on treated, tau0 on control)...")
    tau1 = get_lr_regressor(seed=seed).fit(X1, D1)
    tau0 = get_lr_regressor(seed=seed).fit(X0, D0)

    g = float(t_tr.mean())
    print(f"Fitted models. Propensity weight g = {g:.6f}")

    # Extract model parameters
    mu0_params = extract_pipeline_params(mu0)
    mu1_params = extract_pipeline_params(mu1)
    tau0_params = extract_pipeline_params(tau0)
    tau1_params = extract_pipeline_params(tau1)

    model_params_payload = {
        "model_name": "x_learner_lr",
        "seed": seed,
        "description": "X-Learner with Logistic Regression (Stage 1) and Ridge Regression (Stage 2)",
        "g": g,
        "feature_names": feature_names,
        "numeric_features": NUMERIC_COLS,
        "models": {
            "mu0": mu0_params,
            "mu1": mu1_params,
            "tau0": tau0_params,
            "tau1": tau1_params,
        },
        "metadata": {
            "n_train": len(X_tr),
            "n_train_treated": int((t_tr == 1).sum()),
            "n_train_control": int((t_tr == 0).sum()),
            "outcome": "visit",
            "base_learner": "LogisticRegression (L2, C=1.0) / Ridge (alpha=1.0)",
        },
    }

    params_path = output_dir / "xlearner_params.json"
    with open(params_path, "w", encoding="utf-8") as f:
        json.dump(model_params_payload, f, indent=2)
    print(f"Saved model parameters: {params_path} ({params_path.stat().st_size:,} bytes)")

    # -------------------------------------------------------------------------
    # Verification and Sample Dataset Export
    # -------------------------------------------------------------------------
    print(f"Selecting {n_sample_customers} held-out test customers for sample dataset...")
    sample_test_idx = test_idx[:n_sample_customers]

    # Raw 8 customer columns from original df_raw
    df_sample_raw = df_raw.iloc[sample_test_idx][RAW_CUSTOMER_COLUMNS].copy()

    # Preprocessed features for the sample
    X_sample = X.iloc[sample_test_idx].copy()

    # Python pipeline prediction
    py_tau0 = tau0.predict(X_sample)
    py_tau1 = tau1.predict(X_sample)
    py_uplift = g * py_tau0 + (1.0 - g) * py_tau1
    py_mu0 = mu0.predict_proba(X_sample)[:, 1]
    py_mu1 = mu1.predict_proba(X_sample)[:, 1]

    # Verify against full predict_x_learner
    direct_xlearner_uplift = predict_x_learner(X_tr, y_tr, t_tr, X_sample, base_learner="lr", seed=seed)
    max_pipeline_diff = float(np.max(np.abs(py_uplift - direct_xlearner_uplift)))
    assert max_pipeline_diff < 1e-12, f"Internal pipeline mismatch: {max_pipeline_diff}"
    print(f"Pipeline internal consistency check passed (diff: {max_pipeline_diff:.2e})")

    # Export sample_customers.csv
    csv_path = output_dir / "sample_customers.csv"
    df_sample_raw.to_csv(csv_path, index=False)
    print(f"Saved sample customers CSV ({len(df_sample_raw)} rows): {csv_path}")

    # Export sample_scores_python.json
    scores_payload = {
        "n_samples": len(df_sample_raw),
        "seed": seed,
        "g": g,
        "uplift": [float(x) for x in py_uplift],
        "mu0_prob": [float(x) for x in py_mu0],
        "mu1_prob": [float(x) for x in py_mu1],
        "summary": {
            "mean_uplift": float(np.mean(py_uplift)),
            "std_uplift": float(np.std(py_uplift)),
            "min_uplift": float(np.min(py_uplift)),
            "max_uplift": float(np.max(py_uplift)),
            "mean_mu0_prob": float(np.mean(py_mu0)),
            "mean_mu1_prob": float(np.mean(py_mu1)),
        },
    }

    scores_path = output_dir / "sample_scores_python.json"
    with open(scores_path, "w", encoding="utf-8") as f:
        json.dump(scores_payload, f, indent=2)
    print(f"Saved sample scores JSON: {scores_path}")

    print("\nPhase 1 export completed successfully!")


if __name__ == "__main__":
    export_xlearner_params()
