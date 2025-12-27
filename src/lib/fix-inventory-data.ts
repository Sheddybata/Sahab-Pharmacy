import { fetchStockBatches, updateStockBatch } from '@/services/stock';
import { StockBatch } from './types';

export interface FixResult {
  batchesFixed: number;
  totalValueReduction: number;
  fixedBatches: Array<{
    batchId: string;
    batchNumber: string;
    productId: string;
    oldCostPrice: number;
    newCostPrice: number;
    quantity: number;
    oldValue: number;
    newValue: number;
  }>;
  errors: string[];
}

/**
 * Fix batches where cost_price appears to be stored as total value instead of per-unit price
 * This assumes cost_price = total_value / remaining_quantity
 */
export async function fixBatchesWithIncorrectCostPrice(threshold: number = 10000): Promise<FixResult> {
  const result: FixResult = {
    batchesFixed: 0,
    totalValueReduction: 0,
    fixedBatches: [],
    errors: [],
  };

  try {
    const allBatches = await fetchStockBatches();
    
    // Find batches with unusually high cost prices that might be total values
    const problematicBatches = allBatches.filter((batch) => {
      if (batch.remainingQuantity <= 0) return false;
      if (batch.costPrice <= threshold) return false;
      
      // If cost_price * remaining_quantity gives a value > 1M, it's likely wrong
      const currentValue = batch.remainingQuantity * batch.costPrice;
      return currentValue > 1000000; // Over 1 million
    });

    for (const batch of problematicBatches) {
      try {
        // If cost_price is stored as total value instead of per-unit, divide by quantity
        // This is a common data entry error
        const currentValue = batch.remainingQuantity * batch.costPrice;
        const suggestedPerUnitPrice = batch.costPrice / batch.remainingQuantity;
        
        result.fixedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          productId: batch.productId,
          oldCostPrice: batch.costPrice,
          newCostPrice: suggestedPerUnitPrice,
          quantity: batch.remainingQuantity,
          oldValue: currentValue,
          newValue: batch.remainingQuantity * suggestedPerUnitPrice,
        });
      } catch (error) {
        result.errors.push(`Error processing batch ${batch.id}: ${(error as Error).message}`);
      }
    }

    result.batchesFixed = result.fixedBatches.length;
    
    return result;
  } catch (error) {
    result.errors.push(`Failed to fetch batches: ${(error as Error).message}`);
    return result;
  }
}

/**
 * Get a list of batches that likely have incorrect data
 */
export async function getProblematicBatches(): Promise<Array<{
  batch: StockBatch;
  issue: string;
  currentValue: number;
  suggestedFix?: {
    field: 'costPrice' | 'remainingQuantity';
    oldValue: number;
    newValue: number;
    reason: string;
  };
}>> {
  const allBatches = await fetchStockBatches();
  const problematic: Array<{
    batch: StockBatch;
    issue: string;
    currentValue: number;
    suggestedFix?: {
      field: 'costPrice' | 'remainingQuantity';
      oldValue: number;
      newValue: number;
      reason: string;
    };
  }> = [];

  allBatches.forEach((batch) => {
    if (batch.remainingQuantity <= 0) return;
    
    const currentValue = batch.remainingQuantity * batch.costPrice;
    
    // Flag batches with values over 1 million
    if (currentValue > 1000000) {
      // Calculate what per-unit would be if cost_price is total pack cost
      const calculatedPerUnit = batch.costPrice / batch.remainingQuantity;
      
      // Suggest fix if calculated per-unit seems reasonable (between 0.01 and 100,000)
      const suggestedFix = (calculatedPerUnit >= 0.01 && calculatedPerUnit <= 100000) ? {
        field: 'costPrice' as const,
        oldValue: batch.costPrice,
        newValue: calculatedPerUnit,
        reason: `cost_price (${batch.costPrice.toLocaleString()}) appears to be total pack cost. Dividing by quantity (${batch.remainingQuantity}) gives per-unit cost of ${calculatedPerUnit.toLocaleString()} NGN.`,
      } : undefined;
      
      problematic.push({
        batch,
        currentValue,
        issue: `Batch value is ${currentValue.toLocaleString()} NGN - cost_price may be stored as total pack cost instead of per-unit price`,
        suggestedFix,
      });
    }
  });

  return problematic.sort((a, b) => b.currentValue - a.currentValue);
}

