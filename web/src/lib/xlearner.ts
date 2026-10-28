/**
 * Client-Side X-Learner (Logistic/Ridge) Preprocessing, Scoring, and Segmentation Engine
 *
 * Implements exact mathematical reproduction of the Python pipeline:
 * - Feature engineering (log1p history, recency banding, fixed category one-hot encoding)
 * - StandardScaler normalizations for numeric columns
 * - Stage 1 baseline propensity scoring (mu0, mu1) via logistic sigmoid
 * - Stage 2 counterfactual effect scoring (tau0, tau1) via Ridge dot products
 * - Propensity-weighted uplift: tau(x) = g * tau0(x) + (1 - g) * tau1(x)
 * - Deterministic tie-breaking matching Python's np.argsort(kind="stable")
 */

export interface RawCustomer {
  recency: number | string;
  history: number | string;
  mens: number | string;
  womens: number | string;
  zip_code: string;
  newbie: number | string;
  channel: string;
  history_segment?: string;
  [key: string]: unknown;
}

export interface SubModelScaler {
  features: string[];
  mean: number[];
  scale: number[];
}

export interface SubModelParams {
  type: "classifier" | "regressor";
  link: "logit" | "identity";
  intercept: number;
  coefficients: number[];
  scaler: SubModelScaler;
}

export interface XLearnerParams {
  model_name: string;
  seed: number;
  description: string;
  g: number;
  feature_names: string[];
  numeric_features: string[];
  models: {
    mu0: SubModelParams;
    mu1: SubModelParams;
    tau0: SubModelParams;
    tau1: SubModelParams;
  };
  metadata?: {
    n_train: number;
    n_train_treated: number;
    n_train_control: number;
    outcome: string;
    base_learner: string;
  };
}

export type CustomerSegment = "Persuadables" | "Sure Things" | "Lost Causes" | "Sleeping Dogs";

export interface ScoredCustomer {
  id: number;
  originalRowIndex: number;
  raw: RawCustomer;
  features: number[];
  uplift: number;
  mu0Prob: number;
  mu1Prob: number;
  segment: CustomerSegment;
  rank: number;
}

export interface ValidationIssue {
  row: number;
  column: string;
  value: unknown;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: RawCustomer[];
  issues: ValidationIssue[];
  missingColumns: string[];
}

export const REQUIRED_RAW_COLUMNS = [
  "recency",
  "history",
  "mens",
  "womens",
  "zip_code",
  "newbie",
  "channel",
] as const;

export const ZIP_CODE_CATEGORIES = ["Rural", "Surburban", "Urban"] as const;
export const CHANNEL_CATEGORIES = ["Multichannel", "Phone", "Web"] as const;
export const RECENCY_BAND_CATEGORIES = ["1-3", "4-6", "7-9", "10-12"] as const;

/**
 * Validate customer row and check for unexpected/invalid values.
 */
export function validateCustomerRow(row: Record<string, unknown>, rowIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // recency: integer in [1, 12]
  const recencyVal = Number(row.recency);
  if (isNaN(recencyVal) || !Number.isInteger(recencyVal) || recencyVal < 1 || recencyVal > 12) {
    issues.push({
      row: rowIndex,
      column: "recency",
      value: row.recency,
      reason: "Must be an integer between 1 and 12 (months since last purchase)",
    });
  }

  // history: non-negative float
  const historyVal = Number(row.history);
  if (isNaN(historyVal) || historyVal < 0) {
    issues.push({
      row: rowIndex,
      column: "history",
      value: row.history,
      reason: "Must be a non-negative number (past dollar spend)",
    });
  }

  // mens: 0 or 1
  const mensVal = Number(row.mens);
  if (mensVal !== 0 && mensVal !== 1) {
    issues.push({
      row: rowIndex,
      column: "mens",
      value: row.mens,
      reason: "Must be 0 or 1",
    });
  }

  // womens: 0 or 1
  const womensVal = Number(row.womens);
  if (womensVal !== 0 && womensVal !== 1) {
    issues.push({
      row: rowIndex,
      column: "womens",
      value: row.womens,
      reason: "Must be 0 or 1",
    });
  }

  // newbie: 0 or 1
  const newbieVal = Number(row.newbie);
  if (newbieVal !== 0 && newbieVal !== 1) {
    issues.push({
      row: rowIndex,
      column: "newbie",
      value: row.newbie,
      reason: "Must be 0 or 1",
    });
  }

  // zip_code: Rural, Surburban, Urban (preserving dataset typo "Surburban")
  const rawZip = String(row.zip_code ?? "").trim();
  const normalizedZip = rawZip.toLowerCase() === "suburban" ? "Surburban" : rawZip;
  if (!ZIP_CODE_CATEGORIES.includes(normalizedZip as (typeof ZIP_CODE_CATEGORIES)[number])) {
    issues.push({
      row: rowIndex,
      column: "zip_code",
      value: row.zip_code,
      reason: `Must be one of: ${ZIP_CODE_CATEGORIES.join(", ")} (found '${rawZip}')`,
    });
  }

  // channel: Multichannel, Phone, Web
  const rawChannel = String(row.channel ?? "").trim();
  const matchedChannel = CHANNEL_CATEGORIES.find((c) => c.toLowerCase() === rawChannel.toLowerCase());
  if (!matchedChannel) {
    issues.push({
      row: rowIndex,
      column: "channel",
      value: row.channel,
      reason: `Must be one of: ${CHANNEL_CATEGORIES.join(", ")} (found '${rawChannel}')`,
    });
  }

  return issues;
}

/**
 * Validate an array of parsed customer records.
 */
export function validateCustomerList(rows: Record<string, unknown>[]): ValidationResult {
  if (!rows || rows.length === 0) {
    return {
      valid: false,
      totalRows: 0,
      validRows: [],
      issues: [{ row: 0, column: "file", value: null, reason: "The uploaded file is empty." }],
      missingColumns: [],
    };
  }

  // Check required headers
  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map((k) => k.trim());
  const missingColumns = REQUIRED_RAW_COLUMNS.filter((col) => !keys.includes(col));

  if (missingColumns.length > 0) {
    return {
      valid: false,
      totalRows: rows.length,
      validRows: [],
      issues: [
        {
          row: 0,
          column: "headers",
          value: keys.join(", "),
          reason: `Missing required column(s): ${missingColumns.join(", ")}`,
        },
      ],
      missingColumns,
    };
  }

  const allIssues: ValidationIssue[] = [];
  const validRows: RawCustomer[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIssues = validateCustomerRow(rows[i], i + 1);
    if (rowIssues.length > 0) {
      allIssues.push(...rowIssues);
    } else {
      validRows.push(rows[i] as unknown as RawCustomer);
    }
  }

  return {
    valid: allIssues.length === 0,
    totalRows: rows.length,
    validRows,
    issues: allIssues,
    missingColumns: [],
  };
}

/**
 * Preprocess a validated raw customer record into the exact 15-feature numeric vector.
 *
 * Feature column order matches Python's build_features():
 *  0: recency
 *  1: log_history (log1p(history))
 *  2: mens
 *  3: womens
 *  4: newbie
 *  5: zip_code_Rural
 *  6: zip_code_Surburban
 *  7: zip_code_Urban
 *  8: channel_Multichannel
 *  9: channel_Phone
 * 10: channel_Web
 * 11: recency_band_1-3
 * 12: recency_band_4-6
 * 13: recency_band_7-9
 * 14: recency_band_10-12
 */
export function preprocessCustomer(raw: RawCustomer): number[] {
  const recency = Number(raw.recency);
  const history = Number(raw.history);
  const logHistory = Math.log1p(history);
  const mens = Number(raw.mens) === 1 ? 1 : 0;
  const womens = Number(raw.womens) === 1 ? 1 : 0;
  const newbie = Number(raw.newbie) === 1 ? 1 : 0;

  // Normalize zip_code (accepting standard Suburban as dataset's Surburban)
  const rawZip = String(raw.zip_code ?? "").trim();
  const zip = rawZip.toLowerCase() === "suburban" ? "Surburban" : rawZip;

  // Normalize channel
  const rawChannel = String(raw.channel ?? "").trim();
  const channel = CHANNEL_CATEGORIES.find((c) => c.toLowerCase() === rawChannel.toLowerCase()) || rawChannel;

  // recency_band (pd.cut bins=[0, 3, 6, 9, 12], right=True)
  let band = "10-12";
  if (recency <= 3) band = "1-3";
  else if (recency <= 6) band = "4-6";
  else if (recency <= 9) band = "7-9";

  return [
    recency,
    logHistory,
    mens,
    womens,
    newbie,
    zip === "Rural" ? 1 : 0,
    zip === "Surburban" ? 1 : 0,
    zip === "Urban" ? 1 : 0,
    channel === "Multichannel" ? 1 : 0,
    channel === "Phone" ? 1 : 0,
    channel === "Web" ? 1 : 0,
    band === "1-3" ? 1 : 0,
    band === "4-6" ? 1 : 0,
    band === "7-9" ? 1 : 0,
    band === "10-12" ? 1 : 0,
  ];
}

/**
 * Predict dot product with StandardScaler for a submodel pipeline.
 */
export function predictSubModel(model: SubModelParams, features: number[]): number {
  // Continuous feature standardization (recency and log_history)
  const x0Scaled = (features[0] - model.scaler.mean[0]) / model.scaler.scale[0];
  const x1Scaled = (features[1] - model.scaler.mean[1]) / model.scaler.scale[1];

  let dot = model.intercept;
  dot += model.coefficients[0] * x0Scaled;
  dot += model.coefficients[1] * x1Scaled;

  for (let i = 2; i < 15; i++) {
    dot += model.coefficients[i] * features[i];
  }

  if (model.link === "logit") {
    // Numerically stable sigmoid function
    if (dot >= 0) {
      return 1 / (1 + Math.exp(-dot));
    } else {
      const ez = Math.exp(dot);
      return ez / (1 + ez);
    }
  }

  // Identity / linear link for Ridge regression
  return dot;
}

/**
 * Score a single customer with the full X-Learner model.
 */
export function scoreSingleCustomer(
  params: XLearnerParams,
  features: number[]
): { uplift: number; mu0Prob: number; mu1Prob: number } {
  const mu0Prob = predictSubModel(params.models.mu0, features);
  const mu1Prob = predictSubModel(params.models.mu1, features);
  const tau0 = predictSubModel(params.models.tau0, features);
  const tau1 = predictSubModel(params.models.tau1, features);

  const uplift = params.g * tau0 + (1.0 - params.g) * tau1;
  return { uplift, mu0Prob, mu1Prob };
}

/**
 * Segment assignment definition:
 * - Sleeping Dogs: uplift < 0 (intervention reduces visit probability)
 * - Persuadables: uplift >= median_uplift (or uplift threshold, default 0.05)
 * - Sure Things: uplift < threshold AND baseline mu0_prob >= baseline threshold (default 0.12)
 * - Lost Causes: uplift < threshold AND baseline mu0_prob < baseline threshold (default 0.12)
 *
 * NOTE: These are statistical model estimates, not directly observed individual counterfactuals.
 */
export function classifySegment(
  uplift: number,
  mu0Prob: number,
  upliftThreshold = 0.05,
  baselineThreshold = 0.12
): CustomerSegment {
  if (uplift < 0) {
    return "Sleeping Dogs";
  }
  if (uplift >= upliftThreshold) {
    return "Persuadables";
  }
  if (mu0Prob >= baselineThreshold) {
    return "Sure Things";
  }
  return "Lost Causes";
}

/**
 * Score and rank a list of validated customers.
 * Uses deterministic stable sorting (ties broken by original row index).
 */
export function scoreAndRankCustomers(
  customers: RawCustomer[],
  params: XLearnerParams,
  upliftThreshold = 0.05,
  baselineThreshold = 0.12
): ScoredCustomer[] {
  const scoredList: ScoredCustomer[] = customers.map((raw, idx) => {
    const features = preprocessCustomer(raw);
    const { uplift, mu0Prob, mu1Prob } = scoreSingleCustomer(params, features);
    const segment = classifySegment(uplift, mu0Prob, upliftThreshold, baselineThreshold);

    return {
      id: idx + 1,
      originalRowIndex: idx,
      raw,
      features,
      uplift,
      mu0Prob,
      mu1Prob,
      segment,
      rank: 0, // assigned after stable sort
    };
  });

  // Deterministic stable sort: higher uplift first; if equal, originalRowIndex ascending
  scoredList.sort((a, b) => {
    if (Math.abs(b.uplift - a.uplift) > 1e-12) {
      return b.uplift - a.uplift;
    }
    return a.originalRowIndex - b.originalRowIndex;
  });

  // Assign 1-based ranks
  for (let i = 0; i < scoredList.length; i++) {
    scoredList[i].rank = i + 1;
  }

  return scoredList;
}
