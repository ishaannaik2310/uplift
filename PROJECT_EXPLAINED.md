# The Complete Guide to Uplift Modeling & Causal ML
## Everything You Need to Know About This Project in Plain English

---

## 1. What Is This Project? (The 60-Second Summary)

Imagine you run an online retail store with 100,000 customers. You have a marketing budget to send email campaigns. 

Most marketing teams do something very intuitive but fundamentally flawed: **they train a standard machine learning model to predict who is most likely to buy, and email those customers.**

Here is the problem: **Your best customers would have bought anyway, even without an email.** 

When you email your loyal customers:
- You spend money emailing people who didn't need a nudge.
- You annoy them with unnecessary emails (increasing unsubscribes).
- In some cases, you might even remind them to cancel a subscription!

This project solves that exact problem using **Causal Machine Learning (Uplift Modeling)**. 

Instead of asking:
> *"Who is most likely to buy?"* (Standard Prediction)

We ask:
> *"Who will buy **only because** we emailed them?"* (Causal Uplift)

We built an end-to-end scientific pipeline and an interactive web application that proves this concept, measures it with rigorous statistics, simulates the real dollar profit, and presents everything in an interactive dashboard deployed live on Vercel.

---

## 2. The Four Customer Types (The Core Concept)

In causal marketing science, every customer in your database falls into one of **four buckets**:

```
                       IF WE DON'T EMAIL:
                       Doesn't Buy           Buys Anyway
                   +---------------------+---------------------+
       Buys        |   1. PERSUADABLES   |   2. SURE THINGS    |
IF WE  Because     |  (The ONLY people   |   (Buy anyway;      |
EMAIL: of Email    |   we should email)  |    email is wasted) |
                   +---------------------+---------------------+
       Doesn't     |   3. LOST CAUSES    | 4. SLEEPING DOGS    |
       Buy         |  (Will never buy;   | (Get annoyed;       |
       Either Way  |   don't waste $)    |  unsubscribe/leave) |
                   +---------------------+---------------------+
```

1. **Persuadables**: They buy **only if** they receive an email. Target these people! Every dollar spent here generates brand-new revenue.
2. **Sure Things**: They love your brand and will purchase regardless. Emailing them is a waste of marketing budget.
3. **Lost Causes**: They will not purchase no matter how many emails you send. Emailing them is throwing money away.
4. **Sleeping Dogs (Do-Not-Disturbs)**: Contacting them triggers negative behavior (unsubscribing, complaining, remembering to cancel). Emailing them actually *hurts* revenue.

### Why Standard Machine Learning Fails
Standard ML models look at past purchases and rank customers by *purchase probability*. Naturally, **Sure Things** rank at the very top of standard ML models! The algorithm pats itself on the back because 80% of them end up buying—completely oblivious to the fact that they would have bought anyway for free.

**Uplift Modeling** isolates the **Persuadables** from the **Sure Things**.

---

## 3. The Dataset: Kevin Hillstrom MineThatData RCT

To measure causal effects, you cannot rely on observational data (where you picked who got emailed). You need a **Randomized Controlled Trial (RCT)**—the exact same standard used in clinical medical trials for vaccines.

### Where It Came From
In 2008, Kevin Hillstrom (former VP of Database Marketing at Nordstrom and Eddie Bauer) published the **MineThatData E-Mail Analytics Challenge**. It contains real-world customer data from an apparel retail company.

### Dataset Overview
- **Total Customers**: **64,000** real customers who purchased within the prior 12 months.
- **Random Allocation**: Each customer was randomly assigned to one of three groups:
  1. `Mens E-Mail`: 21,361 customers received an email highlighting men's merchandise.
  2. `Womens E-Mail`: 21,387 customers received an email highlighting women's merchandise.
  3. `No E-Mail` (Control Group): 21,306 customers received **zero marketing**.

In our primary analysis, we combine the two email groups into a single **Treated Group** (**42,694 customers / 66.71%**) vs. the **Control Group** (**21,306 customers / 33.29%**).

### What We Know About Each Customer (Features)
Before sending the email, the business recorded 8 attributes for each customer:
1. `recency`: Months since their last purchase (1 to 12).
2. `history`: Total dollar amount spent in the past year ($29.99 up to $3,345.86).
3. `mens`: 1 if they purchased men's merchandise in the past year, 0 if not.
4. `womens`: 1 if they purchased women's merchandise in the past year, 0 if not.
5. `zip_code`: Where they live (`Urban`, `Surburban`, or `Rural`).
6. `newbie`: 1 if they were a first-time customer in the past year, 0 if existing.
7. `channel`: Which shopping channel they used (`Phone`, `Web`, or `Multichannel`).
8. `history_segment`: A binned text bucket of their spend (e.g., "$100-$200").

### What Happened After the Email (Outcomes)
During the two-week test window following the campaign, the business tracked three outcomes:
1. `visit`: Did the customer visit the website? (**14.67%** visited overall).
2. `conversion`: Did the customer make a purchase? (**0.90%** purchased overall).
3. `spend`: How many dollars did the customer actually spend? 
   - 99.1% of customers spent **$0.00**.
   - The 578 customers who bought spent between **$29.99 and $499.00** (average ~$120).

---

## 4. How the Data Was Cleaned and Preprocessed

Clean, leakage-free data is the backbone of reliable machine learning. Here is exactly what `src/preprocess.py` and `src/data.py` do:

### 1. Ingestion Strategy (`src/data.py`)
The pipeline uses a multi-tier loading system:
- First, it calls `sklift.datasets.fetch_hillstrom(target_col='all')` to download the official dataset archive directly from the Amazon S3 mirror.
- If network access is offline, it automatically falls back to a local copy at `data/hillstrom.csv`.

### 2. RCT Covariate Balance Check (`src/balance_check.py`)
Before running any machine learning, we proved that the randomized trial was executed fairly. If customers in the treated group happened to be wealthier or newer than control customers, the test would be biased.
- We calculated the **Standardized Mean Difference (SMD)** for every feature between treated and control groups.
- All SMDs were **< 0.02** (far below the clinical threshold of 0.10).
- This statistically proves the randomization was clean: treated and control groups are completely identical in customer characteristics.

### 3. Feature Engineering (`src/preprocess.py`)
We transformed the raw features into a leakage-safe 15-column numerical matrix:
- **Continuous Transformation**: Customer spend `history` is heavily right-skewed (most spent ~$100, but a few spent thousands). We applied `log1p(history) = ln(1 + history)`. This stabilizes variance and stops extreme spenders from distorting linear models.
- **Dropping Redundant Columns**: We dropped `history_segment` because it was simply an arbitrary text bucket of `history`. Keeping both would introduce multicollinearity without adding any new information.
- **Recency Banding**: We created 4 binned categories (`1-3`, `4-6`, `7-9`, `10-12` months) alongside the raw continuous `recency`.
- **One-Hot Encoding**: Categorical columns (`zip_code`, `channel`, `recency_band`) were converted into binary columns (0s and 1s) with fixed alphabetical ordering so every future split produces identical feature shapes.
- **Leakage Guard**: A programmatic barrier ensures that none of the outcome columns (`visit`, `conversion`, `spend`) or treatment indicators ever leak into the feature matrix $X$.

### 4. Stratified 60/40 Train/Test Split Across 10 Seeds
To prevent "lucky splits," we never test on a single split:
- 60% of data (**44,800 customers**) is used for training.
- 40% of data (**19,200 customers**) is held out for testing.
- The split is stratified on both treatment ($T$) and outcome ($Y$) to preserve exact group ratios.
- We repeat this across **10 fixed random seeds (0 through 9)**.

---

## 5. Machine Learning Models: How Causal AI Works

In standard machine learning, the model predicts the target outcome:
$$\hat{Y} = P(\text{Visit} = 1 \mid X)$$

In causal uplift modeling, we want to estimate the **Conditional Average Treatment Effect (CATE)**, denoted as $\tau(X)$:
$$\tau(X) = E[Y \mid X, T=1] - E[Y \mid X, T=0]$$

In plain English: **"What is the difference in visit probability for customer $X$ if we email them versus if we do not email them?"**

Because a single customer cannot simultaneously receive an email and NOT receive an email in the real world (the Fundamental Problem of Causal Inference), we use **Causal Meta-Learners**:

### The 9 Models Evaluated in the Project

```
┌────────────────────────────────────────────────────────┐
│                   MODEL FAMILY                         │
├──────────────────────────┬─────────────────────────────┤
│ 1. Random Baseline       │ Flipping a fair coin        │
│ 2. Response Model (LR)   │ Trained on treated only     │
│ 3. Response Model (XGB)  │ Trained on treated only     │
│ 4. S-Learner (LR)        │ Single model with T flag    │
│ 5. S-Learner (XGB)       │ Single model with T flag    │
│ 6. T-Learner (LR)        │ Two separate models         │
│ 7. T-Learner (XGB)       │ Two separate models         │
│ 8. X-Learner (LR)        │ Cross-imputed counterfactual│
│ 9. X-Learner (XGB)       │ Cross-imputed counterfactual│
└──────────────────────────┴─────────────────────────────┘
```

#### 1. Baseline: Random Score
- Assigns each customer a uniform random number between 0 and 1.
- Represents unguided targeting (a coin flip). Its expected incremental gain is 0.

#### 2. Baseline: Response Model (Treated-Only Model)
- **Concept**: The traditional marketing approach. Trains a model exclusively on customers who were emailed to predict who visits.
- **Why it is flawed**: It finds customers with high base response rates (Sure Things). It cannot tell whether they visited because of the email or on their own.

#### 3. S-Learner ("Single" Model)
- **Concept**: Trains a single model using all features $X$ plus the treatment indicator $T \in \{0, 1\}$ as an extra feature: $\hat{f}(X, T)$.
- **How it predicts uplift**:
  $$\text{Uplift} = \hat{f}(X, 1) - \hat{f}(X, 0)$$
- **Pros & Cons**: Simple and uses all data, but has a well-known weakness called *regularization bias*: because the treatment indicator is just one of 16 features, tree models and regularized linear models often ignore it or shrink its effect toward zero.

#### 4. T-Learner ("Two" Models)
- **Concept**: Solves the S-Learner's weakness by splitting the data into two completely separate groups:
  - Model $\mu_1(X)$: Trained ONLY on treated customers.
  - Model $\mu_0(X)$: Trained ONLY on control customers.
- **How it predicts uplift**:
  $$\text{Uplift} = \hat{\mu}_1(X) - \hat{\mu}_0(X)$$
- **Pros & Cons**: Guarantees the treatment effect is never ignored. However, the two models don't share learned features, and control data is smaller (33%) than treated data (67%).

#### 5. X-Learner ("Cross-Estimation" Learner by Künzel et al., 2019)
- **Concept**: The most sophisticated causal meta-learner. It was specifically invented for datasets where one group (treated) is much larger than the other (control)—exactly like our 2:1 Hillstrom data.
- **How it works in 4 steps**:
  1. Train base models $\hat{\mu}_1(X)$ on treated and $\hat{\mu}_0(X)$ on control (like a T-Learner).
  2. **Impute Counterfactuals**:
     - For treated customers, estimate what would have happened if untreated: $D_1 = Y_1 - \hat{\mu}_0(X_1)$.
     - For control customers, estimate what would have happened if treated: $D_0 = \hat{\mu}_1(X_0) - Y_0$.
  3. Train two new second-stage models predicting these counterfactual differences: $\hat{\tau}_1(X)$ and $\hat{\tau}_0(X)$.
  4. Combine them weighted by propensity: $\hat{\tau}(X) = g(X)\hat{\tau}_0(X) + (1 - g(X))\hat{\tau}_1(X)$, giving more weight to the model trained on more data.

---

## 6. How We Evaluate Causal Models: The Qini Curve

You cannot evaluate an uplift model with standard metrics like Accuracy, Precision, Recall, or ROC-AUC. 

Why? Because you **never know the true uplift for an individual person**! You only know what they did under the treatment they actually received.

Instead, we use the **Qini Curve** (cumulative incremental gains).

### How the Qini Curve Works
1. Take the held-out test set (19,200 customers).
2. Rank all customers from highest predicted uplift to lowest predicted uplift.
3. Move down the list customer by customer (from top 1% to 100%).
4. At each point, calculate the **Cumulative Incremental Visits**:
   $$\text{Gain}(f) = Y_{\text{treated}}(f) - Y_{\text{control}}(f) \times \frac{N_{\text{treated}}(f)}{N_{\text{control}}(f)}$$
5. Plot this curve. A model that puts the true Persuadables at the top will climb steeply above the diagonal random line.
6. The **Qini Score** is the area between the model's curve and the random baseline. Higher = better customer ranking!

```
Cumulative
Incremental
Visits
  ^
  |        .---*--.  <-- Good Uplift Model (Peaks early by targeting Persuadables)
  |       /        \
  |      /          \
  |     /            * <-- Everyone Target Point (100% Budget)
  |    /            /
  |   /            /
  |  /            /  <-- Random Baseline (Straight line)
  | /            /
  +-----------------------------> Percentage of Customers Contacted (0% to 100%)
```

---

## 7. Statistical Rigor: Why Most ML Benchmarks Lie

Many marketing data science blogs claim: *"Our uplift model produced an 80% gain over baseline!"*

We tested whether that claim holds up under real mathematical scrutiny:

### The Problem: Overlapping Splits
When you run 10 random 60/40 train/test splits, the training sets overlap heavily (they share ~60% of the same customers). If you run a standard Student's $t$-test across repeated splits, the standard error is artificially small, causing massive **false positive rates** (claiming a difference is real when it's just random noise).

### The Solution: The Nadeau-Bengio (2003) Correction
We implemented the corrected resampled paired $t$-test formulated by Claude Nadeau and Yoshua Bengio:
$$\text{Var}_{\text{corrected}}(d) = \left(\frac{1}{J} + \frac{n_{\text{test}}}{n_{\text{train}}}\right) \times \text{Var}(d)$$

For our 10 splits ($J=10$) with $n_{\text{test}}=19,200$ and $n_{\text{train}}=44,800$:
$$\text{Correction Factor} = \frac{1}{10} + \frac{19,200}{44,800} = 0.10 + 0.4286 = 0.5286$$

This properly widens the variance to account for data overlap.

### The Holm-Bonferroni Multiple Comparison Adjustment
Because we compare multiple models against the baseline, testing multiple hypotheses increases the chance of a false positive. We applied the Holm-Bonferroni step-down correction to strictly control the family-wise error rate at $\alpha = 0.05$.

### The Honest Scientific Finding
Here are the exact numbers from `results/corrected_tests.csv`:

| Model | Mean Qini Score | Raw $p$-value | Nadeau-Bengio + Holm $p$-value | Significant at 5%? |
|---|---|---|---|---|
| **X-Learner (LR)** | **64.78** (±9.31) | $0.022$ | **$0.109$** | **No** (Within variation) |
| **T-Learner (LR)** | **63.46** (±9.92) | $0.028$ | **$0.112$** | **No** (Within variation) |
| **S-Learner (XGB)** | **53.07** (±11.45) | $0.088$ | **$0.264$** | **No** (Within variation) |
| **Response Model (LR)** | **35.96** (±10.92) | Baseline | Baseline | Baseline |
| **Random** | **2.70** (±14.77) | $< 0.001$ | **$< 0.001$** | **Yes** (Worse than model) |

> **The Scientific Takeaway**:
> Uplift models achieve a **mean Qini of 64.78 vs. 35.96** for the response baseline (a notable raw ranking improvement). However, after correcting for split overlap and multiple testing, **the differences are not statistically significant ($p = 0.109 > 0.05$)**. The difference falls within split-to-split variation. Being honest about this distinction separates real science from marketing hype.

---

## 8. The Financial Profit Simulator & Unit Economics

A model with a high Qini score doesn't necessarily make money. To connect machine learning to business value, we built a **unit economics simulation engine** in `src/profit.py`.

### The Profit Formula
For a target population of $N = 100,000$ customers, contacting a budget fraction $f \in [0.05, 1.00]$:
$$\text{Profit}(f) = N \times f \times \left(\text{Margin} \times \Delta\text{Spend}(f) - \text{Cost}\right)$$

Where:
- $N = 100,000$: Scaled campaign customer size.
- $f$: Fraction of customer base contacted (e.g., $0.30$ = emailing top 30,000 customers).
- $\text{Margin}$: Business gross contribution margin on merchandise (default **30%** or $0.30$).
- $\Delta\text{Spend}(f)$: Incremental dollar spend per customer in the top $f$ fraction compared to control.
- $\text{Cost}$: Cost per customer contacted (default **$0.05** per email).

### The Surprising Business Discovery
When we ran the simulation on real dollar spend across all 10 seeds, we discovered a vital business insight:

```
Campaign Net Profit ($)
  ^
  |                                                  * Everyone Target ($11,521)
  |                                                /
  |                                 * S-Learner ($8,068 at 50%)
  |                  * T-Learner ($5,936 at 30%)
  |                /
  |  * Random ($2,522 at 30%)
  +------------------------------------------------------------> Targeting Budget (0% to 100%)
```

#### Finding 1: At Default Costs ($0.05/email), Emailing Everyone Wins!
- **Targeting Everyone (100% budget)**: Earns **$11,521** net profit.
- **T-Learner at 30% budget**: Earns **$5,936** net profit.
- **Why?** Digital delivery is cheap ($0.05). Even though the remaining 70% of customers have smaller lift per person, their cumulative incremental spend easily covers the 5-cent cost of emailing them. Excluding them leaves money on the table!

#### Finding 2: When Contact Costs Rise, Selective Uplift Targeting Dominates!
- If contact costs rise to **$0.30 – $0.50** (for example, sending physical catalogs, direct mail, SMS, or factoring in customer unsubscribe brand damage):
  - **Emailing Everyone loses massive money** (negative profit).
  - **Selective Uplift Targeting preserves profit** by only contacting the high-lift customers who cover the high contact cost!

#### Finding 3: Spend Sparsity
While 14.67% of customers visited the website, only **0.90%** (578 people) actually purchased merchandise. Because dollar purchases are rare and heavy-tailed, monetary estimates exhibit wide variation across train/test splits.

---

## 9. Software Architecture & Web Application

The interactive web app in `web/` is built as a zero-latency, static client-side dashboard with no backend server required.

```
+-----------------------------------------------------------------------------------+
|                           PYTHON PIPELINE (src/)                                  |
|                                                                                   |
|  data.py -> preprocess.py -> balance_check.py -> metrics.py -> models.py          |
|                                                                  |                |
|  results/profit_curves.csv <--- profit.py <--- run_experiments.py                 |
|            |                                                                      |
|            +--------> export_for_web.py                                           |
+------------------------------|----------------------------------------------------+
                               v Produces 3 Static JSON files
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 16 DASHBOARD (web/)                                |
|                                                                                   |
|   web/public/data/results.json      --> Benchmark tables, Qini curves, p-values   |
|   web/public/data/profit_grid.json   --> Delta-spend matrices for instant math     |
|   web/public/data/customers.json    --> Top 100 Seed 0 customer contact list      |
|                                                                                   |
|   Real-Time Client Calculations:                                                  |
|   Sliders (Margin, Cost, Budget) ===> Instant Formula Recalculation (0ms)        |
+-----------------------------------------------------------------------------------+
                               | Deployed via Git
                               v
+-----------------------------------------------------------------------------------+
|                        LIVE ON VERCEL (Production)                                |
|               https://uplift-weld-zeta.vercel.app/simulator                       |
+-----------------------------------------------------------------------------------+
```

### Dashboard Pages
1. **Overview (`/`)**: Executive summary, problem definition, live dataset facts, and interactive causal pipeline diagram.
2. **Models Benchmark (`/models`)**: 9-model comparison table, metric definitions, interactive multi-model Qini curves, decile uplift charts, and plain-English significance badges.
3. **Profit Simulator (`/simulator`)**:
   - Two-column layout with a sticky parameter control panel.
   - Sliders for Margin (5%–60%), Cost ($0.00–$0.60), and Budget (5%–100%).
   - Dynamic verdict card with split-variation warning tags.
   - Three live KPI cards (Selected Policy vs. Target Everyone vs. No Campaign).
   - Break-even cost callout.
   - Interactive profit curve with zero-line and policy variation band.
   - Ranked customer contact table with CSV download.
4. **Methodology & Rigor (`/about`)**: Complete mathematical foundations, meta-learner formulations, and explicit disclosure of assumptions and limitations.

### Automated Integrity Verification (`web/scripts/verify-data.mjs`)
To guarantee that the frontend never drifts from the python pipeline:
- `npm run verify` dynamically loads `results/profit_curves.csv` and tests 11 distinct policy and budget combinations against `profit_grid.json`.
- All 11 checks match within **$0.0000 tolerance**.

---

## 10. Master Cheat Sheet

| Component | What Was Used | Why It Was Chosen |
|---|---|---|
| **Dataset** | Kevin Hillstrom MineThatData (64,000 customers) | Gold-standard randomized controlled trial (RCT) with real spend |
| **Target Variable** | `visit` (14.67%) for modeling; `spend` for profit | Visit has higher density for stable modeling; spend reflects true money |
| **Preprocessing** | `log1p(history)`, one-hot encoding, leakage guard | Handles skew, preserves continuous ordering, guarantees zero leakage |
| **Splits** | 10 repeated 60/40 stratified splits (Seeds 0–9) | Eliminates single-split luck; quantifies split-to-split variance |
| **Best Causal Model** | X-Learner with Logistic Regression | Highest mean Qini (64.78); designed specifically for imbalanced 2:1 RCTs |
| **Statistical Test** | Nadeau-Bengio corrected resampled paired $t$-test | Fixes split overlap variance underestimation ($J=10, n_2/n_1=0.4/0.6$) |
| **Multiple Testing** | Holm-Bonferroni step-down correction | Controls Family-Wise Error Rate at $\alpha = 0.05$ across models |
| **Tie-Breaking** | `np.argsort(-scores, kind="stable")` | Guarantees identical customer ranking regardless of platform |
| **Web Stack** | Next.js 16 (App Router), Tailwind v4, Recharts | Blazing-fast static client performance with zero backend latency |
| **Live URL** | [uplift-weld-zeta.vercel.app](https://uplift-weld-zeta.vercel.app) | Deployed on Vercel with automatic CI/CD from GitHub |
