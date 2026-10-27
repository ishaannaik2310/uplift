"""Data loading utilities for the Hillstrom dataset."""

import os
from pathlib import Path
from typing import Optional
import pandas as pd


def get_data_dir() -> Path:
    """Return the absolute path to the data directory."""
    return Path(__file__).resolve().parent.parent / "data"


def load_hillstrom(data_dir: Optional[Path] = None) -> pd.DataFrame:
    """Load the Hillstrom MineThatData e-mail analytics dataset.

    Attempts to load via `sklift.datasets.fetch_hillstrom(target_col='all')`.
    If that fails or does not yield all required target columns, it falls back
    to loading from `data/hillstrom.csv` (or `data/hillstorm_no_indices.csv.gz`).
    If no local file exists either, raises a FileNotFoundError instructing
    manual download.

    Returns:
        pd.DataFrame: A single DataFrame containing features, treatment ('segment'),
                      and all three outcome metrics ('visit', 'conversion', 'spend').
    """
    target_cols = ["visit", "conversion", "spend"]
    treatment_col = "segment"
    data_path = Path(data_dir) if data_dir else get_data_dir()

    # Strategy 1: Try sklift.datasets.fetch_hillstrom
    try:
        from sklift.datasets import fetch_hillstrom

        # Try fetching with local data_home first to keep artifacts organized
        bunch = None
        for dh in [str(data_path), None]:
            try:
                bunch = fetch_hillstrom(
                    target_col="all",
                    data_home=dh,
                    download_if_missing=True,
                )
                if bunch is not None:
                    break
            except Exception:
                continue

        if bunch is not None:
            # Check if Bunch contains features, treatment, and targets
            has_data = hasattr(bunch, "data") and isinstance(bunch.data, pd.DataFrame)
            has_treatment = hasattr(bunch, "treatment")
            has_target = hasattr(bunch, "target")

            if has_data and has_treatment and has_target:
                features = bunch.data.copy()
                treatment = bunch.treatment
                target = bunch.target

                # Format treatment as a Series with name 'segment'
                if isinstance(treatment, pd.Series):
                    treatment = treatment.rename(treatment_col)
                else:
                    treatment = pd.Series(treatment, name=treatment_col)

                # Ensure target contains all three outcomes
                if isinstance(target, pd.DataFrame) and all(c in target.columns for c in target_cols):
                    df = pd.concat([features, treatment, target[target_cols]], axis=1)
                    return df
    except Exception:
        # Fall through to local CSV fallback
        pass

    # Strategy 2: Fall back to local CSV / GZ
    csv_candidates = [
        data_path / "hillstrom.csv",
        data_path / "hillstorm_no_indices.csv.gz",
        data_path / "hillstorm.csv",
    ]

    for candidate in csv_candidates:
        if candidate.is_file():
            df = pd.read_csv(candidate)
            # Verify required columns exist
            required = [treatment_col] + target_cols
            if all(col in df.columns for col in required):
                return df

    # Strategy 3: Raise descriptive error if all sources fail
    raise FileNotFoundError(
        "Hillstrom dataset could not be loaded via scikit-uplift or local files.\n"
        "Please download the dataset manually from the MineThatData E-Mail Analytics project:\n"
        "  https://blog.minethatdata.com/2008/03/minethatdata-e-mail-analytics-and-data.html\n"
        f"and save the CSV to: {(data_path / 'hillstrom.csv').resolve()}"
    )


if __name__ == "__main__":
    df = load_hillstrom()
    print(f"Successfully loaded dataset with shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
