"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const STORAGE_KEY = "uplift_banner_dismissed";

export default function Banner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // sessionStorage unavailable
    }
  };

  if (dismissed) return null;

  return (
    <aside
      aria-label="Experiment Noise and Sample Sparsity Warning"
      className="bg-amber-500/10 border-b border-amber-500/20 text-amber-950 dark:text-amber-200 px-4 py-2 text-xs sm:text-sm font-medium transition-opacity"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 text-[11px] sm:text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="leading-snug">
            Results come from 10 repeated train/test splits of the Hillstrom experiment.
            Spend is non-zero for only 0.9% of customers, so profit estimates are noisy.
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss banner for this session"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
