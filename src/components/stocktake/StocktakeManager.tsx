// Stocktake Manager component
import React, { useEffect, useState } from 'react';
import { StocktakeItem } from '@/lib/types';
import { calculateCurrentStockAsync } from '@/lib/calculations';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useProducts } from '@/hooks/useProducts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStocktakeSessions,
  fetchStocktakeItemsBySession,
  createStocktakeSession,
  upsertStocktakeItem,
  updateStocktakeSession,
} from '@/services/stocktake';
import { recordAuditLog } from '@/services/audit';
import { insertStockMovement } from '@/services/stock';

type StocktakeItemWithMeta = StocktakeItem & { isNew?: boolean };

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const StocktakeManager: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<StocktakeItemWithMeta[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newSessionDialog, setNewSessionDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [approving, setApproving] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['stocktake_sessions'],
    queryFn: fetchStocktakeSessions,
  });

  const sessions = sessionsQuery.data ?? [];
  const currentSession = currentSessionId
    ? sessions.find((session) => session.id === currentSessionId) ?? null
    : null;

  const itemsQuery = useQuery({
    queryKey: ['stocktake_items', currentSessionId],
    queryFn: () => (currentSessionId ? fetchStocktakeItemsBySession(currentSessionId) : []),
    enabled: Boolean(currentSessionId),
  });

  useEffect(() => {
    let cancelled = false;

    const syncItems = async () => {
      if (!currentSessionId) {
        setItems([]);
        return;
      }

      const sessionItems = (itemsQuery.data ?? []).map<StocktakeItemWithMeta>((item) => ({
        ...item,
        variance: item.variance ?? item.countedQuantity - item.systemQuantity,
      }));

      if (!cancelled) {
        setItems(sessionItems);
      }

      const activeProducts = products.filter((product) => product.active);
      if (activeProducts.length === 0) {
        return;
      }

      const existingProductIds = new Set(sessionItems.map((item) => item.productId));
      const missingProducts = activeProducts.filter((product) => !existingProductIds.has(product.id));

      if (missingProducts.length === 0) {
        return;
      }

      setItemsLoading(true);

      try {
        const generatedItems = await Promise.all(
          missingProducts.map(async (product) => {
            const stock = await calculateCurrentStockAsync(product.id);

            return {
              id: generateId(),
              sessionId: currentSessionId,
              productId: product.id,
              systemQuantity: stock.quantity,
              countedQuantity: stock.quantity,
              variance: 0,
              adjusted: false,
              isNew: true,
            } as StocktakeItemWithMeta;
          })
        );

        if (!cancelled) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const combined = [...prev];
            generatedItems.forEach((item) => {
              if (!existingIds.has(item.id)) {
                combined.push(item);
              }
            });
            return combined;
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          toast({
            title: 'Error',
            description: (error as Error).message ?? 'Failed to load stocktake items',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setItemsLoading(false);
        }
      }
    };

    syncItems();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, itemsQuery.data, products]);

  const createSession = async () => {
    if (!user || creatingSession) return;

    try {
      setCreatingSession(true);
      const sessionNumber = `ST-${Date.now().toString().slice(-8)}`;
      const session = await createStocktakeSession({
        sessionNumber,
        createdBy: user.id,
        createdByName: user.fullName,
        notes: notes.trim() ? notes.trim() : undefined,
      });

      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'stocktake',
        action: 'create_session',
        details: `Stocktake session ${session.sessionNumber} created`,
        resourceId: session.id,
        resourceType: 'stocktake_session',
      });

      toast({
        title: 'Session Created',
        description: `Stocktake session ${session.sessionNumber} created`,
      });

      setNewSessionDialog(false);
      setNotes('');
      setCurrentSessionId(session.id);
      await queryClient.invalidateQueries({ queryKey: ['stocktake_sessions'] });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to create stocktake session',
        variant: 'destructive',
      });
    } finally {
      setCreatingSession(false);
    }
  };

  const updateCountedQuantity = (itemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              countedQuantity: quantity,
              variance: quantity - item.systemQuantity,
            }
          : item
      )
    );
  };

  const saveItem = async (itemId: string) => {
    if (!currentSessionId) return;
    const target = items.find((item) => item.id === itemId);
    if (!target) return;

    const { isNew, ...itemPayload } = target;

    try {
      await upsertStocktakeItem({
        ...itemPayload,
        variance: itemPayload.countedQuantity - itemPayload.systemQuantity,
      });
      await queryClient.invalidateQueries({ queryKey: ['stocktake_items', currentSessionId] });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to save stocktake item',
        variant: 'destructive',
      });
    }
  };

  const approveAdjustments = async () => {
    if (!currentSession || !user || approving) return;

    const itemsWithVariance = items.filter((item) => item.variance !== 0 && !item.adjusted);

    if (itemsWithVariance.length === 0) {
      toast({
        title: 'No Adjustments',
        description: 'No items have variances to adjust',
      });
      return;
    }

    try {
      setApproving(true);

      await Promise.all(
        itemsWithVariance.map(async (item) => {
          const { isNew, ...itemPayload } = item;
          const movement = await insertStockMovement({
            productId: item.productId,
            type: 'stocktake',
            quantity: item.variance,
            costPrice: 0,
            reason: `Stocktake adjustment - Session ${currentSession.sessionNumber}`,
            reference: currentSession.id,
            userId: user.id,
          });

          await upsertStocktakeItem({
            ...itemPayload,
            variance: itemPayload.countedQuantity - itemPayload.systemQuantity,
            adjusted: true,
            adjustmentMovementId: movement.id,
          });
        })
      );

      await updateStocktakeSession(currentSession.id, {
        status: 'approved',
        completedAt: new Date().toISOString(),
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
      });

      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'stocktake',
        action: 'approve_adjustments',
        details: `Stocktake session ${currentSession.sessionNumber} approved with ${itemsWithVariance.length} adjustments`,
        resourceId: currentSession.id,
        resourceType: 'stocktake_session',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stocktake_sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['stocktake_items', currentSession.id] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);

      toast({
        title: 'Adjustments Approved',
        description: `${itemsWithVariance.length} adjustments applied`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to approve adjustments',
        variant: 'destructive',
      });
    } finally {
      setApproving(false);
    }
  };

  if (!user || !hasPermission(user.role, 'stocktake.create')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this module</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Stocktake Management</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Manage physical inventory counts</p>
        </div>
        {!currentSession && (
          <Button
            onClick={() => setNewSessionDialog(true)}
            className="w-full sm:w-auto"
            disabled={creatingSession}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        )}
      </div>

      {currentSession ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Session: {currentSession.sessionNumber}</CardTitle>
                <CardDescription>
                  Status: <Badge variant={
                    currentSession.status === 'approved' ? 'default' :
                    currentSession.status === 'counting' ? 'secondary' : 'outline'
                  }>{currentSession.status}</Badge>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setCurrentSessionId(null)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Close
                </Button>
                {currentSession.status === 'counting' && (
                  <Button onClick={approveAdjustments} disabled={approving}>
                    {approving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Approve Adjustments
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Product</TableHead>
                    <TableHead className="min-w-[100px]">System Qty</TableHead>
                    <TableHead className="min-w-[120px]">Counted Qty</TableHead>
                    <TableHead className="min-w-[100px]">Variance</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsQuery.isLoading || itemsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        No items to display for this session yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {product?.name || 'Unknown Product'}
                          </TableCell>
                          <TableCell>{item.systemQuantity}</TableCell>
                          <TableCell>
                            {currentSession.status === 'counting' ? (
                              <Input
                                type="number"
                                value={item.countedQuantity}
                                onChange={(e) => {
                                  const newQty = Number(e.target.value ?? 0);
                                  updateCountedQuantity(item.id, Number.isNaN(newQty) ? 0 : newQty);
                                }}
                                onBlur={() => saveItem(item.id)}
                                className="w-24"
                              />
                            ) : (
                              item.countedQuantity
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.variance === 0 ? 'secondary' : item.variance > 0 ? 'default' : 'destructive'}>
                              {item.variance > 0 ? '+' : ''}
                              {item.variance}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.adjusted ? (
                              <Badge variant="default">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Adjusted
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Stocktake Sessions</CardTitle>
            <CardDescription>Previous stocktake sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No stocktake sessions found. Create a new session to start.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Started At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.sessionNumber}</TableCell>
                        <TableCell>
                          <Badge variant={
                            session.status === 'approved' ? 'default' :
                            session.status === 'counting' ? 'secondary' : 'outline'
                          }>{session.status}</Badge>
                        </TableCell>
                        <TableCell>{session.createdByName}</TableCell>
                        <TableCell>
                          {new Date(session.startedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentSessionId(session.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Session Dialog */}
      <Dialog open={newSessionDialog} onOpenChange={setNewSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Stocktake Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any notes about this stocktake session..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setNewSessionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createSession} disabled={creatingSession}>
                {creatingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

