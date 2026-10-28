import React from "react";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  delta?: string;
  deltaPositive?: boolean;
  deltaNote?: string;
  icon?: LucideIcon;
}

export default function StatCard({
  label,
  value,
  note,
  delta,
  deltaPositive,
  deltaNote,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {Icon && (
          <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>

      <div className="my-3 flex items-baseline gap-2 flex-wrap">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular font-sans tracking-tight">
          {value}
        </div>
        {delta && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular ${
              deltaPositive
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}
          >
            {delta}
          </span>
        )}
      </div>

      {(note || deltaNote) && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          {note && <span>{note}</span>}
          {deltaNote && <span className="ml-1 text-slate-400 dark:text-slate-500">({deltaNote})</span>}
        </div>
      )}
    </div>
  );
}
