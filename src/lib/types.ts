// Product type
export interface Product {
  id: string;
  name: string;
  price: number; // Selling price per unit (per item or per kg)
  costPrice?: number; // Buying price per unit (0 / missing = not set)
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
  costPrice?: number; // Buying price per unit at the time of sale
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

// Supplier (where you buy goods from)
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  unit: string;
}

// Buying goods from a supplier (total - paid = still owed to the supplier)
export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  note: string;
  items: PurchaseItem[];
  total: number;
  paid: number;
  createdAt: string;
}

// Money paid to a supplier later
export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  note: string;
  createdAt: string;
}

// Shop details printed on invoices
export interface ShopInfo {
  name: string;
  phone: string;
  address: string;
  note: string;
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
