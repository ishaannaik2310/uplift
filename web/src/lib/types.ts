/**
 * TypeScript Data Contracts for Uplift Marketing Dashboard
 * Directly inferred from web/public/data/ results.json, profit_grid.json, and customers.json
 */

export interface DatasetMeta {
  dataset: string;
  n_rows: number;
  n_treated: number;
  n_control: number;
  visit_rate_treated: number;
  visit_rate_control: number;
  ate_visit: number;
  spend_rate_treated: number;
  spend_rate_control: number;
  ate_spend: number;
  spend_total_mens: number;
  spend_total_womens: number;
  spend_total_control: number;
  n_spenders: number;
  spender_rate: number;
  delta_spend_everyone_test_splits_mean: number;
  delta_spend_everyone_test_splits_std: number;
  seeds: number[];
  mode: string;
  outcome: string;
  n_train: number;
  n_test: number;
  default_margin: number;
  default_cost: number;
  assumptions_note: string;
  xgb_params: {
    learning_rate: number;
    max_depth: number;
    min_child_weight: number;
  };
  library_versions: {
    python: string;
    numpy: string;
    pandas: string;
    "scikit-learn": string;
    xgboost: string;
    "scikit-uplift": string;
  };
}

export interface ModelMetricEntry {
  model: string;
  base_learner: string;
  model_id: string;
  qini_raw_mean: number;
  qini_raw_std: number;
  qini_per_N_mean: number;
  qini_per_N_std: number;
  qini_normalized_mean: number;
  qini_normalized_std: number;
  auuc_norm_mean: number;
  auuc_norm_std: number;
  auuc_perf_mean: number;
  auuc_perf_std: number;
  uplift_top30_mean: number;
  uplift_top30_std: number;
}

export interface PairedTestEntry {
  comparison_group: string;
  model_a: string;
  model_b: string;
  mean_diff: number;
  std_diff: number;
  t_stat: number;
  p_value_raw: number;
  p_value_holm: number;
  significance: "significant at 0.05 after Holm adjustment" | "not significant";
}

export interface QiniCurveData {
  fraction: number[];
  mean: number[];
  std: number[];
}

export interface DecileRecord {
  decile: number;
  n_treated: number;
  n_control: number;
  rate_t: number;
  rate_c: number;
  uplift: number;
}

export interface ResultsData {
  meta: DatasetMeta;
  units: Record<string, string>;
  models: ModelMetricEntry[];
  paired_tests: PairedTestEntry[];
  qini_curves: Record<string, QiniCurveData>;
  deciles_seed0: Record<string, DecileRecord[]>;
}

export interface BreakevenData {
  breakeven_note: string;
  fractions: number[];
  policies: Record<string, { mean: number[]; std: number[] }>;
}

export interface ProfitGridData {
  n_pop: number;
  fractions: number[];
  profit_formula: string;
  default_margin: number;
  default_cost: number;
  assumptions_note: string;
  everyone: {
    delta_spend_mean: number;
    delta_spend_std: number;
  };
  policies: Record<string, {
    delta_spend_mean: number[];
    delta_spend_std: number[];
  }>;
  breakeven: BreakevenData;
}

export interface CustomersData {
  columns: string[];
  rows: (number | string)[][];
}

export type PolicyId =
  | "random"
  | "response_lr"
  | "t_learner_lr"
  | "x_learner_lr"
  | "s_learner_xgb";

export interface CustomerRow {
  id: number;
  recency: number;
  history: number;
  mens: number;
  womens: number;
  zip_code: string;
  newbie: number;
  channel: string;
  treated: number;
  visit: number;
  spend: number;
  score_random: number;
  score_response_lr: number;
  score_t_learner_lr: number;
  score_x_learner_lr: number;
  score_s_learner_xgb: number;
}
