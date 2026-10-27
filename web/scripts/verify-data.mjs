/**
 * Runtime Verification Script for Uplift Dashboard Data
 * Reconstructs campaign profit at margin 0.30, cost $0.05 from profit_grid.json
 * and validates against results/profit_curves.csv within $0.01.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(webDir, "..");

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
const headers = lines[0].split(",").map(h => h.trim());
const polIdx = headers.indexOf("policy");
const fracIdx = headers.indexOf("fraction");
const meanProfIdx = headers.indexOf("mean_profit");

const expectedProfits = {};
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(",").map(p => p.trim());
  if (parts.length >= headers.length) {
    const pol = parts[polIdx];
    const frac = parseFloat(parts[fracIdx]).toFixed(2);
    const prof = parseFloat(parts[meanProfIdx]);
    expectedProfits[`${pol}_${frac}`] = prof;
  }
}

const margin = 0.30;
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
console.log("RUNTIME VERIFICATION: profit_grid.json vs results/profit_curves.csv");
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
    const fIdx = profitGrid.fractions.findIndex(val => Math.abs(val - f) < 1e-4);
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

console.log("=".repeat(90));
if (failedCount === 0) {
  console.log("ALL VERIFICATION CHECKS PASSED within $0.01 tolerance.");
  process.exit(0);
} else {
  console.error(`VERIFICATION FAILED: ${failedCount} checks failed.`);
  process.exit(1);
}
