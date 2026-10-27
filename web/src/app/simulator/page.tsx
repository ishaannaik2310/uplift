"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Sliders,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Percent,
  Layers,
} from "lucide-react";
import { CustomersData, PolicyId, ProfitGridData } from "@/lib/types";
import { fetchCustomersData, fetchProfitGridData } from "@/lib/data";
import { formatCurrency } from "@/lib/formatters";
import ProfitChart from "@/components/ProfitChart";
import CustomerTable from "@/components/CustomerTable";

const POLICY_OPTIONS: { id: PolicyId; label: string; tag: string }[] = [
  { id: "t_learner_lr", label: "T-Learner (LR)", tag: "Recommended Uplift" },
  { id: "x_learner_lr", label: "X-Learner (LR)", tag: "Uplift Meta-Learner" },
  { id: "s_learner_xgb", label: "S-Learner (XGB)", tag: "Tree-Based Uplift" },
  { id: "response_lr", label: "Response Model", tag: "Naive Propensity" },
  { id: "random", label: "Random", tag: "Random Targeting" },
];

export default function SimulatorPage() {
  const [profitGrid, setProfitGrid] = useState<ProfitGridData | null>(null);
  const [customersData, setCustomersData] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulator Interactive State
  const [margin, setMargin] = useState<number>(0.30);
  const [cost, setCost] = useState<number>(0.05);
  const [budgetFraction, setBudgetFraction] = useState<number>(0.30);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyId>("t_learner_lr");

  useEffect(() => {
    async function loadData() {
      try {
        const [grid, cust] = await Promise.all([
          fetchProfitGridData(),
          fetchCustomersData(),
        ]);
        setProfitGrid(grid);
        setCustomersData(cust);
        if (grid.default_margin) setMargin(grid.default_margin);
        if (grid.default_cost) setCost(grid.default_cost);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load simulation data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute profit and variation at current settings
  const calculations = useMemo(() => {
    if (!profitGrid) return null;

    const { n_pop, fractions, policies, everyone, breakeven } = profitGrid;
    const f = budgetFraction;

    // Find nearest fraction index
    const fIdx = fractions.findIndex((val) => Math.abs(val - f) < 1e-4);
    const validIdx = fIdx !== -1 ? fIdx : 5; // default to 0.30 (idx 5)

    // 1. Selected Policy at budget f
    const polData = policies[selectedPolicy];
    const polDelta = polData.delta_spend_mean[validIdx];
    const polStd = polData.delta_spend_std[validIdx];
    const polProfit = n_pop * f * (margin * polDelta - cost);
    const polVariation = n_pop * f * margin * polStd;

    // 2. Target Everyone (f=1.0)
    const everyoneDelta = everyone.delta_spend_mean;
    const everyoneStd = everyone.delta_spend_std;
    const everyoneProfit = n_pop * 1.0 * (margin * everyoneDelta - cost);
    const everyoneVariation = n_pop * 1.0 * margin * everyoneStd;

    // 3. Random Targeting at budget f
    const randomDelta = policies.random.delta_spend_mean[validIdx];
    const randomStd = policies.random.delta_spend_std[validIdx];
    const randomProfit = n_pop * f * (margin * randomDelta - cost);
    const randomVariation = n_pop * f * margin * randomStd;

    // 4. Break-even analysis for selected policy
    // Positive ROI break-even cost: margin * polDelta
    const roiBreakevenCost = margin * polDelta;

    // Selective break-even cost (beats emailing everyone): margin * breakeven_mean
    const beMean = breakeven?.policies?.[selectedPolicy]?.mean?.[validIdx] ?? null;
    const selectiveBreakevenCost = beMean !== null ? margin * beMean : null;

    // 5. Compare candidate policies at fraction f
    const policyProfitsAtBudget = Object.entries(policies).map(([polId, pData]) => {
      const pDelta = pData.delta_spend_mean[validIdx];
      const pStd = pData.delta_spend_std[validIdx];
      const pProf = n_pop * f * (margin * pDelta - cost);
      const pVar = n_pop * f * margin * pStd;
      return {
        id: polId as PolicyId,
        label: POLICY_OPTIONS.find((p) => p.id === polId)?.label || polId,
        profit: pProf,
        variation: pVar,
      };
    });

    // Best policy at current budget
    policyProfitsAtBudget.sort((a, b) => b.profit - a.profit);
    const bestSelective = policyProfitsAtBudget[0];

    // Candidate options for recommendation:
    // { No Campaign ($0), Target Everyone ($everyoneProfit), Best Selective ($bestSelective.profit) }
    const candidates = [
      { name: "No Campaign", profit: 0, variation: 0, type: "none" },
      { name: "Target Everyone (100%)", profit: everyoneProfit, variation: everyoneVariation, type: "everyone" },
      { name: `${bestSelective.label} (${Math.round(f * 100)}% budget)`, profit: bestSelective.profit, variation: bestSelective.variation, type: "selective" },
    ];
    candidates.sort((a, b) => b.profit - a.profit);

    const winner = candidates[0];
    const runnerUp = candidates[1];
    const gap = Math.abs(winner.profit - runnerUp.profit);
    const largerVariation = Math.max(winner.variation, runnerUp.variation);
    const isWithinVariation = gap < largerVariation;

    return {
      n_pop,
      polProfit,
      polVariation,
      everyoneProfit,
      everyoneVariation,
      randomProfit,
      randomVariation,
      roiBreakevenCost,
      selectiveBreakevenCost,
      diffVsEveryone: polProfit - everyoneProfit,
      diffVsRandom: polProfit - randomProfit,
      winner,
      runnerUp,
      gap,
      largerVariation,
      isWithinVariation,
      allProfitsNegative: candidates.every((c) => c.profit <= 0),
    };
  }, [profitGrid, margin, cost, budgetFraction, selectedPolicy]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500">Loading campaign simulator data...</p>
      </div>
    );
  }

  if (error || !profitGrid || !customersData || !calculations) {
    return (
      <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300">
        <h2 className="font-bold text-base">Error Loading Simulator</h2>
        <p className="text-sm mt-1">{error || "Simulation dataset not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Targeting & Profit Simulator
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-3xl">
          Simulate campaign profitability across different unit economics, contact costs, and budget fractions
          evaluated on out-of-sample RCT customer response data.
        </p>
      </div>

      {/* Simulator Control Panel */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Simulation Parameters
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Scaled to {calculations.n_pop.toLocaleString()} customers
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Margin Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-indigo-500" />
                Contribution Margin
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                {(margin * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.60"
              step="0.01"
              value={margin}
              onChange={(e) => setMargin(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>5% (Low)</span>
              <span>30% (Default)</span>
              <span>60% (High)</span>
            </div>
          </div>

          {/* Cost Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                Cost per Email
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                ${cost.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.00"
              max="0.60"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>$0.00 (Zero)</span>
              <span>$0.05 (Default)</span>
              <span>$0.60 (High)</span>
            </div>
          </div>

          {/* Budget Fraction Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Targeting Budget (Top %)
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                {Math.round(budgetFraction * 100)}% ({(budgetFraction * calculations.n_pop).toLocaleString()} users)
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.00"
              step="0.05"
              value={budgetFraction}
              onChange={(e) => setBudgetFraction(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>5% (Niche)</span>
              <span>30% (Selective)</span>
              <span>100% (All)</span>
            </div>
          </div>
        </div>

        {/* Policy Selector Pills */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Targeting Model / Policy:
          </label>
          <div className="flex flex-wrap gap-2">
            {POLICY_OPTIONS.map((pol) => {
              const active = selectedPolicy === pol.id;
              return (
                <button
                  key={pol.id}
                  onClick={() => setSelectedPolicy(pol.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span>{pol.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                      active ? "bg-indigo-700 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {pol.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Recommendation Banner */}
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          calculations.allProfitsNegative
            ? "border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
            : calculations.winner.type === "everyone"
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
            : "border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold">
              Recommendation Engine Output
            </h3>
          </div>
          <p className="text-xs leading-relaxed">
            {calculations.allProfitsNegative ? (
              <span>
                <strong>No Campaign:</strong> At a contact cost of ${cost.toFixed(2)} and margin of{" "}
                {(margin * 100).toFixed(0)}%, all targeting policies yield negative expected profit. Avoid sending emails.
              </span>
            ) : calculations.isWithinVariation ? (
              <span>
                At higher contact costs, selective targeting can earn more profit in-sample, but the differences
                are within split-to-split variation. The difference between <strong>{calculations.winner.name}</strong> (
                {formatCurrency(calculations.winner.profit, 0)}) and <strong>{calculations.runnerUp.name}</strong> (
                {formatCurrency(calculations.runnerUp.profit, 0)}) is {formatCurrency(calculations.gap, 0)}, which is within
                the split-to-split variation (&plusmn;{formatCurrency(calculations.largerVariation, 0)}). Either policy is reasonable.
              </span>
            ) : (
              <span>
                <strong>{calculations.winner.name}</strong> yields the highest expected profit at{" "}
                <strong>{formatCurrency(calculations.winner.profit, 0)}</strong>, outperforming {calculations.runnerUp.name} by{" "}
                {formatCurrency(calculations.gap, 0)} beyond split-to-split variation.
              </span>
            )}
          </p>
        </div>

        <div className="flex-shrink-0 self-end sm:self-center font-mono text-right">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Winner Profit
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(calculations.winner.profit, 0)}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Policy */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Selected Policy ({Math.round(budgetFraction * 100)}%)
            </span>
            <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatCurrency(calculations.polProfit, 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            &plusmn;{formatCurrency(calculations.polVariation, 0)} across repeated splits
          </p>
        </div>

        {/* Card 2: Target Everyone */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Target Everyone (100%)
            </span>
            <span className="p-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatCurrency(calculations.everyoneProfit, 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            &plusmn;{formatCurrency(calculations.everyoneVariation, 0)} across repeated splits
          </p>
        </div>

        {/* Card 3: Difference vs Target Everyone */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Diff vs Target Everyone
            </span>
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              calculations.diffVsEveryone >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {calculations.diffVsEveryone >= 0 ? "+" : ""}
            {formatCurrency(calculations.diffVsEveryone, 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {calculations.diffVsEveryone >= 0 ? "Selective gains profit" : "Emailing everyone earns more"}
          </p>
        </div>

        {/* Card 4: Difference vs Random Targeting */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Diff vs Random ({Math.round(budgetFraction * 100)}%)
            </span>
            <span className="p-1 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              calculations.diffVsRandom >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {calculations.diffVsRandom >= 0 ? "+" : ""}
            {formatCurrency(calculations.diffVsRandom, 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Uplift value-add over random mail
          </p>
        </div>
      </div>

      {/* Break-Even Cost Analysis Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Unit Economics & Break-Even Analysis
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Positive ROI Break-Even Cost:
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ${calculations.roiBreakevenCost.toFixed(3)} / email
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Max contact cost before the top {Math.round(budgetFraction * 100)}% campaign loses money (&Pi; &lt; 0).
              Current cost (${cost.toFixed(2)}) is{" "}
              <strong className={cost <= calculations.roiBreakevenCost ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {cost <= calculations.roiBreakevenCost ? "profitable" : "unprofitable"}
              </strong>.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Selective vs Full-Campaign Break-Even:
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {calculations.selectiveBreakevenCost !== null
                  ? `$${calculations.selectiveBreakevenCost.toFixed(3)} / email`
                  : "N/A"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Contact cost above which targeting the top {Math.round(budgetFraction * 100)}% beats emailing 100%.
              Current cost (${cost.toFixed(2)}) is{" "}
              {calculations.selectiveBreakevenCost !== null ? (
                <strong className={cost >= calculations.selectiveBreakevenCost ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"}>
                  {cost >= calculations.selectiveBreakevenCost
                    ? "above threshold (selective targeting preferred)"
                    : "below threshold (emailing everyone preferred)"}
                </strong>
              ) : (
                "not applicable"
              )}.
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <ProfitChart
        profitGrid={profitGrid}
        margin={margin}
        cost={cost}
        selectedPolicy={selectedPolicy}
        budgetFraction={budgetFraction}
      />

      {/* Customer Contact List Table */}
      <CustomerTable
        customersData={customersData}
        selectedPolicy={selectedPolicy}
        budgetFraction={budgetFraction}
      />
    </div>
  );
}
