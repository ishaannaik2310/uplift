"""End-to-end verification script for preprocessing, leakage guard, splits, and balance check.

Generates verified summary and persists report to results/preprocessing_report.txt.
"""

import io
import sys
from pathlib import Path
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data import load_hillstrom
from src.preprocess import (
    build_features,
    make_treatment,
    make_splits,
    get_seeds,
    assert_leakage_guard,
    FORBIDDEN_LEAKAGE_COLUMNS,
)
from src.balance_check import run_and_save_balance_check, format_balance_table


class OutputCapture:
    """Helper to stream output simultaneously to stdout and internal buffer."""

    def __init__(self):
        self.buffer = io.StringIO()

    def print(self, *args, **kwargs):
        print(*args, **kwargs)
        print(*args, **kwargs, file=self.buffer)

    def get_value(self) -> str:
        return self.buffer.getvalue()


def run_checks():
    capture = OutputCapture()
    p = capture.print

    p("=" * 86)
    p("UPLIFT ML PREPROCESSING & RANDOMIZATION VERIFICATION REPORT")
    p("=" * 86)

    # 1. Load data
    p("\n1. LOADING DATASET")
    p("-" * 86)
    df = load_hillstrom()
    p(f"Dataset successfully loaded. Total rows: {len(df):,}, columns: {df.shape[1]}")

    # 2. Build feature matrix and inspect schema
    p("\n2. FEATURE MATRIX CONSTRUCTION & SCHEMA VERIFICATION")
    p("-" * 86)
    df_any = make_treatment(df, mode="any")
    X = build_features(df_any)
    p(f"Feature matrix X shape: {X.shape}")
    p(f"Total feature count: {X.shape[1]} (Expected: 15)")
    assert X.shape[1] == 15, f"Expected 15 features, got {X.shape[1]}"
    p("CONFIRMED: Exact feature count matches specification (15 features).")
    p("\nEngineered Feature Column List:")
    for idx, col in enumerate(X.columns, 1):
        p(f"  {idx:>2}. {col:<24} (dtype: {X[col].dtype})")

    # 3. Leakage Guard verification
    p("\n3. LEAKAGE GUARD VERIFICATION")
    p("-" * 86)
    # Check on legitimate X
    try:
        assert_leakage_guard(X)
        p("PASS: Hard leakage guard passed on feature matrix X (no forbidden columns found).")
    except AssertionError as e:
        p(f"FAIL: Leakage guard raised unexpected error: {e}")
        raise

    # Negative test: verify leakage guard catches forbidden columns
    leakage_caught = True
    for col in FORBIDDEN_LEAKAGE_COLUMNS:
        X_tampered = X.copy()
        X_tampered[col] = 1
        try:
            assert_leakage_guard(X_tampered)
            leakage_caught = False
            p(f"FAIL: Leakage guard did not detect injected forbidden column '{col}'!")
        except AssertionError:
            pass
    if leakage_caught:
        p(f"CONFIRMED: Leakage guard successfully detects and blocks all forbidden columns {FORBIDDEN_LEAKAGE_COLUMNS}.")

    # 4. Stratified Split Verification: mode="any", outcome="visit", seed=0
    p("\n4. STRATIFIED SPLIT VERIFICATION -- MODE: 'ANY', OUTCOME: 'VISIT', SEED: 0")
    p("-" * 86)
    train_idx_any_1, test_idx_any_1 = make_splits(df, outcome="visit", mode="any", seed=0, test_size=0.3)
    train_any = df_any.iloc[train_idx_any_1]
    test_any = df_any.iloc[test_idx_any_1]

    n_total_any = len(df_any)
    n_train_any = len(train_any)
    n_test_any = len(test_any)

    treated_share_train_any = train_any["treated"].mean()
    treated_share_test_any = test_any["treated"].mean()
    visit_rate_train_any = train_any["visit"].mean()
    visit_rate_test_any = test_any["visit"].mean()

    p(f"Total Rows: {n_total_any:,}")
    p(f"Train Split: {n_train_any:,} ({n_train_any / n_total_any * 100:.2f}%)")
    p(f"Test Split : {n_test_any:,} ({n_test_any / n_total_any * 100:.2f}%)")
    p(f"Treated Share  -> Train: {treated_share_train_any:.4f} ({treated_share_train_any * 100:.2f}%) | Test: {treated_share_test_any:.4f} ({treated_share_test_any * 100:.2f}%)")
    p(f"Visit Rate     -> Train: {visit_rate_train_any:.4f} ({visit_rate_train_any * 100:.2f}%) | Test: {visit_rate_test_any:.4f} ({visit_rate_test_any * 100:.2f}%)")

    # Repeat call with identical seed to test reproducibility
    train_idx_any_2, test_idx_any_2 = make_splits(df, outcome="visit", mode="any", seed=0, test_size=0.3)
    assert np.array_equal(train_idx_any_1, train_idx_any_2) and np.array_equal(test_idx_any_1, test_idx_any_2), (
        "FAIL: Consecutive calls to make_splits with seed 0 yielded non-identical splits in mode='any'!"
    )
    p("PASS: Two independent calls with seed 0 produced 100% IDENTICAL train/test index splits.")

    # 5. Stratified Split Verification: mode="mens", outcome="visit", seed=0
    p("\n5. STRATIFIED SPLIT VERIFICATION -- MODE: 'MENS', OUTCOME: 'VISIT', SEED: 0")
    p("-" * 86)
    df_mens = make_treatment(df, mode="mens")
    train_idx_mens_1, test_idx_mens_1 = make_splits(df, outcome="visit", mode="mens", seed=0, test_size=0.3)
    train_mens = df_mens.iloc[train_idx_mens_1]
    test_mens = df_mens.iloc[test_idx_mens_1]

    n_total_mens = len(df_mens)
    n_train_mens = len(train_mens)
    n_test_mens = len(test_mens)

    treated_share_train_mens = train_mens["treated"].mean()
    treated_share_test_mens = test_mens["treated"].mean()
    visit_rate_train_mens = train_mens["visit"].mean()
    visit_rate_test_mens = test_mens["visit"].mean()

    p(f"Total Rows: {n_total_mens:,}")
    p(f"Train Split: {n_train_mens:,} ({n_train_mens / n_total_mens * 100:.2f}%)")
    p(f"Test Split : {n_test_mens:,} ({n_test_mens / n_total_mens * 100:.2f}%)")
    p(f"Treated Share  -> Train: {treated_share_train_mens:.4f} ({treated_share_train_mens * 100:.2f}%) | Test: {treated_share_test_mens:.4f} ({treated_share_test_mens * 100:.2f}%)")
    p(f"Visit Rate     -> Train: {visit_rate_train_mens:.4f} ({visit_rate_train_mens * 100:.2f}%) | Test: {visit_rate_test_mens:.4f} ({visit_rate_test_mens * 100:.2f}%)")

    # Repeat call with identical seed to test reproducibility in mens mode
    train_idx_mens_2, test_idx_mens_2 = make_splits(df, outcome="visit", mode="mens", seed=0, test_size=0.3)
    assert np.array_equal(train_idx_mens_1, train_idx_mens_2) and np.array_equal(test_idx_mens_1, test_idx_mens_2), (
        "FAIL: Consecutive calls to make_splits with seed 0 yielded non-identical splits in mode='mens'!"
    )
    p("PASS: Two independent calls with seed 0 produced 100% IDENTICAL train/test index splits.")

    # 6. Evaluation Seeds List
    p("\n6. REPEATED EVALUATION SEEDS")
    p("-" * 86)
    seeds = get_seeds()
    p(f"Seeds list: {seeds} (Total: {len(seeds)} seeds)")

    # 7. Covariate Balance Table (mode="any")
    p("\n7. COVARIATE BALANCE CHECK (STANDARDIZED MEAN DIFFERENCE)")
    p("-" * 86)
    balance_df = run_and_save_balance_check(df, mode="any", results_dir=PROJECT_ROOT / "results")
    p(format_balance_table(balance_df, mode="any"))

    # Persist complete report
    report_file = PROJECT_ROOT / "results" / "preprocessing_report.txt"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text(capture.get_value(), encoding="utf-8")
    p(f"\n[Complete preprocessing report successfully saved to {report_file.resolve()}]")
    p(f"[Balance check artifacts saved to results/balance_check.csv and results/balance_check.txt]")


if __name__ == "__main__":
    run_checks()
