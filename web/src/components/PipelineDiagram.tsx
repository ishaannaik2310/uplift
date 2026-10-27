import React from "react";
import { Database, Split, Brain, Award, DollarSign } from "lucide-react";

export default function PipelineDiagram() {
  const steps = [
    {
      title: "1. Hillstrom RCT",
      desc: "64,000 customers randomized to E-Mail vs Control",
      icon: Database,
    },
    {
      title: "2. Repeated Splits",
      desc: "10 stratified 70/30 train-test splits",
      icon: Split,
    },
    {
      title: "3. Meta-Learners",
      desc: "S, T, and X-Learners with LR & XGBoost",
      icon: Brain,
    },
    {
      title: "4. Corrected Tests",
      desc: "Nadeau-Bengio t-test & Holm adjustment",
      icon: Award,
    },
    {
      title: "5. Profit Simulation",
      desc: "Dollar outcomes scaled to 100k population",
      icon: DollarSign,
    },
  ];

  return (
    <div className="w-full py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-start gap-2 shadow-sm"
            >
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                  {step.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
