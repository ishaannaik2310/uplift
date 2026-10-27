"""Uplift evaluation metrics implemented from scratch.

Definitions and normalization differences vs scikit-uplift are documented
explicitly per function.

sklift source reference: .venv/Lib/site-packages/sklift/metrics/metrics.py
"""

from typing import Tuple
import numpy as np
import pandas as pd

# Compat shim: np.trapezoid introduced in NumPy 2.0; fall back to np.trapz.
try:
    _trapz = np.trapezoid
except AttributeError:
    _trapz = np.trapz


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _prepare(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Validate and coerce inputs to float64/int arrays of equal length.

    Raises:
        ValueError: if shapes mismatch, treated is not binary, or the dataset
                    has no treated or no control members at all.
    """
    y = np.asarray(y, dtype=float)
    treated = np.asarray(treated, dtype=int)
    score = np.asarray(score, dtype=float)

    if y.ndim != 1 or treated.ndim != 1 or score.ndim != 1:
        raise ValueError("y, treated, and score must all be 1-D arrays.")
    if not (y.shape == treated.shape == score.shape):
        raise ValueError(
            f"Shape mismatch: y={y.shape}, treated={treated.shape}, score={score.shape}"
        )
    if set(np.unique(treated)) - {0, 1}:
        raise ValueError("treated must be binary (0/1 only).")
    if treated.sum() == 0:
        raise ValueError("Dataset contains no treated members (all treated==0).")
    if (1 - treated).sum() == 0:
        raise ValueError("Dataset contains no control members (all treated==1).")

    return y, treated, score


def _sort_desc(
    y: np.ndarray, treated: np.ndarray, score: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Sort all arrays by score descending with stable (deterministic) tie-breaking."""
    order = np.argsort(-score, kind="stable")
    return y[order], treated[order], score[order]


# ---------------------------------------------------------------------------
# 1. Decile table
# ---------------------------------------------------------------------------

def uplift_by_decile(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
    n_bins: int = 10,
) -> pd.DataFrame:
    """Sort customers by score descending, split into n_bins equal groups.

    Returns a DataFrame with one row per decile containing:
      - decile         : 1 (highest score) to n_bins
      - n_treated      : number of treated members in bin
      - n_control      : number of control members in bin
      - y_rate_treated : outcome rate among treated in bin
      - y_rate_control : outcome rate among control in bin
      - uplift         : y_rate_treated - y_rate_control
      - bin_fraction   : fraction of population in this bin

    Raises:
        ValueError: if any bin has zero treated or zero control members.
    """
    y, treated, score = _prepare(y, treated, score)
    y_s, t_s, _ = _sort_desc(y, treated, score)

    bins = np.array_split(np.arange(len(y_s)), n_bins)
    records = []
    for i, idx in enumerate(bins, start=1):
        y_b = y_s[idx]
        t_b = t_s[idx]
        n_t = int(t_b.sum())
        n_c = int(len(t_b) - n_t)

        if n_t == 0:
            raise ValueError(
                f"Decile {i} has no treated members — cannot compute outcome rate. "
                f"Consider reducing n_bins or checking data balance."
            )
        if n_c == 0:
            raise ValueError(
                f"Decile {i} has no control members — cannot compute outcome rate. "
                f"Consider reducing n_bins or checking data balance."
            )

        r_t = float(y_b[t_b == 1].sum()) / n_t
        r_c = float(y_b[t_b == 0].sum()) / n_c

        records.append({
            "decile": i,
            "n_treated": n_t,
            "n_control": n_c,
            "y_rate_treated": r_t,
            "y_rate_control": r_c,
            "uplift": r_t - r_c,
            "bin_fraction": len(idx) / len(y_s),
        })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# 2. Qini curve
# ---------------------------------------------------------------------------

def qini_curve(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute the Qini curve (Radcliffe 2007).

    For each fraction k of the population ranked by score descending:

        Q(k) = cumY_T(k)  -  N_T(k) / N_C(k)  *  cumY_C(k)

    where:
        cumY_T(k) = cumulative sum of outcomes among treated in top-k
        cumY_C(k) = cumulative sum of outcomes among control in top-k
        N_T(k)    = cumulative count of treated in top-k
        N_C(k)    = cumulative count of control in top-k

    When N_C(k) == 0 the ratio term is set to 0 (undefined; no control yet).
    The curve always starts at (0, 0).

    X-axis: FRACTION of population targeted (k / N), range [0, 1].

    Returns:
        x_vals (np.ndarray): fraction of population targeted, starting at 0.
        q_vals (np.ndarray): Qini curve values Q(k), starting at 0.
    """
    y, treated, score = _prepare(y, treated, score)
    y_s, t_s, _ = _sort_desc(y, treated, score)
    N = len(y_s)

    cum_y_t = np.cumsum(y_s * (t_s == 1))
    cum_y_c = np.cumsum(y_s * (t_s == 0))
    cum_n_t = np.cumsum(t_s)
    cum_n_c = np.cumsum(1 - t_s)

    ratio = np.where(
        cum_n_c > 0,
        np.divide(cum_n_t, cum_n_c, out=np.zeros_like(cum_n_t, dtype=float), where=cum_n_c > 0),
        0.0,
    )
    q_vals = cum_y_t - ratio * cum_y_c

    x_vals = np.arange(1, N + 1) / N

    # Prepend (0, 0)
    x_vals = np.r_[0.0, x_vals]
    q_vals = np.r_[0.0, q_vals]

    return x_vals, q_vals


# ---------------------------------------------------------------------------
# 3. Qini coefficient (unnormalized area above diagonal)
# ---------------------------------------------------------------------------

def qini_coefficient(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
) -> float:
    """Area between the Qini curve and the random-targeting diagonal.

    Formula (Radcliffe 2007):

        Qini = AUC_Q  -  Q(1) / 2

    where:
        AUC_Q = integral_0^1 Q(k) dk  (trapezoidal)
        Q(1)  = Qini curve final value (k = 1, entire population targeted)
        Q(1) / 2 = area of the triangle under the random-targeting diagonal
                   from (0,0) to (1, Q(1))

    Equivalently:
        Qini = integral_0^1 [Q(k) - Q_rand(k)] dk
    where Q_rand(k) = k * Q(1).

    Returns:
        float: Qini coefficient (area between curve and random diagonal).
    """
    x_vals, q_vals = qini_curve(y, treated, score)
    auc_q = float(_trapz(q_vals, x_vals))
    q_end = float(q_vals[-1])
    random_area = q_end / 2.0  # triangle: base=1, height=q_end
    return auc_q - random_area


# ---------------------------------------------------------------------------
# 4. Uplift curve + AUUC
# ---------------------------------------------------------------------------

def uplift_curve(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute the cumulative gain (uplift) curve.

    For each fraction k of the population ranked by score descending:

        U(k) = [cumY_T(k) / N_T(k)  -  cumY_C(k) / N_C(k)]  *  k * N

    This is the RATE difference (treated rate minus control rate among top-k)
    multiplied by (k * N) — the number of customers targeted.

    Points where N_T(k) == 0 or N_C(k) == 0 are skipped. The curve starts at (0,0).

    Returns:
        x_vals (np.ndarray): fraction targeted, starting at 0.
        u_vals (np.ndarray): cumulative gain values, starting at 0.
    """
    y, treated, score = _prepare(y, treated, score)
    y_s, t_s, _ = _sort_desc(y, treated, score)
    N = len(y_s)

    cum_y_t = np.cumsum(y_s * (t_s == 1))
    cum_y_c = np.cumsum(y_s * (t_s == 0))
    cum_n_t = np.cumsum(t_s).astype(float)
    cum_n_c = np.cumsum(1 - t_s).astype(float)

    valid = (cum_n_t > 0) & (cum_n_c > 0)

    x_all = np.arange(1, N + 1) / N

    rate_t = np.where(cum_n_t > 0, cum_y_t / np.where(cum_n_t > 0, cum_n_t, 1.0), 0.0)
    rate_c = np.where(cum_n_c > 0, cum_y_c / np.where(cum_n_c > 0, cum_n_c, 1.0), 0.0)
    n_targeted = np.arange(1, N + 1, dtype=float)
    u_all = (rate_t - rate_c) * n_targeted

    x_vals = np.r_[0.0, x_all[valid]]
    u_vals = np.r_[0.0, u_all[valid]]

    return x_vals, u_vals


def auuc(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
    normalize: bool = False,
) -> float:
    """Area under the cumulative uplift (gain) curve.

    Raw AUUC:
        AUUC = integral_0^1 U(k) dk   (trapezoidal)

    Normalized AUUC (normalize=True):
        AUUC_norm = AUUC - AUUC_rand
    where AUUC_rand is the area under the random-targeting diagonal:
        AUUC_rand = U(1) / 2
    """
    x_vals, u_vals = uplift_curve(y, treated, score)
    auc_val = float(_trapz(u_vals, x_vals))

    if normalize:
        u_end = float(u_vals[-1])
        random_area = u_end / 2.0
        return auc_val - random_area

    return auc_val


# ---------------------------------------------------------------------------
# 5. Sklift-Normalized Metrics (Replicating sklift.metrics exactly)
# ---------------------------------------------------------------------------

def _sklift_qini_curve(
    y_true: np.ndarray,
    uplift: np.ndarray,
    treatment: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Exact replication of sklift.metrics.qini_curve (threshold-based)."""
    desc_score_indices = np.argsort(uplift, kind="mergesort")[::-1]
    y_true = y_true[desc_score_indices]
    treatment = treatment[desc_score_indices]
    uplift = uplift[desc_score_indices]

    y_true_ctrl = y_true.copy()
    y_true_trmnt = y_true.copy()
    y_true_ctrl[treatment == 1] = 0
    y_true_trmnt[treatment == 0] = 0

    distinct_value_indices = np.where(np.diff(uplift))[0]
    threshold_indices = np.r_[distinct_value_indices, uplift.size - 1]

    num_trmnt = np.cumsum(treatment)[threshold_indices]
    y_trmnt = np.cumsum(y_true_trmnt)[threshold_indices]
    num_all = threshold_indices + 1
    num_ctrl = num_all - num_trmnt
    y_ctrl = np.cumsum(y_true_ctrl)[threshold_indices]

    curve_values = y_trmnt - y_ctrl * np.divide(
        num_trmnt, num_ctrl, out=np.zeros_like(num_trmnt, dtype=float), where=num_ctrl != 0
    )
    if num_all.size == 0 or curve_values[0] != 0 or num_all[0] != 0:
        num_all = np.r_[0, num_all]
        curve_values = np.r_[0, curve_values]

    return num_all, curve_values


def _perfect_qini_curve(
    y_true: np.ndarray,
    treatment: np.ndarray,
    negative_effect: bool = True,
) -> Tuple[np.ndarray, np.ndarray]:
    """Exact replication of sklift.metrics.perfect_qini_curve."""
    if negative_effect:
        return _sklift_qini_curve(
            y_true, y_true * treatment - y_true * (1 - treatment), treatment
        )
    else:
        n_samples = len(y_true)
        ratio_random = (
            y_true[treatment == 1].sum()
            - len(y_true[treatment == 1]) * y_true[treatment == 0].sum() / len(y_true[treatment == 0])
        )
        return np.array([0, ratio_random, n_samples]), np.array([0, ratio_random, ratio_random])


def qini_auc_normalized(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
    negative_effect: bool = True,
) -> float:
    """Compute normalized Area Under the Qini Curve replicating sklift.metrics.qini_auc_score.

    Formula:
        (AUC_actual - AUC_baseline) / (AUC_perfect - AUC_baseline)

    where:
        - AUC_actual is the area under the Qini curve evaluated at distinct score thresholds.
        - AUC_perfect is computed using the oracle scoring:
            score_perfect = y * treatment - y * (1 - treatment)
        - AUC_baseline is the area under the diagonal from (0,0) to the curve endpoint.
    """
    y, treated, score = _prepare(y, treated, score)
    x_actual, y_actual = _sklift_qini_curve(y, score, treated)
    x_perfect, y_perfect = _perfect_qini_curve(y, treated, negative_effect=negative_effect)
    x_baseline = np.array([0, x_perfect[-1]])
    y_baseline = np.array([0, y_perfect[-1]])

    auc_score_baseline = float(_trapz(y_baseline, x_baseline))
    auc_score_perfect = float(_trapz(y_perfect, x_perfect)) - auc_score_baseline
    auc_score_actual = float(_trapz(y_actual, x_actual)) - auc_score_baseline

    if auc_score_perfect == 0:
        return 0.0

    return auc_score_actual / auc_score_perfect


def _sklift_uplift_curve(
    y_true: np.ndarray,
    uplift: np.ndarray,
    treatment: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Exact replication of sklift.metrics.uplift_curve (threshold-based)."""
    desc_score_indices = np.argsort(uplift, kind="mergesort")[::-1]
    y_true = y_true[desc_score_indices]
    uplift = uplift[desc_score_indices]
    treatment = treatment[desc_score_indices]

    y_true_ctrl, y_true_trmnt = y_true.copy(), y_true.copy()
    y_true_ctrl[treatment == 1] = 0
    y_true_trmnt[treatment == 0] = 0

    distinct_value_indices = np.where(np.diff(uplift))[0]
    threshold_indices = np.r_[distinct_value_indices, uplift.size - 1]

    num_trmnt = np.cumsum(treatment)[threshold_indices]
    y_trmnt = np.cumsum(y_true_trmnt)[threshold_indices]
    num_all = threshold_indices + 1
    num_ctrl = num_all - num_trmnt
    y_ctrl = np.cumsum(y_true_ctrl)[threshold_indices]

    curve_values = (
        np.divide(y_trmnt, num_trmnt, out=np.zeros_like(y_trmnt, dtype=float), where=num_trmnt != 0)
        - np.divide(y_ctrl, num_ctrl, out=np.zeros_like(y_ctrl, dtype=float), where=num_ctrl != 0)
    ) * num_all

    if num_all.size == 0 or curve_values[0] != 0 or num_all[0] != 0:
        num_all = np.r_[0, num_all]
        curve_values = np.r_[0, curve_values]

    return num_all, curve_values


def _perfect_uplift_curve(
    y_true: np.ndarray,
    treatment: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """Exact replication of sklift.metrics.perfect_uplift_curve."""
    cr_num = np.sum((y_true == 1) & (treatment == 0))
    tn_num = np.sum((y_true == 0) & (treatment == 1))
    summand = y_true if cr_num > tn_num else treatment
    perfect_uplift = 2 * (y_true == treatment) + summand
    return _sklift_uplift_curve(y_true, perfect_uplift, treatment)


def auuc_normalized_by_perfect(
    y: np.ndarray,
    treated: np.ndarray,
    score: np.ndarray,
) -> float:
    """Compute normalized Area Under the Uplift Curve replicating sklift.metrics.uplift_auc_score.

    Formula:
        (AUC_actual - AUC_baseline) / (AUC_perfect - AUC_baseline)

    where:
        - AUC_actual is the area under the cumulative gain curve evaluated at distinct thresholds.
        - AUC_perfect uses oracle scoring: 2*(y == treatment) + summand
          where summand = y if CR > TNR else treatment.
        - AUC_baseline is the area under the diagonal from (0,0) to the curve endpoint.
    """
    y, treated, score = _prepare(y, treated, score)
    x_actual, y_actual = _sklift_uplift_curve(y, score, treated)
    x_perfect, y_perfect = _perfect_uplift_curve(y, treated)
    x_baseline = np.array([0, x_perfect[-1]])
    y_baseline = np.array([0, y_perfect[-1]])

    auc_score_baseline = float(_trapz(y_baseline, x_baseline))
    auc_score_perfect = float(_trapz(y_perfect, x_perfect)) - auc_score_baseline
    auc_score_actual = float(_trapz(y_actual, x_actual)) - auc_score_baseline

    if auc_score_perfect == 0:
        return 0.0

    return auc_score_actual / auc_score_perfect
