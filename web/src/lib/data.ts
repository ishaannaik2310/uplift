import { CustomersData, ProfitGridData, ResultsData } from "./types";

let cachedResults: ResultsData | null = null;
let cachedProfitGrid: ProfitGridData | null = null;
let cachedCustomers: CustomersData | null = null;

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
