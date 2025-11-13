import { supabase } from '@/lib/supabaseClient';
import { StocktakeItem, StocktakeSession } from '@/lib/types';

const mapSupabaseSessionToAppSession = (record: any): StocktakeSession => ({
  id: record.id,
  sessionNumber: record.session_number,
  status: record.status,
  createdBy: record.created_by,
  createdByName: record.created_by_name,
  startedAt: record.started_at,
  completedAt: record.completed_at ?? undefined,
  approvedBy: record.approved_by ?? undefined,
  approvedAt: record.approved_at ?? undefined,
  notes: record.notes ?? undefined,
});

const mapSupabaseItemToAppItem = (record: any): StocktakeItem => ({
  id: record.id,
  sessionId: record.session_id,
  productId: record.product_id,
  systemQuantity: Number(record.system_quantity ?? 0),
  countedQuantity: Number(record.counted_quantity ?? 0),
  variance: Number(record.variance ?? 0),
  adjusted: Boolean(record.adjusted),
  adjustmentMovementId: record.adjustment_movement_id ?? undefined,
});

export async function fetchStocktakeSessions(): Promise<StocktakeSession[]> {
  const { data, error } = await supabase
    .from('stocktake_sessions')
    .select('*')
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stocktake sessions: ${error.message}`);
  }

  return (data ?? []).map(mapSupabaseSessionToAppSession);
}

interface CreateStocktakeSessionInput {
  sessionNumber: string;
  createdBy: string;
  createdByName: string;
  notes?: string;
}

export async function createStocktakeSession(
  input: CreateStocktakeSessionInput
): Promise<StocktakeSession> {
  const payload = {
    session_number: input.sessionNumber,
    status: 'counting',
    created_by: input.createdBy,
    created_by_name: input.createdByName,
    started_at: new Date().toISOString(),
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('stocktake_sessions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create stocktake session: ${error.message}`);
  }

  return mapSupabaseSessionToAppSession(data);
}

type UpdateStocktakeSessionInput = Partial<
  Pick<
    StocktakeSession,
    'sessionNumber' | 'status' | 'notes' | 'completedAt' | 'approvedBy' | 'approvedAt' | 'startedAt'
  >
>;

export async function updateStocktakeSession(
  id: string,
  updates: UpdateStocktakeSessionInput
): Promise<StocktakeSession> {
  const payload: Record<string, unknown> = {};

  if (updates.sessionNumber !== undefined) payload.session_number = updates.sessionNumber;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt ?? null;
  if (updates.approvedBy !== undefined) payload.approved_by = updates.approvedBy ?? null;
  if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt ?? null;
  if (updates.startedAt !== undefined) payload.started_at = updates.startedAt;

  const { data, error } = await supabase
    .from('stocktake_sessions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update stocktake session ${id}: ${error.message}`);
  }

  return mapSupabaseSessionToAppSession(data);
}

export async function fetchStocktakeItemsBySession(sessionId: string): Promise<StocktakeItem[]> {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stocktake items: ${error.message}`);
  }

  return (data ?? []).map(mapSupabaseItemToAppItem);
}

export async function upsertStocktakeItem(item: StocktakeItem): Promise<StocktakeItem> {
  const payload = {
    id: item.id,
    session_id: item.sessionId,
    product_id: item.productId,
    system_quantity: item.systemQuantity,
    counted_quantity: item.countedQuantity,
    variance: item.variance,
    adjusted: item.adjusted,
    adjustment_movement_id: item.adjustmentMovementId ?? null,
  };

  const { data, error } = await supabase
    .from('stocktake_items')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to save stocktake item: ${error.message}`);
  }

  return mapSupabaseItemToAppItem(data);
}

