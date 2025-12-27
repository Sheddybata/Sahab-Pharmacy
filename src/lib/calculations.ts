// Business logic calculations
import { StockBatch, SaleItem } from './types';
import {
  fetchStockBatches,
  fetchStockBatchesByProduct,
  fetchStockMovements,
  fetchStockMovementsByProduct,
  updateStockBatch,
} from '@/services/stock';
import { fetchSales } from '@/services/sales';
import { fetchActiveProducts } from '@/services/products';

export interface CurrentStock {
  productId: string;
  quantity: number;
  batches: StockBatch[];
}

/**
 * Calculate current stock for a product from stock movements (async version using Supabase)
 */
export const calculateCurrentStockAsync = async (productId: string): Promise<CurrentStock> => {
  const [movements, batches] = await Promise.all([
    fetchStockMovementsByProduct(productId),
    fetchStockBatchesByProduct(productId),
  ]);

  // Calculate total quantity from movements
  const quantity = movements.reduce((sum, movement) => {
    return sum + movement.quantity;
  }, 0);

  return {
    productId,
    quantity: Math.max(0, quantity),
    batches,
  };
};

/**
 * Get FIFO batches for a product (oldest expiry first) - async version using Supabase
 */
export const getFIFOBatchesAsync = async (productId: string): Promise<StockBatch[]> => {
  const batches = await fetchStockBatchesByProduct(productId);
  return batches
    .filter(b => b.remainingQuantity > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
};

/**
 * Deduct stock using FIFO for a sale
 */
export interface StockDeduction {
  batchId: string;
  quantity: number;
  costPrice: number;
}

export interface DeductStockResult {
  success: boolean;
  deductions: StockDeduction[];
  error?: string;
}

/**
 * Deduct stock using FIFO for a sale - async version using Supabase
 */
export const deductStockFIFOAsync = async (
  productId: string,
  quantity: number
): Promise<DeductStockResult> => {
  const batches = await getFIFOBatchesAsync(productId);
  const deductions: StockDeduction[] = [];
  const updatedBatches: Array<{ batch: StockBatch; newQuantity: number }> = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deductAmount = Math.min(remaining, batch.remainingQuantity);
    deductions.push({
      batchId: batch.id,
      quantity: deductAmount,
      costPrice: batch.costPrice,
    });

    // Track updated batches for persistence after validation
    updatedBatches.push({
      batch,
      newQuantity: batch.remainingQuantity - deductAmount,
    });
    remaining -= deductAmount;
  }

  if (remaining > 0) {
    return {
      success: false,
      deductions: [],
      error: 'Insufficient stock available for sale.',
    };
  }

  // Update all batches in Supabase
  await Promise.all(
    updatedBatches.map(({ batch, newQuantity }) =>
      updateStockBatch(batch.id, { remainingQuantity: newQuantity })
    )
  );

  return {
    success: true,
    deductions,
  };
};

/**
 * Calculate COGS for sale items
 */
export const calculateCOGS = (items: SaleItem[]): number => {
  return items.reduce((sum, item) => {
    return sum + (item.quantity * item.costPrice);
  }, 0);
};

/**
 * Calculate profit margin
 */
export const calculateProfitMargin = (revenue: number, cogs: number): number => {
  if (revenue === 0) return 0;
  return ((revenue - cogs) / revenue) * 100;
};

/**
 * Check if product is expired
 */
export const isExpired = (expiryDate: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return expiry < today;
};

/**
 * Check if product is expiring soon (within threshold days)
 */
export const isExpiringSoon = (expiryDate: string, thresholdDays: number = 90): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry >= 0 && daysUntilExpiry <= thresholdDays;
};

/**
 * Get days until expiry
 */
export const getDaysUntilExpiry = (expiryDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Calculate sales metrics - async version using Supabase
 */
export const calculateSalesMetricsAsync = async (startDate?: Date, endDate?: Date): Promise<{
  revenue: number;
  salesCount: number;
  cogs: number;
  profit: number;
  profitMargin: number;
}> => {
  const sales = await fetchSales({
    startDate,
    endDate,
    refunded: false,
  });

  const revenue = sales.reduce((sum, s) => sum + s.total, 0);
  const salesCount = sales.length;
  const cogs = sales.reduce((sum, s) => {
    const itemCOGS = s.items.reduce((itemSum, item) => {
      return itemSum + (item.quantity * item.costPrice);
    }, 0);
    return sum + itemCOGS;
  }, 0);
  const profit = revenue - cogs;
  const profitMargin = calculateProfitMargin(revenue, cogs);

  return {
    revenue,
    salesCount,
    cogs,
    profit,
    profitMargin,
  };
};

/**
 * Get top selling products - async version using Supabase
 */
export const getTopSellingProductsAsync = async (limit: number = 10): Promise<Array<{
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}>> => {
  const [sales, products] = await Promise.all([
    fetchSales({ refunded: false }),
    fetchActiveProducts(),
  ]);

  const productMap = new Map<string, { quantitySold: number; revenue: number }>();

  sales.forEach(sale => {
    sale.items.forEach(item => {
      const existing = productMap.get(item.productId) || { quantitySold: 0, revenue: 0 };
      productMap.set(item.productId, {
        quantitySold: existing.quantitySold + item.quantity,
        revenue: existing.revenue + item.total,
      });
    });
  });

  return Array.from(productMap.entries())
    .map(([productId, stats]) => {
      const product = products.find(p => p.id === productId);
      return {
        productId,
        productName: product?.name || 'Unknown Product',
        quantitySold: stats.quantitySold,
        revenue: stats.revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

/**
 * Calculate inventory stats - async version using Supabase
 */
export const calculateInventoryStatsAsync = async (): Promise<{
  totalProducts: number;
  totalValue: number;
  totalCostValue: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  todaySales: number;
  monthlySales: number;
  todayRevenue: number;
  monthlyRevenue: number;
}> => {
  const [products, stockBatches, stockMovements] = await Promise.all([
    fetchActiveProducts(),
    fetchStockBatches(),
    fetchStockMovements(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const totalProducts = products.length;
  // totalValue should match Inventory List export: current stock (from movements) × selling price (retail value)
  let totalValue = 0;
  // totalCostValue is kept for reference: batch remainingQuantity × costPrice (cost valuation)
  let totalCostValue = 0;
  let lowStockCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;

  const movementsByProduct = new Map<string, number>();
  stockMovements.forEach((movement) => {
    const current = movementsByProduct.get(movement.productId) ?? 0;
    movementsByProduct.set(movement.productId, current + movement.quantity);
  });

  // Deduplicate batches by ID to prevent counting same batch multiple times
  const uniqueBatchesMap = new Map<string, StockBatch>();
  stockBatches.forEach((batch) => {
    if (!uniqueBatchesMap.has(batch.id)) {
      uniqueBatchesMap.set(batch.id, batch);
    }
  });
  const uniqueBatches = Array.from(uniqueBatchesMap.values());

  const batchesByProduct = new Map<string, StockBatch[]>();
  uniqueBatches.forEach((batch) => {
    const list = batchesByProduct.get(batch.productId) ?? [];
    list.push(batch);
    batchesByProduct.set(batch.productId, list);
  });

  products.forEach((product) => {
    const quantity = Math.max(0, movementsByProduct.get(product.id) ?? 0);
    const batches = (batchesByProduct.get(product.id) ?? [])
      .filter((batch) => batch.remainingQuantity > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    // Retail value (matches InventoryList export calculation)
    const retailValue = quantity * product.sellingPrice;
    if (isFinite(retailValue) && retailValue >= 0) {
      totalValue += retailValue;
    }

    if (quantity <= product.reorderPoint) {
      lowStockCount++;
    }

    if (batches.length > 0) {
      // Calculate total value directly from batches' remaining quantity and cost price
      // Include ALL batches with stock, regardless of expiry status
      const validBatches = batches.filter((batch) => {
        // Must have positive remaining quantity
        if (batch.remainingQuantity <= 0) return false;
        // Must have valid cost price
        if (!batch.costPrice || batch.costPrice <= 0) return false;
        // Include all batches with stock (including expired) for inventory value
        return true;
      });
      
      const totalCost = validBatches.reduce((sum, batch) => {
        const batchValue = batch.remainingQuantity * batch.costPrice;
        // Additional safety check for NaN or Infinity
        if (!isFinite(batchValue) || batchValue < 0) return sum;
        return sum + batchValue;
      }, 0);
      
      // Only add if the value is valid
      if (isFinite(totalCost) && totalCost >= 0) {
        totalCostValue += totalCost;
      }
    }

    batches.forEach((batch) => {
      const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);
      if (daysUntilExpiry < 0) {
        expiredCount++;
      } else if (daysUntilExpiry <= 90) {
        expiringCount++;
      }
    });
  });

  const [todayMetrics, monthlyMetrics] = await Promise.all([
    calculateSalesMetricsAsync(today),
    calculateSalesMetricsAsync(firstDayOfMonth),
  ]);

  return {
    totalProducts,
    totalValue,
    totalCostValue,
    lowStockCount,
    expiringCount,
    expiredCount,
    todaySales: todayMetrics.salesCount,
    monthlySales: monthlyMetrics.salesCount,
    todayRevenue: todayMetrics.revenue,
    monthlyRevenue: monthlyMetrics.revenue,
  };
};



