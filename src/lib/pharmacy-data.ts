import { Medication } from './pharmacy-types';

export const mockMedications: Medication[] = [
  // Antibiotics
  { id: '1', name: 'Amoxicillin 500mg', ndcCode: '00093-4155-73', category: 'Antibiotics', quantity: 450, unit: 'capsules', expirationDate: '2025-12-15', supplier: 'McKesson', costPrice: 0.15, sellingPrice: 0.45, reorderPoint: 200, location: 'A1-01', batchNumber: 'AMX2024-001', manufacturer: 'Teva', dosageForm: 'Capsule', strength: '500mg' },
  { id: '2', name: 'Azithromycin 250mg', ndcCode: '00093-7146-56', category: 'Antibiotics', quantity: 85, unit: 'tablets', expirationDate: '2025-08-20', supplier: 'Cardinal Health', costPrice: 1.20, sellingPrice: 3.50, reorderPoint: 100, location: 'A1-02', batchNumber: 'AZI2024-012', manufacturer: 'Sandoz', dosageForm: 'Tablet', strength: '250mg' },
  { id: '3', name: 'Ciprofloxacin 500mg', ndcCode: '00093-0864-01', category: 'Antibiotics', quantity: 180, unit: 'tablets', expirationDate: '2026-03-10', supplier: 'AmerisourceBergen', costPrice: 0.80, sellingPrice: 2.40, reorderPoint: 150, location: 'A1-03', batchNumber: 'CIP2024-045', manufacturer: 'Dr. Reddy', dosageForm: 'Tablet', strength: '500mg' },
  { id: '4', name: 'Doxycycline 100mg', ndcCode: '00093-1095-01', category: 'Antibiotics', quantity: 25, unit: 'capsules', expirationDate: '2025-11-05', supplier: 'McKesson', costPrice: 0.35, sellingPrice: 1.05, reorderPoint: 120, location: 'A1-04', batchNumber: 'DOX2024-078', manufacturer: 'Mylan', dosageForm: 'Capsule', strength: '100mg' },
  { id: '5', name: 'Cephalexin 500mg', ndcCode: '00093-3147-01', category: 'Antibiotics', quantity: 320, unit: 'capsules', expirationDate: '2026-01-22', supplier: 'Cardinal Health', costPrice: 0.25, sellingPrice: 0.75, reorderPoint: 180, location: 'A1-05', batchNumber: 'CEP2024-091', manufacturer: 'Lupin', dosageForm: 'Capsule', strength: '500mg' },
  
  // Pain Relief
  { id: '6', name: 'Ibuprofen 200mg', ndcCode: '00113-0467-62', category: 'Pain Relief', quantity: 890, unit: 'tablets', expirationDate: '2026-06-30', supplier: 'McKesson', costPrice: 0.05, sellingPrice: 0.15, reorderPoint: 500, location: 'B2-01', batchNumber: 'IBU2024-156', manufacturer: 'Major Pharma', dosageForm: 'Tablet', strength: '200mg' },
  { id: '7', name: 'Acetaminophen 500mg', ndcCode: '00113-0272-62', category: 'Pain Relief', quantity: 1200, unit: 'tablets', expirationDate: '2026-09-15', supplier: 'AmerisourceBergen', costPrice: 0.03, sellingPrice: 0.10, reorderPoint: 600, location: 'B2-02', batchNumber: 'ACE2024-203', manufacturer: 'Perrigo', dosageForm: 'Tablet', strength: '500mg' },
  { id: '8', name: 'Naproxen 220mg', ndcCode: '00113-0184-62', category: 'Pain Relief', quantity: 340, unit: 'tablets', expirationDate: '2025-11-28', supplier: 'Cardinal Health', costPrice: 0.08, sellingPrice: 0.25, reorderPoint: 250, location: 'B2-03', batchNumber: 'NAP2024-087', manufacturer: 'Teva', dosageForm: 'Tablet', strength: '220mg' },

  { id: '9', name: 'Tramadol 50mg', ndcCode: '00406-0537-01', category: 'Pain Relief', quantity: 15, unit: 'tablets', expirationDate: '2025-10-12', supplier: 'McKesson', costPrice: 0.45, sellingPrice: 1.35, reorderPoint: 80, location: 'B2-04', batchNumber: 'TRA2024-034', manufacturer: 'Amneal', dosageForm: 'Tablet', strength: '50mg' },
  
  // Cardiovascular
  { id: '10', name: 'Lisinopril 10mg', ndcCode: '00378-0172-93', category: 'Cardiovascular', quantity: 520, unit: 'tablets', expirationDate: '2026-04-18', supplier: 'AmerisourceBergen', costPrice: 0.12, sellingPrice: 0.35, reorderPoint: 300, location: 'C3-01', batchNumber: 'LIS2024-145', manufacturer: 'Mylan', dosageForm: 'Tablet', strength: '10mg' },
  { id: '11', name: 'Atorvastatin 20mg', ndcCode: '00378-6354-93', category: 'Cardiovascular', quantity: 680, unit: 'tablets', expirationDate: '2026-07-25', supplier: 'Cardinal Health', costPrice: 0.18, sellingPrice: 0.55, reorderPoint: 350, location: 'C3-02', batchNumber: 'ATO2024-198', manufacturer: 'Aurobindo', dosageForm: 'Tablet', strength: '20mg' },
  { id: '12', name: 'Metoprolol 50mg', ndcCode: '00378-0465-93', category: 'Cardiovascular', quantity: 410, unit: 'tablets', expirationDate: '2025-12-08', supplier: 'McKesson', costPrice: 0.15, sellingPrice: 0.45, reorderPoint: 250, location: 'C3-03', batchNumber: 'MET2024-112', manufacturer: 'Zydus', dosageForm: 'Tablet', strength: '50mg' },
  { id: '13', name: 'Amlodipine 5mg', ndcCode: '00378-6380-77', category: 'Cardiovascular', quantity: 55, unit: 'tablets', expirationDate: '2025-09-14', supplier: 'AmerisourceBergen', costPrice: 0.10, sellingPrice: 0.30, reorderPoint: 200, location: 'C3-04', batchNumber: 'AML2024-067', manufacturer: 'Teva', dosageForm: 'Tablet', strength: '5mg' },
  { id: '14', name: 'Losartan 50mg', ndcCode: '00378-6122-93', category: 'Cardiovascular', quantity: 290, unit: 'tablets', expirationDate: '2026-02-20', supplier: 'Cardinal Health', costPrice: 0.20, sellingPrice: 0.60, reorderPoint: 180, location: 'C3-05', batchNumber: 'LOS2024-089', manufacturer: 'Torrent', dosageForm: 'Tablet', strength: '50mg' },
];

// Import additional medications
import { additionalMedications } from './pharmacy-data-2';
import { moreMedications } from './pharmacy-data-3';
import { finalMedications } from './pharmacy-data-4';

export const allMedications = [...mockMedications, ...additionalMedications, ...moreMedications, ...finalMedications];
