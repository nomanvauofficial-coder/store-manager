'use client';

import { useState } from 'react';
import { useTransactions, useDeleteTransaction } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Receipt, Search, Trash2, Eye, Calendar, User, DollarSign, TrendingUp } from 'lucide-react';
import type { Transaction } from '@/types';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

export function TransactionsView() {
  const { data: transactions = [], isLoading } = useTransactions();
  const deleteTransaction = useDeleteTransaction();

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;

    try {
      await deleteTransaction.mutateAsync(selectedTransaction.id);
      toast.success('Transaction deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedTransaction(null);
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.items.some(item => 
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const transactionDate = new Date(transaction.createdAt);
    let matchesDate = true;

    switch (dateFilter) {
      case 'today':
        matchesDate = isToday(transactionDate);
        break;
      case 'yesterday':
        matchesDate = isYesterday(transactionDate);
        break;
      case 'week':
        matchesDate = isThisWeek(transactionDate);
        break;
      case 'month':
        matchesDate = isThisMonth(transactionDate);
        break;
    }

    return matchesSearch && matchesDate;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = format(new Date(transaction.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const totalSales = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalProfit = filteredTransactions.reduce((sum, t) => sum + t.profit, 0);
  const totalCash = filteredTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.totalAmount, 0);
  const totalDue = filteredTransactions.filter(t => t.paymentMethod === 'due').reduce((sum, t) => sum + t.totalAmount, 0);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">View and manage sales history</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">${totalSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalCash.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">${totalDue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'today', 'yesterday', 'week', 'month'] as const).map((filter) => (
            <Button
              key={filter}
              variant={dateFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {Object.keys(groupedTransactions).length > 0 ? (
        <ScrollArea className="h-[calc(100vh-20rem)]">
          {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
            <div key={date} className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
              </h3>
              <div className="space-y-2">
                {dayTransactions.map((transaction) => (
                  <Card key={transaction.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-lg">${transaction.totalAmount.toFixed(2)}</p>
                            <Badge variant={transaction.paymentMethod === 'cash' ? 'default' : 'secondary'}>
                              {transaction.paymentMethod.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              ${transaction.profit.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>{transaction.items.length} items</span>
                            {transaction.customerName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {transaction.customerName}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span>{format(new Date(transaction.createdAt), 'HH:mm')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Receipt className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No transactions found</p>
          <p className="text-sm">Transactions will appear here after sales</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This will restore the inventory and update customer dues if applicable. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transaction Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction && format(new Date(selectedTransaction.createdAt), 'MMMM dd, yyyy HH:mm')}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold">${selectedTransaction.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Method</span>
                <Badge variant={selectedTransaction.paymentMethod === 'cash' ? 'default' : 'secondary'}>
                  {selectedTransaction.paymentMethod.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-bold text-green-600">${selectedTransaction.profit.toFixed(2)}</span>
              </div>
              {selectedTransaction.customerName && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{selectedTransaction.customerName}</span>
                </div>
              )}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Items</h4>
                <div className="space-y-2">
                  {selectedTransaction.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{item.productName}</span>
                        <span className="text-muted-foreground ml-2">
                          × {item.quantity}
                        </span>
                      </div>
                      <span>${item.totalPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
