// Product Form component with optional initial stock receiving
import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export type ProductFormValues = {
  id?: string;
  name: string;
  ndcCode?: string;
  category: string;
  manufacturer: string;
  dosageForm?: string;
  strength?: string;
  sellingPrice: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  barcode?: string;
  description?: string;
  active: boolean;
};

interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: ProductFormValues, initialStock?: {
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    supplier?: string;
  }) => void;
  editingProduct?: Product | null;
}

const categories = [
  'Antibiotics',
  'Pain Relief',
  'Cardiovascular',
  'Diabetes',
  'Respiratory',
  'Gastrointestinal',
  'Vitamins',
  'Dermatology',
  'Mental Health',
  'Other',
];

export const ProductForm: React.FC<ProductFormProps> = ({
  open,
  onClose,
  onSave,
  editingProduct,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    ndcCode: '',
    category: 'Other',
    manufacturer: '',
    dosageForm: '',
    strength: '',
    sellingPrice: 0,
    reorderPoint: 0,
    reorderQuantity: 0,
    location: '',
    barcode: '',
    description: '',
    active: true,
  });

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const [addInitialStock, setAddInitialStock] = useState(false);
  const [initialStock, setInitialStock] = useState({
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
    const year = parseInt(initialStock.expiryYear);
    const month = parseInt(initialStock.expiryMonth);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [initialStock.expiryYear, initialStock.expiryMonth]);

  // Get month name for display
  const getMonthName = (month: string) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(month) - 1];
  };

  useEffect(() => {
    if (editingProduct) {
      setFormData(editingProduct);
      setAddInitialStock(false);
    } else {
      setFormData({
        name: '',
        ndcCode: '',
        category: 'Other',
        manufacturer: '',
        dosageForm: '',
        strength: '',
        sellingPrice: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
        location: '',
        barcode: '',
        description: '',
        active: true,
      });
      setInitialStock({
        batchNumber: '',
        expiryYear: currentYear.toString(),
        expiryMonth: currentMonth.toString(),
        expiryDay: currentDay.toString(),
        quantity: '',
        costPrice: '',
        supplier: '',
      });
      setAddInitialStock(false);
    }
  }, [editingProduct, open, currentYear, currentMonth, currentDay]);

  // Reset day if it's invalid for the selected month/year
  useEffect(() => {
    if (addInitialStock) {
      const maxDay = parseInt(dayOptions[dayOptions.length - 1] || '31');
      if (parseInt(initialStock.expiryDay) > maxDay) {
        setInitialStock(prev => ({ ...prev, expiryDay: maxDay.toString() }));
      }
    }
  }, [initialStock.expiryYear, initialStock.expiryMonth, dayOptions, initialStock.expiryDay, addInitialStock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const product: ProductFormValues = {
      id: editingProduct?.id,
      name: formData.name!,
      ndcCode: formData.ndcCode,
      category: formData.category!,
      manufacturer: formData.manufacturer!,
      dosageForm: formData.dosageForm,
      strength: formData.strength,
      sellingPrice: Number(formData.sellingPrice) || 0,
      reorderPoint: Number(formData.reorderPoint) || 0,
      reorderQuantity: Number(formData.reorderQuantity) || 0,
      location: formData.location,
      barcode: formData.barcode,
      description: formData.description,
      active: formData.active ?? true,
    };

    if (addInitialStock && !editingProduct) {
      if (!initialStock.batchNumber || !initialStock.quantity || !initialStock.costPrice) {
        alert('Please fill in all required initial stock fields');
        return;
      }

      const expiryDate = new Date(
        parseInt(initialStock.expiryYear),
        parseInt(initialStock.expiryMonth) - 1,
        parseInt(initialStock.expiryDay)
      );
      expiryDate.setHours(0, 0, 0, 0);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      if (expiryDate < todayDate) {
        alert('Expiry date cannot be in the past');
        return;
      }

      onSave(product, {
        batchNumber: initialStock.batchNumber,
        expiryDate: expiryDate.toISOString(),
        quantity: Number(initialStock.quantity),
        costPrice: Number(initialStock.costPrice),
        supplier: initialStock.supplier || undefined,
      });
    } else {
      onSave(product);
    }

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ndcCode">NDC Code</Label>
              <Input
                id="ndcCode"
                value={formData.ndcCode || ''}
                onChange={(e) => setFormData({ ...formData, ndcCode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer || ''}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dosageForm">Dosage Form</Label>
              <Input
                id="dosageForm"
                value={formData.dosageForm || ''}
                onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                placeholder="e.g., Tablets, Capsules"
              />
            </div>
            <div>
              <Label htmlFor="strength">Strength</Label>
              <Input
                id="strength"
                value={formData.strength || ''}
                onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                placeholder="e.g., 500mg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sellingPrice">Selling Price *</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                value={formData.sellingPrice || ''}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value ? Number(e.target.value) : '' })}
                required
              />
            </div>
            <div>
              <Label htmlFor="reorderPoint">Reorder Point *</Label>
              <Input
                id="reorderPoint"
                type="number"
                value={formData.reorderPoint || ''}
                onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value ? Number(e.target.value) : '' })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
              <Input
                id="reorderQuantity"
                type="number"
                value={formData.reorderQuantity || ''}
                onChange={(e) => setFormData({ ...formData, reorderQuantity: e.target.value ? Number(e.target.value) : '' })}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              value={formData.barcode || ''}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {!editingProduct && (
            <div className="flex items-center space-x-2 pt-4 border-t">
              <Checkbox
                id="addInitialStock"
                checked={addInitialStock}
                onCheckedChange={(checked) => setAddInitialStock(checked === true)}
              />
              <Label htmlFor="addInitialStock" className="cursor-pointer">
                Add initial stock
              </Label>
            </div>
          )}

          {addInitialStock && !editingProduct && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h3 className="font-medium">Initial Stock Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batchNumber">Batch Number *</Label>
                  <Input
                    id="batchNumber"
                    value={initialStock.batchNumber}
                    onChange={(e) => setInitialStock({ ...initialStock, batchNumber: e.target.value })}
                    required={addInitialStock}
                  />
                </div>
                <div>
                  <Label>Expiry Date *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Select
                        value={initialStock.expiryYear}
                        onValueChange={(value) => setInitialStock({ ...initialStock, expiryYear: value })}
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
                        value={initialStock.expiryMonth}
                        onValueChange={(value) => setInitialStock({ ...initialStock, expiryMonth: value, expiryDay: '1' })}
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
                        value={initialStock.expiryDay}
                        onValueChange={(value) => setInitialStock({ ...initialStock, expiryDay: value })}
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={initialStock.quantity}
                    onChange={(e) => setInitialStock({ ...initialStock, quantity: e.target.value })}
                    required={addInitialStock}
                  />
                </div>
                <div>
                  <Label htmlFor="costPrice">Cost Price *</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    value={initialStock.costPrice}
                    onChange={(e) => setInitialStock({ ...initialStock, costPrice: e.target.value })}
                    required={addInitialStock}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={initialStock.supplier}
                  onChange={(e) => setInitialStock({ ...initialStock, supplier: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{editingProduct ? 'Update' : 'Create'} Product</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};


