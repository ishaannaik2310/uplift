# Stop Paying Customers Who Would've Bought Anyway: Uplift Modeling for Profit-Optimal Marketing Targeting

An end-to-end causal machine learning pipeline and interactive web dashboard evaluating Conditional Average Treatment Effect (CATE) meta-learners against naive response models on the Kevin Hillstrom MineThatData e-mail analytics randomized controlled trial (64,000 customers). The project investigates whether targeting customers based on incremental lift generates more business profit than standard propensity modeling or unsegmented mass campaigns under varying margin and contact cost assumptions.

---

## Team & Project Metadata

- **Authors / Team Members**:
  - `[Member Name 1]` &bull; PRN: `[PRN 1]`
  - `[Member Name 2]` &bull; PRN: `[PRN 2]`
  - `[Member Name 3]` &bull; PRN: `[PRN 3]`
- **Interactive Web App**: `[https://your-deployment-url.vercel.app]` *(Vercel deployment placeholder)*
- **Repository**: [https://github.com/ishaannaik2310/uplift](https://github.com/ishaannaik2310/uplift)

---

## Honest Headline Findings

All figures are read directly from `results/corrected_tests.csv`, `results/metrics_summary.csv`, and `results/profit_curves.csv` over 10 repeated 60/40 train/test splits:

1. **Uplift Models Modestly Improve Customer Ranking Over Naive Propensity, But Differences Are Not Statistically Significant After Holm Adjustment**:
   - On the primary metric (Qini score / cumulative gain on visit), **X-Learner (LR)** achieves a mean Qini of **64.78** (&plusmn;9.31) and **T-Learner (LR)** achieves **63.46** (&plusmn;9.92), compared to **35.96** (&plusmn;10.92) for the baseline **Response Model (LR)** and **2.70** (&plusmn;14.77) for **Random Targeting**.
   - However, under the **Nadeau-Bengio (2003)** corrected resampled paired $t$-test (accounting for overlapping test splits, $J=10, n_2/n_1 = 0.4/0.6$), the comparison of T-Learner vs Response Model yields $t = 2.62, p_{\text{raw}} = 0.028$, which adjusts to $p_{\text{Holm}} = 0.112$ (not significant at $\alpha = 0.05$). Similarly, X-Learner vs Response Model yields $t = 2.77, p_{\text{raw}} = 0.022 \rightarrow p_{\text{Holm}} = 0.109$ (not significant).

2. **At Default Unit Economics, Emailing Everyone Is the Most Profitable Strategy**:
   - Under baseline business assumptions (30% contribution margin, \$0.05 cost per email, scaled to 100,000 customers):
     - **Target Everyone (100% budget)**: about **\$11,521** profit (mean: \$11,520.66, variation across repeated splits: &plusmn;\$3,692.17).
     - **T-Learner (LR) at a 30% budget**: about **\$5,936** profit (mean: \$5,935.63, variation: &plusmn;\$2,826.80).
     - **X-Learner (LR) at a 30% budget**: about **\$5,691** profit (mean: \$5,691.39, variation: &plusmn;\$2,777.29).
     - **Response Model (LR) at a 30% budget**: about **\$4,460** profit (mean: \$4,460.49, variation: &plusmn;\$2,508.34).
     - **Random Targeting at a 30% budget**: about **\$2,522** profit (mean: \$2,522.17, variation: &plusmn;\$3,018.71).
     - **S-Learner (XGB) at a 50% budget**: about **\$8,068** profit (mean: \$8,068.49, variation: &plusmn;\$3,209.47).
   - Because digital delivery costs are low (\$0.05) and margins are positive, the gross margin on incremental purchases from the remaining 70% of the customer base outweighs the cost of emailing them.

3. **At Higher Contact Costs, Selective Targeting Can Earn More Profit In-Sample, But Differences Are Within Split-to-Split Variation**:
   - When contact costs rise (e.g. direct mail at \$0.20–\$0.50/contact or customer unsubscribe fatigue costs), selective uplift policies preserve capital by excluding non-responders. However, customer spend is highly sparse (only 0.9% non-zero), so financial differences between selective targeting and broad campaigns fall within split-to-split variation.

---

## Project Structure

```text
uplift/
├── .gitignore                      # Git exclusion rules
├── README.md                       # Reproducibility guide and findings
├── requirements.txt                # Core Python dependencies
├── requirements-lock.txt           # Exact pinned environment versions
├── data/                           # Local dataset directory (ignored by git)
│   └── hillstrom.csv               # Downloaded/extracted RCT dataset
├── src/                            # Python data science & causal ML pipeline
│   ├── data.py                     # Dataset fetcher & loader (sklift + CSV fallback)
│   ├── preprocess.py               # Feature encoding & stratified splitting
│   ├── balance_check.py            # RCT covariate balance verification
│   ├── metrics.py                  # Qini curve, AUUC, and sklift-normalized curves
│   ├── models.py                   # S-Learner, T-Learner, X-Learner & Response baselines
│   ├── run_experiments.py          # 10-seed cross-validation training harness
│   ├── stats_tests.py              # Nadeau-Bengio corrected resampled t-test & Holm correction
│   ├── profit.py                   # Unit economics simulation across margins & costs
│   └── export_for_web.py           # Precomputes JSON payloads for web app
├── results/                        # Pipeline outputs and evaluation artifacts
│   ├── metrics_by_seed.csv         # Raw metrics across all 10 evaluation seeds
│   ├── metrics_summary.csv         # Aggregated mean and standard deviation
│   ├── corrected_tests.csv         # Nadeau-Bengio hypothesis tests with Holm adjustment
│   ├── profit_curves.csv           # Reconstructed profits across budget fractions (5%-100%)
│   ├── profit_at_budgets.csv       # In-depth profit at 30% and 50% targeting cutoffs
│   ├── sensitivity.csv             # 2D margin x cost grid sensitivity matrix
│   ├── predictions_seed0.csv       # Test set customer predictions for Seed 0 (3.7 MB)
│   ├── qini_plot.png               # Multi-model Qini curves plot
│   ├── profit_plot.png             # Campaign profit vs targeting budget plot
│   └── README_results.md           # Documentation of results and stable tie-breaking
└── web/                            # Interactive Next.js 16 Web Dashboard
    ├── public/data/                # Static precomputed data payloads
    │   ├── results.json            # Model benchmark metrics and metadata
    │   ├── profit_grid.json        # Financial simulation grid for client-side evaluation
    │   └── customers.json          # Ranked customer contact list for Seed 0 test split
    ├── scripts/
    │   └── verify-data.mjs         # Runtime profit reconstruction verification script
    └── src/
        ├── app/                    # Next.js App Router pages (/, /models, /simulator, /about)
        ├── components/             # Recharts visualizations, tables, toggles, diagrams
        └── lib/                    # Data fetchers, TypeScript interfaces, formatters
```

---

## Dataset Description & Source

The project evaluates the **Kevin Hillstrom MineThatData E-Mail Analytics Challenge** dataset containing **64,000 customers** who purchased within the previous twelve months, randomly allocated to one of three treatments:
- `Mens E-Mail` (21,361 customers)
- `Womens E-Mail` (21,387 customers)
- `No E-Mail` Control Group (21,306 customers)

Combined treated volume is **42,694 customers** (66.71%) vs **21,306 control customers** (33.29%).

### Loading Strategy in `src/data.py`
The data loader implementation in `src/data.py` executes three sequential strategies:
1. Calls `sklift.datasets.fetch_hillstrom(target_col='all')`, which downloads the dataset archive directly from the canonical S3 mirror:
   `https://hillstorm1.s3.us-east-2.amazonaws.com/hillstorm_no_indices.csv.gz`
2. If network access or the remote fetch fails, it falls back to loading a local file from `data/hillstrom.csv` or `data/hillstorm_no_indices.csv.gz`.
3. If neither source is available, it raises an informative error pointing to the original MineThatData challenge publication:
   `https://blog.minethatdata.com/2008/03/minethatdata-e-mail-analytics-and-data.html`

---

## Setup & Environment Installation

### Prerequisites
- Python 3.10+ (tested on Python 3.12 / 3.14)
- Node.js 18+ and npm 9+ (tested on Node v24.19.0, npm v11.17.0)

### 1. Python Environment Setup
```bash
# Create and activate a Python virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Verify against locked environment:
# pip install -r requirements-lock.txt
```

### 2. Node.js Environment Setup
```bash
cd web
npm install
cd ..
```

---

## Reproducing the Pipeline from Scratch

Run the pipeline scripts in the exact order below. All outputs will be generated deterministically:

```bash
# 1. Verify dataset integrity and target/feature dimensions
python src/check_data.py

# 2. Check feature preprocessing, one-hot encoding, and 60/40 stratified split
python src/check_preprocess.py

# 3. Verify statistical metric implementations (Qini, AUUC, sklift cross-check)
python src/test_metrics.py

# 4. Train 9 models across 10 random seeds (Seeds 0-9) and record test metrics
python src/run_experiments.py

# 5. Execute Nadeau-Bengio corrected resampled paired t-tests and Holm adjustment
python src/stats_tests.py

# 6. Simulate unit economics, profit curves, and sensitivity matrices
python src/profit.py

# 7. Precompute and export lightweight JSON data files for the web dashboard
python src/export_for_web.py
```

> **Note on Reproduction Steps**:
> `python src/run_experiments.py` trains the models and records metrics across seeds, but does not produce the statistical t-tests or profit curves. You must execute `python src/stats_tests.py`, `python src/profit.py`, and `python src/export_for_web.py` as separate steps in order to generate the full analysis and web artifacts.

> **Note on `results/predictions_all_seeds.csv`**:
> The full multi-seed predictions file (`predictions_all_seeds.csv`, ~37.3 MB) is excluded from version control to keep git operations lightweight. Running `python src/profit.py` regenerates this file completely from existing experiment outputs. `results/predictions_seed0.csv` (3.7 MB) remains tracked in the repository for immediate analysis.

---

## Running the Web Dashboard

The web application is built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **Recharts**.

```bash
cd web

# Run automated runtime data verification
npm run verify
# Validates 11 profit reconstructions against results/profit_curves.csv within $0.01

# Start local development server
npm run dev
# Dashboard available at http://localhost:3000

# Build and start production bundle
npm run build
npm run start
```

### Dashboard Pages
1. **Overview (`/`)**: Executive summary, business problem overview, interactive pipeline flow diagram, and live dataset facts from `results.json`.
2. **Models Benchmark (`/models`)**: Comprehensive 9-model comparison table, metric units guide, Nadeau-Bengio paired tests with Holm significance badges, interactive multi-model Qini curves chart, and decile uplift bar charts.
3. **Targeting & Profit Simulator (`/simulator`)**: Real-time simulation sliders for contribution margin (5%–60%), email contact cost (\$0.00–\$0.60), and targeting budget fraction (5%–100%). Includes break-even analysis, split-to-split variation guards, and a 100-customer ranked contact list with CSV export.
4. **Methodology & Rigor (`/about`)**: Mathematical foundations of CATE, S/T/X meta-learners, Qini cumulative gain formulas, and honest disclosure of assumptions and limitations.

---

## Assumptions & Limitations

1. **Unit Economics Assumptions**:
   - **Contribution Margin (Default 30%)**: Reflects typical gross margins on apparel retail merchandise after cost of goods sold.
   - **Cost per Email (Default \$0.05)**: Incorporates email service provider fees, campaign creative design, copywriting overhead, and estimated customer unsubscribes.
2. **Sparse Spend Outcome**:
   - While site visits occur for **14.67%** of customers (9,394 / 64,000), merchandise purchases with positive dollar spend occur for only **0.90%** of customers (578 / 64,000).
   - Because dollar spend is heavy-tailed and rare, monetary profit estimates exhibit wide variation across repeated train/test splits.
3. **Illustrative Customer Contact Scoring**:
   - Customer scores in the simulator table and CSV export represent held-out predictions from **Seed 0**. Score ties are broken with stable sorting preserving original row order.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
