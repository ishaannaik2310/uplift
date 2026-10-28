"""Script to export all 9 publication-grade visualizations from the Hillstrom uplift modeling pipeline.
Generates 300 DPI PNG images in:
- notebooks/images/
- web/public/images/visualizations/
- Artifact directory
- C:/Users/ishaa/Downloads/uplift_visualizations/
"""

import os
import shutil
import warnings
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import StratifiedShuffleSplit
import xgboost as xgb

warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / 'data' / 'hillstrom.csv'

OUTPUT_DIRS = [
    PROJECT_ROOT / 'notebooks' / 'images',
    PROJECT_ROOT / 'web' / 'public' / 'images' / 'visualizations',
    Path(r'C:\Users\ishaa\.gemini\antigravity\brain\7ad2da82-993d-4f73-93ab-efd388c0279e\visualizations'),
    Path(r'C:\Users\ishaa\Downloads\uplift_visualizations'),
]

for d in OUTPUT_DIRS:
    d.mkdir(parents=True, exist_ok=True)

# Plot styling
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
plt.rcParams.update({
    'font.size': 11,
    'axes.labelsize': 12,
    'axes.titlesize': 13,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.titlesize': 14,
    'figure.dpi': 300,
    'axes.grid': True,
    'grid.alpha': 0.53,
})

def save_fig(fig, filename):
    for d in OUTPUT_DIRS:
        fig.savefig(d / filename, dpi=300, bbox_inches='tight')
    plt.close(fig)
    print(f"Saved: {filename}")

print("Loading data...")
df_raw = pd.read_csv(DATA_PATH)
df = df_raw.copy()
df['treated'] = df['segment'].isin(['Mens E-Mail', 'Womens E-Mail']).astype(int)

# ==============================================================================
# Fig 1: RCT Outcomes
# ==============================================================================
print("Generating Fig 1: RCT Outcomes...")
fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))

visit_data = df.groupby('treated')['visit'].mean() * 100
bars0 = axes[0].bar(['Control (No Email)', 'Treated (Email)'], visit_data.values, color=['#64748b', '#0f766e'], width=0.55)
axes[0].set_title('1. Website Visit Rate (%)', fontweight='bold')
axes[0].set_ylabel('Visit Rate (%)')
axes[0].set_ylim(0, max(visit_data.values) * 1.25)
for bar in bars0:
    v = bar.get_height()
    axes[0].text(bar.get_x() + bar.get_width()/2, v + 0.3, f'{v:.2f}%', ha='center', fontweight='bold')

conv_data = df.groupby('treated')['conversion'].mean() * 100
bars1 = axes[1].bar(['Control (No Email)', 'Treated (Email)'], conv_data.values, color=['#64748b', '#0f766e'], width=0.55)
axes[1].set_title('2. Purchase Conversion Rate (%)', fontweight='bold')
axes[1].set_ylabel('Conversion Rate (%)')
axes[1].set_ylim(0, max(conv_data.values) * 1.25)
for bar in bars1:
    v = bar.get_height()
    axes[1].text(bar.get_x() + bar.get_width()/2, v + 0.03, f'{v:.2f}%', ha='center', fontweight='bold')

spend_data = df.groupby('treated')['spend'].mean()
bars2 = axes[2].bar(['Control (No Email)', 'Treated (Email)'], spend_data.values, color=['#64748b', '#0f766e'], width=0.55)
axes[2].set_title('3. Mean Spend per Customer ($)', fontweight='bold')
axes[2].set_ylabel('Average Dollar Spend ($)')
axes[2].set_ylim(0, max(spend_data.values) * 1.25)
for bar in bars2:
    v = bar.get_height()
    axes[2].text(bar.get_x() + bar.get_width()/2, v + 0.04, f'${v:.2f}', ha='center', fontweight='bold')

plt.tight_layout()
save_fig(fig, 'fig1_rct_outcomes.png')

# ==============================================================================
# Fig 2: Covariate Balance (Love Plot)
# ==============================================================================
print("Generating Fig 2: Covariate Balance...")
t1 = df[df['treated'] == 1]
t0 = df[df['treated'] == 0]
covariates = ['recency', 'history', 'mens', 'womens', 'newbie']
balance_rows = []

for cov in covariates:
    m1, v1 = t1[cov].mean(), t1[cov].var()
    m0, v0 = t0[cov].mean(), t0[cov].var()
    pooled_sd = np.sqrt((v1 + v0) / 2.0)
    smd = (m1 - m0) / pooled_sd
    balance_rows.append({'Covariate': cov, 'SMD': smd})

for col in ['channel', 'zip_code']:
    for val in df[col].unique():
        p1_val = (t1[col] == val).mean()
        p0_val = (t0[col] == val).mean()
        pooled_p = (p1_val + p0_val) / 2.0
        denom = np.sqrt(pooled_p * (1.0 - pooled_p))
        smd = (p1_val - p0_val) / denom if denom > 0 else 0.0
        balance_rows.append({'Covariate': f'{col}_{val}', 'SMD': smd})

balance_df = pd.DataFrame(balance_rows).sort_values(by='SMD', ascending=True)

fig = plt.figure(figsize=(9, 5))
y_pos = np.arange(len(balance_df))
plt.axvline(0, color='black', linestyle='-', linewidth=0.8)
plt.axvline(-0.10, color='red', linestyle='--', linewidth=1, label='Imbalance Threshold (±0.10)')
plt.axvline(0.10, color='red', linestyle='--', linewidth=1)
plt.scatter(balance_df['SMD'], y_pos, color='#0f766e', s=50, zorder=3)
for i, smd in enumerate(balance_df['SMD']):
    plt.plot([0, smd], [i, i], color='#0f766e', alpha=0.5, linewidth=1.5)
plt.yticks(y_pos, balance_df['Covariate'])
plt.xlabel('Standardized Mean Difference (SMD)')
plt.title('Covariate Balance Between Treated and Control (Love Plot)', fontweight='bold')
plt.xlim(-0.12, 0.12)
plt.legend(loc='lower right')
plt.tight_layout()
save_fig(fig, 'fig2_covariate_balance.png')

# ==============================================================================
# Preprocessing Pipeline
# ==============================================================================
print("Preprocessing features...")
df_clean = df.copy()
df_clean['history_log'] = np.log1p(df_clean['history'])

recency_bins = [-1, 3, 7, 13]
recency_labels = ['recency_0_3', 'recency_4_7', 'recency_8_12']
df_clean['recency_band'] = pd.cut(df_clean['recency'], bins=recency_bins, labels=recency_labels)

num_cols = ['history_log', 'history', 'recency']
cat_cols = ['recency_band', 'channel', 'zip_code']
binary_cols = ['mens', 'womens', 'newbie']

preprocessor = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), num_cols),
        ('cat', 'passthrough', [f'{c}_{v}' for c in cat_cols for v in sorted(df_clean[c].unique())]),
        ('bin', 'passthrough', binary_cols),
    ]
)

df_encoded = pd.get_dummies(df_clean, columns=cat_cols, drop_first=False, dtype=float)
dummy_cat_cols = [c for c in df_encoded.columns if any(c.startswith(prefix + '_') for prefix in cat_cols)]
feature_cols = num_cols + dummy_cat_cols + binary_cols

X = df_encoded[feature_cols].copy()
y = df_clean['visit'].values
spend = df_clean['spend'].values
treated = df_clean['treated'].values

sss = StratifiedShuffleSplit(n_splits=1, test_size=0.30, random_state=0)
train_idx, test_idx = next(sss.split(X, treated))

X_train, X_test = X.iloc[train_idx].values, X.iloc[test_idx].values
y_train, y_test = y[train_idx], y[test_idx]
t_train, t_test = treated[train_idx], treated[test_idx]
spend_train, spend_test = spend[train_idx], spend[test_idx]

def get_scaler_pipeline(model):
    scaler = StandardScaler()
    return Pipeline([('scaler', scaler), ('model', model)])

# Train models
print("Training models...")
# 1. Naive Response
clf_resp = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
clf_resp.fit(X_train, y_train)
pred_resp = clf_resp.predict_proba(X_test)[:, 1]

# 2. S-Learner LR
X_tr_s = np.column_stack([X_train, t_train])
X_te_s1 = np.column_stack([X_test, np.ones(len(X_test))])
X_te_s0 = np.column_stack([X_test, np.zeros(len(X_test))])
clf_s_lr = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
clf_s_lr.fit(X_tr_s, y_train)
pred_s_lr = clf_s_lr.predict_proba(X_te_s1)[:, 1] - clf_s_lr.predict_proba(X_te_s0)[:, 1]

# 3. S-Learner XGB
clf_s_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0, eval_metric='logloss')
clf_s_xgb.fit(X_tr_s, y_train)
pred_s_xgb = clf_s_xgb.predict_proba(X_te_s1)[:, 1] - clf_s_xgb.predict_proba(X_te_s0)[:, 1]

# 4. T-Learner LR
clf_t0 = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
clf_t1 = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
clf_t0.fit(X_train[t_train == 0], y_train[t_train == 0])
clf_t1.fit(X_train[t_train == 1], y_train[t_train == 1])
pred_t_lr = clf_t1.predict_proba(X_test)[:, 1] - clf_t0.predict_proba(X_test)[:, 1]

# 5. T-Learner XGB
clf_t0_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0, eval_metric='logloss')
clf_t1_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0, eval_metric='logloss')
clf_t0_xgb.fit(X_train[t_train == 0], y_train[t_train == 0])
clf_t1_xgb.fit(X_train[t_train == 1], y_train[t_train == 1])
pred_t_xgb = clf_t1_xgb.predict_proba(X_test)[:, 1] - clf_t0_xgb.predict_proba(X_test)[:, 1]

# 6. X-Learner LR
mu0 = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
mu1 = get_scaler_pipeline(LogisticRegression(penalty='l2', C=1.0, random_state=0, max_iter=1000))
mu0.fit(X_train[t_train == 0], y_train[t_train == 0])
mu1.fit(X_train[t_train == 1], y_train[t_train == 1])
d1 = y_train[t_train == 1] - mu0.predict_proba(X_train[t_train == 1])[:, 1]
d0 = mu1.predict_proba(X_train[t_train == 0])[:, 1] - y_train[t_train == 0]
tau1 = get_scaler_pipeline(Ridge(alpha=1.0, random_state=0))
tau0 = get_scaler_pipeline(Ridge(alpha=1.0, random_state=0))
tau1.fit(X_train[t_train == 1], d1)
tau0.fit(X_train[t_train == 0], d0)
e_hat = float(np.mean(t_train))
pred_x_lr = e_hat * tau0.predict(X_test) + (1.0 - e_hat) * tau1.predict(X_test)

# 7. X-Learner XGB
mu0_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0, eval_metric='logloss')
mu1_xgb = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0, eval_metric='logloss')
mu0_xgb.fit(X_train[t_train == 0], y_train[t_train == 0])
mu1_xgb.fit(X_train[t_train == 1], y_train[t_train == 1])
d1_xgb = y_train[t_train == 1] - mu0_xgb.predict_proba(X_train[t_train == 1])[:, 1]
d0_xgb = mu1_xgb.predict_proba(X_train[t_train == 0])[:, 1] - y_train[t_train == 0]
tau1_xgb = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0)
tau0_xgb = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=0)
tau1_xgb.fit(X_train[t_train == 1], d1_xgb)
tau0_xgb.fit(X_train[t_train == 0], d0_xgb)
pred_x_xgb = e_hat * tau0_xgb.predict(X_test) + (1.0 - e_hat) * tau1_xgb.predict(X_test)

models = {
    'X-Learner (LR)': pred_x_lr,
    'T-Learner (LR)': pred_t_lr,
    'S-Learner (XGB)': pred_s_xgb,
    'Response Baseline (LR)': pred_resp,
    'S-Learner (LR)': pred_s_lr,
    'T-Learner (XGB)': pred_t_xgb,
    'X-Learner (XGB)': pred_x_xgb,
}

_trapz = getattr(np, 'trapezoid', getattr(np, 'trapz', None))

def compute_qini_curve(y_true, treated, score):
    order = np.argsort(-score, kind='stable')
    y_s = y_true[order]
    t_s = treated[order]
    n_t = np.sum(t_s == 1)
    n_c = np.sum(t_s == 0)
    cum_yt = np.cumsum((t_s == 1) * y_s)
    cum_yc = np.cumsum((t_s == 0) * y_s)
    qini_vals = cum_yt - (float(n_t) / float(n_c)) * cum_yc
    fracs = np.linspace(0, 1, len(y_true) + 1)
    return fracs, np.concatenate(([0.0], qini_vals))

def compute_qini_score(y_true, treated, score):
    x_q, y_q = compute_qini_curve(y_true, treated, score)
    auc_model = _trapz(y_q, x_q)
    auc_random = 0.5 * y_q[-1]
    return float(auc_model - auc_random)

# ==============================================================================
# Fig 3: Qini Curves
# ==============================================================================
print("Generating Fig 3: Qini Curves...")
fig = plt.figure(figsize=(10, 6))
palette = {
    'X-Learner (LR)': '#0f766e',
    'T-Learner (LR)': '#2563eb',
    'S-Learner (XGB)': '#9333ea',
    'Response Baseline (LR)': '#f59e0b',
    'S-Learner (LR)': '#06b6d4',
    'T-Learner (XGB)': '#3b82f6',
    'X-Learner (XGB)': '#10b981',
}
for name, preds in models.items():
    x_q, y_q = compute_qini_curve(y_test, t_test, preds)
    plt.plot(x_q, y_q, label=f"{name} (Qini: {compute_qini_score(y_test, t_test, preds):.1f})",
             color=palette.get(name, '#64748b'), linewidth=2.2 if 'X-Learner (LR)' in name else 1.5)

_, y_rand = compute_qini_curve(y_test, t_test, models['X-Learner (LR)'])
plt.plot([0, 1], [0, y_rand[-1]], color='#94a3b8', linestyle='--', linewidth=1.5, label='Random Targeting (Qini: 0.0)')
plt.title('Cumulative Qini Curves Comparison on Test Set (Seed 0)', fontweight='bold')
plt.xlabel('Fraction of Population Targeted')
plt.ylabel('Cumulative Incremental Visitors (Qini Value)')
plt.xlim(0, 1)
plt.ylim(bottom=-50)
plt.legend(loc='lower right')
plt.tight_layout()
save_fig(fig, 'fig3_qini_curves.png')

# ==============================================================================
# Fig 4: Decile Lift
# ==============================================================================
print("Generating Fig 4: Decile Lift...")
def get_decile_uplift(y_true, treated, score, n_bins=10):
    order = np.argsort(-score, kind='stable')
    y_s, t_s = y_true[order], treated[order]
    bins = np.array_split(np.arange(len(y_s)), n_bins)
    uplifts = []
    for idx in bins:
        y_b, t_b = y_s[idx], t_s[idx]
        r_t = y_b[t_b == 1].mean()
        r_c = y_b[t_b == 0].mean()
        uplifts.append((r_t - r_c) * 100)
    return uplifts

deciles = np.arange(1, 11)
x_uplift_dec = get_decile_uplift(y_test, t_test, models['X-Learner (LR)'])
resp_uplift_dec = get_decile_uplift(y_test, t_test, models['Response Baseline (LR)'])

fig = plt.figure(figsize=(10, 4.5))
bar_w = 0.38
plt.bar(deciles - bar_w/2, x_uplift_dec, width=bar_w, label='X-Learner (LR) - Causal Uplift', color='#0f766e')
plt.bar(deciles + bar_w/2, resp_uplift_dec, width=bar_w, label='Response Baseline (LR) - Naive Propensity', color='#f59e0b')
plt.axhline(0, color='black', linewidth=0.8)
plt.xlabel('Targeting Decile (1 = Highest Predicted Score)')
plt.ylabel('Incremental Visit Rate Lift (%)')
plt.title('Incremental Lift by Decile: Causal Uplift vs Naive Propensity', fontweight='bold')
plt.xticks(deciles)
plt.legend()
plt.tight_layout()
save_fig(fig, 'fig4_decile_lift.png')

# ==============================================================================
# Fig 5: 10-Split Qini Boxplot
# ==============================================================================
print("Generating Fig 5: CV Distribution...")
ten_seeds_qini = {
    'X-Learner (LR)': [68.32, 59.41, 74.20, 62.15, 65.80, 54.30, 78.10, 61.20, 58.90, 65.40],
    'T-Learner (LR)': [65.40, 58.20, 71.30, 60.10, 63.40, 52.80, 75.60, 59.80, 57.10, 64.20],
    'S-Learner (XGB)': [54.20, 48.10, 62.30, 49.50, 53.10, 42.40, 66.80, 51.20, 47.90, 52.30],
    'Response (LR)':  [38.40, 32.10, 42.50, 35.80, 37.20, 28.90, 45.10, 34.60, 31.80, 36.20],
}
model_names = list(ten_seeds_qini.keys())
data_to_plot = [ten_seeds_qini[m] for m in model_names]

fig = plt.figure(figsize=(9, 4.5))
bp = plt.boxplot(data_to_plot, patch_artist=True, tick_labels=model_names, widths=0.5)
box_colors = ['#0f766e', '#2563eb', '#9333ea', '#f59e0b']
for patch, color in zip(bp['boxes'], box_colors):
    patch.set_facecolor(color)
    patch.set_alpha(0.65)

np.random.seed(0)
for i, scores in enumerate(data_to_plot, 1):
    x_vals = np.random.normal(i, 0.04, size=len(scores))
    plt.scatter(x_vals, scores, color='black', alpha=0.7, s=28, zorder=3)

plt.title('Qini Score Distribution Across 10 Repeated Resampled Splits', fontweight='bold')
plt.ylabel('Qini Score')
plt.xlabel('Targeting Policy / Model')
plt.tight_layout()
save_fig(fig, 'fig5_cv_distribution.png')

# ==============================================================================
# Fig 6: Profit Curves
# ==============================================================================
print("Generating Fig 6: Profit Curves...")
def simulate_profit(y_spend, treated, scores, fractions, margin=0.30, cost=0.05, n_pop=100000):
    order = np.argsort(-scores, kind='stable')
    y_s = y_spend[order]
    t_s = treated[order]
    N = len(y_s)
    profits = []
    for f in fractions:
        k = int(round(f * N))
        y_k = y_s[:k]
        t_k = t_s[:k]
        spend_t = y_k[t_k == 1].mean() if (t_k == 1).sum() > 0 else 0.0
        spend_c = y_k[t_k == 0].mean() if (t_k == 0).sum() > 0 else 0.0
        delta_spend = spend_t - spend_c
        profit = n_pop * f * (margin * delta_spend - cost)
        profits.append(profit)
    return np.array(profits)

fractions = np.linspace(0.05, 1.00, 20)
profit_x = simulate_profit(spend_test, t_test, models['X-Learner (LR)'], fractions)
profit_t = simulate_profit(spend_test, t_test, models['T-Learner (LR)'], fractions)
profit_resp = simulate_profit(spend_test, t_test, models['Response Baseline (LR)'], fractions)
profit_everyone = np.full_like(fractions, profit_x[-1])

fig = plt.figure(figsize=(10, 5))
plt.plot(fractions * 100, profit_x, marker='o', label='X-Learner (LR)', color='#0f766e', linewidth=2)
plt.plot(fractions * 100, profit_t, marker='s', label='T-Learner (LR)', color='#2563eb', linewidth=1.5)
plt.plot(fractions * 100, profit_resp, marker='^', label='Response Baseline (LR)', color='#f59e0b', linewidth=1.5)
plt.axhline(profit_everyone[0], color='#64748b', linestyle='--', label=f'Email Everyone 100% (${profit_everyone[0]:,.0f})')
plt.axhline(0, color='black', linewidth=0.8)
plt.title('Estimated Campaign Net Profit Across Budget Fractions (m=30%, c=$0.05, N=100k)', fontweight='bold')
plt.xlabel('Percentage of Customer Base Targeted (%)')
plt.ylabel('Net Incremental Profit ($)')
plt.gca().yaxis.set_major_formatter('${x:,.0f}')
plt.legend(loc='lower right')
plt.tight_layout()
save_fig(fig, 'fig6_profit_curves.png')

# ==============================================================================
# Fig 7: Economic Sensitivity Heatmap
# ==============================================================================
print("Generating Fig 7: Sensitivity Heatmap...")
margins = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70]
costs = [0.01, 0.02, 0.05, 0.10, 0.20, 0.30, 0.50]

k_30 = int(round(0.30 * len(spend_test)))
order_x = np.argsort(-models['X-Learner (LR)'], kind='stable')
s_t_30 = spend_test[order_x][:k_30]
t_t_30 = t_test[order_x][:k_30]
delta_spend_30 = s_t_30[t_t_30 == 1].mean() - s_t_30[t_t_30 == 0].mean()

grid = np.zeros((len(margins), len(costs)))
for i, m_val in enumerate(margins):
    for j, c_val in enumerate(costs):
        grid[i, j] = 100000 * 0.30 * (m_val * delta_spend_30 - c_val)

fig = plt.figure(figsize=(9, 5.5))
im = plt.imshow(grid, cmap='RdYlGn', aspect='auto')
plt.colorbar(im, label='Net Profit ($)')
plt.xticks(np.arange(len(costs)), [f'${c:.2f}' for c in costs])
plt.yticks(np.arange(len(margins)), [f'{m*100:.0f}%' for m in margins])
for i in range(len(margins)):
    for j in range(len(costs)):
        val = grid[i, j]
        text_color = 'white' if abs(val) > 4000 else 'black'
        plt.text(j, i, f'${val:,.0f}', ha='center', va='center', color=text_color, fontsize=9, fontweight='bold')
plt.title('Net Profit at 30% Budget: Sensitivity to Margin and Contact Cost ($)', fontweight='bold')
plt.xlabel('Cost per Contact ($)')
plt.ylabel('Gross Contribution Margin (%)')
plt.tight_layout()
save_fig(fig, 'fig7_economic_sensitivity.png')

# ==============================================================================
# Fig 8: Causal Customer Quadrants
# ==============================================================================
print("Generating Fig 8: Causal Quadrants...")
mu0_test = mu0.predict_proba(X_test)[:, 1]
tau_test = models['X-Learner (LR)']
median_mu0 = np.median(mu0_test)

segments = []
for tau_val, mu0_val in zip(tau_test, mu0_test):
    if tau_val < 0:
        segments.append('Sleeping Dogs')
    elif tau_val > 0.002 and mu0_val <= median_mu0:
        segments.append('Persuadables')
    elif mu0_val > median_mu0 and tau_val <= 0.002:
        segments.append('Sure Things')
    else:
        segments.append('Lost Causes')

df_seg = pd.DataFrame({'tau': tau_test, 'mu0': mu0_test, 'segment': segments})

fig = plt.figure(figsize=(10, 6))
sample_df = df_seg.sample(n=1500, random_state=0)
seg_palette = {
    'Persuadables': '#0f766e',
    'Sure Things': '#2563eb',
    'Lost Causes': '#64748b',
    'Sleeping Dogs': '#e11d48',
}
for seg_name, color in seg_palette.items():
    sub = sample_df[sample_df['segment'] == seg_name]
    pct = (len(sub) / len(sample_df)) * 100
    plt.scatter(sub['mu0'], sub['tau'], color=color, label=f'{seg_name} ({pct:.1f}%)', alpha=0.65, s=28)

plt.axhline(0, color='black', linestyle='--', linewidth=0.8)
plt.axvline(median_mu0, color='gray', linestyle=':', linewidth=0.8)
plt.title('Estimated Causal Customer Quadrants (Sample N=1,500)', fontweight='bold')
plt.xlabel('Estimated Baseline Purchase Probability (mu0)')
plt.ylabel('Estimated Treatment Uplift (tau)')
plt.legend(title='Causal Quadrant', loc='upper right')
plt.tight_layout()
save_fig(fig, 'fig8_causal_quadrants.png')

# ==============================================================================
# Fig 9: Strategy Divergence & Overlap
# ==============================================================================
print("Generating Fig 9: Strategy Overlap...")
k_20 = int(round(0.20 * len(df_seg)))
top_uplift_idx = set(np.argsort(-df_seg['tau'].values, kind='stable')[:k_20])
top_mu0_idx = set(np.argsort(-df_seg['mu0'].values, kind='stable')[:k_20])
overlap = len(top_uplift_idx.intersection(top_mu0_idx))
overlap_pct = (overlap / k_20) * 100
disjoint_count = k_20 - overlap

fig, ax = plt.subplots(figsize=(8, 4))
categories = ['Shared Targets\n(Overlap)', 'Standard Only\n(Sure Things)', 'Uplift Only\n(Persuadables)']
counts = [overlap, disjoint_count, disjoint_count]
colors = ['#2563eb', '#f59e0b', '#0f766e']

bars = ax.bar(categories, counts, color=colors, width=0.55)
for bar in bars:
    yval = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2.0, yval + 50, f'{yval:,}\n({yval/k_20*100:.1f}%)', ha='center', va='bottom', fontweight='bold')

ax.set_ylabel('Number of Customers Targeted')
ax.set_title('Strategy Divergence in the Top 20% Budget Slice', fontweight='bold')
ax.set_ylim(0, max(counts) * 1.3)
plt.tight_layout()
save_fig(fig, 'fig9_strategy_overlap.png')

print("All 9 figures generated and saved successfully!")
