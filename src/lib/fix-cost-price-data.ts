import { fetchStockBatches, updateStockBatch } from '@/services/stock';
import { StockBatch } from './types';

const FIXED_BATCHES_KEY = 'inventory_cost_price_fixed_v3'; // Changed version to allow re-running with improved logic

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
    
    // Find batches that likely have cost_price stored as total value
    // Criteria: (cost_price * quantity) > 1,000,000 AND the calculated per-unit price seems reasonable
    const batchesToFix = allBatches.filter((batch) => {
      if (batch.remainingQuantity <= 0) return false;
      
      const currentValue = batch.remainingQuantity * batch.costPrice;
      
      // If the calculated value is over 1 million, check if it's likely wrong
      if (currentValue > 1000000) {
        // Calculate what per-unit price would be if cost_price is total pack cost
        const calculatedPerUnit = batch.costPrice / batch.remainingQuantity;
        
        // If the calculated per-unit is reasonable (between 0.01 and 100,000),
        // then cost_price is likely stored as total pack cost
        // This catches cases like: 2000 units × 3500 = 7M (should be 3500/2000 = 1.75 per unit)
        if (calculatedPerUnit >= 0.01 && calculatedPerUnit <= 100000) {
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

