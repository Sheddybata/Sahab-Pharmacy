import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { diagnoseInventoryData, DiagnosticResult } from '@/lib/inventory-diagnostics';
import { formatCurrency } from '@/lib/utils';

export const InventoryDiagnostics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const diagnosticResult = await diagnoseInventoryData();
      setResult(diagnosticResult);
    } catch (error) {
      console.error('Diagnostic failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Data Diagnostics</CardTitle>
        <CardDescription>
          Check for data quality issues that might affect inventory value calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runDiagnostics} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Batches Found</p>
                    <p className="text-2xl font-bold">{result.totalBatches}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Batches</p>
                    <p className="text-2xl font-bold">{result.uniqueBatches}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Calculated Total Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(result.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Products with Batches</p>
                    <p className="text-2xl font-bold">{result.batchesByProduct.size}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Issues */}
            {result.potentialIssues.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Potential Issues Found</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {result.potentialIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {result.potentialIssues.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>No Issues Found</AlertTitle>
                <AlertDescription>
                  Data appears to be in good shape. All batches are unique and have valid values.
                </AlertDescription>
              </Alert>
            )}

            {/* Duplicate Batches */}
            {result.duplicateBatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">
                    Duplicate Batches ({result.duplicateBatches.length})
                  </CardTitle>
                  <CardDescription>
                    These batch IDs appear multiple times and are being counted more than once
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Occurrences</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.duplicateBatches.slice(0, 20).map((dup) => (
                        <TableRow key={dup.batchId}>
                          <TableCell className="font-mono text-xs">{dup.batchId}</TableCell>
                          <TableCell className="font-mono text-xs">{dup.productId}</TableCell>
                          <TableCell>{dup.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {result.duplicateBatches.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ...and {result.duplicateBatches.length - 20} more
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invalid Cost Prices */}
            {result.batchesWithInvalidCostPrice.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-orange-600">
                    Invalid Cost Prices ({result.batchesWithInvalidCostPrice.length})
                  </CardTitle>
                  <CardDescription>
                    Batches with zero or negative cost prices (excluded from calculations)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Cost Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.batchesWithInvalidCostPrice.slice(0, 20).map((batch) => (
                        <TableRow key={batch.batchId}>
                          <TableCell className="font-mono text-xs">{batch.batchId}</TableCell>
                          <TableCell className="font-mono text-xs">{batch.productId}</TableCell>
                          <TableCell>{batch.costPrice}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Top Values */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 20 Batch Values</CardTitle>
                <CardDescription>
                  Highest value batches - check if these values look correct
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Batch Number</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Batch Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.sampleData.slice(0, 20).map((item) => (
                      <TableRow key={item.batchId}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="font-mono text-xs">{item.batchNumber}</TableCell>
                        <TableCell className="text-right">{item.remainingQuantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(item.batchValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

