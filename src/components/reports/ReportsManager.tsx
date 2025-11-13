// Reports Manager component
import React, { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { calculateSalesMetricsAsync, calculateCurrentStockAsync } from '@/lib/calculations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSales } from '@/services/sales';
import { fetchActiveProducts } from '@/services/products';

type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

const getDateRange = (period: ReportPeriod): { start: Date; end: Date } => {
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(today);
      start.setDate(today.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

export const ReportsManager: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<'sales' | 'profit' | 'inventory'>('sales');
  const [period, setPeriod] = useState<ReportPeriod>('month');

  if (!user || !hasPermission(user.role, 'reports.view')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this module</p>
      </div>
    );
  }

  const dateRange = useMemo(() => getDateRange(period), [period]);
  const startIso = dateRange.start.toISOString();
  const endIso = dateRange.end.toISOString();

  const salesQueryKey = ['reports', 'sales', startIso, endIso] as const;
  const salesQueryFn = async () => {
    const [sales, metrics] = await Promise.all([
      fetchSales({
        startDate: new Date(startIso),
        endDate: new Date(endIso),
        refunded: false,
      }),
      calculateSalesMetricsAsync(new Date(startIso), new Date(endIso)),
    ]);

    const sortedSales = sales
      .filter((sale) => !sale.refunded)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { sales: sortedSales, metrics };
  };

  const inventoryQueryKey = ['reports', 'inventory'] as const;
  const inventoryQueryFn = async () => {
    const products = await fetchActiveProducts();
    const activeProducts = products.filter((product) => product.active);

    const productsWithStock = await Promise.all(
      activeProducts.map(async (product) => {
        const stock = await calculateCurrentStockAsync(product.id);
        return {
          ...product,
          currentStock: stock.quantity,
        };
      })
    );

    const totalValue = productsWithStock.reduce(
      (sum, product) => sum + product.currentStock * product.sellingPrice,
      0
    );

    return {
      totalValue,
      products: productsWithStock,
    };
  };

  const isSalesReport = reportType === 'sales' || reportType === 'profit';

  const salesReportQuery = useQuery({
    queryKey: salesQueryKey,
    queryFn: salesQueryFn,
    enabled: isSalesReport,
  });

  const inventoryReportQuery = useQuery({
    queryKey: inventoryQueryKey,
    queryFn: inventoryQueryFn,
    enabled: reportType === 'inventory',
  });

  const exportReport = async () => {
    if (!hasPermission(user.role, 'reports.export')) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to export reports",
        variant: 'destructive',
      });
      return;
    }

    try {
      let csvContent = '';

      if (reportType === 'sales') {
        const { sales } = await queryClient.fetchQuery({
          queryKey: salesQueryKey,
          queryFn: salesQueryFn,
        });
        csvContent = 'Sale Number,Date,Items,Total,Payment Method,Cashier\n';
        sales.forEach((sale) => {
          csvContent += `${sale.saleNumber},${sale.createdAt},${sale.items.length},${sale.total},${sale.paymentMethod},${sale.cashierName}\n`;
        });
      } else if (reportType === 'profit') {
        const { metrics } = await queryClient.fetchQuery({
          queryKey: salesQueryKey,
          queryFn: salesQueryFn,
        });
        csvContent = 'Period,Revenue,COGS,Profit,Profit Margin\n';
        csvContent += `${period},${metrics.revenue},${metrics.cogs},${metrics.profit},${metrics.profitMargin.toFixed(2)}%\n`;
      } else if (reportType === 'inventory') {
        const inventory = await queryClient.fetchQuery({
          queryKey: inventoryQueryKey,
          queryFn: inventoryQueryFn,
        });
        csvContent = 'Product Name,Category,Current Stock,Reorder Point,Value\n';
        inventory.products.forEach((product) => {
          const value = product.currentStock * product.sellingPrice;
          csvContent += `${product.name},${product.category},${product.currentStock},${product.reorderPoint},${value.toFixed(2)}\n`;
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${reportType}_${period}_${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Report Exported',
        description: 'Report has been downloaded',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Export Failed',
        description: (error as Error).message ?? 'Unable to export report',
        variant: 'destructive',
      });
    }
  };

  const renderSalesReport = () => {
    if (salesReportQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading sales report...
        </div>
      );
    }

    if (salesReportQuery.isError) {
      const error = salesReportQuery.error as Error;
      return (
        <Card>
          <CardHeader>
            <CardTitle>Sales Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Failed to load sales report: {error.message}
            </p>
          </CardContent>
        </Card>
      );
    }

    const { metrics, sales } = salesReportQuery.data ?? { metrics: undefined, sales: [] };
    if (!metrics) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.salesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.revenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">COGS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.cogs)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.profit)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sales Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Sale Number</TableHead>
                    <TableHead className="min-w-[150px]">Date</TableHead>
                    <TableHead className="min-w-[80px]">Items</TableHead>
                    <TableHead className="min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[100px]">Payment</TableHead>
                    <TableHead className="min-w-[120px]">Cashier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No sales found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.slice(0, 50).map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                        <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{sale.items.length}</TableCell>
                        <TableCell>{formatCurrency(sale.total)}</TableCell>
                        <TableCell>{sale.paymentMethod}</TableCell>
                        <TableCell>{sale.cashierName}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderProfitLossReport = () => {
    if (salesReportQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading profit report...
        </div>
      );
    }

    if (salesReportQuery.isError) {
      const error = salesReportQuery.error as Error;

      return (
        <Card>
          <CardHeader>
            <CardTitle>Profit &amp; Loss Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Failed to load profit report: {error.message}
            </p>
          </CardContent>
        </Card>
      );
    }

    const metrics = salesReportQuery.data?.metrics;
    if (!metrics) {
      return null;
    }

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Report</CardTitle>
            <CardDescription>Period: {period}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-medium mb-2">Revenue</h3>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.revenue)}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Cost of Goods Sold</h3>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(metrics.cogs)}
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Net Profit</h3>
              <div className="text-3xl font-bold">
                {formatCurrency(metrics.profit)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Profit Margin: {metrics.profitMargin.toFixed(2)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderInventoryReport = () => {
    if (inventoryReportQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading inventory report...
        </div>
      );
    }

    if (inventoryReportQuery.isError) {
      const error = inventoryReportQuery.error as Error;
      return (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Failed to load inventory report: {error.message}
            </p>
          </CardContent>
        </Card>
      );
    }

    const inventory = inventoryReportQuery.data;
    if (!inventory) {
      return null;
    }

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-4">
              {formatCurrency(inventory.totalValue)}
            </div>
            <p className="text-sm text-muted-foreground">
              Total inventory value across {inventory.products.length} products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Reorder Point</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.products.slice(0, 50).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.currentStock}</TableCell>
                      <TableCell>{product.reorderPoint}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground text-sm sm:text-base">View and export reports</p>
        </div>
        {hasPermission(user.role, 'reports.export') && (
          <Button onClick={() => void exportReport()} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">Sales Report</SelectItem>
            <SelectItem value="profit">Profit & Loss</SelectItem>
            <SelectItem value="inventory">Inventory Valuation</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reportType === 'sales' && renderSalesReport()}
      {reportType === 'profit' && renderProfitLossReport()}
      {reportType === 'inventory' && renderInventoryReport()}
    </div>
  );
};

