import { supabase } from '@/lib/supabaseClient';
import { Sale, SaleItem, PaymentMethod } from '@/lib/types';
import { db } from '@/lib/offline-db';
import { isOnline, queueOperation, syncSalesFromServer } from '@/lib/offline-sync';

const mapSupabaseSaleToAppSale = (supabaseSale: any): Sale => {
  // Parse items from JSONB column
  const items: SaleItem[] = Array.isArray(supabaseSale.items)
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
    paymentMethod: supabaseSale.payment_method as PaymentMethod,
    cashierId: supabaseSale.cashier_id,
    cashierName: supabaseSale.cashier_name || 'Unknown',
    customerName: supabaseSale.customer_name || undefined,
    customerPhone: supabaseSale.customer_phone || undefined,
    notes: supabaseSale.notes || undefined,
    refunded: supabaseSale.refunded || false,
    refundedAt: supabaseSale.refunded_at || undefined,
    refundedBy: supabaseSale.refunded_by || undefined,
    createdAt: supabaseSale.created_at,
  };
};

const mapAppSaleToSupabaseSale = (appSale: Omit<Sale, 'id' | 'createdAt'>): any => {
  // Map items to the format expected by Supabase (JSONB)
  const items = appSale.items.map(item => ({
    id: item.id,
    product_id: item.productId,
    product_name: item.productName,
    batch_id: item.batchId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    cost_price: item.costPrice,
    total: item.total,
  }));

  return {
    sale_number: appSale.saleNumber,
    items,
    subtotal: appSale.subtotal,
    tax: appSale.tax ?? null,
    total: appSale.total,
    payment_method: appSale.paymentMethod,
    cashier_id: appSale.cashierId,
    customer_name: appSale.customerName ?? null,
    customer_phone: appSale.customerPhone ?? null,
    notes: appSale.notes ?? null,
    refunded: appSale.refunded || false,
    refunded_at: appSale.refundedAt ?? null,
    refunded_by: appSale.refundedBy ?? null,
  };
};

export const SALES_QUERY_KEY = ['sales'];

export async function fetchSales(filters?: {
  startDate?: Date;
  endDate?: Date;
  refunded?: boolean;
}): Promise<Sale[]> {
  if (isOnline()) {
    try {
      const sales = await syncSalesFromServer(filters);
      // Apply local filters if needed
      let filteredSales = sales;
      
      if (filters) {
        if (filters.startDate) {
          filteredSales = filteredSales.filter(s => new Date(s.createdAt) >= filters.startDate!);
        }
        if (filters.endDate) {
          filteredSales = filteredSales.filter(s => new Date(s.createdAt) <= filters.endDate!);
        }
        if (filters.refunded !== undefined) {
          filteredSales = filteredSales.filter(s => s.refunded === filters.refunded);
        }
      }
      
      return filteredSales;
    } catch (error) {
      console.error('Failed to fetch from server, using local cache:', error);
      // Fall through to offline mode
    }
  }

  // Use offline database
  let salesQuery = db.sales.orderBy('createdAt').reverse();
  
  if (filters) {
    if (filters.refunded !== undefined) {
      salesQuery = salesQuery.filter(s => s.refunded === filters.refunded);
    }
  }
  
  const sales = await salesQuery.toArray();
  
  // Apply date filters
  let filteredSales = sales;
  if (filters) {
    if (filters.startDate) {
      filteredSales = filteredSales.filter(s => new Date(s.createdAt) >= filters.startDate!);
    }
    if (filters.endDate) {
      filteredSales = filteredSales.filter(s => new Date(s.createdAt) <= filters.endDate!);
    }
  }
  
  return filteredSales;
}

export async function fetchSaleById(id: string): Promise<Sale | null> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        const sale = mapSupabaseSaleToAppSale(data);
        // Cache it
        await db.sales.put({ ...sale, synced: true });
        return sale;
      }
      
      if (error && error.code !== 'PGRST116') {
        console.error(`Error fetching sale with ID ${id}:`, error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to fetch from server, using local cache:', error);
    }
  }

  // Use offline database
  const sale = await db.sales.get(id);
  return sale || null;
}

export async function insertSale(saleData: Omit<Sale, 'id' | 'createdAt'>): Promise<Sale> {
  const now = new Date().toISOString();
  const tempId = `temp-sale-${Date.now()}-${Math.random()}`;
  
  const sale: Sale = {
    id: tempId,
    ...saleData,
    createdAt: now,
  };

  // Add to local database immediately
  await db.sales.add({ ...sale, synced: false });

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .insert({
          ...mapAppSaleToSupabaseSale(saleData),
          created_at: now,
        })
        .select()
        .single();

      if (!error && data) {
        const syncedSale = mapSupabaseSaleToAppSale(data);
        // Update local database with server ID
        await db.sales.delete(tempId);
        await db.sales.add({ ...syncedSale, synced: true });
        return syncedSale;
      }
    } catch (error) {
      console.error('Failed to insert on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  await queueOperation('create', 'sales', {
    ...mapAppSaleToSupabaseSale(saleData),
    created_at: now,
  });
  
  return sale;
}

export async function updateSale(id: string, saleData: Partial<Omit<Sale, 'id' | 'createdAt'>>): Promise<Sale> {
  // Update local database immediately
  const existing = await db.sales.get(id);
  if (existing) {
    await db.sales.update(id, {
      ...saleData,
      synced: false,
    });
  }

  const updateData: any = {};

  if (saleData.items) {
    updateData.items = saleData.items.map(item => ({
      id: item.id,
      product_id: item.productId,
      product_name: item.productName,
      batch_id: item.batchId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      cost_price: item.costPrice,
      total: item.total,
    }));
  }

  if (saleData.subtotal !== undefined) updateData.subtotal = saleData.subtotal;
  if (saleData.tax !== undefined) updateData.tax = saleData.tax;
  if (saleData.total !== undefined) updateData.total = saleData.total;
  if (saleData.paymentMethod !== undefined) updateData.payment_method = saleData.paymentMethod;
  if (saleData.cashierId !== undefined) updateData.cashier_id = saleData.cashierId;
  if (saleData.customerName !== undefined) updateData.customer_name = saleData.customerName;
  if (saleData.customerPhone !== undefined) updateData.customer_phone = saleData.customerPhone;
  if (saleData.notes !== undefined) updateData.notes = saleData.notes;
  if (saleData.refunded !== undefined) updateData.refunded = saleData.refunded;
  if (saleData.refundedAt !== undefined) updateData.refunded_at = saleData.refundedAt;
  if (saleData.refundedBy !== undefined) updateData.refunded_by = saleData.refundedBy;

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const syncedSale = mapSupabaseSaleToAppSale(data);
        await db.sales.update(id, { ...syncedSale, synced: true });
        return syncedSale;
      }
    } catch (error) {
      console.error('Failed to update on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  await queueOperation('update', 'sales', { id, ...updateData });
  const updated = await db.sales.get(id);
  return updated || { ...existing!, ...saleData };
}

