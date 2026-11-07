// Product type
export interface Product {
  id: string;
  name: string;
  price: number; // Price per unit (per item or per kg)
  stock: number; // Stock in units or kg
  category: string;
  pricingType: 'fixed' | 'weight'; // Fixed price or weight-based
  unit: string; // e.g., 'pcs', 'kg', 'gram'
  createdAt: string;
  updatedAt: string;
}

// Customer type
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

// Sale item type
export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number; // For fixed: number of items, For weight: number of kg
  weight?: number; // Weight in kg (for weight-based products)
  price: number; // Price per unit
  subtotal: number;
  pricingType: 'fixed' | 'weight';
  unit: string;
}

// Sale type
export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentType: 'cash' | 'due';
  customerId?: string;
  customerName?: string;
  createdAt: string;
}

// Due payment (when customer pays their dues)
export interface DuePayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  createdAt: string;
}

// Expense type
export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  createdAt: string;
}

// Store state type
export interface StoreState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  duePayments: DuePayment[];
  expenses: Expense[];
}

// Statistics types
export interface DailyStats {
  date: string;
  sales: number;
  expenses: number;
  profit: number;
}

export interface ProductStats {
  productName: string;
  quantitySold: number;
  revenue: number;
}
