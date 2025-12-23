// POS System component
import React, { useState, useEffect } from 'react';
import { Product, Sale, SaleItem, PaymentMethod } from '@/lib/types';
import { calculateCurrentStockAsync, deductStockFIFOAsync, StockDeduction } from '@/lib/calculations';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { generateAndSaveAlerts } from '@/lib/notifications';
import { formatCurrency } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { insertSale } from '@/services/sales';
import { insertStockMovement, fetchStockBatchById, updateStockBatch } from '@/services/stock';
import { recordAuditLog } from '@/services/audit';
import { useQueryClient } from '@tanstack/react-query';
import { SALES_QUERY_KEY } from '@/services/sales';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export const POSSystem: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: isLoadingProducts } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [productStocks, setProductStocks] = useState<Map<string, number>>(new Map());

  // Load stock levels for all products
  useEffect(() => {
    const loadStocks = async () => {
      if (products.length === 0) return;
      
      const stockMap = new Map<string, number>();
      await Promise.all(
        products.map(async (product) => {
          try {
            const stock = await calculateCurrentStockAsync(product.id);
            stockMap.set(product.id, stock.quantity);
          } catch (error) {
            console.error(`Error loading stock for product ${product.id}:`, error);
            stockMap.set(product.id, 0);
          }
        })
      );
      setProductStocks(stockMap);
    };

    loadStocks();
  }, [products]);

  const filteredProducts = products.filter(product => {
    const stock = productStocks.get(product.id) ?? 0;
    return (
      (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       product.barcode === searchTerm) &&
      stock > 0
    );
  });

  const addToCart = (product: Product) => {
    const stock = productStocks.get(product.id) ?? 0;
    if (stock === 0) {
      toast({
        title: 'Out of Stock',
        description: `${product.name} is out of stock`,
        variant: 'destructive',
      });
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= stock) {
        toast({
          title: 'Stock Limit',
          description: `Only ${stock} units available`,
          variant: 'destructive',
        });
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              total: (item.quantity + 1) * item.unitPrice,
            }
          : item
      ));
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.sellingPrice,
          total: product.sellingPrice,
        },
      ]);
    }
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const stock = productStocks.get(productId) ?? 0;
    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > stock) {
      toast({
        title: 'Stock Limit',
        description: `Only ${stock} units available`,
        variant: 'destructive',
      });
      return;
    }

    setCart(cart.map(item =>
      item.productId === productId
        ? {
            ...item,
            quantity: newQuantity,
            total: newQuantity * item.unitPrice,
          }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0; // 0% tax
  const total = subtotal + tax;

  const revertDeductions = async (deductions: StockDeduction[]) => {
    // Group deductions by batch ID to avoid duplicate updates
    const batchUpdates = new Map<string, number>();
    
    deductions.forEach(deduction => {
      const current = batchUpdates.get(deduction.batchId) || 0;
      batchUpdates.set(deduction.batchId, current + deduction.quantity);
    });

    // Revert each batch by adding back the deducted quantity
    await Promise.all(
      Array.from(batchUpdates.entries()).map(async ([batchId, quantityToRevert]) => {
        try {
          const batch = await fetchStockBatchById(batchId);
          if (batch) {
            await updateStockBatch(batchId, {
              remainingQuantity: batch.remainingQuantity + quantityToRevert,
            });
          }
        } catch (error) {
          console.error(`Error reverting deduction for batch ${batchId}:`, error);
        }
      })
    );
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Please add items to cart',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    // Check for expired products
    for (const item of cart) {
      try {
        const stock = await calculateCurrentStockAsync(item.productId);
        const batches = stock.batches;
        
        if (batches.length > 0) {
          const earliestBatch = batches[0];
          const expiryDate = new Date(earliestBatch.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (expiryDate < today) {
            toast({
              title: 'Expired Product',
              description: `${item.productName} has expired batches`,
              variant: 'destructive',
            });
            return;
          }
        }
      } catch (error) {
        console.error(`Error checking expiry for product ${item.productId}:`, error);
        toast({
          title: 'Error',
          description: `Failed to check product expiry: ${(error as Error).message}`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Process sale with FIFO
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const saleNumber = `SALE-${Date.now().toString().slice(-8)}`;
    const saleItems: SaleItem[] = [];
    const stockMovements: any[] = [];
    const allAppliedDeductions: StockDeduction[] = [];

    for (const cartItem of cart) {
      try {
        const currentStock = await calculateCurrentStockAsync(cartItem.productId);
        if (currentStock.quantity < cartItem.quantity) {
          await revertDeductions(allAppliedDeductions);
          toast({
            title: 'Insufficient Stock',
            description: `${cartItem.productName} no longer has enough stock to complete this sale.`,
            variant: 'destructive',
          });
          return;
        }

        const deductionResult = await deductStockFIFOAsync(cartItem.productId, cartItem.quantity);

        if (!deductionResult.success) {
          await revertDeductions(allAppliedDeductions);
          toast({
            title: 'Stock Error',
            description: deductionResult.error ?? 'Unable to deduct stock for this sale.',
            variant: 'destructive',
          });
          return;
        }

        const totalDeducted = deductionResult.deductions.reduce((sum, deduction) => sum + deduction.quantity, 0);
        if (totalDeducted !== cartItem.quantity) {
          await revertDeductions([...allAppliedDeductions, ...deductionResult.deductions]);
          toast({
            title: 'Stock Error',
            description: `${cartItem.productName} could not be fully deducted from stock.`,
            variant: 'destructive',
          });
          return;
        }

        for (const deduction of deductionResult.deductions) {
          saleItems.push({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            productId: cartItem.productId,
            productName: cartItem.productName,
            batchId: deduction.batchId,
            quantity: deduction.quantity,
            unitPrice: cartItem.unitPrice,
            costPrice: deduction.costPrice,
            total: deduction.quantity * cartItem.unitPrice,
          });

          stockMovements.push({
            productId: cartItem.productId,
            batchId: deduction.batchId,
            type: 'sale' as const,
            quantity: -deduction.quantity,
            costPrice: deduction.costPrice,
            sellingPrice: cartItem.unitPrice,
            reference: saleId,
            userId: user.id,
          });
        }

        allAppliedDeductions.push(...deductionResult.deductions);
      } catch (error) {
        await revertDeductions(allAppliedDeductions);
        toast({
          title: 'Error',
          description: `Failed to process ${cartItem.productName}: ${(error as Error).message}`,
          variant: 'destructive',
        });
        return;
      }
    }

    if (saleItems.length === 0) {
      toast({
        title: 'Stock Error',
        description: 'No sale items could be processed.',
        variant: 'destructive',
      });
      return;
    }

    const saleSubtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
    const saleTax = saleSubtotal * 0;
    const saleTotal = saleSubtotal + saleTax;

    try {
      // Save stock movements to Supabase
      await Promise.all(
        stockMovements.map(movement => insertStockMovement(movement))
      );

      // Create sale record in Supabase
      const sale = await insertSale({
        saleNumber,
        items: saleItems,
        subtotal: saleSubtotal,
        tax: saleTax,
        total: saleTotal,
        paymentMethod,
        cashierId: user.id,
        cashierName: user.fullName,
        customerName: customerName || undefined,
        refunded: false,
      });

      // Generate alerts for affected products
      await Promise.all(cart.map(item => generateAndSaveAlerts(item.productId)));

      // Audit log
      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'sales',
        action: 'create_sale',
        details: `Sale ${saleNumber} processed: ${saleItems.length} items, Total: ${formatCurrency(saleTotal)}`,
        resourceId: sale.id,
        resourceType: 'sale',
      });

      // Invalidate queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['stock_batches'] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]);

      // Reload stock levels
      const stockMap = new Map<string, number>();
      await Promise.all(
        products.map(async (product) => {
          try {
            const stock = await calculateCurrentStockAsync(product.id);
            stockMap.set(product.id, stock.quantity);
          } catch (error) {
            console.error(`Error reloading stock for product ${product.id}:`, error);
            stockMap.set(product.id, 0);
          }
        })
      );
      setProductStocks(stockMap);

      setCompletedSale(sale);
      setReceiptOpen(true);
      setCart([]);
      setCustomerName('');
      setPaymentMethod('cash');

      toast({
        title: 'Sale Completed',
        description: `Sale ${saleNumber} processed successfully`,
      });
    } catch (error) {
      console.error('Failed to save sale:', error);
      await revertDeductions(allAppliedDeductions);
      toast({
        title: 'Error',
        description: `Failed to save sale: ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
  };

  if (isLoadingProducts) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Point of Sale</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Process sales transactions</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Point of Sale</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Process sales transactions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Products</CardTitle>
            <CardDescription>Search and add products to cart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length === 1) {
                    addToCart(filteredProducts[0]);
                    setSearchTerm('');
                  }
                }}
              />
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Product</TableHead>
                    <TableHead className="min-w-[80px]">Stock</TableHead>
                    <TableHead className="text-right min-w-[80px]">Price</TableHead>
                    <TableHead className="text-right min-w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.slice(0, 10).map((product) => {
                      const stock = productStocks.get(product.id) ?? 0;
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            <Badge variant={stock <= product.reorderPoint ? 'destructive' : 'secondary'}>
                              {stock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(product.sellingPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => {
                                addToCart(product);
                                setSearchTerm('');
                              }}
                              disabled={stock === 0}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card>
          <CardHeader>
            <CardTitle>Cart</CardTitle>
            <CardDescription>Review and process sale</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Cart is empty. Add products to continue.
              </p>
            ) : (
              <>
                <div className="border rounded-md max-h-[300px] overflow-y-auto overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Product</TableHead>
                        <TableHead className="min-w-[100px]">Qty</TableHead>
                        <TableHead className="text-right min-w-[80px]">Price</TableHead>
                        <TableHead className="text-right min-w-[80px]">Total</TableHead>
                        <TableHead className="text-right min-w-[60px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.productId, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.productId, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.productId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (0%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name (Optional)</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center">
                          <DollarSign className="mr-2 h-4 w-4" />
                          Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Card
                        </div>
                      </SelectItem>
                      <SelectItem value="insurance">
                        <div className="flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          Insurance
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={processSale} className="w-full" size="lg">
                  Process Sale
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale Receipt</DialogTitle>
          </DialogHeader>
          {completedSale && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="font-bold text-lg">Sahab Pharmacy</p>
                <p className="text-sm text-muted-foreground">Sale #{completedSale.saleNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(completedSale.createdAt).toLocaleString()}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                {completedSale.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(completedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(completedSale.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(completedSale.total)}</span>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm">
                  <span className="font-medium">Payment:</span> {completedSale.paymentMethod.toUpperCase()}
                </p>
                {completedSale.customerName && (
                  <p className="text-sm">
                    <span className="font-medium">Customer:</span> {completedSale.customerName}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-medium">Cashier:</span> {completedSale.cashierName}
                </p>
              </div>

              <Button
                onClick={() => {
                  window.print();
                }}
                className="w-full"
              >
                Print Receipt
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


