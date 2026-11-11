/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toast } from '@/hooks/use-toast';
import {
  Product, Customer, Sale, DuePayment, Expense, SaleItem, Supplier, Purchase, PurchaseItem, SupplierPayment,
} from './types';

type Row = Record<string, any>;

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/* ---------- row <-> app mapping ---------- */
const toProduct = (r: Row): Product => ({
  id: r.id, name: r.name, price: Number(r.price), costPrice: Number(r.cost_price ?? 0), stock: Number(r.stock),
  category: r.category, pricingType: r.pricing_type, unit: r.unit,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const fromProduct = (p: Partial<Product>): Row => {
  const r: Row = {};
  if (p.id !== undefined) r.id = p.id;
  if (p.name !== undefined) r.name = p.name;
  if (p.price !== undefined) r.price = p.price;
  if (p.costPrice !== undefined) r.cost_price = p.costPrice;
  if (p.stock !== undefined) r.stock = p.stock;
  if (p.category !== undefined) r.category = p.category;
  if (p.pricingType !== undefined) r.pricing_type = p.pricingType;
  if (p.unit !== undefined) r.unit = p.unit;
  if (p.createdAt !== undefined) r.created_at = p.createdAt;
  if (p.updatedAt !== undefined) r.updated_at = p.updatedAt;
  return r;
};
const toCustomer = (r: Row): Customer => ({
  id: r.id, name: r.name, phone: r.phone ?? '', address: r.address ?? '', createdAt: r.created_at,
});
const toSale = (r: Row): Sale => ({
  id: r.id, items: r.items as SaleItem[], total: Number(r.total), paymentType: r.payment_type,
  customerId: r.customer_id ?? undefined, customerName: r.customer_name ?? undefined, createdAt: r.created_at,
});
const toDue = (r: Row): DuePayment => ({
  id: r.id, customerId: r.customer_id, customerName: r.customer_name, amount: Number(r.amount), createdAt: r.created_at,
});
const toSupplier = (r: Row): Supplier => ({
  id: r.id, name: r.name, phone: r.phone ?? '', address: r.address ?? '', createdAt: r.created_at,
});
const toPurchase = (r: Row): Purchase => ({
  id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name ?? '', note: r.note ?? '',
  items: (r.items ?? []) as PurchaseItem[], total: Number(r.total), paid: Number(r.paid), createdAt: r.created_at,
});
const toSupplierPayment = (r: Row): SupplierPayment => ({
  id: r.id, supplierId: r.supplier_id, supplierName: r.supplier_name ?? '', amount: Number(r.amount),
  note: r.note ?? '', createdAt: r.created_at,
});
const toExpense = (r: Row): Expense => ({
  id: r.id, description: r.description, amount: Number(r.amount), category: r.category, createdAt: r.created_at,
});

/* ---------- fetching (pages of 1000 so nothing gets cut off) ---------- */
async function fetchAll(table: string, orderBy: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table).select('*').order(orderBy, { ascending: true }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const TABLES = {
  products: { table: 'products', map: toProduct },
  customers: { table: 'customers', map: toCustomer },
  sales: { table: 'sales', map: toSale },
  duePayments: { table: 'due_payments', map: toDue },
  expenses: { table: 'expenses', map: toExpense },
  suppliers: { table: 'suppliers', map: toSupplier },
  purchases: { table: 'purchases', map: toPurchase },
  supplierPayments: { table: 'supplier_payments', map: toSupplierPayment },
} as const;
type Key = keyof typeof TABLES;

interface StoreState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  duePayments: DuePayment[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  _loaded: boolean;

  start: () => Promise<void>;
  stop: () => void;
  refresh: (keys?: Key[]) => Promise<void>;

  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => void;
  deleteSale: (id: string) => void;

  addDuePayment: (payment: Omit<DuePayment, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  deleteDuePayment: (id: string) => void;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;

  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  deleteSupplier: (id: string) => void;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  deletePurchase: (id: string) => void;
  addSupplierPayment: (payment: Omit<SupplierPayment, 'id' | 'createdAt'> & { createdAt?: string }) => void;
  deleteSupplierPayment: (id: string) => void;
}

let channel: RealtimeChannel | null = null;
let onVisible: (() => void) | null = null;

export const useStore = create<StoreState>((set, get) => {
  // Save to the cloud. If it fails, tell the user and reload the real data.
  const persist = async (job: PromiseLike<{ error: { message: string } | null }>, keys: Key[]) => {
    try {
      const { error } = await job;
      if (error) throw error;
    } catch (e) {
      toast({
        title: 'সেভ করা যায়নি',
        description: (e as { message?: string })?.message || 'ইন্টারনেট সংযোগ দেখুন',
        variant: 'destructive',
      });
      void get().refresh(keys);
    }
  };

  return {
    products: [], customers: [], sales: [], duePayments: [], expenses: [], suppliers: [], purchases: [], supplierPayments: [], _loaded: false,

    refresh: async (keys = Object.keys(TABLES) as Key[]) => {
      try {
        const results = await Promise.all(
          keys.map(async k => [k, (await fetchAll(TABLES[k].table, 'created_at')).map(TABLES[k].map as (r: Row) => unknown)] as const),
        );
        set(Object.fromEntries(results) as Partial<StoreState>);
      } catch (e) {
        toast({ title: 'ডেটা লোড করা যায়নি', description: (e as { message?: string })?.message, variant: 'destructive' });
      }
    },

    start: async () => {
      await get().refresh();
      set({ _loaded: true });

      if (!channel) {
        let ch = supabase.channel('store-sync');
        (Object.keys(TABLES) as Key[]).forEach(k => {
          ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[k].table }, () => {
            void get().refresh([k]);
          });
        });
        channel = ch.subscribe();
      }
      if (!onVisible && typeof document !== 'undefined') {
        // Phones pause the connection when the screen is off: refresh when coming back.
        onVisible = () => { if (document.visibilityState === 'visible') void get().refresh(); };
        document.addEventListener('visibilitychange', onVisible);
      }
    },

    stop: () => {
      if (channel) { void supabase.removeChannel(channel); channel = null; }
      if (onVisible) { document.removeEventListener('visibilitychange', onVisible); onVisible = null; }
      set({ products: [], customers: [], sales: [], duePayments: [], expenses: [], suppliers: [], purchases: [], supplierPayments: [], _loaded: false });
    },

    /* ---- products ---- */
    addProduct: data => {
      const now = new Date().toISOString();
      const product: Product = { ...data, id: uid(), createdAt: now, updatedAt: now };
      set({ products: [...get().products, product] });
      void persist(supabase.from('products').insert(fromProduct(product)), ['products']);
    },
    updateProduct: (id, data) => {
      const updatedAt = new Date().toISOString();
      set({ products: get().products.map(p => (p.id === id ? { ...p, ...data, updatedAt } : p)) });
      void persist(supabase.from('products').update(fromProduct({ ...data, updatedAt })).eq('id', id), ['products']);
    },
    deleteProduct: id => {
      set({ products: get().products.filter(p => p.id !== id) });
      void persist(supabase.from('products').delete().eq('id', id), ['products']);
    },

    /* ---- customers ---- */
    addCustomer: data => {
      const customer: Customer = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ customers: [...get().customers, customer] });
      void persist(
        supabase.from('customers').insert({
          id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, created_at: customer.createdAt,
        }),
        ['customers'],
      );
    },
    updateCustomer: (id, data) => {
      set({ customers: get().customers.map(c => (c.id === id ? { ...c, ...data } : c)) });
      const row: Row = {};
      if (data.name !== undefined) row.name = data.name;
      if (data.phone !== undefined) row.phone = data.phone;
      if (data.address !== undefined) row.address = data.address;
      void persist(supabase.from('customers').update(row).eq('id', id), ['customers']);
    },
    deleteCustomer: id => {
      set({ customers: get().customers.filter(c => c.id !== id) });
      void persist(supabase.from('customers').delete().eq('id', id), ['customers']);
    },

    /* ---- sales (stock is changed inside the database, so many phones can sell at once) ---- */
    addSale: data => {
      const sale: Sale = { ...data, id: uid(), createdAt: new Date().toISOString() };
      const products = get().products.map(p => {
        const item = sale.items.find((i: SaleItem) => i.productId === p.id);
        if (!item) return p;
        const deduct = p.pricingType === 'weight' ? item.weight || item.quantity : item.quantity;
        return { ...p, stock: Math.max(0, p.stock - deduct) };
      });
      set({ sales: [...get().sales, sale], products });
      void persist(
        supabase.rpc('create_sale', {
          p_id: sale.id, p_items: sale.items, p_total: sale.total, p_payment_type: sale.paymentType,
          p_customer_id: sale.customerId ?? null, p_customer_name: sale.customerName ?? null,
        }),
        ['sales', 'products'],
      );
    },
    deleteSale: id => {
      const sale = get().sales.find(s => s.id === id);
      if (!sale) return;
      const products = get().products.map(p => {
        const item = sale.items.find(i => i.productId === p.id);
        if (!item) return p;
        const back = p.pricingType === 'weight' ? item.weight || item.quantity : item.quantity;
        return { ...p, stock: p.stock + back };
      });
      set({ sales: get().sales.filter(s => s.id !== id), products });
      void persist(supabase.rpc('delete_sale', { p_id: id }), ['sales', 'products']);
    },

    /* ---- due payments ---- */
    addDuePayment: data => {
      const payment: DuePayment = { ...data, id: uid(), createdAt: data.createdAt || new Date().toISOString() };
      set({ duePayments: [...get().duePayments, payment] });
      void persist(
        supabase.from('due_payments').insert({
          id: payment.id, customer_id: payment.customerId, customer_name: payment.customerName,
          amount: payment.amount, created_at: payment.createdAt,
        }),
        ['duePayments'],
      );
    },

    deleteDuePayment: id => {
      set({ duePayments: get().duePayments.filter(p => p.id !== id) });
      void persist(supabase.from('due_payments').delete().eq('id', id), ['duePayments']);
    },

    /* ---- expenses ---- */
    addExpense: data => {
      const expense: Expense = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ expenses: [...get().expenses, expense] });
      void persist(
        supabase.from('expenses').insert({
          id: expense.id, description: expense.description, amount: expense.amount,
          category: expense.category, created_at: expense.createdAt,
        }),
        ['expenses'],
      );
    },
    deleteExpense: id => {
      set({ expenses: get().expenses.filter(e => e.id !== id) });
      void persist(supabase.from('expenses').delete().eq('id', id), ['expenses']);
    },

    /* ---- suppliers ---- */
    addSupplier: data => {
      const supplier: Supplier = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ suppliers: [...get().suppliers, supplier] });
      void persist(
        supabase.from('suppliers').insert({
          id: supplier.id, name: supplier.name, phone: supplier.phone, address: supplier.address, created_at: supplier.createdAt,
        }),
        ['suppliers'],
      );
    },
    deleteSupplier: id => {
      set({ suppliers: get().suppliers.filter(s => s.id !== id) });
      void persist(supabase.from('suppliers').delete().eq('id', id), ['suppliers']);
    },

    /* ---- buying goods (stock goes up inside the database) ---- */
    addPurchase: data => {
      const purchase: Purchase = { ...data, id: uid(), createdAt: data.createdAt || new Date().toISOString() };
      const products = get().products.map(p => {
        const item = purchase.items.find(i => i.productId === p.id);
        if (!item) return p;
        return { ...p, stock: p.stock + item.quantity, costPrice: item.unitCost > 0 ? item.unitCost : p.costPrice };
      });
      set({ purchases: [...get().purchases, purchase], products });
      void persist(
        supabase.rpc('create_purchase', {
          p_id: purchase.id, p_supplier_id: purchase.supplierId, p_supplier_name: purchase.supplierName,
          p_note: purchase.note, p_items: purchase.items, p_total: purchase.total, p_paid: purchase.paid,
          p_created_at: purchase.createdAt,
        }),
        ['purchases', 'products'],
      );
    },
    deletePurchase: id => {
      const purchase = get().purchases.find(p => p.id === id);
      if (!purchase) return;
      const products = get().products.map(p => {
        const item = purchase.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      });
      set({ purchases: get().purchases.filter(p => p.id !== id), products });
      void persist(supabase.rpc('delete_purchase', { p_id: id }), ['purchases', 'products']);
    },

    /* ---- payments to suppliers ---- */
    addSupplierPayment: data => {
      const payment: SupplierPayment = { ...data, id: uid(), createdAt: data.createdAt || new Date().toISOString() };
      set({ supplierPayments: [...get().supplierPayments, payment] });
      void persist(
        supabase.from('supplier_payments').insert({
          id: payment.id, supplier_id: payment.supplierId, supplier_name: payment.supplierName,
          amount: payment.amount, note: payment.note, created_at: payment.createdAt,
        }),
        ['supplierPayments'],
      );
    },
    deleteSupplierPayment: id => {
      set({ supplierPayments: get().supplierPayments.filter(p => p.id !== id) });
      void persist(supabase.from('supplier_payments').delete().eq('id', id), ['supplierPayments']);
    },
  };
});
