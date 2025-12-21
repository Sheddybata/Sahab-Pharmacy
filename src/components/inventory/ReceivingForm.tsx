// Receiving Form component for stock receiving
import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const [formData, setFormData] = useState({
    batchNumber: '',
    expiryYear: currentYear.toString(),
    expiryMonth: currentMonth.toString(),
    expiryDay: currentDay.toString(),
    quantity: '',
    costPrice: '',
    supplier: '',
  });

  // Generate year options (current year to 10 years ahead)
  const yearOptions = useMemo(() => {
    const years = [];
    for (let i = currentYear; i <= currentYear + 10; i++) {
      years.push(i.toString());
    }
    return years;
  }, [currentYear]);

  // Generate month options
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  }, []);

  // Generate day options based on selected month and year
  const dayOptions = useMemo(() => {
    const year = parseInt(formData.expiryYear);
    const month = parseInt(formData.expiryMonth);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [formData.expiryYear, formData.expiryMonth]);

  // Get month name for display
  const getMonthName = (month: string) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(month) - 1];
  };

  useEffect(() => {
    if (open) {
      setFormData({
        batchNumber: '',
        expiryYear: currentYear.toString(),
        expiryMonth: currentMonth.toString(),
        expiryDay: currentDay.toString(),
        quantity: '',
        costPrice: '',
        supplier: '',
      });
    }
  }, [open, product, currentYear, currentMonth, currentDay]);

  // Reset day if it's invalid for the selected month/year
  useEffect(() => {
    const maxDay = parseInt(dayOptions[dayOptions.length - 1] || '31');
    if (parseInt(formData.expiryDay) > maxDay) {
      setFormData(prev => ({ ...prev, expiryDay: maxDay.toString() }));
    }
  }, [formData.expiryYear, formData.expiryMonth, dayOptions, formData.expiryDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    if (!formData.batchNumber || !formData.quantity || !formData.costPrice) {
      alert('Please fill in all required fields');
      return;
    }

    const expiryDate = new Date(
      parseInt(formData.expiryYear),
      parseInt(formData.expiryMonth) - 1,
      parseInt(formData.expiryDay)
    );
    expiryDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (expiryDate < todayDate) {
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
            <Label>Expiry Date *</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Select
                  value={formData.expiryYear}
                  onValueChange={(value) => setFormData({ ...formData, expiryYear: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={formData.expiryMonth}
                  onValueChange={(value) => setFormData({ ...formData, expiryMonth: value, expiryDay: '1' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>
                        {getMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={formData.expiryDay}
                  onValueChange={(value) => setFormData({ ...formData, expiryDay: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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


