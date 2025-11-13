import React from 'react';
import { StatsCard } from './StatsCard';
import { Package, AlertTriangle, Calendar, DollarSign } from 'lucide-react';
import { Medication } from '@/lib/pharmacy-types';
import { calculateInventoryStats } from '@/lib/pharmacy-utils';
import { formatCurrency } from '@/lib/utils';

interface DashboardProps {
  medications: Medication[];
}

export const Dashboard: React.FC<DashboardProps> = ({ medications }) => {
  const stats = calculateInventoryStats(medications);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your pharmacy inventory</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Medications"
          value={stats.totalMedications}
          icon={Package}
          description="Active products in inventory"
          className="bg-gradient-to-br from-[#dff7e8] to-[#bceecf] dark:from-[#0d2616] dark:to-[#16442a]"
        />
        <StatsCard
          title="Low Stock Items"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          description="Items below reorder point"
          className="bg-gradient-to-br from-[#ffe6e4] to-[#ffcfc9] dark:from-[#3a1513] dark:to-[#5a1f1c]"
        />
        <StatsCard
          title="Expiring Soon"
          value={stats.expiringCount}
          icon={Calendar}
          description="Items expiring within 90 days"
          className="bg-gradient-to-br from-[#fff1d9] to-[#ffe3ab] dark:from-[#3b290d] dark:to-[#5d3d0f]"
        />
        <StatsCard
          title="Inventory Value"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          description="Total cost value"
          className="bg-gradient-to-br from-[#d9f2fb] to-[#bde6f7] dark:from-[#0b2535] dark:to-[#123a52]"
        />
      </div>
    </div>
  );
};
