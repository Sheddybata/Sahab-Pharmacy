import { Medication } from './pharmacy-types';

export const finalMedications: Medication[] = [
  // Mental Health
  { id: '25', name: 'Sertraline 50mg', ndcCode: '00093-7212-56', category: 'Mental Health', quantity: 420, unit: 'tablets', expirationDate: '2026-06-18', supplier: 'Cardinal Health', costPrice: 0.22, sellingPrice: 0.65, reorderPoint: 250, location: 'H8-01', batchNumber: 'SER2024-178', manufacturer: 'Teva', dosageForm: 'Tablet', strength: '50mg' },
  { id: '26', name: 'Escitalopram 10mg', ndcCode: '00093-7239-56', category: 'Mental Health', quantity: 310, unit: 'tablets', expirationDate: '2025-12-22', supplier: 'McKesson', costPrice: 0.28, sellingPrice: 0.85, reorderPoint: 180, location: 'H8-02', batchNumber: 'ESC2024-145', manufacturer: 'Aurobindo', dosageForm: 'Tablet', strength: '10mg' },
  { id: '27', name: 'Alprazolam 0.5mg', ndcCode: '00093-0094-01', category: 'Mental Health', quantity: 8, unit: 'tablets', expirationDate: '2025-11-10', supplier: 'AmerisourceBergen', costPrice: 0.15, sellingPrice: 0.45, reorderPoint: 60, location: 'H8-03', batchNumber: 'ALP2024-089', manufacturer: 'Greenstone', dosageForm: 'Tablet', strength: '0.5mg' },
  
  // Dermatology
  { id: '28', name: 'Hydrocortisone Cream 1%', ndcCode: '00113-0873-62', category: 'Dermatology', quantity: 180, unit: 'tubes', expirationDate: '2026-04-25', supplier: 'McKesson', costPrice: 2.50, sellingPrice: 7.50, reorderPoint: 100, location: 'I9-01', batchNumber: 'HYD2024-156', manufacturer: 'Taro', dosageForm: 'Cream', strength: '1%' },
  { id: '29', name: 'Clotrimazole Cream 1%', ndcCode: '00113-0416-62', category: 'Dermatology', quantity: 145, unit: 'tubes', expirationDate: '2026-02-14', supplier: 'Cardinal Health', costPrice: 3.20, sellingPrice: 9.50, reorderPoint: 80, location: 'I9-02', batchNumber: 'CLO2024-123', manufacturer: 'Perrigo', dosageForm: 'Cream', strength: '1%' },
];
