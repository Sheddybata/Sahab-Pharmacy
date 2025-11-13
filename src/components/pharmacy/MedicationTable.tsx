import React, { useState } from 'react';
import { Medication } from '@/lib/pharmacy-types';
import { getExpirationStatus, getStockStatus } from '@/lib/pharmacy-utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Package } from 'lucide-react';

interface MedicationTableProps {
  medications: Medication[];
  onEdit: (medication: Medication) => void;
  onAdjustStock: (medication: Medication) => void;
}

export const MedicationTable: React.FC<MedicationTableProps> = ({ medications, onEdit, onAdjustStock }) => {
  const getExpirationBadge = (expirationDate: string) => {
    const status = getExpirationStatus(expirationDate);
    const variants = {
      expired: 'destructive',
      critical: 'destructive',
      warning: 'default',
      good: 'secondary'
    };
    return <Badge variant={variants[status] as any}>{new Date(expirationDate).toLocaleDateString()}</Badge>;
  };

  const getStockBadge = (quantity: number, reorderPoint: number) => {
    const status = getStockStatus(quantity, reorderPoint);
    const config = {
      out: { variant: 'destructive', text: 'Out of Stock' },
      critical: { variant: 'destructive', text: `${quantity} units` },
      low: { variant: 'default', text: `${quantity} units` },
      good: { variant: 'secondary', text: `${quantity} units` }
    };
    const { variant, text } = config[status];
    return <Badge variant={variant as any}>{text}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>NDC Code</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Expiration</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medications.map((med) => (
            <TableRow key={med.id}>
              <TableCell className="font-medium">{med.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{med.ndcCode}</TableCell>
              <TableCell><Badge variant="outline">{med.category}</Badge></TableCell>
              <TableCell>{getStockBadge(med.quantity, med.reorderPoint)}</TableCell>
              <TableCell>{getExpirationBadge(med.expirationDate)}</TableCell>
              <TableCell className="text-sm">{med.location}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(med)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAdjustStock(med)}>
                  <Package className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
