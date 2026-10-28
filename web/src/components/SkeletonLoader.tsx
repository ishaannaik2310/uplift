import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export function SkeletonCard({ count = 1, className = "" }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs animate-pulse ${className}`}
        >
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded-md mb-4" />
          <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded-md mb-3" />
          <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
      ))}
    </>
  );
}

export function SkeletonChart() {
  return (
    <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
      </div>
      <div className="h-80 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
    </div>
  );
}

export function ErrorState({
  title = "Failed to load data",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="p-6 sm:p-8 rounded-2xl border border-rose-200 dark:border-rose-950 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 space-y-3">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
        <h3 className="font-bold text-base">{title}</h3>
      </div>
      {message && <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry Loading</span>
        </button>
      )}
    </div>
  );
}
