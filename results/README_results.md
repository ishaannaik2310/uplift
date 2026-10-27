# Benchmark Results & Tie-Breaking Documentation

## Score Ranking & Tie-Breaking Protocol
In uplift evaluation metrics and profit simulation, customers are sorted descending by model score to select targeted subsets $S$ of size $k = \text{round}(f \times N)$.

When models output tied scores across individuals (common in tree ensembles and low-cardinality linear predictors):
- **Tie-Breaking Convention**: Tied scores are broken **stably by original row order** using `numpy.argsort(-scores, kind="stable")`.
- **Reproducibility**: Because spend is highly sparse (~0.9% of customers spend anything, but those who do spend between $29.99 and $499.00), unstable tie-breaking algorithms (e.g. quicksort) can shift boundary customers across the cutoff threshold, causing split profit estimates to vary by up to ~$24 per 100,000 customers. Stable sorting guarantees exact, deterministic reproducibility across evaluation scripts and web export pipelines.

## Profit at Pre-Specified Budgets (Margin = 30%, Cost = $0.05/email, Pop = 100k)
| Budget | Policy | 10-Split Mean Profit ($) | Split Variation (std) ($) |
| :--- | :--- | :--- | :--- |
| **30%** | random | $2,522.17 | $3,018.71 |
| **30%** | response_model | $4,460.49 | $2,508.34 |
| **30%** | s_learner_xgb | $4,391.62 | $3,341.96 |
| **30%** | t_learner_lr | $5,935.63 | $2,826.80 |
| **30%** | x_learner_lr | $5,691.39 | $2,777.29 |
| **50%** | random | $6,396.23 | $3,429.47 |
| **50%** | response_model | $4,527.51 | $1,957.12 |
| **50%** | s_learner_xgb | $8,068.49 | $3,209.47 |
| **50%** | t_learner_lr | $8,037.80 | $3,175.61 |
| **50%** | x_learner_lr | $7,974.58 | $3,494.47 |
| **100%** | target_everyone | $11,520.66 | $3,692.17 |
