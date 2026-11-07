// Product types
export interface Product {
  id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  unit: string;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

// Customer types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  totalDue: number;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

// Transaction types
export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  totalPrice: number;
}

export interface Transaction {
  id: string;
  items: TransactionItem[];
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  paymentMethod: 'cash' | 'due';
  profit: number;
  createdAt: Date;
  deleted: boolean;
}

// Expense types
export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'supplies' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
  createdAt: Date;
  deleted: boolean;
}

// Due Payment types
export interface DuePayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  createdAt: Date;
}

// Product Category types
export interface ProductCategory {
  id: string;
  name: string;
  createdAt: Date;
}

// Settings types
export interface Settings {
  id: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  currency: string;
}

// Dashboard stats types
export interface DashboardStats {
  todaySales: number;
  todayProfit: number;
  totalDue: number;
  totalProducts: number;
  lowStockItems: number;
  todayTransactions: number;
}

// Report types
export interface DailyReport {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
  transactions: number;
}

export interface ProductSalesData {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface CustomerSalesData {
  customerId: string;
  customerName: string;
  totalPurchases: number;
  totalDue: number;
}

// Form types
export interface ProductFormData {
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  unit: string;
  minStock: number;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export interface TransactionFormData {
  items: {
    productId: string;
    quantity: number;
  }[];
  customerId?: string;
  paymentMethod: 'cash' | 'due';
}

export interface ExpenseFormData {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
}
