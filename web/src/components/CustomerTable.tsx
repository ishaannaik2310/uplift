"use client";

import React, { useMemo } from "react";
import { Download, Users } from "lucide-react";
import { CustomersData, PolicyId } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";

interface CustomerTableProps {
  customersData: CustomersData;
  selectedPolicy: PolicyId;
  budgetFraction: number;
}

export default function CustomerTable({
  customersData,
  selectedPolicy,
  budgetFraction,
}: CustomerTableProps) {
  const { columns, rows } = customersData;

  const scoreColName = `score_${selectedPolicy}`;
  const scoreIdx = columns.indexOf(scoreColName);
  const idIdx = columns.indexOf("id");
  const recencyIdx = columns.indexOf("recency");
  const historyIdx = columns.indexOf("history");
  const channelIdx = columns.indexOf("channel");
  const zipIdx = columns.indexOf("zip_code");

  // Rank and slice top k customers
  const rankedCustomers = useMemo(() => {
    if (scoreIdx === -1) return [];

    // Stable descending sort by score
    // Using a slice with index for stable tie-breaking
    const indexed = rows.map((r, i) => ({ r, i }));
    indexed.sort((a, b) => {
      const diff = (b.r[scoreIdx] as number) - (a.r[scoreIdx] as number);
      if (diff !== 0) return diff;
      return a.i - b.i; // stable tie-breaker by original row order
    });

    const k = Math.round(budgetFraction * rows.length);
    return indexed.slice(0, k).map((item) => item.r);
  }, [rows, scoreIdx, budgetFraction]);

  const previewRows = rankedCustomers.slice(0, 100);

  const downloadCsv = () => {
    const csvHeaders = ["id", "recency", "history", "channel", "zip_code", "score"];
    const csvLines = [csvHeaders.join(",")];

    for (const r of rankedCustomers) {
      csvLines.push(
        [
          r[idIdx],
          r[recencyIdx],
          r[historyIdx],
          `"${r[channelIdx]}"`,
          `"${r[zipIdx]}"`,
          (r[scoreIdx] as number).toFixed(5),
        ].join(",")
      );
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `targeted_customers_${selectedPolicy}_${Math.round(budgetFraction * 100)}pct.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Ranked Contact List ({rankedCustomers.length.toLocaleString()} Customers)</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Illustrative: One Held-Out Test Split (Seed 0)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Top {Math.round(budgetFraction * 100)}% customers ranked by {selectedPolicy} model score
          </p>
        </div>

        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Full List as CSV ({rankedCustomers.length.toLocaleString()})</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Customer ID</th>
              <th className="py-2.5 px-3 text-right">Recency (Months)</th>
              <th className="py-2.5 px-3 text-right">Historical Spend</th>
              <th className="py-2.5 px-3">Channel</th>
              <th className="py-2.5 px-3">Zip Code</th>
              <th className="py-2.5 px-3 text-right font-mono">Predicted Uplift Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {previewRows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 font-mono">
                <td className="py-2 px-3 text-slate-400 font-sans">{i + 1}</td>
                <td className="py-2 px-3 text-slate-900 dark:text-white font-semibold">{r[idIdx]}</td>
                <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300 font-sans">
                  {r[recencyIdx]}
                </td>
                <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                  {formatCurrency(r[historyIdx] as number, 2)}
                </td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-sans">{r[channelIdx]}</td>
                <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-sans">{r[zipIdx]}</td>
                <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                  {(r[scoreIdx] as number).toFixed(5)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 text-right">
        Showing first 100 rows of {rankedCustomers.length.toLocaleString()} targeted customers.
      </p>
    </div>
  );
}
