/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { toast } from '@/hooks/use-toast';
import { idbDel, idbGet, idbSet } from './offline';
import {
  Product, Customer, Sale, DuePayment, Expense, SaleItem, Supplier, Purchase, PurchaseItem,
  SupplierPayment, ShopInfo, SaleReturn, ReturnItem,
} from './types';

type Row = Record<string, any>;

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/* ---------- row <-> app mapping ---------- */
const toProduct = (r: Row): Product => ({
  id: r.id, name: r.name, price: Number(r.price), costPrice: Number(r.cost_price ?? 0), barcode: r.barcode ?? '', stock: Number(r.stock),
  category: r.category, pricingType: r.pricing_type, unit: r.unit,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const fromProduct = (p: Partial<Product>): Row => {
  const r: Row = {};
  if (p.id !== undefined) r.id = p.id;
  if (p.name !== undefined) r.name = p.name;
  if (p.price !== undefined) r.price = p.price;
  if (p.costPrice !== undefined) r.cost_price = p.costPrice;
  if (p.barcode !== undefined) r.barcode = p.barcode.trim() || null;
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
  id: r.id, items: r.items as SaleItem[], total: Number(r.total),
  paid: Number(r.paid ?? (r.payment_type === 'cash' ? r.total : 0)), discount: Number(r.discount ?? 0),
  paymentType: r.payment_type, customerId: r.customer_id ?? undefined, customerName: r.customer_name ?? undefined,
  createdAt: r.created_at,
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
const toShop = (r: Row): ShopInfo => ({
  name: r.name ?? '', phone: r.phone ?? '', address: r.address ?? '', note: r.note ?? '',
});
const toReturn = (r: Row): SaleReturn => ({
  id: r.id, saleId: r.sale_id ?? undefined, customerId: r.customer_id ?? undefined,
  customerName: r.customer_name ?? undefined, items: (r.items ?? []) as ReturnItem[],
  total: Number(r.total), credit: Number(r.credit ?? 0), note: r.note ?? '', createdAt: r.created_at,
});
const toExpense = (r: Row): Expense => ({
  id: r.id, description: r.description, amount: Number(r.amount), category: r.category, createdAt: r.created_at,
});

/* ---------- fetching (pages of 1000 so nothing gets cut off) ---------- */
export async function fetchAll(table: string, orderBy = 'created_at'): Promise<Row[]> {
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

export const TABLES = {
  products: { table: 'products', map: toProduct },
  customers: { table: 'customers', map: toCustomer },
  sales: { table: 'sales', map: toSale },
  duePayments: { table: 'due_payments', map: toDue },
  expenses: { table: 'expenses', map: toExpense },
  suppliers: { table: 'suppliers', map: toSupplier },
  purchases: { table: 'purchases', map: toPurchase },
  supplierPayments: { table: 'supplier_payments', map: toSupplierPayment },
  shopSettings: { table: 'shop_settings', map: toShop },
  returns: { table: 'returns', map: toReturn },
} as const;
export type Key = keyof typeof TABLES;
const ALL_KEYS = Object.keys(TABLES) as Key[];

/* ---------- "no internet" detection ---------- */
// true = try again later (no connection, or login token waiting to refresh); false = a real error
export const isRetryable = (e: any) => {
  const msg = String(e?.message ?? e ?? '');
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    e?.name === 'AuthRetryableFetchError' ||
    e?.code === 'PGRST301' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|jwt expired|ECONN/i.test(msg)
  );
};

/* ---------- changes waiting to be saved to the cloud ---------- */
type Op =
  | { t: 'insert'; table: string; row: Row }
  | { t: 'upsert'; table: string; row: Row }
  | { t: 'upsertMany'; table: string; rows: Row[] }
  | { t: 'update'; table: string; id: string; row: Row }
  | { t: 'delete'; table: string; id: string }
  | { t: 'rpc'; fn: string; args: Row };
interface QueueItem { qid: string; op: Op; keys: Key[] }

const runOp = async (op: Op): Promise<{ message: string; code?: string } | null> => {
  try {
    let res: { error: any };
    switch (op.t) {
      case 'insert': res = await supabase.from(op.table).insert(op.row); break;
      case 'upsert': res = await supabase.from(op.table).upsert(op.row); break;
      case 'upsertMany': res = await supabase.from(op.table).upsert(op.rows); break;
      case 'update': res = await supabase.from(op.table).update(op.row).eq('id', op.id); break;
      case 'delete': res = await supabase.from(op.table).delete().eq('id', op.id); break;
      case 'rpc': res = await supabase.rpc(op.fn, op.args); break;
    }
    return res.error ?? null;
  } catch (e) {
    return { message: String((e as Error)?.message ?? e) };
  }
};

interface StoreState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  duePayments: DuePayment[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  shopSettings: ShopInfo[]; // 0 or 1 row: the shop details for invoices
  returns: SaleReturn[];
  _loaded: boolean;
  userId: string;
  online: boolean; // false = the last try to reach the cloud failed
  syncing: boolean;
  pending: number; // changes made on this phone that are not saved to the cloud yet

  start: (userId: string) => Promise<void>;
  stop: () => void;
  refresh: (keys?: Key[]) => Promise<void>;
  sync: () => Promise<void>;
  wipeLocal: () => Promise<void>;

  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  upsertProducts: (list: Product[]) => void; // add new / update existing, many at once (Excel import, price change)

  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  addSale: (sale: Omit<Sale, 'id' | 'createdAt'>) => void;
  deleteSale: (id: string) => void;

  addReturn: (ret: Omit<SaleReturn, 'id' | 'createdAt'>) => void;
  deleteReturn: (id: string) => void;

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

  saveShop: (info: ShopInfo) => void;
}

let channel: RealtimeChannel | null = null;
let queue: QueueItem[] = [];
let flushing = false;
let listenersOn = false;
let timer: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSave: (() => void) | null = null;
let handlers: { visible: () => void; online: () => void; offline: () => void } | null = null;

const EMPTY = {
  products: [], customers: [], sales: [], duePayments: [], expenses: [], suppliers: [],
  purchases: [], supplierPayments: [], shopSettings: [], returns: [],
};

export const useStore = create<StoreState>((set, get) => {
  const qKey = () => `${get().userId}:queue`;
  const sKey = () => `${get().userId}:snapshot`;
  const saveQueue = () => { void idbSet(qKey(), queue); };

  // keep a copy of everything on this phone (so the app opens and works without internet)
  const saveSnapshot = () => {
    if (!get().userId || !get()._loaded) return;
    const st = get();
    const data: Row = {};
    ALL_KEYS.forEach(k => { data[k] = st[k]; });
    void idbSet(sKey(), { savedAt: Date.now(), data });
  };
  const saveSnapshotSoon = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSnapshot, 600);
  };

  // Every change is applied on the screen at once, then saved to the cloud.
  // No internet? It waits in line on this phone and is saved automatically later.
  const enqueue = (op: Op, keys: Key[]) => {
    queue.push({ qid: uid(), op, keys });
    saveQueue();
    set({ pending: queue.length });
    void flush();
  };

  const flush = async () => {
    if (flushing || queue.length === 0) return;
    flushing = true;
    set({ syncing: true });
    const touched = new Set<Key>();
    let offline = false;
    try {
      // no valid login right now (offline with an old token, or signed out): keep everything waiting, never drop it
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) offline = true;
      while (!offline && queue.length > 0) {
        const item = queue[0];
        const err = await runOp(item.op);
        if (!err) {
          queue.shift();
          item.keys.forEach(k => touched.add(k));
        } else if (isRetryable(err)) {
          offline = true;
          break;
        } else if (err.code === '23505') {
          queue.shift(); // already saved earlier
        } else {
          queue.shift();
          item.keys.forEach(k => touched.add(k));
          toast({ title: 'সেভ করা যায়নি', description: err.message, variant: 'destructive' });
        }
        saveQueue();
        set({ pending: queue.length });
      }
    } finally {
      flushing = false;
      set({ syncing: false, online: !offline });
    }
    if (!offline && touched.size > 0) await get().refresh([...touched]);
  };

  // returns true if the cloud answered
  const loadFromCloud = async (keys: Key[]): Promise<boolean> => {
    try {
      const results = await Promise.all(
        keys.map(async k => [k, (await fetchAll(TABLES[k].table)).map(TABLES[k].map as (r: Row) => unknown)] as const),
      );
      set({ ...(Object.fromEntries(results) as Partial<StoreState>), online: true });
      saveSnapshotSoon();
      return true;
    } catch (e) {
      if (isRetryable(e)) { set({ online: false }); return false; }
      throw e;
    }
  };

  return {
    ...EMPTY, _loaded: false, userId: '', online: true, syncing: false, pending: 0,

    refresh: async (keys = ALL_KEYS) => {
      if (queue.length > 0) {
        await flush();
        if (queue.length > 0) return; // our own changes are not saved yet: don't overwrite them
      }
      try {
        await loadFromCloud(keys);
      } catch (e) {
        toast({ title: 'ডেটা লোড করা যায়নি', description: (e as { message?: string })?.message, variant: 'destructive' });
      }
    },

    sync: async () => {
      await flush();
      if (queue.length === 0) await get().refresh();
    },

    start: async (userId: string) => {
      set({ userId });
      queue = (await idbGet<QueueItem[]>(`${userId}:queue`)) ?? [];
      set({ pending: queue.length });

      // 1) show what this phone remembers, right away
      const snap = await idbGet<{ data: Row }>(`${userId}:snapshot`);
      if (snap?.data) set(snap.data as Partial<StoreState>);

      // 2) try the cloud: save waiting changes, then load fresh data
      await flush();
      let cloudOk = false;
      if (queue.length === 0) cloudOk = await loadFromCloud(ALL_KEYS);
      if (!cloudOk && !snap) {
        throw new Error('ইন্টারনেট নেই, আর এই ফোনে আগে কখনো ডেটা লোড করা হয়নি');
      }
      set({ _loaded: true, online: cloudOk });
      saveSnapshotSoon();

      // 3) live updates from other phones
      if (!channel) {
        let ch = supabase.channel('store-sync');
        ALL_KEYS.forEach(k => {
          ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[k].table }, () => {
            void get().refresh([k]);
          });
        });
        channel = ch.subscribe();
      }

      // 4) come back online / screen on / every 20s while something is waiting
      if (!listenersOn && typeof window !== 'undefined') {
        listenersOn = true;
        handlers = {
          visible: () => { if (document.visibilityState === 'visible') void get().sync(); },
          online: () => { void get().sync(); },
          offline: () => set({ online: false }),
        };
        document.addEventListener('visibilitychange', handlers.visible);
        window.addEventListener('online', handlers.online);
        window.addEventListener('offline', handlers.offline);
        timer = setInterval(() => {
          if (queue.length > 0 || !get().online) void get().sync();
        }, 20000);
        unsubscribeSave = useStore.subscribe(saveSnapshotSoon);
      }
    },

    stop: () => {
      if (channel) { void supabase.removeChannel(channel); channel = null; }
      if (handlers) {
        document.removeEventListener('visibilitychange', handlers.visible);
        window.removeEventListener('online', handlers.online);
        window.removeEventListener('offline', handlers.offline);
        handlers = null;
      }
      if (timer) { clearInterval(timer); timer = null; }
      if (unsubscribeSave) { unsubscribeSave(); unsubscribeSave = null; }
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      listenersOn = false;
      queue = [];
      set({ ...EMPTY, _loaded: false, pending: 0, online: true, syncing: false });
    },

    // used when someone signs out on purpose: removes this phone's copy of the shop data
    wipeLocal: async () => {
      const id = get().userId;
      if (!id) return;
      await Promise.all([idbDel(`${id}:snapshot`), idbDel(`${id}:queue`)]);
      try { localStorage.removeItem(`sm-member-${id}`); } catch { /* ignore */ }
    },

    /* ---- products ---- */
    addProduct: data => {
      const now = new Date().toISOString();
      const product: Product = { ...data, id: uid(), createdAt: now, updatedAt: now };
      set({ products: [...get().products, product] });
      enqueue({ t: 'insert', table: 'products', row: fromProduct(product) }, ['products']);
      return product;
    },
    updateProduct: (id, data) => {
      const updatedAt = new Date().toISOString();
      set({ products: get().products.map(p => (p.id === id ? { ...p, ...data, updatedAt } : p)) });
      enqueue({ t: 'update', table: 'products', id, row: fromProduct({ ...data, updatedAt }) }, ['products']);
    },
    deleteProduct: id => {
      set({ products: get().products.filter(p => p.id !== id) });
      enqueue({ t: 'delete', table: 'products', id }, ['products']);
    },
    upsertProducts: list => {
      if (list.length === 0) return;
      const now = new Date().toISOString();
      // every row gets ALL fields, so the database never receives a half-filled row
      const full = list.map(p => ({
        ...p, costPrice: p.costPrice ?? 0, barcode: p.barcode ?? '', category: p.category || 'General',
        createdAt: p.createdAt || now, updatedAt: now,
      }));
      const byId = new Map(get().products.map(p => [p.id, p] as const));
      full.forEach(p => byId.set(p.id, p));
      set({ products: [...byId.values()] });
      for (let i = 0; i < full.length; i += 300) {
        enqueue({ t: 'upsertMany', table: 'products', rows: full.slice(i, i + 300).map(fromProduct) }, ['products']);
      }
    },

    /* ---- customers ---- */
    addCustomer: data => {
      const customer: Customer = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ customers: [...get().customers, customer] });
      enqueue({
        t: 'insert', table: 'customers',
        row: { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, created_at: customer.createdAt },
      }, ['customers']);
      return customer;
    },
    updateCustomer: (id, data) => {
      set({ customers: get().customers.map(c => (c.id === id ? { ...c, ...data } : c)) });
      const row: Row = {};
      if (data.name !== undefined) row.name = data.name;
      if (data.phone !== undefined) row.phone = data.phone;
      if (data.address !== undefined) row.address = data.address;
      enqueue({ t: 'update', table: 'customers', id, row }, ['customers']);
    },
    deleteCustomer: id => {
      set({ customers: get().customers.filter(c => c.id !== id) });
      enqueue({ t: 'delete', table: 'customers', id }, ['customers']);
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
      enqueue({
        t: 'rpc', fn: 'create_sale',
        args: {
          p_id: sale.id, p_items: sale.items, p_total: sale.total, p_payment_type: sale.paymentType,
          p_customer_id: sale.customerId ?? null, p_customer_name: sale.customerName ?? null,
          p_paid: sale.paid, p_discount: sale.discount, p_created_at: sale.createdAt,
        },
      }, ['sales', 'products']);
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
      enqueue({ t: 'rpc', fn: 'delete_sale', args: { p_id: id } }, ['sales', 'products']);
    },

    /* ---- returned goods (stock goes back up) ---- */
    addReturn: data => {
      const ret: SaleReturn = { ...data, id: uid(), createdAt: new Date().toISOString() };
      const products = get().products.map(p => {
        const item = ret.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.quantity } : p;
      });
      set({ returns: [...get().returns, ret], products });
      enqueue({
        t: 'rpc', fn: 'create_return',
        args: {
          p_id: ret.id, p_sale_id: ret.saleId ?? null, p_customer_id: ret.customerId ?? null,
          p_customer_name: ret.customerName ?? null, p_items: ret.items, p_total: ret.total,
          p_credit: ret.credit, p_note: ret.note, p_created_at: ret.createdAt,
        },
      }, ['returns', 'products']);
    },
    deleteReturn: id => {
      const ret = get().returns.find(r => r.id === id);
      if (!ret) return;
      const products = get().products.map(p => {
        const item = ret.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      });
      set({ returns: get().returns.filter(r => r.id !== id), products });
      enqueue({ t: 'rpc', fn: 'delete_return', args: { p_id: id } }, ['returns', 'products']);
    },

    /* ---- due payments ---- */
    addDuePayment: data => {
      const payment: DuePayment = { ...data, id: uid(), createdAt: data.createdAt || new Date().toISOString() };
      set({ duePayments: [...get().duePayments, payment] });
      enqueue({
        t: 'insert', table: 'due_payments',
        row: {
          id: payment.id, customer_id: payment.customerId, customer_name: payment.customerName,
          amount: payment.amount, created_at: payment.createdAt,
        },
      }, ['duePayments']);
    },
    deleteDuePayment: id => {
      set({ duePayments: get().duePayments.filter(p => p.id !== id) });
      enqueue({ t: 'delete', table: 'due_payments', id }, ['duePayments']);
    },

    /* ---- expenses ---- */
    addExpense: data => {
      const expense: Expense = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ expenses: [...get().expenses, expense] });
      enqueue({
        t: 'insert', table: 'expenses',
        row: {
          id: expense.id, description: expense.description, amount: expense.amount,
          category: expense.category, created_at: expense.createdAt,
        },
      }, ['expenses']);
    },
    deleteExpense: id => {
      set({ expenses: get().expenses.filter(e => e.id !== id) });
      enqueue({ t: 'delete', table: 'expenses', id }, ['expenses']);
    },

    /* ---- suppliers ---- */
    addSupplier: data => {
      const supplier: Supplier = { ...data, id: uid(), createdAt: new Date().toISOString() };
      set({ suppliers: [...get().suppliers, supplier] });
      enqueue({
        t: 'insert', table: 'suppliers',
        row: { id: supplier.id, name: supplier.name, phone: supplier.phone, address: supplier.address, created_at: supplier.createdAt },
      }, ['suppliers']);
    },
    deleteSupplier: id => {
      set({ suppliers: get().suppliers.filter(s => s.id !== id) });
      enqueue({ t: 'delete', table: 'suppliers', id }, ['suppliers']);
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
      enqueue({
        t: 'rpc', fn: 'create_purchase',
        args: {
          p_id: purchase.id, p_supplier_id: purchase.supplierId, p_supplier_name: purchase.supplierName,
          p_note: purchase.note, p_items: purchase.items, p_total: purchase.total, p_paid: purchase.paid,
          p_created_at: purchase.createdAt,
        },
      }, ['purchases', 'products']);
    },
    deletePurchase: id => {
      const purchase = get().purchases.find(p => p.id === id);
      if (!purchase) return;
      const products = get().products.map(p => {
        const item = purchase.items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      });
      set({ purchases: get().purchases.filter(p => p.id !== id), products });
      enqueue({ t: 'rpc', fn: 'delete_purchase', args: { p_id: id } }, ['purchases', 'products']);
    },

    /* ---- payments to suppliers ---- */
    addSupplierPayment: data => {
      const payment: SupplierPayment = { ...data, id: uid(), createdAt: data.createdAt || new Date().toISOString() };
      set({ supplierPayments: [...get().supplierPayments, payment] });
      enqueue({
        t: 'insert', table: 'supplier_payments',
        row: {
          id: payment.id, supplier_id: payment.supplierId, supplier_name: payment.supplierName,
          amount: payment.amount, note: payment.note, created_at: payment.createdAt,
        },
      }, ['supplierPayments']);
    },
    deleteSupplierPayment: id => {
      set({ supplierPayments: get().supplierPayments.filter(p => p.id !== id) });
      enqueue({ t: 'delete', table: 'supplier_payments', id }, ['supplierPayments']);
    },

    /* ---- shop details (printed on invoices) ---- */
    saveShop: info => {
      set({ shopSettings: [info] });
      enqueue({
        t: 'upsert', table: 'shop_settings',
        row: { id: 'main', name: info.name, phone: info.phone, address: info.address, note: info.note, updated_at: new Date().toISOString() },
      }, ['shopSettings']);
    },
  };
});
