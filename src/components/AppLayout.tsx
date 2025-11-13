import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dashboard } from './pharmacy/Dashboard';
import { MedicationTable } from './pharmacy/MedicationTable';
import { SearchFilters } from './pharmacy/SearchFilters';
import { AddMedicationModal } from './pharmacy/AddMedicationModal';
import { StockAdjustmentModal } from './pharmacy/StockAdjustmentModal';
import { allMedications } from '@/lib/pharmacy-data';
import { Medication, StockAdjustment } from '@/lib/pharmacy-types';
import { getExpirationStatus, getStockStatus } from '@/lib/pharmacy-utils';

export default function AppLayout() {
  const [medications, setMedications] = useState<Medication[]>(allMedications);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [adjustingMedication, setAdjustingMedication] = useState<Medication | null>(null);

  const filteredMedications = medications.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         med.ndcCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || med.category === categoryFilter;
    
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = getStockStatus(med.quantity, med.reorderPoint) !== 'good';
    } else if (stockFilter === 'out') {
      matchesStock = med.quantity === 0;
    }
    
    let matchesExpiry = true;
    if (expiryFilter === 'expiring') {
      const status = getExpirationStatus(med.expirationDate);
      matchesExpiry = status === 'critical' || status === 'warning';
    } else if (expiryFilter === 'expired') {
      matchesExpiry = getExpirationStatus(med.expirationDate) === 'expired';
    }
    
    return matchesSearch && matchesCategory && matchesStock && matchesExpiry;
  });

  const handleSaveMedication = (medicationData: Partial<Medication>) => {
    if (editingMedication) {
      setMedications(meds => meds.map(m => m.id === editingMedication.id ? { ...m, ...medicationData } : m));
    } else {
      const newMed: Medication = {
        id: String(Date.now()),
        ...medicationData as Medication
      };
      setMedications(meds => [...meds, newMed]);
    }
    setEditingMedication(null);
  };

  const handleStockAdjustment = (adjustment: StockAdjustment) => {
    setMedications(meds => meds.map(m => {
      if (m.id === adjustment.medicationId) {
        let newQuantity = m.quantity;
        if (adjustment.type === 'receive') newQuantity += adjustment.quantity;
        else if (adjustment.type === 'dispense') newQuantity -= adjustment.quantity;
        else newQuantity = adjustment.quantity;
        return { ...m, quantity: Math.max(0, newQuantity) };
      }
      return m;
    }));
    setAdjustingMedication(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f1fbf4] via-white to-[#f6fff8] dark:from-[#06170d] dark:via-[#04110a] dark:to-[#020b05]">
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0f6f3d] to-[#0c8dc4] dark:from-[#5dd89c] dark:to-[#57c8f3] bg-clip-text text-transparent">
              Pharmacy Inventory Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage your medication inventory efficiently</p>
          </div>
          <Button onClick={() => setAddModalOpen(true)} size="lg" className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-5 w-5" /> Add Medication
          </Button>
        </div>

        <Dashboard medications={medications} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Medication Inventory</h2>
            <span className="text-sm text-muted-foreground">{filteredMedications.length} items</span>
          </div>
          
          <SearchFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
            expiryFilter={expiryFilter}
            onExpiryFilterChange={setExpiryFilter}
          />

          <MedicationTable
            medications={filteredMedications}
            onEdit={(med) => { setEditingMedication(med); setAddModalOpen(true); }}
            onAdjustStock={(med) => { setAdjustingMedication(med); setStockModalOpen(true); }}
          />
        </div>

        <AddMedicationModal
          open={addModalOpen}
          onClose={() => { setAddModalOpen(false); setEditingMedication(null); }}
          onSave={handleSaveMedication}
          editingMedication={editingMedication}
        />

        <StockAdjustmentModal
          open={stockModalOpen}
          onClose={() => { setStockModalOpen(false); setAdjustingMedication(null); }}
          onSave={handleStockAdjustment}
          medication={adjustingMedication}
        />
      </div>
    </div>
  );
}
