import { supabase } from '@/lib/supabaseClient';
import { ProductFormValues } from '@/components/inventory/ProductForm';
import { insertProduct } from '@/services/products';
import {
  insertStockBatch,
  insertStockMovement,
  updateStockBatch,
} from '@/services/stock';
import { insertSale } from '@/services/sales';
import { recordAuditLog } from '@/services/audit';
import { generateAndSaveAlerts } from '@/lib/notifications';

export interface AppSettings {
  id?: string;
  taxRate: number;
  currency: string;
  autoGenerateAlerts: boolean;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch application settings: ${error.message}`);
  }

  if (!data) {
    return {
      taxRate: 8,
      currency: 'NGN',
      autoGenerateAlerts: true,
    };
  }

  return {
    id: data.id,
    taxRate: Number(data.tax_rate ?? 0),
    currency: data.currency ?? 'NGN',
    autoGenerateAlerts: Boolean(data.auto_generate_alerts),
  };
}

export async function saveAppSettings(settings: AppSettings): Promise<AppSettings> {
  const payload = {
    tax_rate: settings.taxRate,
    currency: settings.currency,
    auto_generate_alerts: settings.autoGenerateAlerts,
    updated_at: new Date().toISOString(),
  };

  if (settings.id) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(payload)
      .eq('id', settings.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    return {
      id: data.id,
      taxRate: Number(data.tax_rate ?? 0),
      currency: data.currency ?? 'NGN',
      autoGenerateAlerts: Boolean(data.auto_generate_alerts),
    };
  }

  const { data, error } = await supabase
    .from('app_settings')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create settings: ${error.message}`);
  }

  return {
    id: data.id,
    taxRate: Number(data.tax_rate ?? 0),
    currency: data.currency ?? 'NGN',
    autoGenerateAlerts: Boolean(data.auto_generate_alerts),
  };
}

export interface SystemStats {
  products: number;
  users: number;
  sales: number;
  auditLogs: number;
}

async function getTableCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to load ${table} count: ${error.message}`);
  }

  return count ?? 0;
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const [products, users, sales, auditLogs] = await Promise.all([
    getTableCount('products'),
    getTableCount('profiles'),
    getTableCount('sales'),
    getTableCount('audit_logs'),
  ]);

  return {
    products,
    users,
    sales,
    auditLogs,
  };
}

const TABLES_TO_CLEAR = [
  'sale_items',
  'sales',
  'stock_movements',
  'stock_batches',
  'stocktake_items',
  'stocktake_sessions',
  'alerts',
  'audit_logs',
  'products',
  'app_settings',
] as const;

export async function resetSupabaseData(): Promise<void> {
  for (const table of TABLES_TO_CLEAR) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', null);

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to clear table ${table}: ${error.message}`);
    }
  }
}

const SAMPLE_PRODUCTS: Array<{
  form: ProductFormValues;
  initialQuantity: number;
  costPrice: number;
  reorderPoint: number;
}> = [
  {
    form: {
      name: 'Paracetamol 500mg',
      ndcCode: '12345-678-90',
      category: 'Pain Relief',
      manufacturer: 'MediPharm Ltd',
      dosageForm: 'Tablets',
      strength: '500mg',
      sellingPrice: 350,
      reorderPoint: 100,
      reorderQuantity: 400,
      location: 'A1-B2',
      barcode: '1234567890123',
      description: 'Fast-acting pain relief tablets',
      active: true,
    },
    initialQuantity: 200,
    costPrice: 250,
    reorderPoint: 100,
  },
  {
    form: {
      name: 'Amoxicillin 250mg',
      ndcCode: '23456-789-01',
      category: 'Antibiotics',
      manufacturer: 'HealthCare Inc',
      dosageForm: 'Capsules',
      strength: '250mg',
      sellingPrice: 1200,
      reorderPoint: 50,
      reorderQuantity: 150,
      location: 'B3-C1',
      barcode: '2345678901234',
      description: 'Broad-spectrum antibiotic',
      active: true,
    },
    initialQuantity: 120,
    costPrice: 880,
    reorderPoint: 50,
  },
];

export async function seedSupabaseDemoData(userId: string, userName: string): Promise<void> {
  const createdProducts: Array<{
    product: Awaited<ReturnType<typeof insertProduct>>;
    costPrice: number;
    initialQuantity: number;
    batchId: string;
  }> = [];

  for (const sample of SAMPLE_PRODUCTS) {
    const product = await insertProduct(sample.form);
    createdProducts.push({
      product,
      costPrice: sample.costPrice,
      initialQuantity: sample.initialQuantity,
      batchId: '',
    });

    const batch = await insertStockBatch({
      productId: product.id,
      batchNumber: `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      costPrice: sample.costPrice,
      supplier: 'Demo Supplier',
      receivedDate: new Date().toISOString(),
      remainingQuantity: sample.initialQuantity,
    });

    await insertStockMovement({
      productId: product.id,
      batchId: batch.id,
      type: 'purchase',
      quantity: sample.initialQuantity,
      costPrice: sample.costPrice,
      reason: 'Initial stock receiving',
      userId,
    });

    await generateAndSaveAlerts(product.id);

    const lastIndex = createdProducts.length - 1;
    createdProducts[lastIndex].batchId = batch.id;
  }

  const firstProduct = createdProducts[0];
  const saleItemId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sale_item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const saleSubtotal = firstProduct.product.sellingPrice * 5;
  const saleTax = saleSubtotal * 0.08;
  const saleTotal = saleSubtotal + saleTax;

  const sale = await insertSale({
    saleNumber: `SALE-${Date.now().toString().slice(-8)}`,
    items: [
      {
        id: saleItemId,
        productId: firstProduct.product.id,
        productName: firstProduct.product.name,
        batchId: firstProduct.batchId,
        quantity: 5,
        unitPrice: firstProduct.product.sellingPrice,
        costPrice: firstProduct.costPrice,
        total: saleSubtotal,
      },
    ],
    subtotal: saleSubtotal,
    tax: saleTax,
    total: saleTotal,
    paymentMethod: 'cash',
    cashierId: userId,
    cashierName: userName,
    refunded: false,
  });

  await insertStockMovement({
    productId: firstProduct.product.id,
    batchId: firstProduct.batchId,
    type: 'sale',
    quantity: -5,
    costPrice: firstProduct.costPrice,
    sellingPrice: firstProduct.product.sellingPrice,
    reference: sale.id,
    userId,
  });

  await updateStockBatch(firstProduct.batchId, {
    remainingQuantity: firstProduct.initialQuantity - 5,
  });

  await recordAuditLog({
    userId,
    userName,
    module: 'settings',
    action: 'seed_demo_data',
    details: 'Demo data seeded via settings panel',
  });
}

