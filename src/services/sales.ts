import { supabase } from '@/lib/supabaseClient';
import { Sale, SaleItem, PaymentMethod } from '@/lib/types';

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
    cashierName: supabaseSale.cashier_name,
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
    cashier_name: appSale.cashierName,
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

  if (error) {
    console.error('Error fetching sales:', error);
    throw error;
  }

  return (data ?? []).map(mapSupabaseSaleToAppSale);
}

export async function fetchSaleById(id: string): Promise<Sale | null> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means no rows found
    console.error(`Error fetching sale with ID ${id}:`, error);
    throw error;
  }

  return data ? mapSupabaseSaleToAppSale(data) : null;
}

export async function insertSale(saleData: Omit<Sale, 'id' | 'createdAt'>): Promise<Sale> {
  const { data, error } = await supabase
    .from('sales')
    .insert({
      ...mapAppSaleToSupabaseSale(saleData),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting sale:', error);
    throw error;
  }

  return mapSupabaseSaleToAppSale(data);
}

export async function updateSale(id: string, saleData: Partial<Omit<Sale, 'id' | 'createdAt'>>): Promise<Sale> {
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
  if (saleData.cashierName !== undefined) updateData.cashier_name = saleData.cashierName;
  if (saleData.customerName !== undefined) updateData.customer_name = saleData.customerName;
  if (saleData.customerPhone !== undefined) updateData.customer_phone = saleData.customerPhone;
  if (saleData.notes !== undefined) updateData.notes = saleData.notes;
  if (saleData.refunded !== undefined) updateData.refunded = saleData.refunded;
  if (saleData.refundedAt !== undefined) updateData.refunded_at = saleData.refundedAt;
  if (saleData.refundedBy !== undefined) updateData.refunded_by = saleData.refundedBy;

  const { data, error } = await supabase
    .from('sales')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating sale with ID ${id}:`, error);
    throw error;
  }

  return mapSupabaseSaleToAppSale(data);
}

