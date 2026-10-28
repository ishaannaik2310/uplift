"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Download,
  Printer,
  Sparkles,
  Lock,
  Layers,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Database,
  Play,
  Info,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import {
  fetchProfitGridData,
  fetchXLearnerParams,
  fetchSampleCustomersCsv,
  fetchSampleDatasetsManifest,
  fetchSampleCsvByUrl,
  SampleDatasetMetadata,
} from "@/lib/data";
import { ProfitGridData } from "@/lib/types";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import {
  XLearnerParams,
  ScoredCustomer,
  ValidationResult,
  CustomerSegment,
  validateCustomerList,
  scoreAndRankCustomers,
} from "@/lib/xlearner";
import { SkeletonCard, ErrorState } from "@/components/SkeletonLoader";

const DEFAULT_MARGIN = 0.3;
const DEFAULT_COST = 0.05;

// Segment definitions & color tokens
const SEGMENT_CONFIG: Record<
  CustomerSegment,
  {
    label: string;
    description: string;
    action: string;
    color: string;
    bg: string;
    border: string;
    darkBg: string;
    darkText: string;
  }
> = {
  Persuadables: {
    label: "Persuadables",
    description: "High predicted uplift; intervention causes the purchase nudge.",
    action: "Target Priority",
    color: "#0f766e", // teal-700
    bg: "bg-teal-50",
    border: "border-teal-200 dark:border-teal-800",
    darkBg: "dark:bg-teal-950/40",
    darkText: "dark:text-teal-300",
  },
  "Sure Things": {
    label: "Sure Things",
    description: "High baseline purchase probability; will buy without campaign.",
    action: "Suppress (Save Budget)",
    color: "#3b82f6", // blue-500
    bg: "bg-blue-50",
    border: "border-blue-200 dark:border-blue-800",
    darkBg: "dark:bg-blue-950/40",
    darkText: "dark:text-blue-300",
  },
  "Lost Causes": {
    label: "Lost Causes",
    description: "Low baseline probability & low uplift; unlikely to convert.",
    action: "Do Not Target",
    color: "#64748b", // slate-500
    bg: "bg-slate-50",
    border: "border-slate-200 dark:border-slate-700",
    darkBg: "dark:bg-slate-800/40",
    darkText: "dark:text-slate-300",
  },
  "Sleeping Dogs": {
    label: "Sleeping Dogs",
    description: "Negative uplift; campaign contact reduces purchase probability.",
    action: "Strictly Suppress",
    color: "#e11d48", // rose-600
    bg: "bg-rose-50",
    border: "border-rose-200 dark:border-rose-800",
    darkBg: "dark:bg-rose-950/40",
    darkText: "dark:text-rose-300",
  },
};

export default function PlannerPage() {
  const [params, setParams] = useState<XLearnerParams | null>(null);
  const [profitGrid, setProfitGrid] = useState<ProfitGridData | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);

  // Upload & File State
  const [manifest, setManifest] = useState<SampleDatasetMetadata[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [scoredCustomers, setScoredCustomers] = useState<ScoredCustomer[]>(null as unknown as ScoredCustomer[]);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);

  // Business Sliders for Campaign Optimization
  const [margin, setMargin] = useState<number>(DEFAULT_MARGIN);
  const [cost, setCost] = useState<number>(DEFAULT_COST);

  // Table Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Load Model Weights, Profit Curves & Sample Manifest
  useEffect(() => {
    Promise.all([
      fetchXLearnerParams(),
      fetchProfitGridData(),
      fetchSampleDatasetsManifest().catch(() => []),
    ])
      .then(([p, grid, m]) => {
        setParams(p);
        setProfitGrid(grid);
        if (grid.default_margin) setMargin(grid.default_margin);
        if (grid.default_cost) setCost(grid.default_cost);
        if (m && m.length > 0) setManifest(m);
        setLoadingInitial(false);
      })
      .catch((err) => {
        setInitialError(err instanceof Error ? err.message : "Failed to load model parameters");
        setLoadingInitial(false);
      });
  }, []);

  // 2. Parse & Process File
  const handleProcessCsv = (fileOrText: File | string, displayName: string) => {
    if (!params) return;
    setIsProcessing(true);
    setFileName(displayName);

    const t0 = performance.now();

    Papa.parse<Record<string, unknown>>(fileOrText as File, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawRows = results.data;
        const validation = validateCustomerList(rawRows);
        setValidationResult(validation);

        if (validation.valid && validation.validRows.length > 0) {
          // Defer scoring to next tick to allow UI to render processing spinner
          setTimeout(() => {
            const scored = scoreAndRankCustomers(validation.validRows, params);
            setScoredCustomers(scored);
            setProcessingTimeMs(Math.round(performance.now() - t0));
            setIsProcessing(false);
            setCurrentPage(1);
          }, 20);
        } else {
          setScoredCustomers([]);
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setValidationResult({
          valid: false,
          totalRows: 0,
          validRows: [],
          issues: [{ row: 0, column: "file", value: null, reason: `CSV Parse Error: ${err.message}` }],
          missingColumns: [],
        });
        setIsProcessing(false);
      },
    });
  };

  // 3. Load Sample Datasets
  const handleLoadSampleDataset = async (dataset: SampleDatasetMetadata) => {
    try {
      setIsProcessing(true);
      setSelectedSampleId(dataset.id);
      setActiveScenario(dataset.scenario);
      const csvText = await fetchSampleCsvByUrl(dataset.url);
      handleProcessCsv(csvText, `${dataset.name} (${dataset.rows.toLocaleString()} customers)`);
    } catch (err) {
      alert(`Could not load sample file: ${err instanceof Error ? err.message : String(err)}`);
      setIsProcessing(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (manifest.length > 0) {
      await handleLoadSampleDataset(manifest[0]);
    } else {
      try {
        setIsProcessing(true);
        const csvText = await fetchSampleCustomersCsv();
        handleProcessCsv(csvText, "sample_customers.csv (500 held-out test units)");
      } catch (err) {
        alert(`Could not load sample file: ${err instanceof Error ? err.message : String(err)}`);
        setIsProcessing(false);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedSampleId(null);
      setActiveScenario(null);
      handleProcessCsv(file, file.name);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedSampleId(null);
      setActiveScenario(null);
      handleProcessCsv(file, file.name);
    }
  };

  // 4. Financial Optimization on the Uploaded Population
  const recommendation = useMemo(() => {
    if (!scoredCustomers || scoredCustomers.length === 0 || !profitGrid) return null;
    const n = scoredCustomers.length;
    const xLearnerPolicy = profitGrid.policies["x_learner_lr"];
    if (!xLearnerPolicy) return null;

    let bestProfit = -Infinity;
    let bestFraction = 1.0;
    let bestDeltaSpend = 0;

    for (let i = 0; i < profitGrid.fractions.length; i++) {
      const f = profitGrid.fractions[i];
      const deltaSpend = xLearnerPolicy.delta_spend_mean[i];
      const profit = n * f * (margin * deltaSpend - cost);
      if (profit > bestProfit) {
        bestProfit = profit;
        bestFraction = f;
        bestDeltaSpend = deltaSpend;
      }
    }

    // Also compare against 0% (no campaign)
    if (bestProfit < 0) {
      bestProfit = 0;
      bestFraction = 0;
      bestDeltaSpend = 0;
    }

    const targetCount = Math.round(n * bestFraction);
    const breakEvenCost = bestDeltaSpend > 0 ? margin * bestDeltaSpend : 0;
    const revenueIncremental = n * bestFraction * bestDeltaSpend;
    const campaignCost = targetCount * cost;

    return {
      bestFraction,
      targetCount,
      bestProfit,
      revenueIncremental,
      campaignCost,
      breakEvenCost,
      isNoCampaign: bestFraction === 0,
    };
  }, [scoredCustomers, profitGrid, margin, cost]);

  // 5. Segment Metrics
  const segmentStats = useMemo(() => {
    if (!scoredCustomers || scoredCustomers.length === 0) return null;
    const total = scoredCustomers.length;
    const counts: Record<CustomerSegment, number> = {
      Persuadables: 0,
      "Sure Things": 0,
      "Lost Causes": 0,
      "Sleeping Dogs": 0,
    };

    scoredCustomers.forEach((c) => counts[c.segment]++);

    return {
      total,
      counts,
      percentages: {
        Persuadables: counts["Persuadables"] / total,
        "Sure Things": counts["Sure Things"] / total,
        "Lost Causes": counts["Lost Causes"] / total,
        "Sleeping Dogs": counts["Sleeping Dogs"] / total,
      },
      chartData: [
        { name: "Persuadables", count: counts["Persuadables"], color: "#0f766e" },
        { name: "Sure Things", count: counts["Sure Things"], color: "#3b82f6" },
        { name: "Lost Causes", count: counts["Lost Causes"], color: "#64748b" },
        { name: "Sleeping Dogs", count: counts["Sleeping Dogs"], color: "#e11d48" },
      ],
    };
  }, [scoredCustomers]);

  // 6. Stretch Goal: Overlap Analysis (Top 20% by Naive mu0 vs Top 20% by Uplift)
  const overlapAnalysis = useMemo(() => {
    if (!scoredCustomers || scoredCustomers.length < 10) return null;
    const kCount = Math.max(1, Math.round(scoredCustomers.length * 0.2));

    // Top K by Uplift (already sorted)
    const topUpliftIds = new Set(scoredCustomers.slice(0, kCount).map((c) => c.id));

    // Top K by Naive purchase probability mu0
    const sortedByMu0 = [...scoredCustomers].sort((a, b) => {
      if (b.mu0Prob !== a.mu0Prob) return b.mu0Prob - a.mu0Prob;
      return a.originalRowIndex - b.originalRowIndex;
    });
    const topMu0Ids = new Set(sortedByMu0.slice(0, kCount).map((c) => c.id));

    let overlapCount = 0;
    topUpliftIds.forEach((id) => {
      if (topMu0Ids.has(id)) overlapCount++;
    });

    const overlapPct = (overlapCount / kCount) * 100;
    const disjointCount = kCount - overlapCount;

    return {
      kCount,
      overlapCount,
      overlapPct,
      disjointCount,
    };
  }, [scoredCustomers]);

  // 7. Filtered Table List
  const filteredCustomers = useMemo(() => {
    if (!scoredCustomers) return [];
    return scoredCustomers.filter((c) => {
      const matchSegment = selectedSegmentFilter === "ALL" || c.segment === selectedSegmentFilter;
      const matchSearch =
        !searchQuery ||
        String(c.id).includes(searchQuery) ||
        String(c.raw.channel).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.raw.zip_code).toLowerCase().includes(searchQuery.toLowerCase());
      return matchSegment && matchSearch;
    });
  }, [scoredCustomers, selectedSegmentFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const pagedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage]);

  // Export Ranked CSV
  const handleDownloadCsv = () => {
    if (!scoredCustomers || scoredCustomers.length === 0) return;
    const cutoffRank = recommendation ? recommendation.targetCount : scoredCustomers.length;

    const exportRows = scoredCustomers.map((c) => ({
      Rank: c.rank,
      CustomerID: c.id,
      Recommended_Action: c.rank <= cutoffRank ? "TARGET" : "SUPPRESS",
      Estimated_Segment: c.segment,
      Predicted_Uplift: c.uplift.toFixed(6),
      Baseline_Prob_mu0: c.mu0Prob.toFixed(6),
      Treated_Prob_mu1: c.mu1Prob.toFixed(6),
      Recency_Months: c.raw.recency,
      Spend_History: c.raw.history,
      Bought_Mens: c.raw.mens,
      Bought_Womens: c.raw.womens,
      Newbie: c.raw.newbie,
      Zip_Code: c.raw.zip_code,
      Channel: c.raw.channel,
    }));

    const csvStr = Papa.unparse(exportRows);
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ranked_campaign_plan_${fileName || "customers"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingInitial) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (initialError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ErrorState message={initialError} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* 1. Header & Privacy Banner */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 text-teal-800 dark:text-teal-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Client-Side Causal Targeting Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">
              Campaign Planner
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Upload your customer list to score individuals by true incremental uplift using our highest-performing
              X-Learner model. Group your audience into estimated causal segments and generate a profit-maximizing
              contact plan.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>
                <strong>100% Private:</strong> Runs strictly in your browser.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Drag & Drop Upload Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 rounded-xl p-8 text-center transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center text-teal-700 dark:text-teal-400 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                Drop your customer CSV here, or{" "}
                <span className="text-teal-700 dark:text-teal-400 underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Required columns: <code className="font-mono text-xs">recency</code>,{" "}
                <code className="font-mono text-xs">history</code>, <code className="font-mono text-xs">mens</code>,{" "}
                <code className="font-mono text-xs">womens</code>, <code className="font-mono text-xs">zip_code</code>,{" "}
                <code className="font-mono text-xs">newbie</code>, <code className="font-mono text-xs">channel</code>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLoadSampleData();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Try with sample data (500 customers)
              </button>

              {fileName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileName(null);
                    setScoredCustomers([]);
                    setValidationResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-4 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 flex items-center justify-center gap-3 text-sm text-teal-800 dark:text-teal-300">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Processing customer list and executing X-Learner matrix scoring...</span>
          </div>
        )}

        {/* Validation Issues / Diagnostic Box */}
        {validationResult && !validationResult.valid && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Validation failed for &apos;{fileName}&apos;</span>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-400">
              Found {validationResult.issues.length} issue(s) preventing model execution:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
              {validationResult.issues.map((iss, i) => (
                <div key={i} className="text-xs font-mono text-rose-900 dark:text-rose-200 bg-white/70 dark:bg-rose-950/60 p-1.5 rounded">
                  Row {iss.row}: Column <span className="font-bold">{iss.column}</span> — {iss.reason} (value: {String(iss.value)})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success / Status Summary */}
        {scoredCustomers && scoredCustomers.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>{fileName}:</strong> {formatNumber(scoredCustomers.length)} customers successfully scored in{" "}
                  {processingTimeMs ?? 0}ms.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Ranked CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Campaign Brief
                </button>
              </div>
            </div>

            {activeScenario && (
              <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 flex items-start gap-2 text-xs text-teal-900 dark:text-teal-200">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Campaign Scenario Focus:</strong> {activeScenario}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 5 Real Experiment Sample Datasets */}
        {manifest.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Explore 5 Real Experiment Cohorts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sampled directly from Kevin Hillstrom&apos;s RCT test split. Test real-world cohorts with 1 click or download the CSVs.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 self-start sm:self-auto">
                Zero Leakage · Real RCT Data
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {manifest.map((item) => {
                const isCurrent = selectedSampleId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isCurrent
                        ? "bg-teal-50/70 dark:bg-teal-950/40 border-teal-500 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                          {item.badge}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
                          {formatNumber(item.rows)} rows
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </h4>
                      <p className="text-[11px] font-mono text-teal-700 dark:text-teal-400 mt-0.5">
                        {item.tagline}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleLoadSampleDataset(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                          isCurrent
                            ? "bg-teal-700 text-white hover:bg-teal-800"
                            : "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {isCurrent ? "Active Dataset" : "Load & Score"}
                      </button>
                      <a
                        href={item.url}
                        download={item.filename}
                        title={`Download raw ${item.filename}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        CSV
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Planning Workspace */}
      {scoredCustomers && scoredCustomers.length > 0 && (
        <>
          {/* Recommendation & Business Economics Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Unit Economics Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Economic Assumptions
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your margins to scale the profit-optimal targeting cutoff.
                </p>
              </div>

              {/* Margin Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Contribution Margin</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 tabular">
                    {formatPercent(margin, 0)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.60"
                  step="0.05"
                  value={margin}
                  onChange={(e) => setMargin(parseFloat(e.target.value))}
                  className="w-full accent-teal-700 dark:accent-teal-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>5%</span>
                  <span>60%</span>
                </div>
              </div>

              {/* Cost Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Cost per Contact</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 tabular">
                    {formatCurrency(cost, 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.60"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(parseFloat(e.target.value))}
                  className="w-full accent-teal-700 dark:accent-teal-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>$0.00</span>
                  <span>$0.60</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                Breakeven contact cost for this campaign:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatCurrency(recommendation?.breakEvenCost || 0, 3)}
                </strong>
              </div>
            </div>

            {/* Right: Recommendation Verdict */}
            <div className="lg:col-span-2 bg-linear-to-br from-teal-50/70 via-white to-slate-50 dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl border border-teal-200 dark:border-teal-800/80 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-bold uppercase tracking-wider">
                  Targeting Recommendation
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white leading-tight">
                  {recommendation?.isNoCampaign ? (
                    "Do Not Launch: Contact Costs Exceed Predicted Gross Lift"
                  ) : (
                    <>
                      Contact the top{" "}
                      <span className="text-teal-700 dark:text-teal-400">
                        {formatPercent(recommendation?.bestFraction || 0, 0)}
                      </span>{" "}
                      of your list ({formatNumber(recommendation?.targetCount || 0)} customers)
                    </>
                  )}
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {recommendation?.isNoCampaign
                    ? "At current unit economics, incremental gross merchandise revenue cannot cover the campaign costs. Consider improving campaign creative, targeting only ultra-high persuadables, or reducing email delivery overhead."
                    : `Based on the X-Learner uplift curve, contacting ${formatNumber(
                        recommendation?.targetCount || 0
                      )} customers maximizes net contribution profit after subtracting contact costs. Suppressing the remaining ${(
                        (1 - (recommendation?.bestFraction || 0)) *
                        100
                      ).toFixed(0)}% prevents wasting budget on non-responders and sure things.`}
                </p>
              </div>

              {/* Projected KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Projected Net Profit
                  </span>
                  <p className="text-xl font-bold font-serif text-teal-700 dark:text-teal-400 tabular mt-0.5">
                    {formatCurrency(recommendation?.bestProfit || 0, 2)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Incremental Revenue
                  </span>
                  <p className="text-xl font-bold font-serif text-slate-900 dark:text-white tabular mt-0.5">
                    {formatCurrency(recommendation?.revenueIncremental || 0, 2)}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Total Campaign Cost
                  </span>
                  <p className="text-xl font-bold font-serif text-slate-900 dark:text-white tabular mt-0.5">
                    {formatCurrency(recommendation?.campaignCost || 0, 2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Estimated Customer Segments */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  Estimated Causal Segmentation Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Audience partitioned into the four behavioral response quadrants based on predicted uplift and baseline purchase probability.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500">
                Total: {formatNumber(segmentStats?.total || 0)} customers
              </div>
            </div>

            {/* Segment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(SEGMENT_CONFIG) as CustomerSegment[]).map((segKey) => {
                const conf = SEGMENT_CONFIG[segKey];
                const count = segmentStats?.counts[segKey] || 0;
                const pct = segmentStats?.percentages[segKey] || 0;

                return (
                  <div
                    key={segKey}
                    className={`rounded-xl border ${conf.border} ${conf.bg} ${conf.darkBg} p-4 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {conf.label}
                        </span>
                        <span className="text-xs font-bold tabular text-slate-600 dark:text-slate-400">
                          {formatPercent(pct, 1)}
                        </span>
                      </div>
                      <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white tabular mt-2">
                        {formatNumber(count)}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {conf.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] font-semibold flex items-center justify-between">
                      <span className="text-slate-500">Action:</span>
                      <span style={{ color: conf.color }} className="font-bold">
                        {conf.action}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Segment Bar Chart */}
            <div className="h-44 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segmentStats?.chartData || []} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    formatter={(val) => [formatNumber(val as number) + " customers", "Volume"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.5rem", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {segmentStats?.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Methodological Disclosure:</strong> Causal segments are statistical model estimates computed from
              predicted uplift (&tau;) and baseline response probability (&mu;&#8320;). In the real world, individual counterfactuals
              cannot be directly observed.
            </div>
          </div>

          {/* 5. Naive vs Uplift Overlap (Stretch Goal) */}
          {overlapAnalysis && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                  <Layers className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-slate-900 dark:text-white">
                  Why Causal Targeting Beats Naive Propensity: The Top 20% Overlap
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 text-sm text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    A standard propensity/response model picks customers with high baseline purchase rates (Sure Things).
                    Comparing the top 20% ({formatNumber(overlapAnalysis.kCount)} customers) selected by **Naive Propensity** versus{" "}
                    **Causal Uplift**:
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Only {overlapAnalysis.overlapPct.toFixed(1)}% of targets overlap ({formatNumber(overlapAnalysis.overlapCount)} customers).
                  </p>
                  <p className="text-xs text-slate-500">
                    The naive model targets {formatNumber(overlapAnalysis.disjointCount)} customers who would have visited anyway. Causal
                    uplift targeting swaps them for genuine Persuadables who generate incremental revenue.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    Disjoint Targets Replaced
                  </span>
                  <p className="text-3xl font-serif font-bold text-teal-700 dark:text-teal-400 tabular">
                    {formatNumber(overlapAnalysis.disjointCount)}
                  </p>
                  <span className="text-xs text-slate-500">
                    {((overlapAnalysis.disjointCount / overlapAnalysis.kCount) * 100).toFixed(0)}% budget redirected from Sure Things
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Ranked Customer Contact Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  Ranked Customer Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customers ranked from highest predicted uplift to lowest. Contact cutoff set at Rank{" "}
                  <strong>{formatNumber(recommendation?.targetCount || 0)}</strong>.
                </p>
              </div>

              {/* Table Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ID, channel..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                <select
                  value={selectedSegmentFilter}
                  onChange={(e) => {
                    setSelectedSegmentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300"
                >
                  <option value="ALL">All Segments ({scoredCustomers.length})</option>
                  <option value="Persuadables">Persuadables only</option>
                  <option value="Sure Things">Sure Things only</option>
                  <option value="Lost Causes">Lost Causes only</option>
                  <option value="Sleeping Dogs">Sleeping Dogs only</option>
                </select>

                <button
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Rank</th>
                    <th className="py-3 px-3 font-semibold">Customer ID</th>
                    <th className="py-3 px-3 font-semibold">Action</th>
                    <th className="py-3 px-3 font-semibold">Segment</th>
                    <th className="py-3 px-3 font-semibold text-right">Predicted Uplift</th>
                    <th className="py-3 px-3 font-semibold text-right">Baseline Prob (&mu;₀)</th>
                    <th className="py-3 px-3 font-semibold text-right">Past Spend</th>
                    <th className="py-3 px-3 font-semibold">Recency</th>
                    <th className="py-3 px-3 font-semibold">Channel</th>
                    <th className="py-3 px-3 font-semibold">Zip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {pagedCustomers.map((cust) => {
                    const isTarget = recommendation ? cust.rank <= recommendation.targetCount : false;
                    const segConf = SEGMENT_CONFIG[cust.segment];

                    return (
                      <tr
                        key={cust.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isTarget ? "bg-teal-50/20 dark:bg-teal-950/10" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white tabular">
                          #{cust.rank}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 tabular">Row {cust.id}</td>
                        <td className="py-2.5 px-3 font-sans">
                          {isTarget ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                              TARGET
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              SUPPRESS
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ color: segConf.color, backgroundColor: `${segConf.color}15` }}
                          >
                            {cust.segment}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-700 dark:text-teal-400 tabular">
                          {cust.uplift > 0 ? "+" : ""}
                          {(cust.uplift * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 tabular">
                          {(cust.mu0Prob * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right tabular text-slate-700 dark:text-slate-300">
                          ${Number(cust.raw.history).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 tabular text-slate-600 dark:text-slate-400">
                          {cust.raw.recency} mo
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {String(cust.raw.channel)}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {String(cust.raw.zip_code)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredCustomers.length)} of{" "}
                {formatNumber(filteredCustomers.length)} entries
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono tabular">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 7. Printable Campaign Brief Section (styled with @media print) */}
          <div className="hidden print:block p-8 bg-white text-black space-y-6">
            <div className="border-b-2 border-black pb-4">
              <h1 className="text-2xl font-bold font-serif uppercase tracking-wider">
                Targeting Campaign Plan & Executive Brief
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Generated via X-Learner Causal Machine Learning Engine &bull; Cohort: {fileName}
                {activeScenario && ` — Focus: ${activeScenario}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <strong>Total Customers Analyzed:</strong> {formatNumber(scoredCustomers.length)}
              </div>
              <div>
                <strong>Recommended Cutoff:</strong> Top{" "}
                {formatPercent(recommendation?.bestFraction || 0, 0)} ({formatNumber(recommendation?.targetCount || 0)} customers)
              </div>
              <div>
                <strong>Contribution Margin:</strong> {formatPercent(margin, 0)}
              </div>
              <div>
                <strong>Cost per Contact:</strong> {formatCurrency(cost, 2)}
              </div>
              <div>
                <strong>Projected Net Contribution Profit:</strong> {formatCurrency(recommendation?.bestProfit || 0, 2)}
              </div>
              <div>
                <strong>Breakeven Cost:</strong> {formatCurrency(recommendation?.breakEvenCost || 0, 3)}
              </div>
            </div>

            <div className="border-t border-slate-300 pt-4">
              <h2 className="text-sm font-bold uppercase mb-2">Causal Segmentation</h2>
              <ul className="text-xs space-y-1">
                {segmentStats && (
                  <>
                    <li>Persuadables (Target Priority): {formatNumber(segmentStats.counts.Persuadables)} ({formatPercent(segmentStats.percentages.Persuadables, 1)})</li>
                    <li>Sure Things (Suppress to save budget): {formatNumber(segmentStats.counts["Sure Things"])} ({formatPercent(segmentStats.percentages["Sure Things"], 1)})</li>
                    <li>Lost Causes (Do Not Target): {formatNumber(segmentStats.counts["Lost Causes"])} ({formatPercent(segmentStats.percentages["Lost Causes"], 1)})</li>
                    <li>Sleeping Dogs (Strictly Suppress): {formatNumber(segmentStats.counts["Sleeping Dogs"])} ({formatPercent(segmentStats.percentages["Sleeping Dogs"], 1)})</li>
                  </>
                )}
              </ul>
            </div>

            <div className="border-t border-slate-300 pt-4 text-[10px] text-slate-500 leading-normal">
              <strong>Caveats:</strong> Statistical estimates trained on the Kevin Hillstrom MineThatData 2008 retail RCT. Margin and cost are assumptions. Differences between uplift and naive baselines are within split-to-split variation (Holm-adjusted p = 0.109).
            </div>
          </div>

          {/* 8. Honest Limitations Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
              <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Scientific Limitations & Business Caveats</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <li>
                <strong>Single Experiment Domain:</strong> Model weights were derived from Kevin Hillstrom&apos;s 2008 apparel e-mail analytics randomized controlled trial. If your customers or product category behave differently, consider calibrating on your own A/B trial.
              </li>
              <li>
                <strong>Statistical Power & Variation:</strong> While X-Learner achieved the top mean Qini score (64.78 vs 35.96 for naive response model), the difference was not statistically significant after Nadeau-Bengio resampled split correction and Holm adjustment (Holm-adjusted p = 0.109). Differences fall within split-to-split variation.
              </li>
              <li>
                <strong>Assumed Economics:</strong> Contribution margins and contact costs are user-specified assumptions. Validate actual merchant processing fees, fulfillment costs, and unsubscribe churn with your finance team.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
