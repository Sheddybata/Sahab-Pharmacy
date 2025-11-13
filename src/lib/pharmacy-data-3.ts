import { Medication } from './pharmacy-types';

export const moreMedications: Medication[] = [
  // Gastrointestinal
  { id: '20', name: 'Omeprazole 20mg', ndcCode: '00093-7347-56', category: 'Gastrointestinal', quantity: 620, unit: 'capsules', expirationDate: '2026-08-14', supplier: 'AmerisourceBergen', costPrice: 0.12, sellingPrice: 0.35, reorderPoint: 300, location: 'F6-01', batchNumber: 'OME2024-189', manufacturer: 'Sandoz', dosageForm: 'Capsule', strength: '20mg' },
  { id: '21', name: 'Pantoprazole 40mg', ndcCode: '00093-5129-56', category: 'Gastrointestinal', quantity: 380, unit: 'tablets', expirationDate: '2026-01-09', supplier: 'McKesson', costPrice: 0.18, sellingPrice: 0.55, reorderPoint: 200, location: 'F6-02', batchNumber: 'PAN2024-112', manufacturer: 'Teva', dosageForm: 'Tablet', strength: '40mg' },
  { id: '22', name: 'Ondansetron 4mg', ndcCode: '00093-0150-56', category: 'Gastrointestinal', quantity: 12, unit: 'tablets', expirationDate: '2025-09-22', supplier: 'Cardinal Health', costPrice: 0.85, sellingPrice: 2.50, reorderPoint: 80, location: 'F6-03', batchNumber: 'OND2024-067', manufacturer: 'Zydus', dosageForm: 'Tablet', strength: '4mg' },
  
  // Vitamins
  { id: '23', name: 'Vitamin D3 1000IU', ndcCode: '00113-0368-62', category: 'Vitamins', quantity: 950, unit: 'softgels', expirationDate: '2026-12-31', supplier: 'McKesson', costPrice: 0.04, sellingPrice: 0.12, reorderPoint: 500, location: 'G7-01', batchNumber: 'VIT2024-234', manufacturer: 'Nature Made', dosageForm: 'Softgel', strength: '1000IU' },
  { id: '24', name: 'Multivitamin Adult', ndcCode: '00113-0425-62', category: 'Vitamins', quantity: 1100, unit: 'tablets', expirationDate: '2027-02-28', supplier: 'AmerisourceBergen', costPrice: 0.06, sellingPrice: 0.18, reorderPoint: 600, location: 'G7-02', batchNumber: 'MUL2024-267', manufacturer: 'Centrum', dosageForm: 'Tablet', strength: 'Standard' },
];
