import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Medication, StockAdjustment } from '@/lib/pharmacy-types';
import { Textarea } from '@/components/ui/textarea';

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (adjustment: StockAdjustment) => void;
  medication: Medication | null;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ 
  open, 
  onClose, 
  onSave, 
  medication 
}) => {
  const [formData, setFormData] = React.useState<StockAdjustment>({
    medicationId: '',
    type: 'receive',
    quantity: 0,
    reason: '',
    batchNumber: '',
    expirationDate: ''
  });

  React.useEffect(() => {
    if (medication) {
      setFormData(prev => ({ ...prev, medicationId: medication.id }));
    }
  }, [medication]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {medication?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Adjustment Type *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({...formData, type: value as any})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receive">Receive Shipment</SelectItem>
                <SelectItem value="dispense">Dispense</SelectItem>
                <SelectItem value="adjust">Manual Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input 
              type="number" 
              value={formData.quantity} 
              onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
              required
            />
          </div>
          <Button type="submit" className="w-full">Save Adjustment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
