import React from "react";
import Link from "next/link";
import {
  BookOpen,
  GitBranch,
  ShieldAlert,
  ExternalLink,
  Cpu,
  Layers,
  Scale,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto py-2">
      {/* Page Header */}
      <section className="space-y-3">
        <h1 className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight break-words">
          Methodology, CATE &amp; Statistical Rigor
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          A rigorous guide to uplift modeling, causal meta-learners, out-of-sample evaluation,
          and honest reporting on the Kevin Hillstrom email RCT dataset.
        </p>
      </section>

      {/* Section 1: The Core Problem */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800">
          <Scale className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            1. Why Uplift Modeling? The Causal Attribution Gap
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Standard predictive marketing relies on <strong>response models</strong> (propensity scoring):
          estimating Pr(Y=1 | X) to identify customers most likely to purchase. However, customers
          with high propensity often purchase anyway (&ldquo;Sure Things&rdquo;). Spending marketing budget
          on them wastes capital and can even cause fatigue or unsubscriptions (&ldquo;Do Not Disturbs&rdquo;).
        </p>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong>Uplift modeling</strong> directly estimates the <strong>Conditional Average Treatment Effect (CATE)</strong>:
        </p>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 font-mono text-sm text-center text-teal-800 dark:text-teal-300">
          &tau;(X) = E[Y(1) - Y(0) | X]
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          By ranking customers by predicted uplift &tau;&circ;(X), marketing teams target &ldquo;Persuadables&rdquo;&mdash;customers
          who buy if and only if they receive a communication.
        </p>
      </section>

      {/* Section 2: Meta-Learner Architectures */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800">
          <Cpu className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            2. Uplift Meta-Learners Evaluated
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
              <span>T-Learner (Two-Model Estimator)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Fits two independent base estimators: &mu;<sub>1</sub>(X) = E[Y | X, W=1] on treated units,
              and &mu;<sub>0</sub>(X) = E[Y | X, W=0] on control units. Uplift is the difference:
              &tau;&circ;(X) = &mu;&circ;<sub>1</sub>(X) - &mu;&circ;<sub>0</sub>(X). Prevents treatment signal from being washed
              out by strong prognostic main effects.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
              <span>X-Learner (Crossover Imputation)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Designed by K&uuml;nzel et al. (2019) for imbalanced treatment/control allocations (e.g. 2:1 treated in Hillstrom).
              Imputes unobserved counterfactuals for both groups, fits stage-2 CATE regressors on the imputed effects,
              and blends them via propensity weighting: &tau;&circ;(X) = e(X)&tau;&circ;<sub>0</sub>(X) + (1-e(X))&tau;&circ;<sub>1</sub>(X).
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
              <span>S-Learner (Single Model)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Fits a single model &mu;(X, W) = E[Y | X, W] including treatment indicator W as a feature.
              Uplift: &tau;&circ;(X) = &mu;&circ;(X, 1) - &mu;&circ;(X, 0). In high dimensions, tree algorithms can easily
              under-split on W if main features dominate variance.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span>Response Model (Propensity Baseline)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Standard marketing model trained only on treated records: Pr(Y=1 | X, W=1). Assumes high response
              implies high incremental return. Confounds base purchase rate with incremental lift.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Statistical Rigor & Validation */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800">
          <Layers className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            3. Repeated Split Validation &amp; Nadeau-Bengio Paired Tests
          </h2>
        </div>
        <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3 shadow-xs">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            A single train/test split can be misleading due to split luck. To ensure statistical integrity:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <li>
              <strong>10 Repeated Splits:</strong> Every model is trained and evaluated across 10 independent 70/30
              stratified train/test splits (Seeds 0&ndash;9).
            </li>
            <li>
              <strong>Nadeau-Bengio (2003) Correction:</strong> Standard paired t-tests across repeated splits underestimate
              variance because test folds overlap. We apply the corrected sample variance:
              <div className="my-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 font-mono text-[11px] sm:text-xs text-center border border-slate-200/80 dark:border-slate-800">
                &sigma;<sup>2</sup><sub>corrected</sub> = (1/J + n<sub>2</sub>/n<sub>1</sub>) S<sup>2</sup> = (1/10 + 0.3/0.7) S<sup>2</sup> &approx; (0.1 + 0.429) S<sup>2</sup>
              </div>
            </li>
            <li>
              <strong>Holm-Bonferroni Correction:</strong> Step-down adjustment applied across all model comparisons against
              random targeting to enforce a strict Family-Wise Error Rate (FWER) &le; 0.05.
            </li>
          </ul>
        </div>
      </section>

      {/* Section 4: Assumptions & Limitations */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            4. Assumptions, Sparse Spend &amp; Limitations
          </h2>
        </div>
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <div className="p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
            <h3 className="font-bold text-amber-950 dark:text-amber-200 text-sm">
              Sparse Spend Limitation (0.9% Non-Zero)
            </h3>
            <p>
              While visits occur for 14.67% of customers in the dataset, dollar spend occurs for only 0.9%
              (578 customers across the entire 64,000 dataset). Because spend is heavy-tailed and sparse, dollar-based
              profit estimates exhibit substantial split-to-split variance.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Business Modeling Assumptions
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Contribution Margin (default 30%):</strong> Assumes a 30% gross profit margin on incremental retail revenue.
              </li>
              <li>
                <strong>Email Contact Cost (default $0.05):</strong> Includes delivery platform costs, creative production, and customer unsubscribe friction.
              </li>
              <li>
                <strong>Single-Split Customer Scoring:</strong> Customer contact tables and individual uplift scores are generated on Seed 0&rsquo;s held-out test split for illustrative demonstration.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 5: References & Code */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200/90 dark:border-slate-800">
          <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            5. Academic References &amp; Open Source Code
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white">
              Kevin Hillstrom Email Dataset
            </h3>
            <p className="text-slate-500">
              MineThatData E-Mail Analytics Challenge (64,000 customers).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white">
              K&uuml;nzel et al. (2019) X-Learner
            </h3>
            <p className="text-slate-500">
              Metalearners for estimating heterogeneous treatment effects using machine learning (PNAS).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white">
              Radcliffe (2007) Qini Curve
            </h3>
            <p className="text-slate-500">
              Using control groups to target on predicted lift: The Qini curve and financial uplift.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white">
              Nadeau &amp; Bengio (2003)
            </h3>
            <p className="text-slate-500">
              Inference for the Generalization Error: Correcting for non-independent resampled test splits.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-teal-950 dark:text-teal-200">
              Open-Source Uplift Modeling Pipeline
            </h3>
            <p className="text-xs text-teal-800 dark:text-teal-300">
              Reproduce all models, metrics, cross-validations, and static data exports with Python and Next.js.
            </p>
          </div>
          <Link
            href="https://github.com/ishaannaik2310/uplift"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-all shadow-xs self-start sm:self-auto shrink-0"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
