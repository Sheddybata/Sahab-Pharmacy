// Core Type Definitions for Sahab Pharmacy

export type UserRole = 'admin' | 'cashier';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PaymentMethod = 'cash' | 'card' | 'insurance';
export type StockMovementType = 'purchase' | 'sale' | 'adjustment' | 'stocktake' | 'return';
export type AuditModule = 'auth' | 'inventory' | 'sales' | 'stocktake' | 'reports' | 'users' | 'settings';

export interface User {
  id: string;
  username: string;
  password: string; // In production, this would be hashed
  role: UserRole;
  fullName: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  ndcCode?: string;
  category: string;
  manufacturer: string;
  dosageForm?: string;
  strength?: string;
  sellingPrice: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  barcode?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockBatch {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string; // ISO date string
  costPrice: number;
  supplier?: string;
  receivedDate: string;
  remainingQuantity: number; // For FIFO tracking
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  batchId?: string; // For FIFO tracking
  type: StockMovementType;
  quantity: number; // Positive for purchases, negative for sales
  costPrice: number; // Cost per unit at time of movement
  sellingPrice?: number; // For sales
  reason?: string;
  reference?: string; // Sale ID, stocktake ID, etc.
  userId?: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  saleNumber: string; // Unique sale identifier
  items: SaleItem[];
  subtotal: number;
  tax?: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  refunded: boolean;
  refundedAt?: string;
  refundedBy?: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
  costPrice: number; // For COGS calculation
  total: number;
}

export interface StocktakeSession {
  id: string;
  sessionNumber: string;
  status: 'open' | 'counting' | 'review' | 'approved' | 'cancelled';
  createdBy: string;
  createdByName: string;
  startedAt: string;
  completedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface StocktakeItem {
  id: string;
  sessionId: string;
  productId: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  adjusted: boolean;
  adjustmentMovementId?: string;
}

export interface Alert {
  id: string;
  productId: string;
  productName: string;
  type: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';
  severity: AlertSeverity;
  message: string;
  batchId?: string;
  expiryDate?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  module: AuditModule;
  action: string;
  details?: string;
  resourceId?: string;
  resourceType?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  todaySales: number;
  monthlySales: number;
  todayRevenue: number;
  monthlyRevenue: number;
}

export interface DashboardMetrics {
  stats: InventoryStats;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  unreadAlerts: number;
}


