// Inventory List component
import React, { useMemo, useState, useCallback } from 'react';
import { Product } from '@/lib/types';
import { getDaysUntilExpiry } from '@/lib/calculations';
import { hasPermission } from '@/lib/permissions';
import { useAuth } from '@/components/auth/AuthProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Package, Search, Loader2, RotateCcw, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useProducts } from '@/hooks/useProducts';
import { useQuery } from '@tanstack/react-query';
import { fetchStockBatches, fetchStockMovements } from '@/services/stock';
import { toast } from '@/components/ui/use-toast';

interface InventoryListProps {
  onEdit: (product: Product) => void;
  onReceiveStock: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export const InventoryList: React.FC<InventoryListProps> = ({ onEdit, onReceiveStock, onDelete }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'category'>('name');

  const productsQuery = useProducts();
  const batchesQuery = useQuery({
    queryKey: ['stock_batches', 'all'],
    queryFn: fetchStockBatches,
  });
  const movementsQuery = useQuery({
    queryKey: ['stock_movements', 'all'],
    queryFn: fetchStockMovements,
  });

  const products = productsQuery.data ?? [];
  const stockBatches = batchesQuery.data ?? [];
  const stockMovements = movementsQuery.data ?? [];

  const loading =
    productsQuery.isLoading || batchesQuery.isLoading || movementsQuery.isLoading;
  const error = productsQuery.error || batchesQuery.error || movementsQuery.error;

  const retryAll = () => {
    productsQuery.refetch();
    batchesQuery.refetch();
    movementsQuery.refetch();
  };

  const getProductInventory = useCallback(
    (productId: string) => {
      const movements = stockMovements.filter(
        (movement) => movement.productId === productId
      );
      const quantity = movements.reduce((sum, movement) => sum + movement.quantity, 0);
      const batches = stockBatches
        .filter((batch) => batch.productId === productId && batch.remainingQuantity > 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      return {
        quantity: Math.max(0, quantity),
        batches,
      };
    },
    [stockBatches, stockMovements]
  );

  const getStockStatus = (productId: string) => {
    const stock = getProductInventory(productId);
    const product = products.find((p) => p.id === productId);
    if (!product) return { status: 'unknown', quantity: 0 };

    if (stock.quantity === 0) return { status: 'out', quantity: 0 };
    if (stock.quantity <= product.reorderPoint * 0.3) return { status: 'critical', quantity: stock.quantity };
    if (stock.quantity <= product.reorderPoint) return { status: 'low', quantity: stock.quantity };
    return { status: 'good', quantity: stock.quantity };
  };

  const getExpiryStatus = (productId: string) => {
    const stock = getProductInventory(productId);
    const batches = stock.batches;
    
    if (batches.length === 0) return { status: 'unknown', earliestDate: null };
    
    const earliestBatch = batches[0];
    const daysUntilExpiry = getDaysUntilExpiry(earliestBatch.expiryDate);
    
    if (daysUntilExpiry < 0) return { status: 'expired', earliestDate: earliestBatch.expiryDate };
    if (daysUntilExpiry <= 30) return { status: 'critical', earliestDate: earliestBatch.expiryDate };
    if (daysUntilExpiry <= 90) return { status: 'warning', earliestDate: earliestBatch.expiryDate };
    return { status: 'good', earliestDate: earliestBatch.expiryDate };
  };

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesSearch =
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.ndcCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;

        const stockStatus = getStockStatus(product.id);
        let matchesStock = true;
        if (stockFilter === 'low') {
          matchesStock = stockStatus.status === 'low' || stockStatus.status === 'critical';
        } else if (stockFilter === 'out') {
          matchesStock = stockStatus.status === 'out';
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'stock') {
          const aStock = getStockStatus(a.id).quantity;
          const bStock = getStockStatus(b.id).quantity;
          return aStock - bStock;
        }
        if (sortBy === 'category') {
          return a.category.localeCompare(b.category);
        }
        return 0;
      });
  }, [products, searchTerm, categoryFilter, stockFilter, sortBy, getStockStatus]);

  const exportProducts = () => {
    if (!hasPermission(user.role, 'products.view')) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to export products",
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create CSV header
      let csvContent = 'Product Name,NDC Code,Category,Manufacturer,Dosage Form,Strength,Selling Price,Current Stock,Reorder Point,Reorder Quantity,Location,Barcode,Status\n';

      // Add product rows
      filteredProducts.forEach((product) => {
        const stockStatus = getStockStatus(product.id);
        const stock = stockStatus.quantity;
        
        // Escape commas and quotes in CSV values
        const escapeCSV = (value: any): string => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        csvContent += `${escapeCSV(product.name)},${escapeCSV(product.ndcCode || '')},${escapeCSV(product.category)},${escapeCSV(product.manufacturer)},${escapeCSV(product.dosageForm || '')},${escapeCSV(product.strength || '')},${product.sellingPrice},${stock},${product.reorderPoint},${product.reorderQuantity},${escapeCSV(product.location || '')},${escapeCSV(product.barcode || '')},${product.active ? 'Active' : 'Inactive'}\n`;
      });

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Products Exported',
        description: `Exported ${filteredProducts.length} products to CSV file`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: (error as Error).message || 'Failed to export products',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Inventory</CardTitle>
          <CardDescription>Manage your product inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading inventory...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Inventory</CardTitle>
          <CardDescription>Manage your product inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-destructive">
              {(error as Error).message || 'Failed to load inventory data.'}
            </p>
            <Button onClick={retryAll} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Product Inventory</CardTitle>
            <CardDescription>Manage your product inventory</CardDescription>
          </div>
          {hasPermission(user.role, 'products.view') && (
            <Button onClick={exportProducts} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Products
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, NDC code, or manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="stock">Stock Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[100px]">NDC Code</TableHead>
                  <TableHead className="min-w-[100px]">Category</TableHead>
                  <TableHead className="min-w-[120px]">Manufacturer</TableHead>
                  <TableHead className="min-w-[80px]">Stock</TableHead>
                  <TableHead className="min-w-[100px]">Expiry</TableHead>
                  <TableHead className="min-w-[100px]">Reorder Point</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product.id);
                    const expiryStatus = getExpiryStatus(product.id);

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.ndcCode || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell>{product.manufacturer}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              stockStatus.status === 'out' || stockStatus.status === 'critical'
                                ? 'destructive'
                                : stockStatus.status === 'low'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {stockStatus.quantity} units
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {expiryStatus.earliestDate ? (
                            <Badge
                              variant={
                                expiryStatus.status === 'expired'
                                  ? 'destructive'
                                  : expiryStatus.status === 'critical'
                                  ? 'destructive'
                                  : expiryStatus.status === 'warning'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {new Date(expiryStatus.earliestDate).toLocaleDateString()}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{product.reorderPoint}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {hasPermission(user.role, 'products.edit') && (
                            <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission(user.role, 'inventory.receive') && (
                            <Button size="sm" variant="outline" onClick={() => onReceiveStock(product)}>
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission(user.role, 'products.delete') && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{product.name}</strong>? 
                                    This action cannot be undone. This will permanently delete the product and all associated data.
                                    {stockStatus.quantity > 0 && (
                                      <span className="block mt-2 text-destructive font-medium">
                                        Warning: This product has {stockStatus.quantity} units in stock. Deleting it will remove all stock records.
                                      </span>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onDelete(product)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
