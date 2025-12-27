import { fetchStockBatches, updateStockBatch } from '@/services/stock';
import { StockBatch } from './types';

const FIXED_BATCHES_KEY = 'inventory_cost_price_fixed';

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
    // Criteria: cost_price > 10,000 AND (cost_price * quantity) > 1,000,000
    const batchesToFix = allBatches.filter((batch) => {
      if (batch.remainingQuantity <= 0) return false;
      if (batch.costPrice <= 10000) return false; // Skip if cost_price is reasonable per-unit
      
      const currentValue = batch.remainingQuantity * batch.costPrice;
      // If the calculated value is over 1 million, it's likely wrong
      return currentValue > 1000000;
    });

    // Fix all problematic batches
    for (const batch of batchesToFix) {
      try {
        const newCostPrice = batch.costPrice / batch.remainingQuantity;
        
        // Only fix if the new cost price is reasonable (between 1 and 100,000 per unit)
        if (newCostPrice >= 1 && newCostPrice <= 100000) {
          await updateStockBatch(batch.id, { costPrice: newCostPrice });
          result.fixed++;
        } else {
          result.skipped++;
        }
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

