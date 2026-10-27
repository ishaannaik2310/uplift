"""Data preprocessing, feature engineering, treatment encoding, and split utilities.

Uplift Modeling for Profit-Optimal Marketing Targeting on Hillstrom Dataset.
"""

from typing import List, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit

# Fixed category orders to guarantee identical columns across subsets and splits
ZIP_CODE_CATEGORIES: List[str] = ["Rural", "Surburban", "Urban"]
CHANNEL_CATEGORIES: List[str] = ["Multichannel", "Phone", "Web"]
RECENCY_BAND_CATEGORIES: List[str] = ["1-3", "4-6", "7-9", "10-12"]

FORBIDDEN_LEAKAGE_COLUMNS = {"visit", "conversion", "spend", "segment"}


def get_seeds() -> List[int]:
    """Return the 10 fixed random seeds for repeated cross-validation/splits."""
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]


def make_treatment(df: pd.DataFrame, mode: str = "any") -> pd.DataFrame:
    """Encode treatment indicator column based on experimental segment.

    Args:
        df: Input DataFrame containing the 'segment' column.
        mode:
            - "any": treated = 1 if segment in ('Mens E-Mail', 'Womens E-Mail'),
                     treated = 0 if 'No E-Mail'. All rows retained.
            - "mens": filters to only 'Mens E-Mail' and 'No E-Mail'.
                      treated = 1 for 'Mens E-Mail', treated = 0 for 'No E-Mail'.

    Returns:
        pd.DataFrame: A filtered copy with a new integer 'treated' column (0 or 1),
                      with reset index.
    """
    if mode not in {"any", "mens"}:
        raise ValueError(f"Invalid mode '{mode}'. Expected 'any' or 'mens'.")

    df_out = df.copy()

    if mode == "any":
        treated_mask = df_out["segment"].isin(["Mens E-Mail", "Womens E-Mail"])
        control_mask = df_out["segment"] == "No E-Mail"
        valid_mask = treated_mask | control_mask
        df_out = df_out[valid_mask].copy()
        df_out["treated"] = treated_mask.astype(int)
    elif mode == "mens":
        df_out = df_out[df_out["segment"].isin(["Mens E-Mail", "No E-Mail"])].copy()
        df_out["treated"] = (df_out["segment"] == "Mens E-Mail").astype(int)

    return df_out.reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Construct leakage-safe feature matrix X from input DataFrame.

    Features included (15 total):
      - Continuous/Numeric: recency, log_history (log1p of history), mens, womens, newbie (5)
      - One-hot zip_code: Rural, Surburban, Urban (3)
      - One-hot channel: Multichannel, Phone, Web (3)
      - One-hot recency_band: 1-3, 4-6, 7-9, 10-12 (4)

    Design Note on history_segment:
      `history_segment` is dropped because it is an arbitrary binned duplicate
      of the continuous `history` metric. Using `log_history = log1p(history)`
      compresses the right-skewed spending history while preserving continuous
      rank-order and resolution without redundant collinear bin indicators.

    Args:
        df: DataFrame containing raw feature columns.

    Returns:
        pd.DataFrame: Engineered feature matrix X of shape (N, 15).

    Raises:
        AssertionError: If recency values fall outside [1, 12], if recency_band has NaNs,
                        or if any outcome/treatment columns leak into X.
    """
    # 1. Validate recency bounds
    recency_min = df["recency"].min()
    recency_max = df["recency"].max()
    assert recency_min >= 1 and recency_max <= 12, (
        f"Recency values [{recency_min}, {recency_max}] outside expected [1, 12] range."
    )

    # 2. Engineer recency_band and validate
    recency_band = pd.cut(
        df["recency"],
        bins=[0, 3, 6, 9, 12],
        labels=RECENCY_BAND_CATEGORIES,
        right=True,
    )
    assert not recency_band.isna().any(), "recency_band contains unexpected NaN values."

    # 3. Base continuous & binary features
    X = pd.DataFrame(index=df.index)
    X["recency"] = df["recency"].astype(int)
    X["log_history"] = np.log1p(df["history"].astype(float))
    X["mens"] = df["mens"].astype(int)
    X["womens"] = df["womens"].astype(int)
    X["newbie"] = df["newbie"].astype(int)

    # 4. Full one-hot encoding (drop_first=False) for zip_code
    for cat in ZIP_CODE_CATEGORIES:
        X[f"zip_code_{cat}"] = (df["zip_code"] == cat).astype(int)

    # 5. Full one-hot encoding (drop_first=False) for channel
    for cat in CHANNEL_CATEGORIES:
        X[f"channel_{cat}"] = (df["channel"] == cat).astype(int)

    # 6. Full one-hot encoding (drop_first=False) for recency_band
    for band in RECENCY_BAND_CATEGORIES:
        X[f"recency_band_{band}"] = (recency_band == band).astype(int)

    # 7. Strict leakage guard
    assert_leakage_guard(X)

    # 8. Assert expected feature count (15)
    assert X.shape[1] == 15, f"Expected 15 features, got {X.shape[1]}: {list(X.columns)}"

    return X


def assert_leakage_guard(X: pd.DataFrame) -> None:
    """Enforce strict leakage guard on feature matrix X.

    Raises:
        AssertionError: If any target or treatment column is present in X.
    """
    leakage_detected = FORBIDDEN_LEAKAGE_COLUMNS.intersection(X.columns)
    assert not leakage_detected, (
        f"DATA LEAKAGE DETECTED! Feature matrix contains forbidden column(s): {leakage_detected}"
    )


def make_splits(
    df: pd.DataFrame,
    outcome: str = "visit",
    mode: str = "any",
    seed: int = 0,
    test_size: float = 0.3,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate stratified train and test positional indices.

    Stratifies on the joint distribution of treated x outcome to guarantee
    that both train and test splits preserve identical treatment-to-control ratios
    and outcome event rates.

    Args:
        df: Input DataFrame (will be processed via make_treatment(df, mode)).
        outcome: One of 'visit', 'conversion', 'spend'.
        mode: 'any' or 'mens'.
        seed: Random state integer for reproducibility.
        test_size: Proportion of dataset allocated to test set (default 0.3).

    Returns:
        Tuple[np.ndarray, np.ndarray]: (train_indices, test_indices) indexing
                                       the filtered DataFrame returned by make_treatment.
    """
    if outcome not in {"visit", "conversion", "spend"}:
        raise ValueError(f"Unknown outcome '{outcome}'. Expected 'visit', 'conversion', or 'spend'.")

    # Filter and encode treatment
    df_treated = make_treatment(df, mode=mode)

    # For continuous spend, binarize to spend > 0 for stratification
    if outcome == "spend":
        outcome_binary = (df_treated["spend"] > 0).astype(int)
    else:
        outcome_binary = df_treated[outcome].astype(int)

    # Composite stratum: treated x outcome
    stratum = df_treated["treated"].astype(str) + "_" + outcome_binary.astype(str)

    sss = StratifiedShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(sss.split(df_treated, stratum))

    return train_idx, test_idx
