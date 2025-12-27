import { supabase } from '@/lib/supabaseClient';
import { StockBatch, StockMovement } from '@/lib/types';

export interface StockBatchInsert {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  costPrice: number;
  supplier?: string;
  receivedDate?: string;
  remainingQuantity: number;
}

export interface StockMovementInsert {
  productId: string;
  batchId?: string;
  type: StockMovement['type'];
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
  reason?: string;
  reference?: string;
  userId?: string;
}

export async function fetchStockBatches(): Promise<StockBatch[]> {
  // Only fetch batches with remaining quantity > 0 for inventory calculations
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*')
    .gt('remaining_quantity', 0) // Only get batches with stock remaining
    .order('expiry_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load stock batches: ${error.message}`);
  }

  return (data ?? []).map<StockBatch>((record) => ({
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
}

export async function fetchStockBatchesByProduct(productId: string): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('product_id', productId)
    .gt('remaining_quantity', 0)
    .order('expiry_date', { ascending: true });

  if (error) {
    console.error(`Error fetching stock batches for product ${productId}:`, error);
    throw error;
  }

  return (data ?? []).map<StockBatch>((record) => ({
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
}

export async function fetchStockBatchById(batchId: string): Promise<StockBatch | null> {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means no rows found
    console.error(`Error fetching stock batch with ID ${batchId}:`, error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    productId: data.product_id,
    batchNumber: data.batch_number,
    expiryDate: data.expiry_date,
    costPrice: Number(data.cost_price ?? 0),
    supplier: data.supplier ?? undefined,
    receivedDate: data.received_date,
    remainingQuantity: data.remaining_quantity ?? 0,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load stock movements: ${error.message}`);
  }

  return (data ?? []).map<StockMovement>((record) => ({
    id: record.id,
    productId: record.product_id,
    batchId: record.batch_id ?? undefined,
    type: record.movement_type,
    quantity: Number(record.quantity ?? 0),
    costPrice: Number(record.cost_price ?? 0),
    sellingPrice: record.selling_price != null ? Number(record.selling_price) : undefined,
    reason: record.reason ?? undefined,
    reference: record.reference ?? undefined,
    userId: record.performed_by ?? undefined,
    createdAt: record.created_at ?? new Date().toISOString(),
  }));
}

export async function fetchStockMovementsByProduct(productId: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching stock movements for product ${productId}:`, error);
    throw error;
  }

  return (data ?? []).map<StockMovement>((record) => ({
    id: record.id,
    productId: record.product_id,
    batchId: record.batch_id ?? undefined,
    type: record.movement_type,
    quantity: Number(record.quantity ?? 0),
    costPrice: Number(record.cost_price ?? 0),
    sellingPrice: record.selling_price != null ? Number(record.selling_price) : undefined,
    reason: record.reason ?? undefined,
    reference: record.reference ?? undefined,
    userId: record.performed_by ?? undefined,
    createdAt: record.created_at ?? new Date().toISOString(),
  }));
}

/**
 * Normalize cost_price to ensure it's stored as per-unit price, not pack cost
 * If cost_price seems too high (> 100) and dividing by quantity gives a reasonable per-unit,
 * then it's likely pack cost and should be converted to per-unit
 */
function normalizeCostPrice(costPrice: number, quantity: number): number {
  // If cost_price > 100 and quantity > 1, check if it might be pack cost
  if (costPrice > 100 && quantity > 1) {
    const calculatedPerUnit = costPrice / quantity;
    // If calculated per-unit is reasonable (0.01 to 100,000), treat cost_price as pack cost
    if (calculatedPerUnit >= 0.01 && calculatedPerUnit <= 100000) {
      // Check if the batch value would be unusually high
      const batchValue = costPrice * quantity;
      if (batchValue > 100000) {
        // Cost price appears to be pack cost, convert to per-unit
        return calculatedPerUnit;
      }
    }
  }
  // Otherwise, assume it's already per-unit
  return costPrice;
}

export async function insertStockBatch(payload: StockBatchInsert): Promise<StockBatch> {
  // Normalize cost_price to ensure it's per-unit, not pack cost
  const normalizedCostPrice = normalizeCostPrice(payload.costPrice, payload.remainingQuantity);
  
  const { data, error } = await supabase
    .from('stock_batches')
    .insert({
      product_id: payload.productId,
      batch_number: payload.batchNumber,
      expiry_date: payload.expiryDate,
      cost_price: normalizedCostPrice,
      supplier: payload.supplier ?? null,
      received_date: payload.receivedDate ?? new Date().toISOString(),
      remaining_quantity: payload.remainingQuantity,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create stock batch: ${error.message}`);
  }

  return {
    id: data.id,
    productId: data.product_id,
    batchNumber: data.batch_number,
    expiryDate: data.expiry_date,
    costPrice: Number(data.cost_price ?? 0),
    supplier: data.supplier ?? undefined,
    receivedDate: data.received_date,
    remainingQuantity: data.remaining_quantity ?? 0,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

export async function insertStockMovement(payload: StockMovementInsert): Promise<StockMovement> {
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      product_id: payload.productId,
      batch_id: payload.batchId ?? null,
      movement_type: payload.type,
      quantity: payload.quantity,
      cost_price: payload.costPrice,
      selling_price: payload.sellingPrice ?? null,
      reason: payload.reason ?? null,
      reference: payload.reference ?? null,
      performed_by: payload.userId ?? null,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create stock movement: ${error.message}`);
  }

  return {
    id: data.id,
    productId: data.product_id,
    batchId: data.batch_id ?? undefined,
    type: data.movement_type,
    quantity: data.quantity ?? 0,
    costPrice: Number(data.cost_price ?? 0),
    sellingPrice: data.selling_price != null ? Number(data.selling_price) : undefined,
    reason: data.reason ?? undefined,
    reference: data.reference ?? undefined,
    userId: data.performed_by ?? undefined,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}

export async function updateStockBatch(id: string, batchData: Partial<StockBatch>): Promise<StockBatch> {
  const updateData: any = {};

  if (batchData.productId !== undefined) updateData.product_id = batchData.productId;
  if (batchData.batchNumber !== undefined) updateData.batch_number = batchData.batchNumber;
  if (batchData.expiryDate !== undefined) updateData.expiry_date = batchData.expiryDate;
  if (batchData.supplier !== undefined) updateData.supplier = batchData.supplier ?? null;
  if (batchData.receivedDate !== undefined) updateData.received_date = batchData.receivedDate;
  if (batchData.remainingQuantity !== undefined) updateData.remaining_quantity = batchData.remainingQuantity;
  
  // Normalize cost_price if being updated
  if (batchData.costPrice !== undefined) {
    const quantity = batchData.remainingQuantity ?? 0;
    // Fetch current batch to get quantity if not provided
    let currentQuantity = quantity;
    if (quantity === 0) {
      const currentBatch = await fetchStockBatchById(id);
      if (currentBatch) {
        currentQuantity = currentBatch.remainingQuantity;
      }
    }
    updateData.cost_price = normalizeCostPrice(batchData.costPrice, currentQuantity);
  }

  const { data, error } = await supabase
    .from('stock_batches')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error(`Error updating stock batch with ID ${id}:`, error);
    throw error;
  }

  return {
    id: data.id,
    productId: data.product_id,
    batchNumber: data.batch_number,
    expiryDate: data.expiry_date,
    costPrice: Number(data.cost_price ?? 0),
    supplier: data.supplier ?? undefined,
    receivedDate: data.received_date,
    remainingQuantity: data.remaining_quantity ?? 0,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
}


