import { Medication } from './pharmacy-types';

export const additionalMedications: Medication[] = [
  // Diabetes
  { id: '15', name: 'Metformin 500mg', ndcCode: '00093-7214-01', category: 'Diabetes', quantity: 780, unit: 'tablets', expirationDate: '2026-05-12', supplier: 'McKesson', costPrice: 0.08, sellingPrice: 0.25, reorderPoint: 400, location: 'D4-01', batchNumber: 'MET2024-167', manufacturer: 'Teva', dosageForm: 'Tablet', strength: '500mg' },
  { id: '16', name: 'Glipizide 5mg', ndcCode: '00093-7267-01', category: 'Diabetes', quantity: 240, unit: 'tablets', expirationDate: '2025-11-30', supplier: 'Cardinal Health', costPrice: 0.15, sellingPrice: 0.45, reorderPoint: 150, location: 'D4-02', batchNumber: 'GLI2024-098', manufacturer: 'Mylan', dosageForm: 'Tablet', strength: '5mg' },
  { id: '17', name: 'Insulin Glargine 100U/mL', ndcCode: '00088-2220-33', category: 'Diabetes', quantity: 45, unit: 'vials', expirationDate: '2025-08-05', supplier: 'AmerisourceBergen', costPrice: 85.00, sellingPrice: 250.00, reorderPoint: 25, location: 'D4-03', batchNumber: 'INS2024-023', manufacturer: 'Sanofi', dosageForm: 'Injectable', strength: '100U/mL' },
  
  // Respiratory
  { id: '18', name: 'Albuterol Inhaler', ndcCode: '00173-0682-20', category: 'Respiratory', quantity: 95, unit: 'inhalers', expirationDate: '2026-03-28', supplier: 'McKesson', costPrice: 12.50, sellingPrice: 35.00, reorderPoint: 50, location: 'E5-01', batchNumber: 'ALB2024-134', manufacturer: 'GSK', dosageForm: 'Inhaler', strength: '90mcg' },
  { id: '19', name: 'Montelukast 10mg', ndcCode: '00093-7355-56', category: 'Respiratory', quantity: 18, unit: 'tablets', expirationDate: '2025-10-20', supplier: 'Cardinal Health', costPrice: 0.35, sellingPrice: 1.05, reorderPoint: 100, location: 'E5-02', batchNumber: 'MON2024-076', manufacturer: 'Dr. Reddy', dosageForm: 'Tablet', strength: '10mg' },
];

