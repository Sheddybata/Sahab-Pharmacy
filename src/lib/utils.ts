import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Nigerian Naira currency
 */
export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format a number as Nigerian Naira currency without decimal places
 */
export function formatCurrencyWhole(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`
}
