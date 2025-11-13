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

export async function insertProduct(payload: ProductInsert): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...payload,
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

  const { data, error } = await supabase
    .from('products')
    .update({
      ...rest,
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


