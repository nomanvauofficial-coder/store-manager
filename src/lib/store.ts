import { create } from 'zustand';
import { Product, Customer, Sale, DuePayment, Expense, SaleItem } from './types';
import {
  getProducts, saveProducts,
  getCustomers, saveCustomers,
  getSales, saveSales,
  getDuePayments, saveDuePayments,
  getExpenses, saveExpenses,
  generateId
} from './storage';

interface StoreState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  duePayments: DuePayment[];
  expenses: Expense[];
  _loaded: boolean;
  
  // Actions
  loadData: () => void;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  // Sale actions
  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => void;
  deleteSale: (id: string) => void;
  
  // Due payment actions
  addDuePayment: (payment: Omit<DuePayment, 'id' | 'createdAt'>) => void;
  
  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  products: [],
  customers: [],
  sales: [],
  duePayments: [],
  expenses: [],
  _loaded: false,
  
  loadData: () => {
    // Only load once
    if ((get() as any)._loaded) return;
    set({
      products: getProducts(),
      customers: getCustomers(),
      sales: getSales(),
      duePayments: getDuePayments(),
      expenses: getExpenses(),
      _loaded: true,
    } as any);
  },
  
  // Product actions
  addProduct: (productData) => {
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const products = [...get().products, newProduct];
    saveProducts(products);
    set({ products });
  },
  
  updateProduct: (id, productData) => {
    const products = get().products.map(p => 
      p.id === id ? { ...p, ...productData, updatedAt: new Date().toISOString() } : p
    );
    saveProducts(products);
    set({ products });
  },
  
  deleteProduct: (id) => {
    const products = get().products.filter(p => p.id !== id);
    saveProducts(products);
    set({ products });
  },
  
  // Customer actions
  addCustomer: (customerData) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const customers = [...get().customers, newCustomer];
    saveCustomers(customers);
    set({ customers });
  },
  
  updateCustomer: (id, customerData) => {
    const customers = get().customers.map(c => 
      c.id === id ? { ...c, ...customerData } : c
    );
    saveCustomers(customers);
    set({ customers });
  },
  
  deleteCustomer: (id) => {
    const customers = get().customers.filter(c => c.id !== id);
    saveCustomers(customers);
    set({ customers });
  },
  
  // Sale actions
  addSale: (saleData) => {
    const newSale: Sale = {
      ...saleData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    
    // Update inventory for each item
    const products = get().products.map(p => {
      const saleItem = saleData.items.find((item: SaleItem) => item.productId === p.id);
      if (saleItem) {
        const deductAmount = p.pricingType === 'weight' 
          ? (saleItem.weight || saleItem.quantity) 
          : saleItem.quantity;
        return { ...p, stock: Math.max(0, p.stock - deductAmount), updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    const sales = [...get().sales, newSale];
    saveSales(sales);
    saveProducts(products);
    set({ sales, products });
  },
  
  deleteSale: (id) => {
    const sale = get().sales.find(s => s.id === id);
    if (!sale) return;
    
    // Restore inventory
    const products = get().products.map(p => {
      const saleItem = sale.items.find(item => item.productId === p.id);
      if (saleItem) {
        const restoreAmount = p.pricingType === 'weight' 
          ? (saleItem.weight || saleItem.quantity) 
          : saleItem.quantity;
        return { ...p, stock: p.stock + restoreAmount, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    
    const sales = get().sales.filter(s => s.id !== id);
    saveSales(sales);
    saveProducts(products);
    set({ sales, products });
  },
  
  // Due payment actions
  addDuePayment: (paymentData) => {
    const newPayment: DuePayment = {
      ...paymentData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const duePayments = [...get().duePayments, newPayment];
    saveDuePayments(duePayments);
    set({ duePayments });
  },
  
  // Expense actions
  addExpense: (expenseData) => {
    const newExpense: Expense = {
      ...expenseData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const expenses = [...get().expenses, newExpense];
    saveExpenses(expenses);
    set({ expenses });
  },
  
  deleteExpense: (id) => {
    const expenses = get().expenses.filter(e => e.id !== id);
    saveExpenses(expenses);
    set({ expenses });
  },
}));
