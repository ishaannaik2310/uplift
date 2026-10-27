"""Script to inspect and verify the Hillstrom dataset."""

import io
import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data import load_hillstrom


class OutputCapture:
    """Helper to simultaneously stream to stdout and capture to a buffer."""

    def __init__(self):
        self.buffer = io.StringIO()

    def print(self, *args, **kwargs):
        print(*args, **kwargs)
        print(*args, **kwargs, file=self.buffer)

    def get_value(self) -> str:
        return self.buffer.getvalue()


def main():
    capture = OutputCapture()
    p = capture.print

    p("=" * 70)
    p("HILLSTROM EMAIL ANALYTICS DATASET VERIFICATION & SUMMARY")
    p("=" * 70)

    # 1. Load dataset
    df = load_hillstrom()

    # 2. Shape, column names, and dtypes
    p("\n1. DATASET SHAPE & SCHEMA")
    p("-" * 70)
    p(f"Rows: {df.shape[0]:,}")
    p(f"Columns: {df.shape[1]}")
    p("\nColumns and Data Types:")
    for col, dtype in df.dtypes.items():
        p(f"  - {col:<18} : {str(dtype)}")

    # 3. Missing values per column
    p("\n2. MISSING VALUES PER COLUMN")
    p("-" * 70)
    missing = df.isnull().sum()
    if missing.sum() == 0:
        p("No missing values detected in any column (0 missing across all rows).")
    else:
        for col, count in missing.items():
            pct = (count / len(df)) * 100
            p(f"  - {col:<18} : {count:,} ({pct:.2f}%)")

    # 4. Value counts for segment, visit, conversion
    p("\n3. VALUE COUNTS")
    p("-" * 70)
    p("Treatment Column ('segment') Value Counts:")
    seg_counts = df["segment"].value_counts(dropna=False)
    seg_pcts = df["segment"].value_counts(normalize=True, dropna=False) * 100
    for val in seg_counts.index:
        p(f"  {val:<16} : {seg_counts[val]:>6,} ({seg_pcts[val]:>6.2f}%)")

    p("\nOutcome Column ('visit') Value Counts:")
    visit_counts = df["visit"].value_counts(dropna=False)
    visit_pcts = df["visit"].value_counts(normalize=True, dropna=False) * 100
    for val in sorted(visit_counts.index):
        p(f"  {val:<16} : {visit_counts[val]:>6,} ({visit_pcts[val]:>6.2f}%)")

    p("\nOutcome Column ('conversion') Value Counts:")
    conv_counts = df["conversion"].value_counts(dropna=False)
    conv_pcts = df["conversion"].value_counts(normalize=True, dropna=False) * 100
    for val in sorted(conv_counts.index):
        p(f"  {val:<16} : {conv_counts[val]:>6,} ({conv_pcts[val]:>6.2f}%)")

    # 5. Conversion rates
    p("\n4. CONVERSION RATES")
    p("-" * 70)
    overall_conv_rate = df["conversion"].mean()
    p(f"Overall Conversion Rate: {overall_conv_rate:.4f} ({overall_conv_rate * 100:.2f}%)")
    p(f"Total Conversions: {df['conversion'].sum():,} / {len(df):,}")

    p("\nConversion Rate per Segment:")
    seg_conv = df.groupby("segment", observed=False)["conversion"].agg(
        count="count",
        conversions="sum",
        rate="mean"
    )
    for seg, row in seg_conv.iterrows():
        p(f"  {seg:<16} : {row['rate']:.4f} ({row['rate'] * 100:.2f}%)  [{int(row['conversions']):,} / {int(row['count']):,}]")

    # 6. Mean spend per segment
    p("\n5. MEAN SPEND PER SEGMENT")
    p("-" * 70)
    overall_spend = df["spend"].mean()
    p(f"Overall Mean Spend: ${overall_spend:.4f}")
    p(f"Total Revenue: ${df['spend'].sum():,.2f}")

    p("\nMean Spend per Segment (All Customers in Segment):")
    seg_spend = df.groupby("segment", observed=False)["spend"].agg(
        count="count",
        total_spend="sum",
        mean_spend="mean"
    )
    for seg, row in seg_spend.iterrows():
        p(f"  {seg:<16} : ${row['mean_spend']:.4f}  (Total: ${row['total_spend']:,.2f})")

    # Additional spend metric: Spend among converters
    p("\nMean Spend among Converting Customers (conversion == 1):")
    conv_spend = df[df["conversion"] == 1].groupby("segment", observed=False)["spend"].agg(
        converters="count",
        mean_spend="mean"
    )
    for seg, row in conv_spend.iterrows():
        p(f"  {seg:<16} : ${row['mean_spend']:.2f} per converter  (N={int(row['converters'])})")

    p("=" * 70)

    # Save to results/data_summary.txt
    results_dir = PROJECT_ROOT / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    summary_file = results_dir / "data_summary.txt"
    summary_file.write_text(capture.get_value(), encoding="utf-8")
    p(f"\n[Summary successfully written to {summary_file.resolve()}]")


if __name__ == "__main__":
    main()
