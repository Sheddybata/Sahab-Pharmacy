// Audit Log Viewer component
import React, { useMemo, useState } from 'react';
import { AuditLog, AuditModule } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Search } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '@/services/audit';

export const AuditManager: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<AuditModule | 'all'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  const auditLogsQuery = useQuery({
    queryKey: ['audit_logs'],
    queryFn: fetchAuditLogs,
  });

  const logs = auditLogsQuery.data ?? [];

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((log) => {
        return (
          log.action.toLowerCase().includes(search) ||
          log.details?.toLowerCase().includes(search) ||
          log.userName?.toLowerCase().includes(search) ||
          log.module.toLowerCase().includes(search)
        );
      });
    }

    if (moduleFilter !== 'all') {
      result = result.filter((log) => log.module === moduleFilter);
    }

    if (userFilter !== 'all') {
      result = result.filter((log) => log.userId === userFilter);
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filterDate.setHours(0, 0, 0, 0);
      result = result.filter((log) => {
        const logDate = new Date(log.createdAt);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === filterDate.getTime();
      });
    }

    return result;
  }, [logs, searchTerm, moduleFilter, userFilter, dateFilter]);

  const exportLogs = () => {
    if (!hasPermission(user?.role || 'cashier', 'audit.export')) {
      toast({
        title: 'Permission Denied',
        description: 'You don\'t have permission to export audit logs',
        variant: 'destructive',
      });
      return;
    }

    let csvContent = 'Date,User,Module,Action,Details,Resource ID,Resource Type\n';
    filteredLogs.forEach(log => {
      csvContent += `${log.createdAt},${log.userName},${log.module},${log.action},"${log.details || ''}",${log.resourceId || ''},${log.resourceType || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Audit Logs Exported',
      description: 'Audit logs have been downloaded',
    });
  };

  const modules: AuditModule[] = ['auth', 'inventory', 'sales', 'stocktake', 'reports', 'users', 'settings'];
  const users = useMemo(
    () =>
      Array.from(new Map(logs.map((log) => [log.userId ?? 'unknown', log.userName || 'System'])).entries())
        .filter(([id]) => id !== 'unknown')
        .map(([id, name]) => ({ id, name })),
    [logs]
  );

  if (!user || !hasPermission(user.role, 'audit.view')) {
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-muted-foreground text-sm sm:text-base">View system activity logs</p>
        </div>
        {hasPermission(user.role, 'audit.export') && (
          <Button onClick={exportLogs} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map(module => (
                  <SelectItem key={module} value={module}>
                    {module.charAt(0).toUpperCase() + module.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Date"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            {auditLogsQuery.isLoading
              ? 'Loading audit logs...'
              : `Showing ${filteredLogs.length} of ${logs.length} logs`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Date & Time</TableHead>
                  <TableHead className="min-w-[100px]">User</TableHead>
                  <TableHead className="min-w-[100px]">Module</TableHead>
                  <TableHead className="min-w-[120px]">Action</TableHead>
                  <TableHead className="min-w-[200px]">Details</TableHead>
                  <TableHead className="min-w-[150px]">Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.slice(0, 100).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.userName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.module}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell className="max-w-md truncate">{log.details || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.resourceId ? `${log.resourceType || 'resource'}: ${log.resourceId.slice(0, 8)}...` : '-'}
                      </TableCell>
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


