// Receiving Form component for stock receiving
import React, { useState, useEffect } from 'react';
import { Product } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceivingFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    productId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    supplier?: string;
  }) => void;
  product: Product | null;
}

export const ReceivingForm: React.FC<ReceivingFormProps> = ({
  open,
  onClose,
  onSave,
  product,
}) => {
  const [formData, setFormData] = useState({
    batchNumber: '',
    expiryDate: new Date(),
    quantity: '',
    costPrice: '',
    supplier: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        batchNumber: '',
        expiryDate: new Date(),
        quantity: '',
        costPrice: '',
        supplier: '',
      });
    }
  }, [open, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    if (!formData.batchNumber || !formData.quantity || !formData.costPrice) {
      alert('Please fill in all required fields');
      return;
    }

    const expiryDate = new Date(formData.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      alert('Expiry date cannot be in the past');
      return;
    }

    onSave({
      productId: product.id,
      batchNumber: formData.batchNumber,
      expiryDate: expiryDate.toISOString(),
      quantity: Number(formData.quantity),
      costPrice: Number(formData.costPrice),
      supplier: formData.supplier || undefined,
    });

    onClose();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive Stock - {product.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="batchNumber">Batch Number *</Label>
            <Input
              id="batchNumber"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              required
              placeholder="Enter batch number"
            />
          </div>

          <div>
            <Label htmlFor="expiryDate">Expiry Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !formData.expiryDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expiryDate ? (
                    format(formData.expiryDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.expiryDate}
                  onSelect={(date) => {
                    if (date) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selectedDate = new Date(date);
                      selectedDate.setHours(0, 0, 0, 0);
                      if (selectedDate >= today) {
                        setFormData({ ...formData, expiryDate: date });
                      } else {
                        alert('Expiry date cannot be in the past');
                      }
                    }
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="costPrice">Cost Price *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                required
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Receive Stock</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};


