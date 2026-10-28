"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  RotateCcw,
  Percent,
  DollarSign,
  Layers,
  Sparkles,
  TrendingUp,
  Ban,
  HelpCircle,
} from "lucide-react";
import { CustomersData, PolicyId, ProfitGridData } from "@/lib/types";
import { fetchCustomersData, fetchProfitGridData } from "@/lib/data";
import { formatCurrency } from "@/lib/formatters";
import ProfitChart from "@/components/ProfitChart";
import CustomerTable from "@/components/CustomerTable";
import { SkeletonCard, SkeletonChart, ErrorState } from "@/components/SkeletonLoader";

const DEFAULT_MARGIN = 0.30;
const DEFAULT_COST = 0.05;
const DEFAULT_BUDGET = 0.30;
const DEFAULT_POLICY: PolicyId = "t_learner_lr";

const POLICY_OPTIONS: { id: PolicyId; label: string; short: string; tag: string }[] = [
  { id: "t_learner_lr", label: "T-Learner (LR)", short: "T-LR", tag: "two models" },
  { id: "x_learner_lr", label: "X-Learner (LR)", short: "X-LR", tag: "cross-estimation" },
  { id: "s_learner_xgb", label: "S-Learner (XGB)", short: "S-XGB", tag: "one model" },
  { id: "response_lr", label: "Response Model", short: "Response", tag: "treated-only model" },
  { id: "random", label: "Random", short: "Random", tag: "random" },
];

export default function SimulatorPage() {
  const [profitGrid, setProfitGrid] = useState<ProfitGridData | null>(null);
  const [customersData, setCustomersData] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulator Interactive State
  const [margin, setMargin] = useState<number>(DEFAULT_MARGIN);
  const [cost, setCost] = useState<number>(DEFAULT_COST);
  const [budgetFraction, setBudgetFraction] = useState<number>(DEFAULT_BUDGET);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyId>(DEFAULT_POLICY);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([fetchProfitGridData(), fetchCustomersData()])
      .then(([grid, cust]) => {
        setProfitGrid(grid);
        setCustomersData(cust);
        if (grid.default_margin) setMargin(grid.default_margin);
        if (grid.default_cost) setCost(grid.default_cost);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load simulation data");
        setLoading(false);
      });
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const resetDefaults = () => {
    if (profitGrid?.default_margin) setMargin(profitGrid.default_margin);
    else setMargin(DEFAULT_MARGIN);
    if (profitGrid?.default_cost) setCost(profitGrid.default_cost);
    else setCost(DEFAULT_COST);
    setBudgetFraction(DEFAULT_BUDGET);
    setSelectedPolicy(DEFAULT_POLICY);
  };

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
    const roiBreakevenCost = margin * polDelta;
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

    policyProfitsAtBudget.sort((a, b) => b.profit - a.profit);
    const bestSelective = policyProfitsAtBudget[0];

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
      <div className="space-y-10">
        <div className="space-y-3 max-w-2xl">
          <div className="h-8 w-60 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <SkeletonCard className="h-96" />
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard count={3} />
            <SkeletonChart />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profitGrid || !customersData || !calculations) {
    return (
      <ErrorState
        title="Failed to load simulation environment"
        message={error}
        onRetry={handleRetry}
      />
    );
  }

  const selectedPolicyObj = POLICY_OPTIONS.find((p) => p.id === selectedPolicy);

  return (
    <div className="space-y-12">
      {/* Page Header */}
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight break-words">
          Targeting &amp; Profit Simulator
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
          Simulate campaign profitability across unit economics, contact costs, and budget fractions
          evaluated on out-of-sample RCT customer response data.
        </p>
      </section>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sticky Control Panel */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Simulation Parameters
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scaled to {calculations.n_pop.toLocaleString()} customers
                </p>
              </div>
              <button
                onClick={resetDefaults}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Reset to default economic parameters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Slider 1: Contribution Margin */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label
                  htmlFor="margin-slider"
                  className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Percent className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Contribution Margin</span>
                </label>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400 tabular text-sm">
                  {(margin * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="margin-slider"
                type="range"
                min="0.05"
                max="0.60"
                step="0.01"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value))}
                aria-label="Contribution Margin"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-700"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular">
                <span>Min: 5%</span>
                <span>Default: 30%</span>
                <span>Max: 60%</span>
              </div>
            </div>

            {/* Slider 2: Cost per Email */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label
                  htmlFor="cost-slider"
                  className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Cost per Contact</span>
                </label>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400 tabular text-sm">
                  ${cost.toFixed(2)}
                </span>
              </div>
              <input
                id="cost-slider"
                type="range"
                min="0.00"
                max="0.60"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(parseFloat(e.target.value))}
                aria-label="Cost per Contact"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-700"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular">
                <span>Min: $0.00</span>
                <span>Default: $0.05</span>
                <span>Max: $0.60</span>
              </div>
            </div>

            {/* Slider 3: Budget Fraction */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label
                  htmlFor="budget-slider"
                  className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Targeting Budget</span>
                </label>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400 tabular text-sm">
                  {Math.round(budgetFraction * 100)}% ({Math.round(budgetFraction * calculations.n_pop).toLocaleString()} users)
                </span>
              </div>
              <input
                id="budget-slider"
                type="range"
                min="0.05"
                max="1.00"
                step="0.05"
                value={budgetFraction}
                onChange={(e) => setBudgetFraction(parseFloat(e.target.value))}
                aria-label="Targeting Budget Fraction"
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-700"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular">
                <span>Min: 5%</span>
                <span>Selective: 30%</span>
                <span>Full: 100%</span>
              </div>
            </div>

            {/* Segmented Buttons for Policy Selector */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Targeting Policy:
              </label>
              <div
                className="grid grid-cols-1 gap-1.5"
                role="radiogroup"
                aria-label="Select targeting policy"
              >
                {POLICY_OPTIONS.map((pol) => {
                  const active = selectedPolicy === pol.id;
                  return (
                    <button
                      key={pol.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedPolicy(pol.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between border cursor-pointer ${
                        active
                          ? "bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-950 dark:text-teal-200 font-semibold shadow-xs"
                          : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            active ? "bg-teal-600 dark:bg-teal-400" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        <span>{pol.label}</span>
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        {pol.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Simulation Output, KPI Cards, Verdict, Chart, Contact Table */}
        <div className="lg:col-span-8 space-y-8">
          {/* Verdict Card: One Bold Sentence + Quiet Tag */}
          <section
            aria-label="Simulation Verdict"
            className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Simulation Verdict
                </h2>
              </div>
              {calculations.isWithinVariation && !calculations.allProfitsNegative && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  within split variation
                </span>
              )}
            </div>

            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {calculations.allProfitsNegative ? (
                <span>At ${cost.toFixed(2)} cost and {(margin * 100).toFixed(0)}% margin, no targeting policy is profitable &mdash; run No Campaign.</span>
              ) : calculations.isWithinVariation ? (
                <span>{calculations.winner.name} yields highest in-sample profit ({formatCurrency(calculations.winner.profit, 0)}), but the gap over {calculations.runnerUp.name} ({formatCurrency(calculations.gap, 0)}) is within split-to-split variation.</span>
              ) : (
                <span>{calculations.winner.name} is the clear profit-optimal decision at {formatCurrency(calculations.winner.profit, 0)}, outperforming {calculations.runnerUp.name} beyond sample noise.</span>
              )}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Evaluating the top {Math.round(budgetFraction * 100)}% customers against a full 100% campaign and a $0 baseline on 10 repeated test sets.
            </p>
          </section>

          {/* Three KPI Cards: Selected Policy, Target Everyone, No Campaign */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Key Performance Indicators">
            {/* Card 1: Selected Policy */}
            <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Selected Policy</span>
                <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-sans tabular text-slate-900 dark:text-white">
                {formatCurrency(calculations.polProfit, 0)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular">
                &plusmn;{formatCurrency(calculations.polVariation, 0)} cross-split SD
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                <span>{selectedPolicyObj?.label} at {Math.round(budgetFraction * 100)}%</span>
              </div>
            </div>

            {/* Card 2: Target Everyone */}
            <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Target Everyone</span>
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-sans tabular text-slate-900 dark:text-white">
                {formatCurrency(calculations.everyoneProfit, 0)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular">
                &plusmn;{formatCurrency(calculations.everyoneVariation, 0)} cross-split SD
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                <span>Full campaign (100% of customers)</span>
              </div>
            </div>

            {/* Card 3: No Campaign */}
            <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>No Campaign</span>
                <Ban className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold font-sans tabular text-slate-900 dark:text-white">
                $0
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Zero contact expenditure
              </div>
              <div className="text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                <span>Baseline natural transactions only</span>
              </div>
            </div>
          </section>

          {/* Break-Even Callout */}
          <section
            aria-label="Break-even Analysis"
            className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-3"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Break-Even Economics for {selectedPolicyObj?.label} ({Math.round(budgetFraction * 100)}% budget)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Positive ROI Ceiling:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400 tabular text-sm">
                    ${calculations.roiBreakevenCost.toFixed(3)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Maximum contact cost before targeting this cohort loses money. Current (${cost.toFixed(2)}) is{" "}
                  <strong className={cost <= calculations.roiBreakevenCost ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {cost <= calculations.roiBreakevenCost ? "profitable" : "unprofitable"}
                  </strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Selective vs Mass Threshold:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400 tabular text-sm">
                    {calculations.selectiveBreakevenCost !== null
                      ? `$${calculations.selectiveBreakevenCost.toFixed(3)}`
                      : "N/A"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Cost per email above which selective targeting beats mass mailing 100%. Current (${cost.toFixed(2)}) is{" "}
                  {calculations.selectiveBreakevenCost !== null ? (
                    <strong className={cost >= calculations.selectiveBreakevenCost ? "text-teal-700 dark:text-teal-400" : "text-amber-700 dark:text-amber-400"}>
                      {cost >= calculations.selectiveBreakevenCost ? "above (selective preferred)" : "below (emailing everyone preferred)"}
                    </strong>
                  ) : (
                    "not applicable"
                  )}.
                </p>
              </div>
            </div>
          </section>

          {/* Profit vs Budget Chart */}
          <section className="space-y-4">
            <ProfitChart
              profitGrid={profitGrid}
              margin={margin}
              cost={cost}
              selectedPolicy={selectedPolicy}
              budgetFraction={budgetFraction}
            />
          </section>

          {/* Contact Table with CSV Download */}
          <section className="space-y-4">
            <CustomerTable
              customersData={customersData}
              selectedPolicy={selectedPolicy}
              budgetFraction={budgetFraction}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
