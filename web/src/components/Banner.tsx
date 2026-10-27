import React from "react";
import { AlertTriangle } from "lucide-react";

export default function Banner() {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs sm:text-sm font-medium">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          Results come from 10 repeated train/test splits of the Hillstrom experiment.
          Spend is non-zero for only 0.9% of customers, so profit estimates are noisy.
        </span>
      </div>
    </div>
  );
}
