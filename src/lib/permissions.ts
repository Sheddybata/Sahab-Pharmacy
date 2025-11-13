// Role-based permissions system
import { UserRole, AuditModule } from './types';

export type Permission = 
  | 'products.view'
  | 'products.add'
  | 'products.edit'
  | 'products.delete'
  | 'inventory.view'
  | 'inventory.receive'
  | 'inventory.adjust'
  | 'stocktake.create'
  | 'stocktake.approve'
  | 'sales.view'
  | 'sales.process'
  | 'sales.refund'
  | 'reports.view'
  | 'reports.export'
  | 'users.view'
  | 'users.add'
  | 'users.edit'
  | 'users.delete'
  | 'audit.view'
  | 'audit.export'
  | 'settings.view'
  | 'settings.edit';

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'products.view',
    'products.add',
    'products.edit',
    'products.delete',
    'inventory.view',
    'inventory.receive',
    'inventory.adjust',
    'stocktake.create',
    'stocktake.approve',
    'sales.view',
    'sales.process',
    'sales.refund',
    'reports.view',
    'reports.export',
    'users.view',
    'users.add',
    'users.edit',
    'users.delete',
    'audit.view',
    'audit.export',
    'settings.view',
    'settings.edit',
  ],
  cashier: [
    'products.view',
    'inventory.view',
    'sales.view',
    'sales.process',
    'sales.refund',
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const canAccessModule = (role: UserRole, module: AuditModule): boolean => {
  const modulePermissions: Record<AuditModule, Permission[]> = {
    auth: [],
    inventory: ['inventory.view', 'products.view'],
    sales: ['sales.view', 'sales.process'],
    stocktake: ['stocktake.create'],
    reports: ['reports.view'],
    users: ['users.view'],
    settings: ['settings.view'],
  audit: ['audit.view'],
  };

  const requiredPermissions = modulePermissions[module];

  if (!requiredPermissions) {
    return false;
  }

  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some(perm => hasPermission(role, perm));
};

export const getRolePermissions = (role: UserRole): Permission[] => {
  return rolePermissions[role] ?? [];
};


