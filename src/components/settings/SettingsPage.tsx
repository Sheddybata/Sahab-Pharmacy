// Settings Page component
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { RefreshCw, Loader2, Trash2 } from 'lucide-react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAppSettings,
  fetchSystemStats,
  resetSupabaseData,
  saveAppSettings,
  seedSupabaseDemoData,
} from '@/services/settings';
import { recordAuditLog } from '@/services/audit';
import { InventoryDiagnostics } from '@/components/diagnostics/InventoryDiagnostics';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [taxRate, setTaxRate] = useState('8');
  const [currency, setCurrency] = useState('NGN');
  const [autoGenerateAlerts, setAutoGenerateAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['app_settings'],
    queryFn: fetchAppSettings,
  });

  const systemStatsQuery = useQuery({
    queryKey: ['system_stats'],
    queryFn: fetchSystemStats,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setTaxRate(settingsQuery.data.taxRate.toString());
      setCurrency(settingsQuery.data.currency);
      setAutoGenerateAlerts(settingsQuery.data.autoGenerateAlerts);
    }
  }, [settingsQuery.data]);

  if (!user || !hasPermission(user.role, 'settings.view')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this module</p>
      </div>
    );
  }

  const handleResetDemoData = async () => {
    if (resetting) return;

    try {
      setResetting(true);
      await resetSupabaseData();
      
      // Invalidate all queries to refresh the entire application
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['stock_batches'] }),
        queryClient.invalidateQueries({ queryKey: ['stock_movements'] }),
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['top_selling_products'] }),
        queryClient.invalidateQueries({ queryKey: ['stocktake_sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['audit_logs'] }),
      ]);
      
      // Reset form to defaults
      setTaxRate('8');
      setCurrency('NGN');
      setAutoGenerateAlerts(true);

      toast({
        title: 'All Data Cleared',
        description: 'All products, sales, stock, and demo data have been cleared successfully. You can now start adding fresh products.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to reset data',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  const handleReseedData = async () => {
    if (reseeding) return;

    try {
      setReseeding(true);
      await resetSupabaseData();
      await seedSupabaseDemoData(user.id, user.fullName);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['app_settings'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory_stats'] }),
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
      ]);

      toast({
        title: 'Data Reseeded',
        description: 'Demo data has been reseeded successfully',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to reseed data',
        variant: 'destructive',
      });
    } finally {
      setReseeding(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!hasPermission(user.role, 'settings.edit')) {
      toast({
        title: 'Permission Denied',
        description: "You don't have permission to edit settings",
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const currentSettings = settingsQuery.data;
      const saved = await saveAppSettings({
        id: currentSettings?.id,
        taxRate: Number(taxRate) || 0,
        currency,
        autoGenerateAlerts,
      });

      await recordAuditLog({
        userId: user.id,
        userName: user.fullName,
        module: 'settings',
        action: 'update_settings',
        details: `Settings updated: Tax Rate=${saved.taxRate}%, Currency=${saved.currency}`,
      });

      await queryClient.invalidateQueries({ queryKey: ['app_settings'] });

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been saved successfully',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm sm:text-base">Manage system settings and preferences</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">General Settings</CardTitle>
          <CardDescription>Configure general application settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxRate">Tax Rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              min="0"
              max="100"
              step="0.1"
              disabled={settingsQuery.isLoading || saving}
            />
            <p className="text-xs text-muted-foreground">
              Default tax rate applied to sales transactions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={currency}
              onValueChange={setCurrency}
              disabled={settingsQuery.isLoading || saving}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NGN">NGN - Nigerian Naira (₦)</SelectItem>
                <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoAlerts">Auto-generate Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Automatically generate alerts for low stock and expiring items
              </p>
            </div>
            <Switch
              id="autoAlerts"
              checked={autoGenerateAlerts}
              onCheckedChange={setAutoGenerateAlerts}
              disabled={settingsQuery.isLoading || saving}
            />
          </div>

          {hasPermission(user.role, 'settings.edit') && (
            <div className="pt-4">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      {hasPermission(user.role, 'settings.edit') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Data Management</CardTitle>
            <CardDescription>Manage application data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Demo Data</h3>
              <p className="text-sm text-muted-foreground">
                Reset or reseed demo data for testing purposes
              </p>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto" disabled={reseeding}>
                    {reseeding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {reseeding ? 'Reseeding...' : 'Reseed Demo Data'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reseed Demo Data</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all products, batches, sales, and movements, then recreate demo data.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleReseedData()}
                      disabled={reseeding}
                    >
                      {reseeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {reseeding ? 'Processing...' : 'Continue'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto" disabled={resetting}>
                    {resetting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {resetting ? 'Resetting...' : 'Reset All Data'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Demo Data</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete ALL products, sales, stock batches, stock movements, alerts, and audit logs.
                      Your user accounts (admin and cashier) will be preserved. Settings will be reset to defaults.
                      After clearing, you can start adding fresh products. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleResetDemoData()}
                      disabled={resetting}
                    >
                      {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {resetting ? 'Clearing...' : 'Clear All Data'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Diagnostics */}
      {hasPermission(user.role, 'settings.view') && (
        <InventoryDiagnostics />
      )}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">System Information</CardTitle>
          <CardDescription>Application details and statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Application Name</Label>
              <p className="text-sm text-muted-foreground">Sahab Pharmacy</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Version</Label>
              <p className="text-sm text-muted-foreground">1.0.0</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Total Products</Label>
              <p className="text-sm text-muted-foreground">
                {systemStatsQuery.isLoading ? '...' : systemStatsQuery.data?.products ?? 0}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Total Users</Label>
              <p className="text-sm text-muted-foreground">
                {systemStatsQuery.isLoading ? '...' : systemStatsQuery.data?.users ?? 0}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Total Sales</Label>
              <p className="text-sm text-muted-foreground">
                {systemStatsQuery.isLoading ? '...' : systemStatsQuery.data?.sales ?? 0}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Audit Logs</Label>
              <p className="text-sm text-muted-foreground">
                {systemStatsQuery.isLoading ? '...' : systemStatsQuery.data?.auditLogs ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

