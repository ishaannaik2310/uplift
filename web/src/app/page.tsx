"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users, UserCheck, ShieldCheck, TrendingUp, DollarSign, CreditCard } from "lucide-react";
import PipelineDiagram from "@/components/PipelineDiagram";
import StatCard from "@/components/StatCard";
import { SkeletonCard, ErrorState } from "@/components/SkeletonLoader";
import { fetchResultsData, fetchProfitGridData } from "@/lib/data";
import { ResultsData, ProfitGridData } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";

export default function OverviewPage() {
  const [results, setResults] = useState<ResultsData | null>(null);
  const [profitGrid, setProfitGrid] = useState<ProfitGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([fetchResultsData(), fetchProfitGridData()])
      .then(([rData, pData]) => {
        setResults(rData);
        setProfitGrid(pData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      });
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="space-y-4 max-w-3xl">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse" />
          <div className="h-10 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-16 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <SkeletonCard count={6} />
        </div>
      </div>
    );
  }

  if (error || !results || !profitGrid) {
    return (
      <ErrorState
        title="Failed to load benchmark results"
        message={error}
        onRetry={handleRetry}
      />
    );
  }

  const { meta, models, paired_tests } = results;

  // Extract key statistics from data
  const xLearner = models.find((m) => m.model_id === "x_learner_lr");
  const baselineLR = models.find((m) => m.model_id === "baseline_response_lr");
  const xVsBaselineTest = paired_tests.find(
    (t) => t.model_a === "x_learner_lr" && t.model_b === "baseline_response_lr"
  );

  const everyoneProfitDefault =
    profitGrid.n_pop * 1.0 * (profitGrid.default_margin * profitGrid.everyone.delta_spend_mean - profitGrid.default_cost);

  return (
    <div className="space-y-14">
      {/* Hero Section */}
      <section className="space-y-4 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80">
          <span>ML Course Project</span>
          <span className="text-teal-400">&bull;</span>
          <span>Uplift Modeling &amp; Causality</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-slate-900 dark:text-white tracking-tight leading-tight break-words">
          Stop Paying Customers Who Would&apos;ve Bought Anyway
        </h1>
        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
          Standard response models predict who is likely to purchase, systematically targeting
          high-intent customers who would have bought even without marketing. Uplift modeling
          uses randomized controlled trial (RCT) data to estimate the <em>incremental causal impact</em> of
          interventions, isolating persuadable customers from non-responders and sure things.
        </p>
      </section>

      {/* Pipeline Diagram */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Evaluation &amp; Decision Pipeline
          </h2>
        </div>
        <PipelineDiagram />
      </section>

      {/* Dataset Facts Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Dataset Facts &bull; Kevin Hillstrom Email RCT
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <StatCard
            label="Total Rows"
            value={formatNumber(meta.n_rows)}
            note={`70/30 split (${formatNumber(meta.n_test)} test)`}
            icon={Users}
          />
          <StatCard
            label="Treated Group"
            value={formatNumber(meta.n_treated)}
            note={`${formatPercent(meta.visit_rate_treated)} visit rate`}
            icon={UserCheck}
          />
          <StatCard
            label="Control Group"
            value={formatNumber(meta.n_control)}
            note={`${formatPercent(meta.visit_rate_control)} visit rate`}
            icon={ShieldCheck}
          />
          <StatCard
            label="Visit ATE"
            value={`+${formatPercent(meta.ate_visit)}`}
            note="Incremental visit rate"
            delta="+6.09%"
            deltaPositive={true}
            icon={TrendingUp}
          />
          <StatCard
            label="Spend ATE (Full Data)"
            value={`+${formatCurrency(meta.ate_spend)}`}
            note={`${formatCurrency(meta.spend_rate_treated)} vs ${formatCurrency(meta.spend_rate_control)}`}
            deltaPositive={true}
            icon={DollarSign}
          />
          <StatCard
            label="Spenders"
            value={formatPercent(meta.spender_rate)}
            note={`${meta.n_spenders} of ${formatNumber(meta.n_rows)} users`}
            icon={CreditCard}
          />
        </div>
      </section>

      {/* Three Honest Headline Findings */}
      <section className="space-y-6">
        <div className="pb-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Three Honest Headline Findings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Reconciling machine learning lift curves with unit economics and resampled statistical variance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Finding 1 */}
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-xs">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-3xl font-bold text-teal-700 dark:text-teal-400 tabular">
                01
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                Modest Ranking Gain, Not Significant
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Uplift models rank customers somewhat better than the naive response model (X-Learner LR
              Qini: <strong className="tabular font-semibold text-slate-900 dark:text-slate-200">{xLearner?.qini_normalized_mean.toFixed(4)}</strong> vs Baseline LR:{" "}
              <strong className="tabular font-semibold text-slate-900 dark:text-slate-200">{baselineLR?.qini_normalized_mean.toFixed(4)}</strong>), but the differences are{" "}
              <strong>not statistically significant</strong> after Nadeau-Bengio split variance correction and
              Holm-Bonferroni adjustment (t = <span className="tabular">{xVsBaselineTest?.t_stat.toFixed(2)}</span>, raw p ={" "}
              <span className="tabular">{xVsBaselineTest?.p_value_raw.toFixed(4)}</span>, Holm p ={" "}
              <span className="tabular">{xVsBaselineTest?.p_value_holm.toFixed(4)}</span>).
            </p>
          </div>

          {/* Finding 2 */}
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-xs">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-3xl font-bold text-teal-700 dark:text-teal-400 tabular">
                02
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                Default Assumptions Favor Mass Mailing
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              At default business assumptions (<strong className="tabular font-semibold text-slate-900 dark:text-slate-200">{formatPercent(meta.default_margin, 0)} margin</strong> and{" "}
              <strong className="tabular font-semibold text-slate-900 dark:text-slate-200">{formatCurrency(meta.default_cost)} per email</strong>), emailing 100% of customers is the
              most profitable option (expected profit of <strong className="tabular font-semibold text-slate-900 dark:text-slate-200">{formatCurrency(everyoneProfitDefault, 0)}</strong> per 100k
              customers). The average incremental spend easily covers the low $0.05 email cost.
            </p>
          </div>

          {/* Finding 3 */}
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-xs">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-3xl font-bold text-teal-700 dark:text-teal-400 tabular">
                03
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                Selective Targeting Pays at Higher Costs
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              At higher contact costs, selective targeting can earn more profit in-sample, but the differences are
              within split-to-split variation. High spend sparsity (only <span className="tabular font-semibold text-slate-900 dark:text-slate-200">{formatPercent(meta.spender_rate)} spenders</span>)
              means empirical dollar profit carries wide noise across sample partitions.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Actions */}
      <section className="pt-2 flex flex-wrap items-center gap-3.5">
        <Link
          href="/simulator"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs sm:text-sm transition-all shadow-sm"
        >
          <span>Launch Interactive Profit Simulator</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/models"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm transition-all"
        >
          <span>Explore Benchmark &amp; Statistical Tests</span>
        </Link>
      </section>
    </div>
  );
}
