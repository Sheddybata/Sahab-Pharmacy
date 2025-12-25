import { db, PendingOperation, OfflineSale } from './offline-db';
import { supabase } from './supabaseClient';
import { Product, Sale } from './types';

/**
 * Check if the application is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Add an operation to the pending operations queue
 */
export async function queueOperation(
  type: 'create' | 'update' | 'delete',
  table: string,
  data: any
): Promise<void> {
  const operation: PendingOperation = {
    id: `${Date.now()}-${Math.random()}`,
    type,
    table,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  await db.pendingOperations.add(operation);
}

/**
 * Sync pending operations when coming back online
 */
export async function syncPendingOperations(): Promise<void> {
  if (!isOnline()) {
    return;
  }

  const pendingOps = await db.pendingOperations
    .orderBy('timestamp')
    .toArray();

  for (const op of pendingOps) {
    try {
      await executeOperation(op);
      await db.pendingOperations.delete(op.id);
    } catch (error) {
      console.error(`Failed to sync operation ${op.id}:`, error);
      // Increment retry count
      op.retries += 1;
      if (op.retries < 5) {
        await db.pendingOperations.update(op.id, { retries: op.retries });
      } else {
        // Too many retries, remove from queue
        await db.pendingOperations.delete(op.id);
        console.error(`Operation ${op.id} exceeded retry limit`);
      }
    }
  }
}

/**
 * Execute a single pending operation
 */
async function executeOperation(op: PendingOperation): Promise<void> {
  let result: any;
  
  switch (op.type) {
    case 'create':
      result = await supabase.from(op.table).insert(op.data);
      if (result.error) throw result.error;
      break;
    case 'update':
      const { id, ...updateData } = op.data;
      result = await supabase.from(op.table).update(updateData).eq('id', id);
      if (result.error) throw result.error;
      break;
    case 'delete':
      result = await supabase.from(op.table).delete().eq('id', op.data.id);
      if (result.error) throw result.error;
      break;
  }
}

/**
 * Sync products from server to local database
 */
export async function syncProductsFromServer(): Promise<Product[]> {
  if (!isOnline()) {
    return db.products.where('synced').equals(1).toArray();
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    const products = (data ?? []).map((record: any) => ({
      id: record.id,
      name: record.name,
      ndcCode: record.ndc_code ?? undefined,
      category: record.category,
      manufacturer: record.manufacturer,
      dosageForm: record.dosage_form ?? undefined,
      strength: record.strength ?? undefined,
      sellingPrice: Number(record.selling_price ?? 0),
      reorderPoint: Number(record.reorder_point ?? 0),
      reorderQuantity: record.reorder_quantity ?? 0,
      location: record.location ?? undefined,
      barcode: record.barcode ?? undefined,
      description: record.description ?? undefined,
      active: Boolean(record.active),
      createdAt: record.created_at ?? new Date().toISOString(),
      updatedAt: record.updated_at ?? new Date().toISOString(),
      synced: true,
    }));

    // Clear synced products and add fresh data
    await db.products.where('synced').equals(1).delete();
    await db.products.bulkAdd(products);

    // Keep pending (unsynced) products
    return db.products.toArray();
  } catch (error) {
    console.error('Failed to sync products from server, using local cache:', error);
    return db.products.toArray();
  }
}

/**
 * Sync sales from server to local database
 */
export async function syncSalesFromServer(filters?: {
  startDate?: Date;
  endDate?: Date;
  refunded?: boolean;
}): Promise<OfflineSale[]> {
  if (!isOnline()) {
    return db.sales.toArray();
  }

  try {
    let query = supabase.from('sales').select('*').order('created_at', { ascending: false });

    if (filters) {
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.refunded !== undefined) {
        query = query.eq('refunded', filters.refunded);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

      const mapSupabaseSaleToAppSale = (supabaseSale: any): OfflineSale => {
      const items = Array.isArray(supabaseSale.items)
        ? supabaseSale.items.map((item: any) => ({
            id: item.id,
            productId: item.product_id || item.productId,
            productName: item.product_name || item.productName,
            batchId: item.batch_id || item.batchId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price || item.unitPrice),
            costPrice: Number(item.cost_price || item.costPrice),
            total: Number(item.total),
          }))
        : [];

      return {
        id: supabaseSale.id,
        saleNumber: supabaseSale.sale_number,
        items,
        subtotal: Number(supabaseSale.subtotal),
        tax: supabaseSale.tax ? Number(supabaseSale.tax) : undefined,
        total: Number(supabaseSale.total),
        paymentMethod: supabaseSale.payment_method,
        cashierId: supabaseSale.cashier_id,
        cashierName: supabaseSale.cashier_name || 'Unknown',
        customerName: supabaseSale.customer_name || undefined,
        customerPhone: supabaseSale.customer_phone || undefined,
        notes: supabaseSale.notes || undefined,
        refunded: supabaseSale.refunded || false,
        refundedAt: supabaseSale.refunded_at || undefined,
        refundedBy: supabaseSale.refunded_by || undefined,
        createdAt: supabaseSale.created_at,
        synced: true,
      };
    };

    const sales = (data ?? []).map(mapSupabaseSaleToAppSale);

    // Clear synced sales and add fresh data (only if no filters, otherwise merge)
    if (!filters) {
      await db.sales.where('synced').equals(1).delete();
      await db.sales.bulkAdd(sales);
    } else {
      // With filters, merge the results
      for (const sale of sales) {
        await db.sales.put(sale);
      }
    }

    return db.sales.toArray();
  } catch (error) {
    console.error('Failed to sync sales from server, using local cache:', error);
    return db.sales.toArray();
  }
}

/**
 * Initialize offline sync - listen for online/offline events
 */
export function initializeOfflineSync(): void {
  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Connection restored, syncing...');
    syncPendingOperations();
  });

  // Try to sync immediately if online
  if (isOnline()) {
    syncPendingOperations();
  }
}

