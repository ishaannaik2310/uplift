import React from "react";
import { Database, Split, Brain, Award, DollarSign } from "lucide-react";

export default function PipelineDiagram() {
  const steps = [
    {
      num: "01",
      title: "Hillstrom RCT",
      desc: "64,000 customers randomized to E-Mail vs Control",
      icon: Database,
    },
    {
      num: "02",
      title: "Repeated Splits",
      desc: "10 stratified 70/30 train-test splits",
      icon: Split,
    },
    {
      num: "03",
      title: "Meta-Learners",
      desc: "S, T, and X-Learners with LR & XGBoost",
      icon: Brain,
    },
    {
      num: "04",
      title: "Corrected Tests",
      desc: "Nadeau-Bengio t-test & Holm adjustment",
      icon: Award,
    },
    {
      num: "05",
      title: "Profit Simulation",
      desc: "Dollar outcomes scaled to 100k population",
      icon: DollarSign,
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col items-start gap-3 shadow-xs hover:border-teal-500/30 transition-all"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="font-mono text-xs font-bold text-slate-300 dark:text-slate-700">
                  {step.num}
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
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
