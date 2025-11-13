import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Medication, MedicationCategory } from '@/lib/pharmacy-types';

interface AddMedicationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (medication: Partial<Medication>) => void;
  editingMedication?: Medication | null;
}

const categories: MedicationCategory[] = [
  'Antibiotics', 'Pain Relief', 'Cardiovascular', 'Diabetes', 
  'Respiratory', 'Gastrointestinal', 'Vitamins', 'Dermatology', 
  'Mental Health', 'Other'
];

export const AddMedicationModal: React.FC<AddMedicationModalProps> = ({ 
  open, 
  onClose, 
  onSave, 
  editingMedication 
}) => {
  const [formData, setFormData] = React.useState<Partial<Medication>>({
    name: '',
    ndcCode: '',
    category: 'Other',
    quantity: 0,
    unit: 'tablets',
    expirationDate: '',
    supplier: '',
    costPrice: 0,
    sellingPrice: 0,
    reorderPoint: 0,
    location: '',
    batchNumber: '',
    manufacturer: '',
    dosageForm: '',
    strength: ''
  });

  React.useEffect(() => {
    if (editingMedication) {
      setFormData(editingMedication);
    }
  }, [editingMedication]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingMedication ? 'Edit Medication' : 'Add New Medication'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Medication Name *</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>NDC Code *</Label>
              <Input 
                value={formData.ndcCode} 
                onChange={(e) => setFormData({...formData, ndcCode: e.target.value})}
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full">Save Medication</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
