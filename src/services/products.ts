import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/lib/types';
import { db } from '@/lib/offline-db';
import { isOnline, queueOperation, syncProductsFromServer } from '@/lib/offline-sync';

type ProductInsert = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type ProductUpdate = Partial<Omit<Product, 'createdAt' | 'updatedAt'>> & { id: string };

export async function fetchActiveProducts(): Promise<Product[]> {
  if (isOnline()) {
    try {
      return await syncProductsFromServer();
    } catch (error) {
      console.error('Failed to fetch from server, using local cache:', error);
      // Fall through to offline mode
    }
  }

  // Use offline database
  const products = await db.products.where('active').equals(true).toArray();
  return products.map(normalizeProductDates);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const product = normalizeProductDates(data);
        // Cache it
        await db.products.put({ ...product, synced: true });
        return product;
      }
    } catch (error) {
      console.error('Failed to fetch from server, using local cache:', error);
    }
  }

  // Use offline database
  const product = await db.products.get(id);
  return product ? normalizeProductDates(product) : null;
}

// Convert camelCase Product fields to snake_case database fields
function convertToDatabaseFormat(payload: Partial<ProductInsert>): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {};
  
  if (payload.name !== undefined) dbPayload.name = payload.name;
  if (payload.ndcCode !== undefined) dbPayload.ndc_code = payload.ndcCode;
  if (payload.category !== undefined) dbPayload.category = payload.category;
  if (payload.manufacturer !== undefined) dbPayload.manufacturer = payload.manufacturer;
  if (payload.dosageForm !== undefined) dbPayload.dosage_form = payload.dosageForm;
  if (payload.strength !== undefined) dbPayload.strength = payload.strength;
  if (payload.sellingPrice !== undefined) dbPayload.selling_price = payload.sellingPrice;
  if (payload.reorderPoint !== undefined) dbPayload.reorder_point = payload.reorderPoint;
  if (payload.reorderQuantity !== undefined) dbPayload.reorder_quantity = payload.reorderQuantity;
  if (payload.location !== undefined) dbPayload.location = payload.location;
  if (payload.barcode !== undefined) dbPayload.barcode = payload.barcode;
  if (payload.description !== undefined) dbPayload.description = payload.description;
  if (payload.active !== undefined) dbPayload.active = payload.active;
  
  return dbPayload;
}

export async function insertProduct(payload: ProductInsert): Promise<Product> {
  const now = new Date().toISOString();
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  
  const product: Product = {
    id: tempId,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };

  // Add to local database immediately
  await db.products.add({ ...product, synced: false });

  if (isOnline()) {
    try {
      const dbPayload = convertToDatabaseFormat(payload);
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...dbPayload,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single();

      if (!error && data) {
        const syncedProduct = normalizeProductDates(data);
        // Update local database with server ID
        await db.products.delete(tempId);
        await db.products.add({ ...syncedProduct, synced: true });
        return syncedProduct;
      }
    } catch (error) {
      console.error('Failed to insert on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  await queueOperation('create', 'products', convertToDatabaseFormat(payload));
  return product;
}

export async function updateProduct(payload: ProductUpdate): Promise<Product> {
  const { id, ...rest } = payload;
  const now = new Date().toISOString();
  
  // Update local database immediately
  const existing = await db.products.get(id);
  if (existing) {
    await db.products.update(id, {
      ...rest,
      updatedAt: now,
      synced: false,
    });
  }

  if (isOnline()) {
    try {
      const dbPayload = convertToDatabaseFormat(rest);
      const { data, error } = await supabase
        .from('products')
        .update({
          ...dbPayload,
          updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        const syncedProduct = normalizeProductDates(data);
        await db.products.update(id, { ...syncedProduct, synced: true });
        return syncedProduct;
      }
    } catch (error) {
      console.error('Failed to update on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  await queueOperation('update', 'products', { id, ...convertToDatabaseFormat(rest) });
  const updated = await db.products.get(id);
  return normalizeProductDates(updated || { ...payload, updatedAt: now });
}

export async function deactivateProduct(id: string): Promise<void> {
  // Update local database
  await db.products.update(id, { active: false, synced: false });

  if (isOnline()) {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (!error) {
        await db.products.update(id, { synced: true });
        return;
      }
    } catch (error) {
      console.error('Failed to deactivate on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  await queueOperation('update', 'products', { id, active: false });
}

export async function removeProduct(id: string): Promise<void> {
  // Mark for deletion in local database
  await db.products.update(id, { pendingDelete: true, synced: false });

  if (isOnline()) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (!error) {
        await db.products.delete(id);
        return;
      }
    } catch (error) {
      console.error('Failed to delete on server, queuing for sync:', error);
    }
  }

  // Queue for sync
  const product = await db.products.get(id);
  if (product) {
    await queueOperation('delete', 'products', { id });
  }
}

function normalizeProductDates(record: any): Product {
  return {
    id: record.id,
    name: record.name,
    ndcCode: record.ndc_code ?? record.ndcCode ?? undefined,
    category: record.category,
    manufacturer: record.manufacturer,
    dosageForm: record.dosage_form ?? record.dosageForm ?? undefined,
    strength: record.strength ?? undefined,
    sellingPrice: Number(record.selling_price ?? record.sellingPrice ?? 0),
    reorderPoint: Number(record.reorder_point ?? record.reorderPoint ?? 0),
    reorderQuantity: record.reorder_quantity ?? record.reorderQuantity ?? 0,
    location: record.location ?? undefined,
    barcode: record.barcode ?? undefined,
    description: record.description ?? undefined,
    active: Boolean(record.active),
    createdAt: record.created_at ?? record.createdAt ?? new Date().toISOString(),
    updatedAt: record.updated_at ?? record.updatedAt ?? new Date().toISOString(),
  };
}


