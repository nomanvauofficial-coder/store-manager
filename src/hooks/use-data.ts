'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  productOperations,
  customerOperations,
  transactionOperations,
  expenseOperations,
  categoryOperations,
  duePaymentOperations,
  reportOperations,
  settingsOperations
} from '@/lib/db';
import type { Product, Customer, Transaction, Expense, DuePayment, ProductFormData, CustomerFormData, ExpenseFormData } from '@/types';

// Products hooks
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => productOperations.getAll()
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => productOperations.getById(id),
    enabled: !!id
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products', 'lowStock'],
    queryFn: () => productOperations.getLowStock()
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (product: ProductFormData) => productOperations.add(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) => 
      productOperations.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => productOperations.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}

// Customers hooks
export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => customerOperations.getAll()
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customerOperations.getById(id),
    enabled: !!id
  });
}

export function useCustomersWithDue() {
  return useQuery({
    queryKey: ['customers', 'withDue'],
    queryFn: () => customerOperations.getWithDue()
  });
}

export function useAddCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (customer: CustomerFormData) => customerOperations.add(customer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) => 
      customerOperations.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => customerOperations.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

// Transactions hooks
export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionOperations.getAll()
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: () => transactionOperations.getById(id),
    enabled: !!id
  });
}

export function useTodayTransactions() {
  return useQuery({
    queryKey: ['transactions', 'today'],
    queryFn: () => transactionOperations.getTodaySales()
  });
}

export function useCustomerTransactions(customerId: string) {
  return useQuery({
    queryKey: ['transactions', 'customer', customerId],
    queryFn: () => transactionOperations.getByCustomer(customerId),
    enabled: !!customerId
  });
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'deleted'>) => 
      transactionOperations.add(transaction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => transactionOperations.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

// Expenses hooks
export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => expenseOperations.getAll()
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expenseOperations.getById(id),
    enabled: !!id
  });
}

export function useTodayExpenses() {
  return useQuery({
    queryKey: ['expenses', 'today'],
    queryFn: () => expenseOperations.getTodayExpenses()
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (expense: ExpenseFormData) => expenseOperations.add(expense),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Expense> }) => 
      expenseOperations.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => expenseOperations.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
}

// Categories hooks
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryOperations.getAll()
  });
}

export function useAddCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (name: string) => categoryOperations.add(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => categoryOperations.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
}

// Due Payments hooks
export function useAddDuePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payment: Omit<DuePayment, 'id' | 'createdAt'>) => 
      duePaymentOperations.add(payment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

export function useCustomerDuePayments(customerId: string) {
  return useQuery({
    queryKey: ['duePayments', customerId],
    queryFn: () => duePaymentOperations.getByCustomer(customerId),
    enabled: !!customerId
  });
}

// Reports hooks
export function useWeeklyReport() {
  return useQuery({
    queryKey: ['reports', 'weekly'],
    queryFn: () => reportOperations.getWeeklyReport()
  });
}

export function useMonthlyReport() {
  return useQuery({
    queryKey: ['reports', 'monthly'],
    queryFn: () => reportOperations.getMonthlyReport()
  });
}

export function useYearlyReport() {
  return useQuery({
    queryKey: ['reports', 'yearly'],
    queryFn: () => reportOperations.getYearlyReport()
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: ['reports', 'topProducts'],
    queryFn: () => reportOperations.getTopProducts()
  });
}

export function useTopCustomers() {
  return useQuery({
    queryKey: ['reports', 'topCustomers'],
    queryFn: () => reportOperations.getTopCustomers()
  });
}

// Settings hooks
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsOperations.get()
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Parameters<typeof settingsOperations.update>[0]) => 
      settingsOperations.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });
}

// Dashboard stats hook
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [products, todayTransactions, todayExpenses, customersWithDue, lowStockProducts] = await Promise.all([
        productOperations.getAll(),
        transactionOperations.getTodaySales(),
        expenseOperations.getTodayExpenses(),
        customerOperations.getWithDue(),
        productOperations.getLowStock()
      ]);

      const todaySales = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
      const todayProfit = todayTransactions.reduce((sum, t) => sum + t.profit, 0);
      const totalDue = customersWithDue.reduce((sum, c) => sum + c.totalDue, 0);

      return {
        todaySales,
        todayProfit,
        totalDue,
        totalProducts: products.length,
        lowStockItems: lowStockProducts.length,
        todayTransactions: todayTransactions.length,
        todayExpenses: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
        recentTransactions: todayTransactions.slice(0, 5),
        lowStockProducts: lowStockProducts.slice(0, 5)
      };
    }
  });
}
