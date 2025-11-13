// Supabase-backed alert/notification system
import { AlertSeverity } from './types';
import { getDaysUntilExpiry, isExpired } from './calculations';
import { fetchProductById } from '@/services/products';
import { insertAlert } from '@/services/alerts';
import { supabase } from '@/lib/supabaseClient';

type AlertType = 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';

interface AlertCheck {
  productId: string;
  productName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  batchId?: string;
  expiryDate?: string;
}

async function fetchProductInventory(productId: string) {
  const [{ data: batches, error: batchError }, { data: movements, error: movementError }] =
    await Promise.all([
      supabase
        .from('stock_batches')
        .select('*')
        .eq('product_id', productId)
        .order('expiry_date', { ascending: true }),
      supabase.from('stock_movements').select('quantity').eq('product_id', productId),
    ]);

  if (batchError) {
    throw new Error(`Failed to load batches: ${batchError.message}`);
  }
  if (movementError) {
    throw new Error(`Failed to load stock movements: ${movementError.message}`);
  }

  const quantity = (movements ?? []).reduce(
    (sum, movement) => sum + Number(movement.quantity ?? 0),
    0
  );

  return {
    quantity: Math.max(0, quantity),
    batches: (batches ?? []).map((batch) => ({
      id: batch.id as string,
      batchNumber: batch.batch_number as string,
      expiryDate: batch.expiry_date as string,
      remainingQuantity: batch.remaining_quantity ?? 0,
    })),
  };
}

export const generateProductAlerts = async (productId: string): Promise<AlertCheck[]> => {
  const product = await fetchProductById(productId);
  if (!product || !product.active) {
    return [];
  }

  const alerts: AlertCheck[] = [];
  const stock = await fetchProductInventory(productId);

  if (stock.quantity === 0) {
    alerts.push({
      productId,
      productName: product.name,
      type: 'out_of_stock',
      severity: 'critical',
      message: `${product.name} is out of stock`,
    });
  } else if (stock.quantity <= product.reorderPoint) {
    alerts.push({
      productId,
      productName: product.name,
      type: 'low_stock',
      severity: stock.quantity <= product.reorderPoint * 0.3 ? 'high' : 'medium',
      message: `${product.name} is low on stock (${stock.quantity} remaining, reorder point: ${product.reorderPoint})`,
    });
  }

  stock.batches.forEach((batch) => {
    const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate);

    if (isExpired(batch.expiryDate)) {
      alerts.push({
        productId,
        productName: product.name,
        type: 'expired',
        severity: 'critical',
        message: `${product.name} batch ${batch.batchNumber} has expired on ${new Date(batch.expiryDate).toLocaleDateString()}`,
        batchId: batch.id,
        expiryDate: batch.expiryDate,
      });
    } else if (daysUntilExpiry <= 30) {
      alerts.push({
        productId,
        productName: product.name,
        type: 'expiring_soon',
        severity: 'high',
        message: `${product.name} batch ${batch.batchNumber} expires in ${daysUntilExpiry} days (${new Date(batch.expiryDate).toLocaleDateString()})`,
        batchId: batch.id,
        expiryDate: batch.expiryDate,
      });
    } else if (daysUntilExpiry <= 90) {
      alerts.push({
        productId,
        productName: product.name,
        type: 'expiring_soon',
        severity: 'medium',
        message: `${product.name} batch ${batch.batchNumber} expires in ${daysUntilExpiry} days (${new Date(batch.expiryDate).toLocaleDateString()})`,
        batchId: batch.id,
        expiryDate: batch.expiryDate,
      });
    }
  });

  return alerts;
};

const isDuplicateAlert = async (alert: AlertCheck): Promise<boolean> => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('alerts')
    .select('id')
    .eq('product_id', alert.productId)
    .eq('alert_type', alert.type)
    .gte('created_at', twentyFourHoursAgo);

  if (alert.batchId) {
    query = query.eq('batch_id', alert.batchId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(`Failed to check duplicate alerts: ${error.message}`);
  }

  return (data ?? []).length > 0;
};

export const generateAndSaveAlerts = async (productId: string): Promise<void> => {
  const alertChecks = await generateProductAlerts(productId);

  for (const check of alertChecks) {
    const exists = await isDuplicateAlert(check);
    if (!exists) {
      await insertAlert({
        productId: check.productId,
        productName: check.productName,
        type: check.type,
        severity: check.severity,
        message: check.message,
        batchId: check.batchId,
        expiryDate: check.expiryDate,
      });
    }
  }
};

export const generateAllAlerts = async (): Promise<void> => {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('active', true);

  if (error) {
    throw new Error(`Failed to load products for alert generation: ${error.message}`);
  }

  for (const record of data ?? []) {
    await generateAndSaveAlerts(record.id as string);
  }
};

export const checkExpiringBatches = async (): Promise<void> => {
  const { data, error } = await supabase
    .from('stock_batches')
    .select('product_id, expiry_date, batch_number, id');

  if (error) {
    throw new Error(`Failed to load batches: ${error.message}`);
  }

  const productIds = new Set<string>();

  (data ?? []).forEach((batch) => {
    const expiryDate = batch.expiry_date as string;
    const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
    if (daysUntilExpiry <= 90 && daysUntilExpiry >= 0) {
      productIds.add(batch.product_id as string);
    }
  });

  for (const productId of productIds) {
    await generateAndSaveAlerts(productId);
  }
};

