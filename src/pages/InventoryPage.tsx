// Inventory Page
import React, { useState } from 'react';
import { hasPermission } from '@/lib/permissions';
import { useAuth } from '@/components/auth/AuthProvider';
import { InventoryList } from '@/components/inventory/InventoryList';
import { ProductForm, ProductFormValues } from '@/components/inventory/ProductForm';
import { ReceivingForm } from '@/components/inventory/ReceivingForm';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { generateAndSaveAlerts } from '@/lib/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { PRODUCT_QUERY_KEY } from '@/hooks/useProducts';
import { insertProduct, updateProduct, fetchProductById } from '@/services/products';
import { insertStockBatch, insertStockMovement } from '@/services/stock';
import { recordAuditLog } from '@/services/audit';
import { Product } from '@/lib/types';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [receivingFormOpen, setReceivingFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [receivingProduct, setReceivingProduct] = useState<Product | null>(null);

  if (!user) return null;

  const invalidateInventoryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PRODUCT_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['stock_batches', 'all'] }),
      queryClient.invalidateQueries({ queryKey: ['stock_movements', 'all'] }),
      queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    ]);
  };

  const handleSaveProduct = async (
    formValues: ProductFormValues,
    initialStock?: {
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      costPrice: number;
      supplier?: string;
    }
  ) => {
    if (!user) return;

    try {
      const basePayload = {
        name: formValues.name,
        ndcCode: formValues.ndcCode,
        category: formValues.category,
        manufacturer: formValues.manufacturer,
        dosageForm: formValues.dosageForm,
        strength: formValues.strength,
        sellingPrice: Number(formValues.sellingPrice) || 0,
        reorderPoint: Number(formValues.reorderPoint) || 0,
        reorderQuantity: Number(formValues.reorderQuantity) || 0,
        location: formValues.location,
        barcode: formValues.barcode,
        description: formValues.description,
        active: formValues.active,
      };

      const savedProduct = editingProduct
        ? await updateProduct({
            id: formValues.id!,
            ...basePayload,
          })
        : await insertProduct(basePayload);

      if (initialStock && !editingProduct) {
        const batch = await insertStockBatch({
          productId: savedProduct.id,
          batchNumber: initialStock.batchNumber,
          expiryDate: initialStock.expiryDate,
          costPrice: initialStock.costPrice,
          supplier: initialStock.supplier,
          remainingQuantity: initialStock.quantity,
        });

        await insertStockMovement({
          productId: savedProduct.id,
          batchId: batch.id,
          type: 'purchase',
          quantity: initialStock.quantity,
          costPrice: initialStock.costPrice,
          reason: 'Initial stock receiving',
          userId: user.id,
        });
      }

      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'inventory',
        action: editingProduct ? 'update_product' : 'create_product',
        details: `${editingProduct ? 'Updated' : 'Created'} product: ${savedProduct.name}`,
        resourceId: savedProduct.id,
        resourceType: 'product',
      });

      await generateAndSaveAlerts(savedProduct.id);
      await invalidateInventoryQueries();

      toast({
        title: editingProduct ? 'Product Updated' : 'Product Created',
        description: `Product ${savedProduct.name} has been ${editingProduct ? 'updated' : 'created'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to save product',
        variant: 'destructive',
      });
    } finally {
      setEditingProduct(null);
      setProductFormOpen(false);
    }
  };

  const handleReceiveStock = async (data: {
    productId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    supplier?: string;
  }) => {
    if (!user) return;

    try {
      const batch = await insertStockBatch({
        productId: data.productId,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate,
        costPrice: data.costPrice,
        supplier: data.supplier,
        remainingQuantity: data.quantity,
      });

      await insertStockMovement({
        productId: data.productId,
        batchId: batch.id,
        type: 'purchase',
        quantity: data.quantity,
        costPrice: data.costPrice,
        reason: `Stock receiving - Batch ${data.batchNumber}`,
        userId: user.id,
      });

      const product = await fetchProductById(data.productId);

      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'inventory',
        action: 'receive_stock',
        details: `Received ${data.quantity} units of ${product?.name || 'product'} - Batch ${data.batchNumber}`,
        resourceId: data.productId,
        resourceType: 'product',
      });

      await generateAndSaveAlerts(data.productId);
      await invalidateInventoryQueries();

      toast({
        title: 'Stock Received',
        description: `Received ${data.quantity} units of ${product?.name || 'product'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to receive stock',
        variant: 'destructive',
      });
    } finally {
      setReceivingFormOpen(false);
      setReceivingProduct(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Manage your product inventory</p>
        </div>
        {hasPermission(user.role, 'products.add') && (
          <Button
            onClick={() => {
              setEditingProduct(null);
              setProductFormOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      <InventoryList
        onEdit={(product) => {
          setEditingProduct(product);
          setProductFormOpen(true);
        }}
        onReceiveStock={(product) => {
          setReceivingProduct(product);
          setReceivingFormOpen(true);
        }}
      />

      <ProductForm
        open={productFormOpen}
        onClose={() => {
          setProductFormOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
      />

      <ReceivingForm
        open={receivingFormOpen}
        onClose={() => {
          setReceivingFormOpen(false);
          setReceivingProduct(null);
        }}
        onSave={handleReceiveStock}
        product={receivingProduct}
      />
    </div>
  );
};

