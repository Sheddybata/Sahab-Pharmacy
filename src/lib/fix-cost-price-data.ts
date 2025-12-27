import { fetchStockBatches, updateStockBatch } from '@/services/stock';
import { StockBatch } from './types';
import { supabase } from './supabaseClient';

const FIXED_BATCHES_KEY = 'inventory_cost_price_fixed_v5'; // More conservative fix - only clearly wrong batches (> 500K value)
// NOTE: Previous auto-fix (v4) was too aggressive and may have incorrectly fixed valid batches
// This version only fixes batches with clearly wrong values (> 500K batch value)

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
    // Fetch ALL batches directly from database (including those with 0 quantity) 
    // to analyze all data, not just active batches
    const { data: batchData, error: batchError } = await supabase
      .from('stock_batches')
      .select('*');
    
    if (batchError) {
      throw new Error(`Failed to fetch batches: ${batchError.message}`);
    }
    
    const allBatches = (batchData ?? []).map((record: any) => ({
      id: record.id,
      productId: record.product_id,
      batchNumber: record.batch_number,
      expiryDate: record.expiry_date,
      costPrice: Number(record.cost_price ?? 0),
      supplier: record.supplier ?? undefined,
      receivedDate: record.received_date,
      remainingQuantity: record.remaining_quantity ?? 0,
      createdAt: record.created_at ?? new Date().toISOString(),
    }));
    
    // Only fix batches with CLEARLY wrong values - batches where the total value is unusually high
    // We fix batches where:
    // 1. The batch value (cost_price * quantity) is > 500,000 NGN (clearly wrong)
    // 2. AND dividing cost_price by quantity gives a reasonable per-unit price (0.01 to 10,000)
    // 3. This only catches cases where cost_price was clearly entered as pack cost (very high values)
    const batchesToFix = allBatches.filter((batch) => {
      if (batch.remainingQuantity <= 0) return false;
      
      const batchValue = batch.remainingQuantity * batch.costPrice;
      
      // Only fix if batch value is clearly wrong (> 500,000 NGN)
      // This is conservative - we only fix obvious mistakes, not borderline cases
      if (batchValue > 500000) {
        // Calculate what per-unit price would be if cost_price is total pack cost
        const calculatedPerUnit = batch.costPrice / batch.remainingQuantity;
        
        // If the calculated per-unit is reasonable (between 0.01 and 10,000 NGN per unit),
        // then cost_price is likely stored as total pack cost
        if (calculatedPerUnit >= 0.01 && calculatedPerUnit <= 10000) {
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

