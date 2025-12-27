// Updated Dashboard component
import React from 'react';
import { StatsCard } from '../pharmacy/StatsCard';
import { Package, AlertTriangle, Calendar, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
import { calculateInventoryStatsAsync, getTopSellingProductsAsync } from '@/lib/calculations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '@/services/alerts';

export const Dashboard: React.FC = () => {
  const {
    data: statsData,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['inventory_stats'],
    queryFn: calculateInventoryStatsAsync,
    refetchInterval: 5000,
  });

  const {
    data: topProductsData,
    isLoading: topProductsLoading,
  } = useQuery({
    queryKey: ['top_selling_products', 5],
    queryFn: () => getTopSellingProductsAsync(5),
    refetchInterval: 10000,
  });

  const {
    data: alertsData,
    isLoading: alertsLoading,
  } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchAlerts('unread'),
    refetchInterval: 5000,
  });

  const stats = statsData ?? {
    totalProducts: 0,
    totalValue: 0,
    totalCostValue: 0,
    lowStockCount: 0,
    expiringCount: 0,
    expiredCount: 0,
    todaySales: 0,
    monthlySales: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
  };

  const topProducts = topProductsData ?? [];
  const alerts = alertsData ?? [];
  const unreadAlerts = alerts.length;
  const recentAlerts = alerts.slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Overview of your pharmacy inventory</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Products"
          value={statsLoading ? '...' : stats.totalProducts}
          icon={Package}
          description="Active products in inventory"
          className="bg-gradient-to-br from-[#dff7e8] to-[#bceecf] dark:from-[#0d2616] dark:to-[#16442a]"
        />
        <StatsCard
          title="Low Stock Items"
          value={statsLoading ? '...' : stats.lowStockCount}
          icon={AlertTriangle}
          description="Items below reorder point"
          className="bg-gradient-to-br from-[#ffe6e4] to-[#ffcfc9] dark:from-[#3a1513] dark:to-[#5a1f1c]"
        />
        <StatsCard
          title="Expiring Soon"
          value={statsLoading ? '...' : stats.expiringCount}
          icon={Calendar}
          description="Items expiring within 90 days"
          className="bg-gradient-to-br from-[#fff1d9] to-[#ffe3ab] dark:from-[#3b290d] dark:to-[#5d3d0f]"
        />
        <StatsCard
          title="Inventory Value"
          value={statsLoading ? '...' : formatCurrency(stats.totalValue)}
          icon={DollarSign}
          description="Total retail value (matches Inventory export)"
          className="bg-gradient-to-br from-[#d9f2fb] to-[#bde6f7] dark:from-[#0b2535] dark:to-[#123a52]"
        />
      </div>

      {/* Sales Metrics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today's Sales"
          value={statsLoading ? '...' : stats.todaySales}
          icon={ShoppingCart}
          description={
            statsLoading ? 'Revenue: ...' : `Revenue: ${formatCurrency(stats.todayRevenue)}`
          }
          className="bg-gradient-to-br from-[#dff6f2] to-[#bdebe0] dark:from-[#0a2722] dark:to-[#103a31]"
        />
        <StatsCard
          title="Monthly Sales"
          value={statsLoading ? '...' : stats.monthlySales}
          icon={TrendingUp}
          description={
            statsLoading ? 'Revenue: ...' : `Revenue: ${formatCurrency(stats.monthlyRevenue)}`
          }
          className="bg-gradient-to-br from-[#e0f1ff] to-[#c3e1ff] dark:from-[#0b2236] dark:to-[#123251]"
        />
        <StatsCard
          title="Expired Items"
          value={statsLoading ? '...' : stats.expiredCount}
          icon={AlertTriangle}
          description="Items past expiration date"
          className="bg-gradient-to-br from-[#ffe2e0] to-[#ffc2bd] dark:from-[#3a1210] dark:to-[#5c1c19]"
        />
        <StatsCard
          title="Unread Alerts"
          value={alertsLoading ? '...' : unreadAlerts}
          icon={AlertTriangle}
          description="Requires attention"
          className="bg-gradient-to-br from-[#e5f8d8] to-[#c7ef9f] dark:from-[#132b0d] dark:to-[#1d4313]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Top Selling Products</CardTitle>
            <CardDescription>Best performers this month</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell>{product.quantitySold}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : topProductsLoading ? (
              <p className="text-sm text-muted-foreground">Loading top products...</p>
            ) : (
              <p className="text-sm text-muted-foreground">No sales data available</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Items requiring attention</CardDescription>
              </div>
              <Link to="/alerts">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <p className="text-sm text-muted-foreground">Loading alerts...</p>
            ) : recentAlerts.length > 0 ? (
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                  >
                    <AlertTitle className="text-sm">{alert.productName}</AlertTitle>
                    <AlertDescription className="text-xs">{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No alerts at this time</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


