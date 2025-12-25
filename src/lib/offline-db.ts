import Dexie, { Table } from 'dexie';
import { Product, Sale } from './types';

// Define the database schema
export interface OfflineProduct extends Product {
  synced?: boolean;
  pendingDelete?: boolean;
}

export interface OfflineSale extends Sale {
  synced?: boolean;
}

export interface OfflineStockBatch {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  supplier?: string;
  synced?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

// Define the database
export class OfflineDatabase extends Dexie {
  products!: Table<OfflineProduct, string>;
  sales!: Table<OfflineSale, string>;
  stockBatches!: Table<OfflineStockBatch, string>;
  pendingOperations!: Table<PendingOperation, string>;

  constructor() {
    super('SahabPharmacyDB');
    
    this.version(1).stores({
      products: 'id, name, category, active, synced',
      sales: 'id, createdAt, synced, refunded, saleNumber',
      stockBatches: 'id, productId, synced',
      pendingOperations: 'id, table, timestamp',
    });
  }
}

// Create a singleton instance
export const db = new OfflineDatabase();

