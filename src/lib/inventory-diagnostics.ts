import { fetchActiveProducts } from '@/services/products';
import { fetchStockBatches } from '@/services/stock';
import { StockBatch, Product } from './types';

export interface DiagnosticResult {
  totalBatches: number;
  uniqueBatches: number;
  duplicateBatches: Array<{ batchId: string; productId: string; count: number }>;
  batchesWithInvalidCostPrice: Array<{ batchId: string; productId: string; costPrice: number }>;
  batchesWithInvalidQuantity: Array<{ batchId: string; productId: string; remainingQuantity: number }>;
  batchesByProduct: Map<string, number>;
  totalValue: number;
  totalValueByProduct: Map<string, number>;
  potentialIssues: string[];
  sampleData: Array<{
    batchId: string;
    productId: string;
    productName: string;
    batchNumber: string;
    remainingQuantity: number;
    costPrice: number;
    batchValue: number;
  }>;
}

/**
 * Run diagnostics on inventory data to identify potential issues
 */
export async function diagnoseInventoryData(): Promise<DiagnosticResult> {
  const [products, allBatches] = await Promise.all([
    fetchActiveProducts(),
    fetchStockBatches(),
  ]);

  const productsMap = new Map<string, Product>();
  products.forEach((p) => productsMap.set(p.id, p));

  const result: DiagnosticResult = {
    totalBatches: allBatches.length,
    uniqueBatches: 0,
    duplicateBatches: [],
    batchesWithInvalidCostPrice: [],
    batchesWithInvalidQuantity: [],
    batchesByProduct: new Map(),
    totalValue: 0,
    totalValueByProduct: new Map(),
    potentialIssues: [],
    sampleData: [],
  };

  // Check for duplicate batches
  const batchCounts = new Map<string, { count: number; productId: string }>();
  allBatches.forEach((batch) => {
    const existing = batchCounts.get(batch.id);
    if (existing) {
      existing.count++;
    } else {
      batchCounts.set(batch.id, { count: 1, productId: batch.productId });
    }
  });

  batchCounts.forEach((info, batchId) => {
    if (info.count > 1) {
      result.duplicateBatches.push({
        batchId,
        productId: info.productId,
        count: info.count,
      });
    }
  });

  // Get unique batches
  const uniqueBatchesMap = new Map<string, StockBatch>();
  allBatches.forEach((batch) => {
    if (!uniqueBatchesMap.has(batch.id)) {
      uniqueBatchesMap.set(batch.id, batch);
    }
  });
  result.uniqueBatches = uniqueBatchesMap.size;

  // Check for invalid cost prices and quantities
  const validBatches: StockBatch[] = [];
  uniqueBatchesMap.forEach((batch) => {
    if (!batch.costPrice || batch.costPrice <= 0) {
      result.batchesWithInvalidCostPrice.push({
        batchId: batch.id,
        productId: batch.productId,
        costPrice: batch.costPrice,
      });
    } else if (batch.remainingQuantity <= 0) {
      result.batchesWithInvalidQuantity.push({
        batchId: batch.id,
        productId: batch.productId,
        remainingQuantity: batch.remainingQuantity,
      });
    } else {
      validBatches.push(batch);
    }
  });

  // Count batches by product
  validBatches.forEach((batch) => {
    const count = result.batchesByProduct.get(batch.productId) || 0;
    result.batchesByProduct.set(batch.productId, count + 1);
  });

  // Calculate values
  validBatches.forEach((batch) => {
    const batchValue = batch.remainingQuantity * batch.costPrice;
    result.totalValue += batchValue;

    const productValue = result.totalValueByProduct.get(batch.productId) || 0;
    result.totalValueByProduct.set(batch.productId, productValue + batchValue);

    const product = productsMap.get(batch.productId);
    result.sampleData.push({
      batchId: batch.id,
      productId: batch.productId,
      productName: product?.name || 'Unknown',
      batchNumber: batch.batchNumber,
      remainingQuantity: batch.remainingQuantity,
      costPrice: batch.costPrice,
      batchValue: batchValue,
    });
  });

  // Sort sample data by value (highest first) to see most problematic items
  result.sampleData.sort((a, b) => b.batchValue - a.batchValue);

  // Identify potential issues
  if (result.duplicateBatches.length > 0) {
    result.potentialIssues.push(
      `Found ${result.duplicateBatches.length} duplicate batch IDs - batches are being counted multiple times`
    );
  }

  if (result.batchesWithInvalidCostPrice.length > 0) {
    result.potentialIssues.push(
      `Found ${result.batchesWithInvalidCostPrice.length} batches with invalid cost prices (zero or negative)`
    );
  }

  if (result.batchesWithInvalidQuantity.length > 0) {
    result.potentialIssues.push(
      `Found ${result.batchesWithInvalidQuantity.length} batches with invalid quantities (zero or negative)`
    );
  }

  // Check for unusually high values
  const topValues = result.sampleData.slice(0, 10);
  const hasUnusualValues = topValues.some((item) => item.batchValue > 1000000); // Over 1 million
  if (hasUnusualValues) {
    result.potentialIssues.push(
      'Found batches with unusually high values (>1M) - check if cost_price or remaining_quantity are stored correctly'
    );
  }

  return result;
}

