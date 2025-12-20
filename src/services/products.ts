import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/lib/types';

type ProductInsert = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
type ProductUpdate = Partial<Omit<Product, 'createdAt' | 'updatedAt'>> & { id: string };

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return (data ?? []).map(normalizeProductDates);
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load product: ${error.message}`);
  }

  return data ? normalizeProductDates(data) : null;
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
  const dbPayload = convertToDatabaseFormat(payload);
  
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...dbPayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  return normalizeProductDates(data);
}

export async function updateProduct(payload: ProductUpdate): Promise<Product> {
  const { id, ...rest } = payload;
  const dbPayload = convertToDatabaseFormat(rest);

  const { data, error } = await supabase
    .from('products')
    .update({
      ...dbPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }

  return normalizeProductDates(data);
}

export async function deactivateProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to deactivate product: ${error.message}`);
  }
}

export async function removeProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}

function normalizeProductDates(record: any): Product {
  return {
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
  };
}


