import { fetchStockBatches, updateStockBatch } from '@/services/stock';
import { StockBatch } from './types';

const FIXED_BATCHES_KEY = 'inventory_cost_price_fixed_v4'; // Changed version to allow re-running with comprehensive fix

/**
 * Check if batches have already been fixed (one-time fix)
 */
function hasFixedBatches(): boolean {
  return localStorage.getItem(FIXED_BATCHES_KEY) === 'true';
}

function markAsFixed(): void {
  localStorage.setItem(FIXED_BATCHES_KEY, 'true');
}

/**
 * Reset the fix flag (for testing or re-running the fix)
 */
export function resetFixFlag(): void {
  localStorage.removeItem(FIXED_BATCHES_KEY);
}

/**
 * Automatically fix batches where cost_price appears to be stored as total pack cost
 * instead of per-unit cost. This runs once automatically.
 */
export async function autoFixCostPriceData(): Promise<{
  fixed: number;
  skipped: number;
  errors: string[];
}> {
  // Check if we've already fixed batches
  if (hasFixedBatches()) {
    return { fixed: 0, skipped: 0, errors: [] };
  }

  const result = {
    fixed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const allBatches = await fetchStockBatches();
    
    // Find ALL batches that likely have cost_price stored as total pack cost instead of per-unit
    // We fix batches where:
    // 1. cost_price > 100 (suspiciously high for a single unit in pharmacy inventory)
    // 2. AND dividing cost_price by quantity gives a reasonable per-unit price (0.01 to 100,000)
    // 3. This catches cases where cost_price was entered as pack cost
    const batchesToFix = allBatches.filter((batch) => {
      if (batch.remainingQuantity <= 0) return false;
      if (batch.costPrice <= 100) return false; // Skip very low cost prices (likely already per-unit)
      
      // Calculate what per-unit price would be if cost_price is total pack cost
      const calculatedPerUnit = batch.costPrice / batch.remainingQuantity;
      
      // If the calculated per-unit is reasonable (between 0.01 and 100,000 NGN per unit),
      // and the current cost_price seems too high for a single unit (> 100),
      // then cost_price is likely stored as total pack cost and should be fixed
      if (calculatedPerUnit >= 0.01 && calculatedPerUnit <= 100000) {
        // Fix if cost_price > 100 (seems high for per-unit) OR batch value > 100,000 (unusually high)
        const batchValue = batch.remainingQuantity * batch.costPrice;
        if (batch.costPrice > 100 || batchValue > 100000) {
          return true;
        }
      }
      
      return false;
    });

    // Fix all problematic batches
    for (const batch of batchesToFix) {
      try {
        const newCostPrice = batch.costPrice / batch.remainingQuantity;
        
        // Fix all batches that passed the filter (already validated that per-unit is reasonable)
        // The filter already ensures newCostPrice is between 0.01 and 100,000
        await updateStockBatch(batch.id, { costPrice: newCostPrice });
        result.fixed++;
      } catch (error) {
        result.errors.push(`Batch ${batch.batchNumber}: ${(error as Error).message}`);
      }
    }

    // Mark as fixed so we don't run this again
    if (result.fixed > 0) {
      markAsFixed();
    }

    return result;
  } catch (error) {
    result.errors.push(`Failed to fetch batches: ${(error as Error).message}`);
    return result;
  }
}

