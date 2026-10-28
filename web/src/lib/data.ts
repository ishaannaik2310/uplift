import { CustomersData, ProfitGridData, ResultsData } from "./types";
import { XLearnerParams } from "./xlearner";

let cachedResults: ResultsData | null = null;
let cachedProfitGrid: ProfitGridData | null = null;
let cachedCustomers: CustomersData | null = null;
let cachedXLearnerParams: XLearnerParams | null = null;

export async function fetchResultsData(): Promise<ResultsData> {
  if (cachedResults) return cachedResults;
  const res = await fetch("/data/results.json");
  if (!res.ok) {
    throw new Error(`Failed to load results.json: HTTP ${res.status}`);
  }
  cachedResults = await res.json();
  return cachedResults as ResultsData;
}

export async function fetchProfitGridData(): Promise<ProfitGridData> {
  if (cachedProfitGrid) return cachedProfitGrid;
  const res = await fetch("/data/profit_grid.json");
  if (!res.ok) {
    throw new Error(`Failed to load profit_grid.json: HTTP ${res.status}`);
  }
  cachedProfitGrid = await res.json();
  return cachedProfitGrid as ProfitGridData;
}

export async function fetchCustomersData(): Promise<CustomersData> {
  if (cachedCustomers) return cachedCustomers;
  const res = await fetch("/data/customers.json");
  if (!res.ok) {
    throw new Error(`Failed to load customers.json: HTTP ${res.status}`);
  }
  cachedCustomers = await res.json();
  return cachedCustomers as CustomersData;
}

export async function fetchXLearnerParams(): Promise<XLearnerParams> {
  if (cachedXLearnerParams) return cachedXLearnerParams;
  const res = await fetch("/data/xlearner_params.json");
  if (!res.ok) {
    throw new Error(`Failed to load xlearner_params.json: HTTP ${res.status}`);
  }
  cachedXLearnerParams = await res.json();
  return cachedXLearnerParams as XLearnerParams;
}

export async function fetchSampleCustomersCsv(): Promise<string> {
  const res = await fetch("/data/sample_customers.csv");
  if (!res.ok) {
    throw new Error(`Failed to load sample_customers.csv: HTTP ${res.status}`);
  }
  return await res.text();
}

