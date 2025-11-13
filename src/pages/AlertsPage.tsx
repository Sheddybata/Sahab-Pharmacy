// Alerts Page
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { generateAllAlerts } from '@/lib/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlerts, markAlertAsRead, markAllAlertsAsRead } from '@/services/alerts';
import { toast } from '@/components/ui/use-toast';

const ALERTS_QUERY_KEY = ['alerts'];

export const AlertsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: ALERTS_QUERY_KEY,
    queryFn: fetchAlerts,
  });

  useEffect(() => {
    (async () => {
      try {
        await generateAllAlerts();
        await queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message ?? 'Failed to refresh alerts',
          variant: 'destructive',
        });
      }
    })();
  }, [queryClient]);

  const alerts = alertsQuery.data ?? [];

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === 'unread') return !alert.read;
      if (filter === 'read') return alert.read;
      return true;
    });
  }, [alerts, filter]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAlertAsRead(alertId);
      await queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to mark alert as read',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAlertsAsRead();
      await queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message ?? 'Failed to mark alerts as read',
        variant: 'destructive',
      });
    }
  };

  if (alertsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading alerts...</span>
      </div>
    );
  }

  if (alertsQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="text-sm text-destructive">
          {(alertsQuery.error as Error).message ?? 'Failed to load alerts.'}
        </p>
        <Button onClick={() => alertsQuery.refetch()} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {unreadCount} unread alerts
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead} variant="outline" className="w-full sm:w-auto">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </Button>
        <Button
          variant={filter === 'read' ? 'default' : 'outline'}
          onClick={() => setFilter('read')}
        >
          Read ({alerts.length - unreadCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            System alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Product</TableHead>
                  <TableHead className="min-w-[100px]">Type</TableHead>
                  <TableHead className="min-w-[100px]">Severity</TableHead>
                  <TableHead className="min-w-[200px]">Message</TableHead>
                  <TableHead className="min-w-[150px]">Date</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="text-right min-w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No alerts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.productName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{alert.type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            alert.severity === 'critical' ? 'destructive' :
                            alert.severity === 'high' ? 'destructive' :
                            alert.severity === 'medium' ? 'default' : 'secondary'
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>
                        {new Date(alert.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {alert.read ? (
                          <Badge variant="secondary">Read</Badge>
                        ) : (
                          <Badge variant="default">Unread</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!alert.read && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsRead(alert.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
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

