import { Medication, InventoryStats } from './pharmacy-types';

export const getExpirationStatus = (expirationDate: string): 'expired' | 'critical' | 'warning' | 'good' => {
  const today = new Date();
  const expDate = new Date(expirationDate);
  const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'critical';
  if (daysUntilExpiry <= 90) return 'warning';
  return 'good';
};

export const getStockStatus = (quantity: number, reorderPoint: number): 'out' | 'critical' | 'low' | 'good' => {
  if (quantity === 0) return 'out';
  if (quantity <= reorderPoint * 0.3) return 'critical';
  if (quantity <= reorderPoint) return 'low';
  return 'good';
};

export const calculateInventoryStats = (medications: Medication[]): InventoryStats => {
  const totalValue = medications.reduce((sum, med) => sum + (med.quantity * med.costPrice), 0);
  const lowStockCount = medications.filter(med => getStockStatus(med.quantity, med.reorderPoint) !== 'good').length;
  const expiringCount = medications.filter(med => {
    const status = getExpirationStatus(med.expirationDate);
    return status === 'critical' || status === 'warning';
  }).length;
  
  return {
    totalMedications: medications.length,
    totalValue,
    lowStockCount,
    expiringCount
  };
};
