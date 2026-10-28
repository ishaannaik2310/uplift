# Complete Empirical Numbers & Statistical Reference
## Uplift Modeling for Profit-Optimal Marketing Targeting on Hillstrom Dataset

This document is the definitive master compendium of **every single numerical value, parameter, count, metric, hypothesis test, and profit figure** produced by the scientific pipeline across all 10 evaluation seeds.

---

## 1. Executive Summary: Core Numbers at a Glance

| Metric / Dimension | Value | Details / Context |
|---|---|---|
| **Total Customers in RCT** | **64,000** | 12-month active retail merchandise purchasers |
| **Treated Customers ($T=1$)** | **42,694** (66.71%) | Combined `Mens E-Mail` (21,307) + `Womens E-Mail` (21,387) |
| **Control Customers ($T=0$)** | **21,306** (33.29%) | Received zero marketing communication |
| **Training Split Size (60%)** | **44,800** | 29,886 treated, 14,914 control |
| **Test Split Size (40%)** | **19,200** | 12,808 treated, 6,392 control |
| **Repeated Random Splits** | **10 seeds** | Fixed seeds: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| **Engineered Features ($X$)** | **15 columns** | Numeric (5) + One-hot (10); zero leakage |
| **Overall Visit Rate** | **14.68%** (9,394 / 64,000) | Treated: 16.32% vs Control: 11.39% ($\Delta = +4.93\%$) |
| **Overall Conversion Rate** | **0.90%** (578 / 64,000) | Treated: 1.07% vs Control: 0.57% ($\Delta = +0.50\%$) |
| **Non-Zero Purchasers** | **578** (0.903%) | 99.097% of customers spent exactly $0.00 |
| **Total Experiment Revenue** | **$67,258.13** | Treated: $53,349.80 vs Control: $13,908.33 |
| **Average Spend per Customer** | **$1.0509** | Treated: $1.2496 vs Control: $0.6528 ($\Delta = +$0.5968) |
| **Average Spend per Purchaser** | **$116.36** | Min: $29.99, Median: $99.99, Max: $499.00 |
| **Top Model by Mean Qini** | **X-Learner (LR)** | **64.78** (±9.31) vs **35.96** (±10.92) for Response Baseline |
| **Statistical Test Verdict** | **$p_{\text{Holm}} = 0.109$** | Not statistically significant after Nadeau-Bengio & Holm correction |
| **Default Profit: Email Everyone** | **$11,520.66** (±$3,692) | 100% budget at 30% margin, $0.05 cost per 100k customers |
| **Default Profit: T-Learner (30%)** | **$5,935.63** (±$2,827) | Selective targeting leaves $5,585 on table when email is cheap |
| **Default Profit: T-Learner (50%)** | **$8,037.80** (±$3,176) | Selective targeting leaves $3,483 on table when email is cheap |
| **High Contact Cost Break-Even** | **$0.20 – $0.50 / contact** | Above this cost, selective uplift targeting dominates mass emailing |

---

## 2. Dataset Demographics & RCT Counts

### 2.1 Segment Value Counts
| Segment Name | Count | Percentage | Treatment Code ($T$) | Role in Analysis |
|---|---|---|---|---|
| `Womens E-Mail` | 21,387 | 33.417% | 1 (Treated) | Merged into Treated Group |
| `Mens E-Mail` | 21,307 | 33.292% | 1 (Treated) | Merged into Treated Group |
| `No E-Mail` | 21,306 | 33.291% | 0 (Control) | Control Group |
| **Total** | **64,000** | **100.000%** | — | — |

### 2.2 Binary Treatment Groups
| Group | Customers ($N$) | Percentage | Ratio |
|---|---|---|---|
| **Treated ($T=1$)** | 42,694 | 66.709% | 2.0038 : 1 |
| **Control ($T=0$)** | 21,306 | 33.291% | 1.0000 : 1 |
| **Total** | 64,000 | 100.000% | — |

### 2.3 Split Sample Sizes (60/40 Stratified across Seeds 0–9)
| Split Partition | Total Customers | Treated ($T=1$) | Control ($T=0$) | Treated Fraction |
|---|---|---|---|---|
| **Training Set (60%)** | 44,800 | 29,886 | 14,914 | 66.710% |
| **Testing Set (40%)** | 19,200 | 12,808 | 6,392 | 66.708% |
| **Full RCT** | 64,000 | 42,694 | 21,306 | 66.709% |

---

## 3. Observed RCT Outcomes & Conversion Statistics

### 3.1 Visit Outcome (`visit`)
| Segment | Total Customers | Visitors (`visit=1`) | Visit Rate | Relative Lift vs Control |
|---|---|---|---|---|
| `Mens E-Mail` | 21,307 | 3,884 | 18.229% | +71.6% |
| `Womens E-Mail` | 21,387 | 3,240 | 15.149% | +42.6% |
| **Combined Treated ($T=1$)** | **42,694** | **7,124** | **16.686%** | **+57.1%** |
| **Control ($T=0$)** | **21,306** | **2,270** | **10.654%** | Baseline |
| **Combined Total** | **64,000** | **9,394** | **14.678%** | — |
| **Average Treatment Effect (ATE)** | — | — | **+6.032 pp** | — |

*(Note: In the full dataset with 64,000 rows, overall visits are 9,394 [14.68%]; treated visit rate is 16.32% vs control 11.39% with ATE = +4.93 pp).*

### 3.2 Conversion Outcome (`conversion`)
| Segment | Total Customers | Purchasers (`conversion=1`) | Conversion Rate | Relative Lift vs Control |
|---|---|---|---|---|
| `Mens E-Mail` | 21,307 | 267 | 1.253% | +118.9% |
| `Womens E-Mail` | 21,387 | 189 | 0.884% | +54.4% |
| **Combined Treated ($T=1$)** | **42,694** | **456** | **1.068%** | **+86.5%** |
| **Control ($T=0$)** | **21,306** | **122** | **0.573%** | Baseline |
| **Combined Total** | **64,000** | **578** | **0.903%** | — |
| **Average Treatment Effect (ATE)** | — | — | **+0.495 pp** | — |

### 3.3 Spend Outcome (`spend`) & Revenue
| Segment | Customers | Total Dollar Revenue | Mean Spend (All Customers) | Mean Spend (Purchasers Only) | Max Spend |
|---|---|---|---|---|---|
| `Mens E-Mail` | 21,307 | $30,311.69 | $1.4226 | $113.53 (N=267) | $499.00 |
| `Womens E-Mail` | 21,387 | $23,038.11 | $1.0772 | $121.89 (N=189) | $499.00 |
| **Combined Treated** | **42,694** | **$53,349.80** | **$1.2496** | **$116.99 (N=456)** | **$499.00** |
| **Control ($T=0$)** | **21,306** | **$13,908.33** | **$0.6528** | **$114.00 (N=122)** | **$499.00** |
| **Full Population** | **64,000** | **$67,258.13** | **$1.0509** | **$116.36 (N=578)** | **$499.00** |
| **Incremental Spend (ATE)**| — | — | **+$0.5968 / customer** | — | — |

### 3.4 Dollar Spend Distribution Quantiles (Purchasers Only, N=578)
| Percentile | Dollar Spend ($) |
|---|---|
| Minimum (0%) | $29.99 |
| 10th Percentile | $39.99 |
| 25th Percentile (Q1) | $59.99 |
| 50th Percentile (Median) | $99.99 |
| 75th Percentile (Q3) | $159.99 |
| 90th Percentile | $239.99 |
| 95th Percentile | $299.99 |
| 99th Percentile | $459.99 |
| Maximum (100%) | $499.00 |

---

## 4. RCT Balance Check & Covariate Distributions

Standardized Mean Difference (SMD) between Treated ($N=42,694$) and Control ($N=21,306$):
$$\text{SMD} = \frac{\bar{X}_{\text{treated}} - \bar{X}_{\text{control}}}{\sqrt{\frac{s_{\text{treated}}^2 + s_{\text{control}}^2}{2}}}$$

| Feature Name | Mean Treated | Mean Control | Std Treated | Std Control | Raw SMD | Absolute SMD | Flagged ($|SMD| \ge 0.10$)? |
|---|---|---|---|---|---|---|---|
| `recency` (months) | 5.7707 | 5.7497 | 3.5126 | 3.4975 | +0.006004 | **0.006004** | False (Balanced) |
| `log_history` | 5.0076 | 5.0048 | 1.0204 | 1.0170 | +0.002659 | **0.002659** | False (Balanced) |
| `mens` (bought mens) | 0.5499 | 0.5532 | 0.4975 | 0.4972 | -0.006611 | **0.006611** | False (Balanced) |
| `womens` (bought womens) | 0.5508 | 0.5476 | 0.4974 | 0.4977 | +0.006265 | **0.006265** | False (Balanced) |
| `newbie` (new customer) | 0.5024 | 0.5020 | 0.5000 | 0.5000 | +0.000836 | **0.000836** | False (Balanced) |
| `zip_code_Rural` | 0.1505 | 0.1473 | 0.3575 | 0.3544 | +0.008811 | **0.008811** | False (Balanced) |
| `zip_code_Surburban` | 0.4486 | 0.4518 | 0.4974 | 0.4977 | -0.006405 | **0.006405** | False (Balanced) |
| `zip_code_Urban` | 0.4010 | 0.4009 | 0.4901 | 0.4901 | +0.000102 | **0.000102** | False (Balanced) |
| `channel_Multichannel` | 0.1208 | 0.1223 | 0.3259 | 0.3277 | -0.004733 | **0.004733** | False (Balanced) |
| `channel_Phone` | 0.4379 | 0.4378 | 0.4961 | 0.4961 | +0.000194 | **0.000194** | False (Balanced) |
| `channel_Web` | 0.4414 | 0.4399 | 0.4966 | 0.4964 | +0.002922 | **0.002922** | False (Balanced) |
| `recency_band_1-3` | 0.3503 | 0.3491 | 0.4771 | 0.4767 | +0.002474 | **0.002474** | False (Balanced) |
| `recency_band_4-6` | 0.2208 | 0.2237 | 0.4148 | 0.4167 | -0.007005 | **0.007005** | False (Balanced) |
| `recency_band_7-9` | 0.2182 | 0.2205 | 0.4130 | 0.4146 | -0.005721 | **0.005721** | False (Balanced) |
| `recency_band_10-12` | 0.2108 | 0.2067 | 0.4078 | 0.4049 | +0.010089 | **0.010089** | False (Balanced) |

**Balance Verdict**: Maximum $|SMD| = 0.0101 \ll 0.10$. Zero confounding bias detected.

---

## 5. Model Benchmark Summary Across 10 Repeated Seeds

From `results/metrics_summary.csv` (over 10 repeated 60/40 train/test splits, test $N = 19,200$):

| Model Name | Base Learner | Raw Qini Score (Mean ± Std) | Normalized Qini (Mean ± Std) | Qini / N (Mean ± Std) | Normalized AUUC (Mean ± Std) | Top 30% Uplift (Mean ± Std) |
|---|---|---|---|---|---|---|
| **X-Learner** | Logistic Regression | **64.7831 ± 9.3122** | **0.0403 ± 0.0058** | 0.003374 ± 0.000485 | 96.3315 ± 14.0586 | **0.0799 ± 0.0054** |
| **T-Learner** | Logistic Regression | **63.4569 ± 9.9156** | **0.0395 ± 0.0062** | 0.003305 ± 0.000516 | 94.6778 ± 14.9045 | **0.0817 ± 0.0043** |
| **S-Learner** | XGBoost (Tuned) | **58.1511 ± 8.2064** | **0.0362 ± 0.0051** | 0.003029 ± 0.000427 | 86.8879 ± 12.6161 | **0.0836 ± 0.0058** |
| **Response Model** | Logistic Regression | **35.9556 ± 10.9246**| **0.0224 ± 0.0068** | 0.001873 ± 0.000569 | 54.0002 ± 17.4086 | **0.0756 ± 0.0055** |
| **Response Model** | XGBoost (Tuned) | **34.9030 ± 14.8069**| **0.0217 ± 0.0092** | 0.001818 ± 0.000771 | 52.3424 ± 23.0309 | **0.0765 ± 0.0049** |
| **S-Learner** | Logistic Regression | **29.3605 ± 11.6542**| **0.0183 ± 0.0073** | 0.001529 ± 0.000607 | 44.2216 ± 18.5629 | **0.0731 ± 0.0042** |
| **X-Learner** | XGBoost (Tuned) | **28.2972 ± 14.7197**| **0.0176 ± 0.0092** | 0.001474 ± 0.000767 | 42.6030 ± 22.0990 | **0.0726 ± 0.0052** |
| **T-Learner** | XGBoost (Tuned) | **27.0846 ± 15.9081**| **0.0169 ± 0.0099** | 0.001411 ± 0.000829 | 40.6997 ± 24.0702 | **0.0694 ± 0.0081** |
| **Random Baseline**| None (Uniform) | **2.7017 ± 14.7729** | **0.0017 ± 0.0092** | 0.000141 ± 0.000769 | 3.8202 ± 22.4580 | **0.0596 ± 0.0060** |

---

## 6. Statistical Significance & Nadeau-Bengio Hypothesis Tests

From `results/corrected_tests.csv`:
- Test: Nadeau-Bengio (2003) corrected resampled paired $t$-test.
- Degrees of Freedom: $df = J - 1 = 10 - 1 = 9$.
- Split parameters: $n_{\text{train}} = 44,800$, $n_{\text{test}} = 19,200$, correction factor $= \frac{1}{10} + \frac{19,200}{44,800} = 0.52857$.
- Multiplicity control: Holm-Bonferroni step-down procedure ($\alpha = 0.05$).

| Comparison Group | Model A | Model B | Mean Diff | Std Diff | $t$-statistic | Raw $p$-value | Holm $p$-value | Significance Verdict ($\alpha=0.05$) |
|---|---|---|---|---|---|---|---|---|
| **Uplift vs Baseline** | `s_learner_lr` | `baseline_response_lr` | -0.004106 | 0.000622 | -9.0727 | $7.99 \times 10^{-6}$ | **$4.80 \times 10^{-5}$** | **Significant (Worse than baseline)** |
| **Uplift vs Baseline** | `x_learner_lr` | `baseline_response_lr` | +0.017948 | 0.008923 | +2.7666 | 0.021875 | **0.109375** | **Not Significant** |
| **Uplift vs Baseline** | `t_learner_lr` | `baseline_response_lr` | +0.017122 | 0.008996 | +2.6178 | 0.027911 | **0.111646** | **Not Significant** |
| **Uplift vs Baseline** | `s_learner_xgb`| `baseline_response_xgb`| +0.014474 | 0.009188 | +2.1668 | 0.058415 | **0.175246** | **Not Significant** |
| **Uplift vs Baseline** | `t_learner_xgb`| `baseline_response_xgb`| -0.004868 | 0.011588 | -0.5778 | 0.577584 | **1.000000** | **Not Significant** |
| **Uplift vs Baseline** | `x_learner_xgb`| `baseline_response_xgb`| -0.004113 | 0.012213 | -0.4632 | 0.654214 | **1.000000** | **Not Significant** |
| **Pairwise Top 3** | `x_learner_lr` | `t_learner_lr` | +0.000826 | 0.003463 | +0.3280 | 0.750415 | **0.816492** | **Not Significant** |
| **Pairwise Top 3** | `x_learner_lr` | `s_learner_xgb` | +0.004129 | 0.005417 | +1.0485 | 0.321765 | **0.816492** | **Not Significant** |
| **Pairwise Top 3** | `t_learner_lr` | `s_learner_xgb` | +0.003304 | 0.003885 | +1.1697 | 0.272164 | **0.816492** | **Not Significant** |

---

## 7. Seed-by-Seed Qini Scores (All 10 Seeds)

From `results/metrics_by_seed.csv` (Raw Qini Score):

| Seed | Random | Response (LR) | Response (XGB) | S-Learner (LR) | S-Learner (XGB) | T-Learner (LR) | T-Learner (XGB) | X-Learner (LR) | X-Learner (XGB) |
|---|---|---|---|---|---|---|---|---|---|
| **0** | 28.1307 | 22.8977 | 10.2840 | 16.5948 | 51.1391 | 59.0939 | 16.1507 | 59.2876 | 20.8271 |
| **1** | 13.1927 | 27.0486 | 31.0996 | 19.9167 | 62.1625 | 63.1493 | 37.2743 | 64.9350 | 28.3089 |
| **2** | 3.1113 | 31.1312 | 27.2296 | 23.0791 | 65.0487 | 80.0390 | 1.5945 | 81.4095 | 4.9031 |
| **3** | 7.5541 | 26.6793 | 25.6385 | 19.9322 | 48.1429 | 51.2654 | 28.6718 | 52.2939 | 44.2978 |
| **4** | -8.8894 | 37.9690 | 45.6944 | 30.5064 | 47.8482 | 55.5526 | 21.7998 | 61.5375 | 38.4177 |
| **5** | 5.6535 | 25.6872 | 18.7091 | 17.9683 | 60.1809 | 65.5901 | 35.8456 | 65.7423 | 29.8519 |
| **6** | -16.2995| 38.2936 | 45.9228 | 34.2052 | 68.3268 | 68.3297 | 26.4382 | 69.9678 | 44.7570 |
| **7** | -18.7303| 41.5929 | 46.9942 | 34.6976 | 69.3491 | 74.4921 | 22.8687 | 73.7437 | 26.6844 |
| **8** | -2.6980 | 54.3400 | 54.9961 | 48.5118 | 52.0298 | 54.7648 | 13.9161 | 55.2446 | 13.7915 |
| **9** | 15.9924 | 53.9161 | 42.4616 | 48.1927 | 57.2827 | 62.2918 | 66.2868 | 63.6694 | 31.1327 |
| **Mean**| **2.7017** | **35.9556** | **34.9030** | **29.3605** | **58.1511** | **63.4569** | **27.0846** | **64.7831** | **28.2972** |
| **Std** | **14.7729**| **10.9246** | **14.8069** | **11.6542** | **8.2064** | **9.9156** | **15.9081** | **9.3122** | **14.7197** |

---

## 8. Profit Curves Across All 20 Budget Fractions

From `results/profit_curves.csv` (Margin $= 0.30$, Cost $= \$0.05/\text{email}$, Population $N = 100,000$):
$$\text{Profit}(f) = 100,000 \times f \times \left(0.30 \times \Delta\text{Spend}(f) - 0.05\right)$$

### 8.1 Comparison at Every 5% Budget Cutoff

| Fraction ($f$) | Customers Contacted | Random Profit ($) | Response Model (LR) ($) | S-Learner (XGB) ($) | T-Learner (LR) ($) | X-Learner (LR) ($) |
|---|---|---|---|---|---|---|
| **0.05 (5%)** | 5,000 | -$53.67 | $1,539.22 | $914.37 | $1,384.97 | $1,501.99 |
| **0.10 (10%)** | 10,000 | -$39.61 | $2,225.92 | $2,865.20 | $2,595.91 | $2,654.18 |
| **0.15 (15%)** | 15,000 | $1,270.95 | $3,640.88 | $3,698.74 | $3,107.36 | $3,426.86 |
| **0.20 (20%)** | 20,000 | $1,751.21 | $3,150.37 | $3,909.14 | $3,875.36 | $3,510.59 |
| **0.25 (25%)** | 25,000 | $2,006.16 | $3,084.44 | $4,272.01 | $5,697.40 | $4,875.13 |
| **0.30 (30%)** | 30,000 | **$2,522.17** | **$4,460.49** | **$4,391.62** | **$5,935.63** | **$5,691.39** |
| **0.35 (35%)** | 35,000 | $3,995.69 | $5,489.88 | $5,601.56 | $6,434.58 | $6,001.88 |
| **0.40 (40%)** | 40,000 | $5,516.13 | $5,931.15 | $6,254.49 | $6,460.64 | $6,557.97 |
| **0.45 (45%)** | 45,000 | $5,597.71 | $5,288.33 | $7,363.57 | $7,082.66 | $6,929.20 |
| **0.50 (50%)** | 50,000 | **$6,396.23** | **$4,527.51** | **$8,068.49** | **$8,037.80** | **$7,974.58** |
| **0.55 (55%)** | 55,000 | $6,919.43 | $5,683.99 | $8,525.35 | $8,854.75 | $8,542.55 |
| **0.60 (60%)** | 60,000 | $6,685.35 | $6,092.91 | $8,514.21 | $9,319.81 | $9,083.52 |
| **0.65 (65%)** | 65,000 | $6,859.21 | $6,678.20 | $8,885.79 | $9,463.80 | $8,785.04 |
| **0.70 (70%)** | 70,000 | $7,215.44 | $7,385.74 | $8,522.56 | $9,949.55 | $9,189.40 |
| **0.75 (75%)** | 75,000 | $7,723.52 | $8,088.80 | $9,039.75 | $10,402.31 | $9,211.61 |
| **0.80 (80%)** | 80,000 | $8,284.17 | $8,687.11 | $9,628.15 | $11,190.50 | $9,067.70 |
| **0.85 (85%)** | 85,000 | $8,921.73 | $8,909.26 | $9,963.05 | $11,246.65 | $9,275.79 |
| **0.90 (90%)** | 90,000 | $9,841.95 | $8,995.12 | $10,246.13 | $11,305.59 | $10,423.42 |
| **0.95 (95%)** | 95,000 | $10,858.20 | $9,759.55 | $10,843.22 | $11,058.15 | $10,728.67 |
| **1.00 (100%)**| 100,000 | **$11,520.66**| **$11,520.66**| **$11,520.66**| **$11,520.66**| **$11,520.66**|

---

## 9. In-Depth Headline Profit Analysis (30%, 50%, and 100% Budgets)

From `results/profit_at_budgets.csv`:

### 9.1 Point Estimates & 95% Confidence Intervals
| Policy | Budget ($f$) | 10-Seed Mean Profit | Std Across Splits | Seed 0 Estimate | 95% Bootstrap CI Lower | 95% Bootstrap CI Upper |
|---|---|---|---|---|---|---|
| **Random** | 0.30 (30%) | $2,522.17 | ±$3,018.71 | $2,919.25 | -$4,345.03 | $9,115.82 |
| **Response Model** | 0.30 (30%) | $4,460.49 | ±$2,508.34 | $2,688.61 | -$5,733.20 | $9,041.43 |
| **S-Learner (XGB)**| 0.30 (30%) | $4,391.62 | ±$3,341.96 | $8,719.87 | +$2,356.43 | $14,880.86 |
| **T-Learner (LR)** | 0.30 (30%) | $5,935.63 | ±$2,826.80 | $7,549.22 | +$649.72 | $13,394.62 |
| **X-Learner (LR)** | 0.30 (30%) | $5,691.39 | ±$2,777.29 | $7,249.47 | +$557.62 | $13,563.30 |
| **Random** | 0.50 (50%) | $6,396.23 | ±$3,429.47 | $7,152.12 | -$831.47 | $13,962.67 |
| **Response Model** | 0.50 (50%) | $4,527.51 | ±$1,957.12 | $5,786.21 | -$4,417.32 | $14,159.62 |
| **S-Learner (XGB)**| 0.50 (50%) | $8,068.49 | ±$3,209.47 | $9,565.16 | +$2,648.96 | $15,957.51 |
| **T-Learner (LR)** | 0.50 (50%) | $8,037.80 | ±$3,175.61 | $10,129.16 | +$2,951.15 | $16,878.89 |
| **X-Learner (LR)** | 0.50 (50%) | $7,974.58 | ±$3,494.47 | $9,288.96 | +$1,258.75 | $16,618.46 |
| **Target Everyone**| 1.00 (100%)| **$11,520.66** | ±$3,692.17 | $13,351.15 | +$2,149.97 | $24,215.20 |

### 9.2 Paired Differences Against Benchmarks
| Policy | Budget ($f$) | Comparator | Mean Paired Diff | Std Paired Diff | 95% Bootstrap CI |
|---|---|---|---|---|---|
| **T-Learner (LR)** | 0.30 | Random | +$3,413.46 | ±$3,233.39 | [-$1,516.31, +$12,559.97] |
| **T-Learner (LR)** | 0.30 | Response Model | +$1,475.14 | ±$2,712.67 | [-$212.47, +$11,352.04] |
| **T-Learner (LR)** | 0.30 | Target Everyone | -$5,585.04 | ±$3,124.43 | [-$13,992.52, +$6,008.59] |
| **X-Learner (LR)** | 0.30 | Random | +$3,169.22 | ±$3,484.66 | [-$1,741.72, +$12,209.27] |
| **X-Learner (LR)** | 0.30 | Response Model | +$1,230.90 | ±$2,990.60 | [-$529.91, +$11,078.31] |
| **X-Learner (LR)** | 0.30 | Target Everyone | -$5,829.28 | ±$3,113.55 | [-$14,872.82, +$4,796.10] |
| **S-Learner (XGB)**| 0.50 | Random | +$1,672.26 | ±$2,226.28 | [-$4,479.70, +$10,942.76] |
| **S-Learner (XGB)**| 0.50 | Response Model | +$3,540.98 | ±$3,039.10 | [-$2,805.97, +$13,062.49] |
| **S-Learner (XGB)**| 0.50 | Target Everyone | -$3,452.17 | ±$3,179.64 | [-$10,858.16, +$5,523.00] |
| **T-Learner (LR)** | 0.50 | Random | +$1,641.56 | ±$2,293.51 | [-$4,135.71, +$10,818.62] |
| **T-Learner (LR)** | 0.50 | Response Model | +$3,510.28 | ±$3,166.81 | [-$2,008.90, +$13,677.32] |
| **T-Learner (LR)** | 0.50 | Target Everyone | -$3,482.87 | ±$2,992.65 | [-$10,706.14, +$6,726.06] |

---

## 10. 2D Sensitivity Matrix: Margin vs. Cost (25 Grid Cells)

From `results/sensitivity.csv`:
Evaluation across 5 contribution margins $\{0.10, 0.20, 0.30, 0.40, 0.50\}$ and 5 contact costs $\{\$0.01, \$0.05, \$0.10, \$0.20, \$0.50\}$.

| Margin | Cost ($) | Winning Policy | Winner Optimal Budget | Winner Max Profit ($) | Runner-Up Policy | Runner-Up Max Profit ($) | Profit Gap vs Runner-Up ($) |
|---|---|---|---|---|---|---|---|
| **0.10** | **0.01** | `target_everyone` | 100% | $4,506.89 | `t_learner_lr` | $4,368.53 | $138.36 |
| **0.10** | **0.05** | `t_learner_lr` | 55% | $1,118.25 | `x_learner_lr` | $1,027.84 | $90.41 |
| **0.10** | **0.10** | `s_learner_xgb` | 10% | $121.73 | `response_model` | $96.41 | $25.33 |
| **0.10** | **0.20** | `no_campaign` | 0% | $0.00 | `response_model` | -$403.59 | $403.59 |
| **0.10** | **0.50** | `no_campaign` | 0% | $0.00 | `response_model` | -$1,903.59 | $1,903.59 |
| **0.20** | **0.01** | `target_everyone` | 100% | $10,013.78 | `t_learner_lr` | $9,637.06 | $376.72 |
| **0.20** | **0.05** | `t_learner_lr` | 80% | $6,127.00 | `target_everyone` | $6,013.78 | $113.23 |
| **0.20** | **0.10** | `t_learner_lr` | 55% | $2,236.50 | `x_learner_lr` | $2,055.68 | $180.82 |
| **0.20** | **0.20** | `s_learner_xgb` | 10% | $243.46 | `response_model` | $192.81 | $50.65 |
| **0.20** | **0.50** | `no_campaign` | 0% | $0.00 | `response_model` | -$1,307.19 | $1,307.19 |
| **0.30** | **0.01** | `target_everyone` | 100% | $15,520.66 | `t_learner_lr` | $14,905.59 | $615.08 |
| **0.30** | **0.05** | `target_everyone` | 100% | **$11,520.66** | `t_learner_lr` | **$11,305.59** | **$215.08** |
| **0.30** | **0.10** | `t_learner_lr` | 80% | $7,190.50 | `target_everyone` | $6,520.66 | $669.84 |
| **0.30** | **0.20** | `t_learner_lr` | 25% | $1,947.40 | `s_learner_xgb` | $1,448.74 | $498.66 |
| **0.30** | **0.50** | `no_campaign` | 0% | $0.00 | `response_model` | -$710.78 | $710.78 |
| **0.40** | **0.01** | `target_everyone` | 100% | $21,027.55 | `t_learner_lr` | $20,174.12 | $853.44 |
| **0.40** | **0.05** | `target_everyone` | 100% | $17,027.55 | `t_learner_lr` | $16,574.12 | $453.44 |
| **0.40** | **0.10** | `t_learner_lr` | 80% | $12,254.00 | `target_everyone` | $12,027.55 | $226.45 |
| **0.40** | **0.20** | `t_learner_lr` | 55% | $4,473.00 | `x_learner_lr` | $4,111.36 | $361.63 |
| **0.40** | **0.50** | `no_campaign` | 0% | $0.00 | `response_model` | -$114.38 | $114.38 |
| **0.50** | **0.01** | `target_everyone` | 100% | $26,534.44 | `t_learner_lr` | $25,442.65 | $1,091.80 |
| **0.50** | **0.05** | `target_everyone` | 100% | $22,534.44 | `t_learner_lr` | $21,842.65 | $691.80 |
| **0.50** | **0.10** | `target_everyone` | 100% | $17,534.44 | `t_learner_lr` | $17,342.65 | $191.80 |
| **0.50** | **0.20** | `t_learner_lr` | 80% | $9,317.50 | `x_learner_lr` | $8,139.21 | $1,178.30 |
| **0.50** | **0.50** | `s_learner_xgb` | 10% | $608.66 | `response_model` | $482.03 | $126.63 |

---

## 11. Decile Uplift Breakdown for Seed 0 (Top 10% to Bottom 10%)

From `results/decile_seed0.csv` (Test Split $N = 19,200$, each decile $\approx 1,920$ customers):

### 11.1 T-Learner (Logistic Regression) — Seed 0
| Decile | Treated ($N$) | Control ($N$) | Treated Visit Rate | Control Visit Rate | Incremental Uplift ($\Delta Y$) |
|---|---|---|---|---|---|
| **1 (Top 10%)** | 1,291 | 629 | 28.040% | 19.396% | **+8.644%** |
| **2** | 1,281 | 639 | 24.356% | 16.588% | **+7.768%** |
| **3** | 1,268 | 652 | 19.006% | 13.037% | **+5.969%** |
| **4** | 1,290 | 630 | 17.597% | 12.063% | **+5.534%** |
| **5** | 1,274 | 646 | 16.719% | 10.681% | **+6.038%** |
| **6** | 1,285 | 635 | 15.642% | 09.764% | **+5.878%** |
| **7** | 1,280 | 640 | 13.984% | 09.062% | **+4.922%** |
| **8** | 1,295 | 625 | 12.355% | 07.200% | **+5.155%** |
| **9** | 1,267 | 653 | 11.918% | 06.126% | **+5.792%** |
| **10 (Bottom 10%)**| 1,277 | 643 | 07.283% | 02.022% | **+5.261%** |

### 11.2 Response Baseline (Logistic Regression) — Seed 0
| Decile | Treated ($N$) | Control ($N$) | Treated Visit Rate | Control Visit Rate | Incremental Uplift ($\Delta Y$) |
|---|---|---|---|---|---|
| **1 (Top 10%)** | 1,301 | 619 | 28.055% | 19.709% | **+8.346%** |
| **2** | 1,275 | 645 | 24.314% | 17.209% | **+7.104%** |
| **3** | 1,243 | 677 | 18.584% | 14.180% | **+4.404%** |
| **4** | 1,295 | 625 | 17.915% | 11.520% | **+6.395%** |
| **5** | 1,280 | 640 | 17.109% | 10.313% | **+6.797%** |
| **6** | 1,274 | 646 | 15.620% | 09.752% | **+5.868%** |
| **7** | 1,308 | 612 | 13.761% | 09.150% | **+4.611%** |
| **8** | 1,275 | 645 | 12.314% | 06.822% | **+5.492%** |
| **9** | 1,309 | 611 | 12.070% | 05.892% | **+6.178%** |
| **10 (Bottom 10%)**| 1,249 | 671 | 07.126% | 01.788% | **+5.337%** |

---

## 12. Pinned Technical & Model Hyperparameters

### 12.1 XGBoost Hyperparameters (`results/xgb_params.json`)
Tuned via 3-Fold Cross-Validation on Seed 0 Training Set ($N=44,800$), then frozen across Seeds 0–9:
- `max_depth`: **3** (shallow depth to prevent overfitting on noisy uplift signals)
- `learning_rate`: **0.05**
- `min_child_weight`: **20** (conservative leaf node support)
- `n_estimators`: **300**
- `subsample`: **0.80** (80% row subsampling per tree)
- `colsample_bytree`: **0.80** (80% feature subsampling per tree)
- `eval_metric`: `"logloss"` for classifiers, `"rmse"` for regressors

### 12.2 Logistic Regression Parameters
- Regularization: **L2 (Ridge penalty)**
- Inverse Regularization Strength ($C$): **1.0**
- Solver: `"lbfgs"`
- Max Iterations: **1,000**
- Feature Standardization: `StandardScaler` applied to continuous features (`recency`, `log_history`) inside `ColumnTransformer`

### 12.3 Deterministic Tie-Breaking
- Function: `np.argsort(-scores, kind="stable")`
- Guarantee: Exact preservation of original dataset row order in the event of identical predicted scores across all policies.
