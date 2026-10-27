"""Uplift models implemented for benchmark evaluation.

Models:
  - Baseline response model: classifier trained on treated rows only; score = P(visit=1 | x, treated).
  - Random score: reference baseline (expected Qini = 0).
  - S-Learner: single model on features + treated indicator; uplift = f(x, 1) - f(x, 0).
  - T-Learner: two separate models on treated and control; uplift = mu1(x) - mu0(x).
  - X-Learner (Künzel et al.): two-stage estimation with imputed counterfactual treatment effects
    and propensity weighting (g = treated fraction in randomized split).

Base Learners:
  - Logistic Regression: L2 penalty, StandardScaler on continuous features ('recency', 'log_history')
    inside a ColumnTransformer pipeline, max_iter=1000.
    For Stage 2 regression in X-learner: Ridge regression with StandardScaler pipeline.
  - XGBoost: conservative shallow trees, tuned via 3-fold CV on seed-0 training split only.
"""

from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.model_selection import GridSearchCV
from xgboost import XGBClassifier, XGBRegressor

NUMERIC_COLS = ["recency", "log_history"]


def get_lr_classifier(seed: int = 0) -> Pipeline:
    """Create a standardized Logistic Regression pipeline for classification."""
    preprocessor = ColumnTransformer(
        transformers=[("scaler", StandardScaler(), NUMERIC_COLS)],
        remainder="passthrough",
    )
    return Pipeline([
        ("preprocessor", preprocessor),
        ("clf", LogisticRegression(penalty="l2", C=1.0, max_iter=1000, random_state=seed, solver="lbfgs")),
    ])


def get_lr_regressor(seed: int = 0) -> Pipeline:
    """Create a standardized Ridge Regression pipeline for continuous targets."""
    preprocessor = ColumnTransformer(
        transformers=[("scaler", StandardScaler(), NUMERIC_COLS)],
        remainder="passthrough",
    )
    return Pipeline([
        ("preprocessor", preprocessor),
        ("reg", Ridge(alpha=1.0, random_state=seed)),
    ])


def tune_xgb_classifier(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    seed: int = 0,
) -> Dict[str, Any]:
    """Tune XGBoost hyperparameters via 3-fold CV on seed-0 training split only.

    NOTE: Hyperparameter selection is performed strictly on seed 0 training data
    and frozen across all 10 experimental seeds to prevent test data leakage.
    """
    param_grid = {
        "max_depth": [3, 4],
        "learning_rate": [0.05, 0.1],
        "min_child_weight": [10, 20],
    }
    base_xgb = XGBClassifier(
        n_estimators=300,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=seed,
        n_jobs=-1,
    )
    grid_search = GridSearchCV(
        base_xgb,
        param_grid,
        cv=3,
        scoring="neg_log_loss",
        n_jobs=-1,
    )
    grid_search.fit(X_train, y_train)
    return grid_search.best_params_


def get_xgb_classifier(best_params: Dict[str, Any], seed: int = 0) -> XGBClassifier:
    """Instantiate XGBClassifier with tuned parameters and split-specific seed."""
    return XGBClassifier(
        n_estimators=300,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=seed,
        n_jobs=-1,
        **best_params,
    )


def get_xgb_regressor(best_params: Dict[str, Any], seed: int = 0) -> XGBRegressor:
    """Instantiate XGBRegressor reusing tuned classifier parameters and split-specific seed."""
    return XGBRegressor(
        n_estimators=300,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="rmse",
        random_state=seed,
        n_jobs=-1,
        **best_params,
    )


# ---------------------------------------------------------------------------
# Uplift Model Estimators
# ---------------------------------------------------------------------------

def predict_random(X_test: pd.DataFrame, seed: int = 0) -> np.ndarray:
    """Generate reproducible random baseline scores."""
    rng = np.random.default_rng(seed)
    scores = rng.random(len(X_test))
    assert not np.isnan(scores).any(), "NaN in random scores"
    return scores


def predict_baseline_response(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    t_train: np.ndarray,
    X_test: pd.DataFrame,
    base_learner: str = "lr",
    seed: int = 0,
    xgb_params: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """Naive response model: trained only on treated units; score = P(y=1 | x, treated)."""
    treated_mask = t_train == 1
    X_t = X_train[treated_mask]
    y_t = y_train[treated_mask]

    if base_learner == "lr":
        model = get_lr_classifier(seed=seed)
    elif base_learner == "xgb":
        assert xgb_params is not None, "xgb_params required for XGBoost base learner"
        model = get_xgb_classifier(xgb_params, seed=seed)
    else:
        raise ValueError(f"Unknown base learner: {base_learner}")

    model.fit(X_t, y_t)
    scores = model.predict_proba(X_test)[:, 1]
    assert not np.isnan(scores).any(), f"NaN detected in baseline response model ({base_learner})"
    return scores


def predict_s_learner(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    t_train: np.ndarray,
    X_test: pd.DataFrame,
    base_learner: str = "lr",
    seed: int = 0,
    xgb_params: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """S-Learner: single model fit on features + treated indicator; uplift = f(x,1) - f(x,0)."""
    X_train_s = X_train.copy()
    X_train_s["treated"] = t_train

    if base_learner == "lr":
        model = get_lr_classifier(seed=seed)
    elif base_learner == "xgb":
        assert xgb_params is not None, "xgb_params required for XGBoost base learner"
        model = get_xgb_classifier(xgb_params, seed=seed)
    else:
        raise ValueError(f"Unknown base learner: {base_learner}")

    model.fit(X_train_s, y_train)

    X_test_1 = X_test.copy()
    X_test_1["treated"] = 1
    pred_1 = model.predict_proba(X_test_1)[:, 1]

    X_test_0 = X_test.copy()
    X_test_0["treated"] = 0
    pred_0 = model.predict_proba(X_test_0)[:, 1]

    uplift = pred_1 - pred_0
    assert not np.isnan(uplift).any(), f"NaN detected in S-learner ({base_learner})"
    return uplift


def predict_t_learner(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    t_train: np.ndarray,
    X_test: pd.DataFrame,
    base_learner: str = "lr",
    seed: int = 0,
    xgb_params: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """T-Learner: two separate models for treated and control; uplift = mu1(x) - mu0(x)."""
    X_t = X_train[t_train == 1]
    y_t = y_train[t_train == 1]
    X_c = X_train[t_train == 0]
    y_c = y_train[t_train == 0]

    if base_learner == "lr":
        mu1 = get_lr_classifier(seed=seed)
        mu0 = get_lr_classifier(seed=seed)
    elif base_learner == "xgb":
        assert xgb_params is not None, "xgb_params required for XGBoost base learner"
        mu1 = get_xgb_classifier(xgb_params, seed=seed)
        mu0 = get_xgb_classifier(xgb_params, seed=seed)
    else:
        raise ValueError(f"Unknown base learner: {base_learner}")

    mu1.fit(X_t, y_t)
    mu0.fit(X_c, y_c)

    pred_1 = mu1.predict_proba(X_test)[:, 1]
    pred_0 = mu0.predict_proba(X_test)[:, 1]

    uplift = pred_1 - pred_0
    assert not np.isnan(uplift).any(), f"NaN detected in T-learner ({base_learner})"
    return uplift


def predict_x_learner(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    t_train: np.ndarray,
    X_test: pd.DataFrame,
    base_learner: str = "lr",
    seed: int = 0,
    xgb_params: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """X-Learner (Künzel et al.): two-stage estimation with imputed treatment effects.

    Stage 1:
        mu0 fit on control (X0, Y0)
        mu1 fit on treated (X1, Y1)
    Imputed effects:
        D1 = Y1 - mu0(X1)
        D0 = mu1(X0) - Y0
    Stage 2:
        tau1 fit on (X1, D1) via regressor
        tau0 fit on (X0, D0) via regressor
    Propensity:
        g = treated fraction in training set (randomized trial)
    Final Uplift:
        tau = g * tau0(X_test) + (1 - g) * tau1(X_test)
    """
    X1 = X_train[t_train == 1]
    y1 = y_train[t_train == 1]
    X0 = X_train[t_train == 0]
    y0 = y_train[t_train == 0]

    # Stage 1: Outcome classifiers
    if base_learner == "lr":
        mu1 = get_lr_classifier(seed=seed)
        mu0 = get_lr_classifier(seed=seed)
    elif base_learner == "xgb":
        assert xgb_params is not None, "xgb_params required for XGBoost base learner"
        mu1 = get_xgb_classifier(xgb_params, seed=seed)
        mu0 = get_xgb_classifier(xgb_params, seed=seed)
    else:
        raise ValueError(f"Unknown base learner: {base_learner}")

    mu1.fit(X1, y1)
    mu0.fit(X0, y0)

    # Imputed treatment effects
    D1 = y1 - mu0.predict_proba(X1)[:, 1]
    D0 = mu1.predict_proba(X0)[:, 1] - y0

    # Stage 2: Effect regressors
    if base_learner == "lr":
        tau1 = get_lr_regressor(seed=seed)
        tau0 = get_lr_regressor(seed=seed)
    elif base_learner == "xgb":
        assert xgb_params is not None, "xgb_params required for XGBoost base learner"
        tau1 = get_xgb_regressor(xgb_params, seed=seed)
        tau0 = get_xgb_regressor(xgb_params, seed=seed)
    else:
        raise ValueError(f"Unknown base learner: {base_learner}")

    tau1.fit(X1, D1)
    tau0.fit(X0, D0)

    # Propensity score in randomized A/B experiment is constant
    g = float(t_train.mean())

    pred_tau0 = tau0.predict(X_test)
    pred_tau1 = tau1.predict(X_test)

    uplift = g * pred_tau0 + (1.0 - g) * pred_tau1
    assert not np.isnan(uplift).any(), f"NaN detected in X-learner ({base_learner})"
    return uplift
