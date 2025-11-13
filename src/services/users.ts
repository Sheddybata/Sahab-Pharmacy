import { supabase } from '@/lib/supabaseClient';
import { User, UserRole } from '@/lib/types';

const mapSupabaseProfileToUser = (record: any): User => ({
  id: record.id,
  username: record.username,
  password: record.password ?? '',
  role: record.role as UserRole,
  fullName: record.full_name ?? record.username,
  email: record.email ?? undefined,
  active: record.active ?? true,
  createdAt: record.created_at ?? new Date().toISOString(),
  updatedAt: record.updated_at ?? new Date().toISOString(),
});

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data ?? []).map(mapSupabaseProfileToUser);
}

export async function fetchUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data ? mapSupabaseProfileToUser(data) : null;
}

export async function fetchUserByUsername(username: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data ? mapSupabaseProfileToUser(data) : null;
}

export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<User | null> {
  if (!username || !password) {
    return null;
  }

  const user = await fetchUserByUsername(username);
  if (!user || !user.active) {
    return null;
  }

  if (user.password !== password) {
    return null;
  }

  return user;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  fullName: string;
  email?: string;
  active?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const payload = {
    username: input.username,
    password: input.password,
    role: input.role,
    full_name: input.fullName,
    email: input.email ?? null,
    active: input.active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('profiles').insert(payload).select('*').single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return mapSupabaseProfileToUser(data);
}

export interface UpdateUserInput {
  password?: string;
  role?: UserRole;
  fullName?: string;
  email?: string;
  active?: boolean;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.password !== undefined && input.password !== '') {
    payload.password = input.password;
  }
  if (input.role !== undefined) {
    payload.role = input.role;
  }
  if (input.fullName !== undefined) {
    payload.full_name = input.fullName;
  }
  if (input.email !== undefined) {
    payload.email = input.email ?? null;
  }
  if (input.active !== undefined) {
    payload.active = input.active;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return mapSupabaseProfileToUser(data);
}

export async function deactivateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to deactivate user: ${error.message}`);
  }
}

