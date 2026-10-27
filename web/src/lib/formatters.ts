/**
 * Formatting utilities for numbers, currencies, and percentages
 */

export function formatCurrency(
  value: number,
  fractionDigits: number = 2
): string {
  if (isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(
  value: number,
  fractionDigits: number = 2
): string {
  if (isNaN(value)) return "0.00%";
  return (value * 100).toFixed(fractionDigits) + "%";
}

export function formatNumber(
  value: number,
  fractionDigits: number = 0
): string {
  if (isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
