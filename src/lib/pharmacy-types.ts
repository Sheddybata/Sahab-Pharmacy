export type MedicationCategory = 
  | 'Antibiotics'
  | 'Pain Relief'
  | 'Cardiovascular'
  | 'Diabetes'
  | 'Respiratory'
  | 'Gastrointestinal'
  | 'Vitamins'
  | 'Dermatology'
  | 'Mental Health'
  | 'Antimalarials'
  | 'Cold chain products'
  | 'Pile disorders'
  | 'Antispasmodics'
  | 'Antifungals'
  | 'Antivirals'
  | 'Gout products'
  | 'Supplements'
  | 'Other';

export interface Medication {
  id: string;
  name: string;
  ndcCode: string;
  category: MedicationCategory;
  quantity: number;
  unit: string;
  expirationDate: string;
  supplier: string;
  costPrice: number;
  sellingPrice: number;
  reorderPoint: number;
  location: string;
  batchNumber: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
}

export interface StockAdjustment {
  medicationId: string;
  type: 'receive' | 'dispense' | 'adjust';
  quantity: number;
  reason?: string;
  batchNumber?: string;
  expirationDate?: string;
}

export interface InventoryStats {
  totalMedications: number;
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
}
