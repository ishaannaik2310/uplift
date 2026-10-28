/**
 * Runtime Verification Script for Uplift Dashboard & Client-Side Planner
 *
 * Part 1: Campaign profit reconstruction at margin 0.30, cost $0.05 from profit_grid.json
 *         validated against results/profit_curves.csv within $0.01 tolerance.
 *
 * Part 2: Client-side X-Learner scoring verification
 *         Scores 500 held-out test customers in sample_customers.csv using TypeScript engine
 *         and validates against sample_scores_python.json within 1e-6 tolerance.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(webDir, "..");

// -----------------------------------------------------------------------------
// PART 1: Profit Reconstruction Verification
// -----------------------------------------------------------------------------
const profitGridPath = path.resolve(webDir, "public", "data", "profit_grid.json");
const profitCurvesPath = path.resolve(projectRoot, "results", "profit_curves.csv");

if (!fs.existsSync(profitGridPath)) {
  console.error(`ERROR: Missing profit_grid.json at ${profitGridPath}`);
  process.exit(1);
}

if (!fs.existsSync(profitCurvesPath)) {
  console.error(`ERROR: Missing profit_curves.csv at ${profitCurvesPath}`);
  process.exit(1);
}

const profitGrid = JSON.parse(fs.readFileSync(profitGridPath, "utf-8"));
const curvesCsvContent = fs.readFileSync(profitCurvesPath, "utf-8");

// Simple CSV parser for profit_curves.csv
const lines = curvesCsvContent.trim().split("\n");
const headers = lines[0].split(",").map((h) => h.trim());
const polIdx = headers.indexOf("policy");
const fracIdx = headers.indexOf("fraction");
const meanProfIdx = headers.indexOf("mean_profit");

const expectedProfits = {};
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(",").map((p) => p.trim());
  if (parts.length >= headers.length) {
    const pol = parts[polIdx];
    const frac = parseFloat(parts[fracIdx]).toFixed(2);
    const prof = parseFloat(parts[meanProfIdx]);
    expectedProfits[`${pol}_${frac}`] = prof;
  }
}

const margin = 0.3;
const cost = 0.05;
const nPop = profitGrid.n_pop || 100000;

const checks = [
  // Full campaign
  { policyKey: "everyone", curvePolicy: "target_everyone", fraction: 1.0 },
  // 30% Budget
  { policyKey: "random", curvePolicy: "random", fraction: 0.3 },
  { policyKey: "response_lr", curvePolicy: "response_model", fraction: 0.3 },
  { policyKey: "s_learner_xgb", curvePolicy: "s_learner_xgb", fraction: 0.3 },
  { policyKey: "t_learner_lr", curvePolicy: "t_learner_lr", fraction: 0.3 },
  { policyKey: "x_learner_lr", curvePolicy: "x_learner_lr", fraction: 0.3 },
  // 50% Budget
  { policyKey: "random", curvePolicy: "random", fraction: 0.5 },
  { policyKey: "response_lr", curvePolicy: "response_model", fraction: 0.5 },
  { policyKey: "s_learner_xgb", curvePolicy: "s_learner_xgb", fraction: 0.5 },
  { policyKey: "t_learner_lr", curvePolicy: "t_learner_lr", fraction: 0.5 },
  { policyKey: "x_learner_lr", curvePolicy: "x_learner_lr", fraction: 0.5 },
];

console.log("=".repeat(90));
console.log("CHECK 1: RUNTIME PROFIT VERIFICATION (profit_grid.json vs results/profit_curves.csv)");
console.log("Formula: profit(f) = n_pop * f * (margin * delta_spend(f) - cost)");
console.log(`Parameters: margin = ${margin}, cost = $${cost}, n_pop = ${nPop.toLocaleString()}`);
console.log("=".repeat(90));
console.log(
  `${"Policy".padEnd(18)} ${"Budget".padEnd(8)} ${"Reconstructed".padStart(16)} ${"Expected (CSV)".padStart(16)} ${"Diff".padStart(12)}  Status`
);
console.log("-".repeat(90));

let failedCount = 0;

for (const check of checks) {
  const f = check.fraction;
  const fStr = f.toFixed(2);
  let deltaSpend = 0;

  if (check.policyKey === "everyone") {
    deltaSpend = profitGrid.everyone.delta_spend_mean;
  } else {
    const fIdx = profitGrid.fractions.findIndex((val) => Math.abs(val - f) < 1e-4);
    if (fIdx === -1) {
      console.error(`ERROR: Fraction ${f} not found in profit_grid.fractions`);
      failedCount++;
      continue;
    }
    deltaSpend = profitGrid.policies[check.policyKey].delta_spend_mean[fIdx];
  }

  const reconstructedProfit = nPop * f * (margin * deltaSpend - cost);
  const expectedKey = `${check.curvePolicy}_${fStr}`;
  const expectedProfit = expectedProfits[expectedKey];

  if (expectedProfit === undefined) {
    console.error(`ERROR: Expected profit not found for key ${expectedKey} in profit_curves.csv`);
    failedCount++;
    continue;
  }

  const diff = Math.abs(reconstructedProfit - expectedProfit);
  const passed = diff < 0.01;
  if (!passed) failedCount++;

  const bStr = `${Math.round(f * 100)}%`;
  const statusStr = passed ? "PASS" : "FAIL (>= $0.01)";

  console.log(
    `${check.policyKey.padEnd(18)} ${bStr.padEnd(8)} $${reconstructedProfit.toFixed(2).padStart(15)} $${expectedProfit.toFixed(2).padStart(15)} $${diff.toFixed(4).padStart(11)}  ${statusStr}`
  );
}

// -----------------------------------------------------------------------------
// PART 2: Client-Side TypeScript X-Learner Scoring Verification
// -----------------------------------------------------------------------------
console.log("\n" + "=".repeat(90));
console.log("CHECK 2: CLIENT-SIDE X-LEARNER SCORING VERIFICATION (TypeScript vs Python)");
console.log("Testing 500 held-out test customers in sample_customers.csv against sample_scores_python.json");
console.log("Tolerance: 1e-6 (1 micro-unit)");
console.log("=".repeat(90));

const xlearnerParamsPath = path.resolve(webDir, "public", "data", "xlearner_params.json");
const sampleCustomersPath = path.resolve(webDir, "public", "data", "sample_customers.csv");
const sampleScoresPath = path.resolve(webDir, "public", "data", "sample_scores_python.json");

if (!fs.existsSync(xlearnerParamsPath)) {
  console.error(`ERROR: Missing xlearner_params.json at ${xlearnerParamsPath}`);
  process.exit(1);
}
if (!fs.existsSync(sampleCustomersPath)) {
  console.error(`ERROR: Missing sample_customers.csv at ${sampleCustomersPath}`);
  process.exit(1);
}
if (!fs.existsSync(sampleScoresPath)) {
  console.error(`ERROR: Missing sample_scores_python.json at ${sampleScoresPath}`);
  process.exit(1);
}

const xlearnerModulePath = path.resolve(webDir, "src", "lib", "xlearner.ts");
const xlearnerModuleUrl = pathToFileURL(xlearnerModulePath).href;
const { preprocessCustomer, scoreSingleCustomer, scoreAndRankCustomers } = await import(xlearnerModuleUrl);

const xlearnerParams = JSON.parse(fs.readFileSync(xlearnerParamsPath, "utf-8"));
const sampleScores = JSON.parse(fs.readFileSync(sampleScoresPath, "utf-8"));
const sampleCsv = fs.readFileSync(sampleCustomersPath, "utf-8");

const csvLines = sampleCsv.trim().split("\n");
const csvHeaders = csvLines[0].split(",").map((h) => h.trim());

const rawCustomers = [];
for (let i = 1; i < csvLines.length; i++) {
  const vals = csvLines[i].split(",").map((v) => v.trim());
  const row = {};
  csvHeaders.forEach((h, idx) => (row[h] = vals[idx]));
  rawCustomers.push(row);
}

let maxUpliftDiff = 0;
let maxMu0Diff = 0;
let maxMu1Diff = 0;

for (let i = 0; i < rawCustomers.length; i++) {
  const raw = rawCustomers[i];
  const features = preprocessCustomer(raw);
  const { uplift, mu0Prob, mu1Prob } = scoreSingleCustomer(xlearnerParams, features);

  const expUplift = sampleScores.uplift[i];
  const expMu0 = sampleScores.mu0_prob[i];
  const expMu1 = sampleScores.mu1_prob[i];

  const diffUplift = Math.abs(uplift - expUplift);
  const diffMu0 = Math.abs(mu0Prob - expMu0);
  const diffMu1 = Math.abs(mu1Prob - expMu1);

  if (diffUplift > maxUpliftDiff) maxUpliftDiff = diffUplift;
  if (diffMu0 > maxMu0Diff) maxMu0Diff = diffMu0;
  if (diffMu1 > maxMu1Diff) maxMu1Diff = diffMu1;
}

const scoredCustomers = scoreAndRankCustomers(rawCustomers, xlearnerParams);

const upliftTolerance = 1e-6;
const passedUplift = maxUpliftDiff < upliftTolerance;
const passedMu0 = maxMu0Diff < upliftTolerance;
const passedMu1 = maxMu1Diff < upliftTolerance;
const passedRanking = scoredCustomers.length === rawCustomers.length && scoredCustomers[0].rank === 1;

console.log(
  `Uplift (tau):      Max Diff = ${maxUpliftDiff.toExponential(4)} (Tol: 1e-6)  --> ${passedUplift ? "PASS" : "FAIL"}`
);
console.log(
  `Baseline prob mu0: Max Diff = ${maxMu0Diff.toExponential(4)} (Tol: 1e-6)  --> ${passedMu0 ? "PASS" : "FAIL"}`
);
console.log(
  `Treated prob mu1:  Max Diff = ${maxMu1Diff.toExponential(4)} (Tol: 1e-6)  --> ${passedMu1 ? "PASS" : "FAIL"}`
);
console.log(
  `Stable Ranking:    ${scoredCustomers.length} rows ranked deterministically       --> ${passedRanking ? "PASS" : "FAIL"}`
);

if (!passedUplift || !passedMu0 || !passedMu1 || !passedRanking) {
  failedCount++;
}

console.log("=".repeat(90));
if (failedCount === 0) {
  console.log("ALL VERIFICATION CHECKS PASSED (Profit Reconstructions + Client X-Learner Scoring).");
  process.exit(0);
} else {
  console.error(`VERIFICATION FAILED: ${failedCount} check suite(s) failed.`);
  process.exit(1);
}
