import { Product, Customer, Sale, DuePayment, Expense } from './types';

const STORAGE_KEYS = {
  PRODUCTS: 'store_products',
  CUSTOMERS: 'store_customers',
  SALES: 'store_sales',
  DUE_PAYMENTS: 'store_due_payments',
  EXPENSES: 'store_expenses',
};

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generic get from localStorage
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Generic save to localStorage
function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage: ${key}`, error);
  }
}

// Products
export function getProducts(): Product[] {
  return getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
}

export function saveProducts(products: Product[]): void {
  saveToStorage(STORAGE_KEYS.PRODUCTS, products);
}

// Customers
export function getCustomers(): Customer[] {
  return getFromStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
}

export function saveCustomers(customers: Customer[]): void {
  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
}

// Sales
export function getSales(): Sale[] {
  return getFromStorage<Sale[]>(STORAGE_KEYS.SALES, []);
}

export function saveSales(sales: Sale[]): void {
  saveToStorage(STORAGE_KEYS.SALES, sales);
}

// Due Payments
export function getDuePayments(): DuePayment[] {
  return getFromStorage<DuePayment[]>(STORAGE_KEYS.DUE_PAYMENTS, []);
}

export function saveDuePayments(duePayments: DuePayment[]): void {
  saveToStorage(STORAGE_KEYS.DUE_PAYMENTS, duePayments);
}

// Expenses
export function getExpenses(): Expense[] {
  return getFromStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []);
}

export function saveExpenses(expenses: Expense[]): void {
  saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
}

// Calculate customer's due balance
export function getCustomerDueBalance(customerId: string): number {
  const sales = getSales();
  const duePayments = getDuePayments();
  
  const totalDue = sales
    .filter(s => s.customerId === customerId && s.paymentType === 'due')
    .reduce((sum, s) => sum + s.total, 0);
  
  const totalPaid = duePayments
    .filter(p => p.customerId === customerId)
    .reduce((sum, p) => sum + p.amount, 0);
  
  return totalDue - totalPaid;
}

// Get all customers with due balances
export function getCustomersWithDues(): (Customer & { dueBalance: number })[] {
  const customers = getCustomers();
  return customers.map(customer => ({
    ...customer,
    dueBalance: getCustomerDueBalance(customer.id),
  }));
}
