'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { AuthGate } from '@/components/auth-gate';
import { Product, Sale, SaleItem } from '@/lib/types';
import {
  format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth,
  subDays, subMonths, isWithinInterval,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  ShoppingCart, Package, TrendingUp, Plus, Minus, Trash2, Pencil, Search, CreditCard,
  Wallet, Receipt, AlertCircle, X, Scale, Home as HomeIcon, Users, BarChart3, Phone,
  Banknote, LogOut, type LucideIcon,
} from 'lucide-react';
import {
  BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
const LOW_STOCK = 5;

// Bangladeshi Taka, with thousand separators, no useless ".00"
const formatCurrency = (amount: number) =>
  `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Bottom-sheet on mobile, centered dialog on >= sm
const SHEET =
  'p-4 sm:p-6 max-h-[92dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:left-0 ' +
  'max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none ' +
  'max-sm:rounded-t-2xl max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]';

const PRIMARY_BTN = 'bg-purple-600 text-white hover:bg-purple-700';

type Range = 'all' | 'today' | 'week' | 'month';
const RANGES: { id: Range; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function inRange(iso: string, range: Range) {
  if (range === 'all') return true;
  const now = new Date();
  const d = new Date(iso);
  const [start, end] =
    range === 'today' ? [startOfDay(now), endOfDay(now)]
    : range === 'week' ? [startOfWeek(now), endOfWeek(now)]
    : [startOfMonth(now), endOfMonth(now)];
  return isWithinInterval(d, { start, end });
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const saleSummary = (sale: Sale) =>
  sale.items
    .map(i => `${i.productName} ${i.pricingType === 'weight' ? `${i.weight ?? i.quantity}kg` : `×${i.quantity}`}`)
    .join(', ');

// Customer dues, calculated once
function useCustomerDues() {
  const customers = useStore(s => s.customers);
  const sales = useStore(s => s.sales);
  const duePayments = useStore(s => s.duePayments);
  return useMemo(() => {
    const map: Record<string, number> = {};
    customers.forEach(c => { map[c.id] = 0; });
    sales.forEach(s => {
      if (s.paymentType === 'due' && s.customerId && s.customerId in map) map[s.customerId] += s.total;
    });
    duePayments.forEach(p => {
      if (p.customerId in map) map[p.customerId] -= p.amount;
    });
    const total = Object.values(map).reduce((sum, v) => sum + Math.max(0, v), 0);
    return { map, total };
  }, [customers, sales, duePayments]);
}

/* ------------------------------------------------------------------ */
/* Small shared UI pieces                                              */
/* ------------------------------------------------------------------ */

function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500">
      <Icon className="h-8 w-8 text-gray-300" />
      <p className="text-sm">{text}</p>
      {action}
    </div>
  );
}

function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1 sm:w-72" role="tablist">
      {RANGES.map(r => (
        <button
          key={r.id}
          role="tab"
          aria-selected={value === r.id}
          onClick={() => onChange(r.id)}
          className={`h-8 rounded-md text-xs font-medium transition-colors ${
            value === r.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function PaymentBadge({ type }: { type: 'cash' | 'due' }) {
  return (
    <Badge variant={type === 'cash' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">
      {type}
    </Badge>
  );
}

function ConfirmDialog({
  open, title, description, onConfirm, onCancel,
}: { open: boolean; title: string; description?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="max-sm:flex-row max-sm:gap-2">
          <AlertDialogCancel className="max-sm:flex-1 max-sm:mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600 max-sm:flex-1">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 pl-9"
      />
    </div>
  );
}

const TONES = {
  green: { card: 'border-green-100 bg-green-50/60', icon: 'bg-green-100 text-green-600', value: 'text-green-700' },
  orange: { card: 'border-orange-100 bg-orange-50/60', icon: 'bg-orange-100 text-orange-600', value: 'text-orange-700' },
  red: { card: 'border-red-200 bg-red-50/60', icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  gray: { card: 'border-gray-200 bg-white', icon: 'bg-gray-100 text-gray-400', value: 'text-gray-900' },
  blue: { card: 'border-blue-100 bg-blue-50/60', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700' },
} as const;

function StatCard({
  label, value, sub, icon: Icon, tone, onClick,
}: { label: string; value: string; sub: string; icon: LucideIcon; tone: keyof typeof TONES; onClick?: () => void }) {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors active:bg-gray-100 sm:p-4 ${t.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-1 truncate text-lg font-bold sm:text-2xl ${t.value}`}>{value}</div>
      <p className="truncate text-[11px] text-gray-500">{sub}</p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', icon: HomeIcon },
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function Page() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}

function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const lowStockCount = useStore(s => s.products.filter(p => p.stock <= LOW_STOCK).length);

  const go = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-40 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:h-14 sm:px-4">
          <h1 className="flex items-center gap-2 text-base font-bold text-gray-900 sm:text-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Package className="h-4 w-4" />
            </span>
            Store Manager
          </h1>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 sm:text-sm">{format(new Date(), 'EEE, MMM d')}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Sign out"
              onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-24 pt-3 sm:px-4 sm:pb-8 sm:pt-6">
        <Tabs value={activeTab} onValueChange={go}>
          {/* Desktop / tablet tabs */}
          <TabsList className="mb-6 hidden w-full grid-cols-6 sm:grid">
            {NAV.map(n => (
              <TabsTrigger key={n.id} value={n.id}>{n.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><Dashboard go={go} /></TabsContent>
          <TabsContent value="sales"><SalesModule /></TabsContent>
          <TabsContent value="products"><ProductManagement /></TabsContent>
          <TabsContent value="customers"><CustomerManagement /></TabsContent>
          <TabsContent value="expenses"><ExpenseTracking /></TabsContent>
          <TabsContent value="reports"><Reports /></TabsContent>
        </Tabs>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="grid grid-cols-6">
          {NAV.map(n => {
            const active = activeTab === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? 'text-purple-600' : 'text-gray-500'
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-purple-600" />}
                <Icon className="h-5 w-5" />
                {n.label}
                {n.id === 'products' && lowStockCount > 0 && (
                  <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-500" aria-label="Low stock" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ go }: { go: (tab: string) => void }) {
  const products = useStore(s => s.products);
  const sales = useStore(s => s.sales);
  const expenses = useStore(s => s.expenses);
  const { total: totalDue } = useCustomerDues();
  const [saleOpen, setSaleOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const todaySales = sales.filter(s => inRange(s.createdAt, 'today'));
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const monthlyRevenue = sales.filter(s => inRange(s.createdAt, 'month')).reduce((sum, s) => sum + s.total, 0);
  const monthlyExpenses = expenses.filter(e => inRange(e.createdAt, 'month')).reduce((sum, e) => sum + e.amount, 0);
  const lowStockProducts = products.filter(p => p.stock <= LOW_STOCK);
  const recentSales = [...sales].sort(byNewest).slice(0, 5);
  const profit = monthlyRevenue - monthlyExpenses;

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(todayRevenue)} sub={`${todaySales.length} transactions`}
          icon={Banknote} tone="green" onClick={() => go('sales')} />
        <StatCard label="Total Due" value={formatCurrency(totalDue)} sub="Outstanding"
          icon={CreditCard} tone="orange" onClick={() => go('customers')} />
        <StatCard label="Low Stock" value={String(lowStockProducts.length)} sub="Need restock"
          icon={AlertCircle} tone={lowStockProducts.length > 0 ? 'red' : 'gray'} onClick={() => go('products')} />
        <StatCard label="Monthly Profit" value={formatCurrency(profit)} sub={`Revenue ${formatCurrency(monthlyRevenue)}`}
          icon={TrendingUp} tone={profit >= 0 ? 'blue' : 'red'} onClick={() => go('reports')} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Button onClick={() => setSaleOpen(true)} className={`h-11 sm:h-14 sm:text-base ${PRIMARY_BTN}`}>
          <ShoppingCart /> New Sale
        </Button>
        <Button variant="outline" onClick={() => setProductOpen(true)} className="h-11 sm:h-14 sm:text-base">
          <Package /> Product
        </Button>
        <Button variant="outline" onClick={() => setExpenseOpen(true)} className="h-11 sm:h-14 sm:text-base">
          <Receipt /> Expense
        </Button>
      </div>

      {lowStockProducts.length > 0 && (
        <button
          onClick={() => go('products')}
          className="flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-red-700">Restock soon</p>
            <p className="truncate text-red-600">
              {lowStockProducts.slice(0, 4).map(p => `${p.name} (${p.stock})`).join(', ')}
              {lowStockProducts.length > 4 && ` +${lowStockProducts.length - 4} more`}
            </p>
          </div>
        </button>
      )}

      <Card className="gap-0 py-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-3 py-3 sm:px-6">
          <CardTitle className="text-sm sm:text-lg">Recent Sales</CardTitle>
          {sales.length > 5 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-purple-600" onClick={() => go('sales')}>
              View all
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <SalesList sales={recentSales} emptyAction={
            <Button size="sm" className={PRIMARY_BTN} onClick={() => setSaleOpen(true)}>Make first sale</Button>
          } />
        </CardContent>
      </Card>

      <NewSaleDialog open={saleOpen} onClose={() => setSaleOpen(false)} />
      <ProductFormDialog open={productOpen} onClose={() => setProductOpen(false)} />
      <ExpenseFormDialog open={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

// Compact list on mobile, table on desktop
function SalesList({
  sales, onDelete, emptyAction,
}: { sales: Sale[]; onDelete?: (id: string) => void; emptyAction?: React.ReactNode }) {
  if (sales.length === 0) return <EmptyState icon={Receipt} text="No sales yet" action={emptyAction} />;
  return (
    <>
      <ul className="divide-y sm:hidden">
        {sales.map(sale => (
          <li key={sale.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{saleSummary(sale)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                {format(new Date(sale.createdAt), 'MMM d, h:mm a')}
                <PaymentBadge type={sale.paymentType} />
                {sale.customerName && <span className="truncate">· {sale.customerName}</span>}
              </p>
            </div>
            <span className="text-sm font-semibold text-green-600">{formatCurrency(sale.total)}</span>
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Delete sale" onClick={() => onDelete(sale.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {onDelete && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map(sale => (
              <TableRow key={sale.id}>
                <TableCell className="text-xs">{format(new Date(sale.createdAt), 'MMM d, h:mm a')}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">{saleSummary(sale)}</TableCell>
                <TableCell><PaymentBadge type={sale.paymentType} /></TableCell>
                <TableCell className="text-xs">{sale.customerName || '-'}</TableCell>
                <TableCell className="text-right text-xs font-medium text-green-600">{formatCurrency(sale.total)}</TableCell>
                {onDelete && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label="Delete sale" onClick={() => onDelete(sale.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function SalesModule() {
  const sales = useStore(s => s.sales);
  const deleteSale = useStore(s => s.deleteSale);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('today');

  const filtered = useMemo(() => sales.filter(s => inRange(s.createdAt, range)).sort(byNewest), [sales, range]);
  const total = filtered.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <RangeTabs value={range} onChange={setRange} />
        <Button onClick={() => setOpen(true)} className={`ml-auto h-10 shrink-0 ${PRIMARY_BTN}`}>
          <Plus /> New Sale
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
        <span className="text-gray-500">{filtered.length} sales</span>
        <span className="font-semibold text-green-700">{formatCurrency(total)}</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          <SalesList sales={filtered} onDelete={setDeleteId} />
        </CardContent>
      </Card>

      <NewSaleDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!deleteId}
        title="Delete sale?"
        description="Inventory will be restored."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteSale(deleteId); toast({ title: 'Deleted', description: 'Sale deleted' }); }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function NewSaleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const addSale = useStore(s => s.addSale);

  const [items, setItems] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'due'>('cash');
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    if (!open) {
      setItems([]); setSearch(''); setSelectedId(''); setQty('1'); setWeight('');
      setPaymentType('cash'); setCustomerId('');
    }
  }, [open]);

  const selected = products.find(p => p.id === selectedId);
  const isWeight = selected?.pricingType === 'weight';
  const inCart = items.find(i => i.productId === selectedId)?.quantity ?? 0;
  const available = selected ? Math.round((selected.stock - inCart) * 1000) / 1000 : 0;
  const amount = Number(isWeight ? weight : qty);
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => p.stock > 0 && (!q || `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [products, search]);

  const addItem = () => {
    if (!selected) return;
    if (!(amount > 0) || amount > available) {
      toast({ title: 'Invalid amount', description: `Available: ${available} ${selected.unit}`, variant: 'destructive' });
      return;
    }
    if (!isWeight && !Number.isInteger(amount)) {
      toast({ title: 'Invalid quantity', description: 'Use a whole number', variant: 'destructive' });
      return;
    }
    const newQty = Math.round((inCart + amount) * 1000) / 1000;
    const line: SaleItem = {
      productId: selected.id,
      productName: selected.name,
      quantity: newQty,
      weight: isWeight ? newQty : undefined,
      price: selected.price,
      subtotal: Math.round(newQty * selected.price * 100) / 100,
      pricingType: isWeight ? 'weight' : 'fixed',
      unit: isWeight ? 'kg' : 'pcs',
    };
    setItems(prev => (prev.some(i => i.productId === line.productId)
      ? prev.map(i => (i.productId === line.productId ? line : i))
      : [...prev, line]));
    setSelectedId(''); setSearch(''); setQty('1'); setWeight('');
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    if (paymentType === 'due' && !customerId) {
      toast({ title: 'Select a customer', description: 'A customer is required for due payment', variant: 'destructive' });
      return;
    }
    const customer = customers.find(c => c.id === customerId);
    addSale({
      items, total, paymentType,
      customerId: paymentType === 'due' ? customerId : undefined,
      customerName: paymentType === 'due' ? customer?.name : undefined,
    });
    toast({ title: 'Sale completed', description: formatCurrency(total) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-xl`}>
        <DialogHeader><DialogTitle>New Sale</DialogTitle></DialogHeader>

        <div className="space-y-3">
          {/* Product picker */}
          {!selected ? (
            <div className="space-y-2">
              <SearchBar value={search} onChange={setSearch} placeholder="Search product…" />
              <div className="max-h-44 divide-y overflow-y-auto rounded-lg border">
                {matches.length === 0 ? (
                  <p className="p-4 text-center text-sm text-gray-500">No product in stock</p>
                ) : matches.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setQty('1'); setWeight(''); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-gray-100"
                  >
                    {p.pricingType === 'weight' && <Scale className="h-3.5 w-3.5 shrink-0 text-purple-500" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-gray-500">{p.stock} {p.unit}</span>
                    <span className="text-sm font-semibold">{formatCurrency(p.price)}{p.pricingType === 'weight' && '/kg'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="text-xs text-gray-600">
                    {formatCurrency(selected.price)}/{isWeight ? 'kg' : 'pcs'} · Available {available} {selected.unit}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Change product" onClick={() => setSelectedId('')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isWeight ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      inputMode="decimal" placeholder="Weight (kg)" aria-label="Weight in kg"
                      value={weight} onChange={e => setWeight(e.target.value)} className="h-11 flex-1"
                    />
                    <Button onClick={addItem} disabled={!(amount > 0)} className={`h-11 px-5 ${PRIMARY_BTN}`}>Add</Button>
                  </div>
                  <div className="flex gap-1.5">
                    {['0.25', '0.5', '1', '2'].map(w => (
                      <button key={w} onClick={() => setWeight(w)}
                        className="h-8 flex-1 rounded-md border bg-white text-xs font-medium active:bg-gray-100">
                        {w} kg
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border bg-white">
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Decrease"
                      onClick={() => setQty(String(Math.max(1, (parseInt(qty) || 1) - 1)))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      inputMode="numeric" aria-label="Quantity" value={qty}
                      onChange={e => setQty(e.target.value.replace(/\D/g, ''))}
                      className="h-11 w-14 border-0 text-center shadow-none focus-visible:ring-0"
                    />
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Increase"
                      onClick={() => setQty(String((parseInt(qty) || 0) + 1))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={addItem} disabled={!(amount > 0)} className={`h-11 flex-1 ${PRIMARY_BTN}`}>
                    Add · {formatCurrency((amount > 0 ? amount : 0) * selected.price)}
                  </Button>
                </div>
              )}
              {isWeight && amount > 0 && (
                <p className="text-right text-xs text-gray-600">= {formatCurrency(amount * selected.price)}</p>
              )}
            </div>
          )}

          {/* Cart */}
          {items.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {items.map(item => (
                <li key={item.productId} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-gray-500">
                      {item.pricingType === 'weight' ? `${item.weight} kg` : `${item.quantity} pcs`} × {formatCurrency(item.price)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(item.subtotal)}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Remove ${item.productName}`}
                    onClick={() => setItems(items.filter(i => i.productId !== item.productId))}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Payment */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant={paymentType === 'cash' ? 'default' : 'outline'} className="h-11" onClick={() => setPaymentType('cash')}>
              <Wallet /> Cash
            </Button>
            <Button variant={paymentType === 'due' ? 'default' : 'outline'} className="h-11" onClick={() => setPaymentType('due')}>
              <CreditCard /> Due
            </Button>
          </div>

          {paymentType === 'due' && (
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-11 w-full" aria-label="Customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.length === 0 && <div className="p-3 text-sm text-gray-500">Add a customer first</div>}
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone && ` · ${c.phone}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Sticky total + action */}
        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background px-4 pt-3 sm:mx-0 sm:px-0">
          <div className="leading-tight">
            <p className="text-[11px] text-gray-500">Total</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(total)}</p>
          </div>
          <Button onClick={handleSubmit} disabled={items.length === 0} className="h-11 flex-1 bg-green-600 text-white hover:bg-green-700">
            Complete Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function ProductFormDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product | null }) {
  const products = useStore(s => s.products);
  const addProduct = useStore(s => s.addProduct);
  const updateProduct = useStore(s => s.updateProduct);
  const empty = { name: '', price: '', stock: '', category: '', pricingType: 'fixed' as 'fixed' | 'weight' };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setForm(product
      ? {
        name: product.name, price: String(product.price), stock: String(product.stock),
        category: product.category || '', pricingType: product.pricingType || 'fixed',
      }
      : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean))),
    [products],
  );

  const submit = () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim() || form.price === '' || form.stock === '' || !(price >= 0) || !(stock >= 0)) {
      toast({ title: 'Check the form', description: 'Name, price and stock are required', variant: 'destructive' });
      return;
    }
    const data = {
      name: form.name.trim(), price, stock,
      category: form.category.trim() || 'General',
      pricingType: form.pricingType,
      unit: form.pricingType === 'weight' ? 'kg' : 'pcs',
    };
    if (product) {
      updateProduct(product.id, data);
      toast({ title: 'Product updated' });
    } else {
      addProduct(data);
      toast({ title: 'Product added' });
    }
    onClose();
  };

  const isWeight = form.pricingType === 'weight';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name *</Label>
            <Input id="p-name" className="h-11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
            {(['fixed', 'weight'] as const).map(t => (
              <button key={t} onClick={() => setForm({ ...form, pricingType: t })}
                className={`h-9 rounded-md text-sm font-medium ${form.pricingType === t ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'}`}>
                {t === 'fixed' ? 'Per piece' : 'Per kg'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price {isWeight ? '(per kg)' : ''} *</Label>
              <Input id="p-price" inputMode="decimal" className="h-11" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock {isWeight ? '(kg)' : '(pcs)'} *</Label>
              <Input id="p-stock" inputMode="decimal" className="h-11" value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-cat">Category</Label>
            <Input id="p-cat" list="category-list" className="h-11" placeholder="e.g. Food, Drinks, Grocery"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <datalist id="category-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose}>Cancel</Button>
          <Button className={`h-11 flex-1 ${PRIMARY_BTN}`} onClick={submit}>{product ? 'Update' : 'Add'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductManagement() {
  const products = useStore(s => s.products);
  const deleteProduct = useStore(s => s.deleteProduct);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => !q || p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  }, [products, search]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products…" />
        <Button onClick={openAdd} className={`h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> <span className="max-sm:hidden">Add Product</span><span className="sm:hidden">Add</span></Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Package} text={products.length ? 'No products match your search' : 'No products yet'}
              action={!products.length && <Button size="sm" className={PRIMARY_BTN} onClick={openAdd}>Add first product</Button>} />
          ) : (
            <>
              {/* Mobile list */}
              <ul className="divide-y sm:hidden">
                {filtered.map(p => (
                  <li key={p.id} className="flex items-center">
                    <button onClick={() => openEdit(p)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left active:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {p.pricingType === 'weight' && <Scale className="h-3.5 w-3.5 shrink-0 text-purple-500" />}
                          <span className="truncate">{p.name}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">{p.category || 'General'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(p.price)}{p.pricingType === 'weight' && <span className="text-[10px] font-normal text-gray-400">/kg</span>}</p>
                        <p className={`text-[11px] ${p.stock <= LOW_STOCK ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                          {p.stock} {p.unit}
                        </p>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="mr-1 h-10 w-10 shrink-0" aria-label={`Delete ${p.name}`} onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Name</TableHead><TableHead>Type</TableHead>
                      <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Stock</TableHead>
                      <TableHead>Category</TableHead><TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {p.pricingType === 'weight' && <Scale className="h-4 w-4 text-purple-500" />}{p.name}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={p.pricingType === 'weight' ? 'default' : 'secondary'}>{p.pricingType === 'weight' ? 'Per KG' : 'Fixed'}</Badge></TableCell>
                        <TableCell className="text-right">{formatCurrency(p.price)}{p.pricingType === 'weight' && <span className="text-xs text-gray-400">/kg</span>}</TableCell>
                        <TableCell className={`text-right ${p.stock <= LOW_STOCK ? 'font-semibold text-red-600' : ''}`}>{p.stock} {p.unit}</TableCell>
                        <TableCell><Badge variant="outline">{p.category || '-'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
      <ConfirmDialog
        open={!!deleteId} title="Delete product?" description="This action cannot be undone."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteProduct(deleteId); toast({ title: 'Product deleted' }); }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

function CustomerManagement() {
  const customers = useStore(s => s.customers);
  const sales = useStore(s => s.sales);
  const addCustomer = useStore(s => s.addCustomer);
  const deleteCustomer = useStore(s => s.deleteCustomer);
  const addDuePayment = useStore(s => s.addDuePayment);
  const { map: dues } = useCustomerDues();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [payAmount, setPayAmount] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  const detailsCustomer = customers.find(c => c.id === detailsId);
  const payCustomer = customers.find(c => c.id === payId);
  const payDue = payId ? dues[payId] ?? 0 : 0;

  const submitCustomer = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
    toast({ title: 'Customer added' });
    setAddOpen(false);
    setForm({ name: '', phone: '', address: '' });
  };

  const submitPayment = () => {
    const amount = Number(payAmount);
    if (!payCustomer || !(amount > 0)) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (amount > payDue) {
      toast({ title: 'Too much', description: `Current due is ${formatCurrency(payDue)}`, variant: 'destructive' });
      return;
    }
    addDuePayment({ customerId: payCustomer.id, customerName: payCustomer.name, amount });
    toast({ title: 'Payment recorded', description: formatCurrency(amount) });
    setPayId(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="Search customers…" />
        <Button onClick={() => setAddOpen(true)} className={`h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> <span className="max-sm:hidden">Add Customer</span><span className="sm:hidden">Add</span></Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Users} text="No customers found" /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filtered.map(c => {
            const due = Math.max(0, dues[c.id] ?? 0);
            return (
              <div key={c.id} className={`rounded-xl border bg-white p-3 shadow-sm ${due > 0 ? 'border-orange-200 bg-orange-50/50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="h-3 w-3" />{c.phone}
                      </a>
                    )}
                    {c.address && <p className="truncate text-xs text-gray-400">{c.address}</p>}
                  </div>
                  <Badge variant={due > 0 ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                    {due > 0 ? `${formatCurrency(due)} due` : 'No due'}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => setDetailsId(c.id)}>Details</Button>
                  {due > 0 && (
                    <Button className="h-9 bg-green-600 text-xs text-white hover:bg-green-700"
                      onClick={() => { setPayId(c.id); setPayAmount(''); }}>Pay</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${c.name}`} onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false); }}>
        <DialogContent className={`${SHEET} sm:max-w-md`}>
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="c-name">Name *</Label>
              <Input id="c-name" className="h-11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" type="tel" inputMode="tel" className="h-11" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-addr">Address</Label>
              <Input id="c-addr" className="h-11" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className={`h-11 flex-1 ${PRIMARY_BTN}`} onClick={submitCustomer}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!detailsId} onOpenChange={o => { if (!o) setDetailsId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-lg`}>
          <DialogHeader><DialogTitle>{detailsCustomer?.name}</DialogTitle></DialogHeader>
          {detailsCustomer && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-xs">
                <div><p className="text-gray-500">Phone</p><p className="truncate font-medium">{detailsCustomer.phone || '-'}</p></div>
                <div><p className="text-gray-500">Address</p><p className="truncate font-medium">{detailsCustomer.address || '-'}</p></div>
                <div><p className="text-gray-500">Due</p><p className="font-semibold text-red-600">{formatCurrency(Math.max(0, dues[detailsCustomer.id] ?? 0))}</p></div>
              </div>
              <p className="text-xs font-medium text-gray-500">Purchase history</p>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {sales.filter(s => s.customerId === detailsCustomer.id).sort(byNewest).map(s => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{saleSummary(s)}</p>
                      <p className="text-[11px] text-gray-500">{format(new Date(s.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                    <PaymentBadge type={s.paymentType} />
                    <span className="text-xs font-semibold">{formatCurrency(s.total)}</span>
                  </li>
                ))}
                {sales.every(s => s.customerId !== detailsCustomer.id) && (
                  <li className="p-4 text-center text-xs text-gray-500">No purchases yet</li>
                )}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={!!payId} onOpenChange={o => { if (!o) setPayId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-sm`}>
          <DialogHeader><DialogTitle>Receive Payment{payCustomer && ` · ${payCustomer.name}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">Current due: <span className="font-bold text-red-600">{formatCurrency(payDue)}</span></p>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amt">Amount (৳)</Label>
              <div className="flex gap-2">
                <Input id="pay-amt" inputMode="decimal" className="h-11" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <Button variant="outline" className="h-11 shrink-0" onClick={() => setPayAmount(String(payDue))}>Full</Button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setPayId(null)}>Cancel</Button>
            <Button className="h-11 flex-1 bg-green-600 text-white hover:bg-green-700" onClick={submitPayment}>Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId} title="Delete customer?" description="Sales history will be preserved."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteCustomer(deleteId); toast({ title: 'Customer deleted' }); }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Transport', 'Stock', 'Other'];

function ExpenseFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addExpense = useStore(s => s.addExpense);
  const [form, setForm] = useState({ description: '', amount: '', category: '' });

  useEffect(() => { if (!open) setForm({ description: '', amount: '', category: '' }); }, [open]);

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.description.trim() || !(amount > 0)) {
      toast({ title: 'Check the form', description: 'Description and a valid amount are required', variant: 'destructive' });
      return;
    }
    addExpense({ description: form.description.trim(), amount, category: form.category.trim() || 'General' });
    toast({ title: 'Expense added', description: formatCurrency(amount) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="e-desc">Description *</Label>
            <Input id="e-desc" className="h-11" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="e-amt">Amount (৳) *</Label>
            <Input id="e-amt" inputMode="decimal" className="h-11" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="e-cat">Category</Label>
            <Input id="e-cat" className="h-11" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c} onClick={() => setForm({ ...form, category: c })}
                  className={`h-8 rounded-full border px-3 text-xs ${form.category === c ? 'border-purple-600 bg-purple-50 text-purple-700' : 'bg-white text-gray-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="h-11 flex-1" onClick={onClose}>Cancel</Button>
          <Button className={`h-11 flex-1 ${PRIMARY_BTN}`} onClick={submit}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseTracking() {
  const expenses = useStore(s => s.expenses);
  const deleteExpense = useStore(s => s.deleteExpense);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('month');

  const filtered = useMemo(() => expenses.filter(e => inRange(e.createdAt, range)).sort(byNewest), [expenses, range]);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2">
        <RangeTabs value={range} onChange={setRange} />
        <Button onClick={() => setOpen(true)} className={`ml-auto h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> Add</Button>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
        <span className="text-gray-500">{filtered.length} expenses</span>
        <span className="font-semibold text-red-600">-{formatCurrency(total)}</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Wallet} text="No expenses found" />
          ) : (
            <>
              <ul className="divide-y sm:hidden">
                {filtered.map(e => (
                  <li key={e.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.description}</p>
                      <p className="text-[11px] text-gray-500">{format(new Date(e.createdAt), 'MMM d')} · {e.category || 'General'}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600">-{formatCurrency(e.amount)}</span>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label={`Delete ${e.description}`} onClick={() => setDeleteId(e.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{format(new Date(e.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs">{e.description}</TableCell>
                        <TableCell><Badge variant="outline">{e.category || 'General'}</Badge></TableCell>
                        <TableCell className="text-right text-xs font-medium text-red-600">-{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`Delete ${e.description}`} onClick={() => setDeleteId(e.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!deleteId} title="Delete expense?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteExpense(deleteId); toast({ title: 'Expense deleted' }); }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

function Reports() {
  const sales = useStore(s => s.sales);
  const expenses = useStore(s => s.expenses);
  const { total: totalDue } = useCustomerDues();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const sumIn = <T extends { createdAt: string }>(list: T[], pick: (x: T) => number, start: Date, end: Date) =>
    list.filter(x => isWithinInterval(new Date(x.createdAt), { start, end })).reduce((s, x) => s + pick(x), 0);

  const chartData = useMemo(() => {
    const today = new Date();
    const out: { date: string; sales: number; expenses: number }[] = [];
    const push = (label: string, start: Date, end: Date) =>
      out.push({ date: label, sales: sumIn(sales, s => s.total, start, end), expenses: sumIn(expenses, e => e.amount, start, end) });

    if (period === 'daily') {
      for (let i = 23; i >= 0; i--) {
        const h = new Date(today); h.setHours(today.getHours() - i, 0, 0, 0);
        const hEnd = new Date(h); hEnd.setHours(h.getHours() + 1);
        push(format(h, 'ha'), h, hEnd);
      }
    } else if (period === 'weekly' || period === 'monthly') {
      const n = period === 'weekly' ? 7 : 30;
      for (let i = n - 1; i >= 0; i--) {
        const d = subDays(today, i);
        push(format(d, period === 'weekly' ? 'EEE' : 'MMM d'), startOfDay(d), endOfDay(d));
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(today, i);
        push(format(m, 'MMM'), startOfMonth(m), endOfMonth(m));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, expenses, period]);

  const paymentData = useMemo(() => [
    { name: 'Cash', value: sales.filter(s => s.paymentType === 'cash').reduce((a, s) => a + s.total, 0), color: COLORS[0] },
    { name: 'Due', value: sales.filter(s => s.paymentType === 'due').reduce((a, s) => a + s.total, 0), color: COLORS[1] },
  ], [sales]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    sales.forEach(sale => sale.items.forEach(i => {
      map[i.productId] ??= { name: i.productName, revenue: 0 };
      map[i.productId].revenue += i.subtotal;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { const c = e.category || 'General'; map[c] = (map[c] || 0) + e.amount; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [expenses]);

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const net = totalRevenue - totalExpenses;
  const fmtTip = (v: unknown) => formatCurrency(Number(v));

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1 sm:w-96">
        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`h-8 rounded-md text-xs font-medium capitalize ${period === p ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600'}`}>
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} sub="All time" icon={Banknote} tone="green" />
        <StatCard label="Expenses" value={formatCurrency(totalExpenses)} sub="All time" icon={Receipt} tone="red" />
        <StatCard label="Net Profit" value={formatCurrency(net)} sub="Revenue − expenses" icon={TrendingUp} tone={net >= 0 ? 'blue' : 'red'} />
        <StatCard label="Dues" value={formatCurrency(totalDue)} sub="Outstanding" icon={CreditCard} tone="orange" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-2">
        <Card className="gap-2 py-3 shadow-sm lg:col-span-2 sm:py-6">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">Sales vs Expenses</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div className="h-52 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.6} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} width={42} />
                  <Tooltip formatter={fmtTip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="sales" stroke="#7c3aed" fill="url(#gSales)" name="Sales" />
                  <Area type="monotone" dataKey="expenses" stroke="#f59e0b" fill="url(#gExp)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-3 shadow-sm sm:py-6">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">Cash vs Due</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div className="h-48 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%">
                    {paymentData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={fmtTip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-3 shadow-sm sm:py-6">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">Expenses by Category</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            {expenseByCategory.length === 0 ? <EmptyState icon={Wallet} text="No expenses" /> : (
              <div className="h-48 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBar data={expenseByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={42} />
                    <Tooltip formatter={fmtTip} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {expenseByCategory.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </RechartsBar>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-3 shadow-sm sm:py-6 lg:col-span-2">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">Top Selling Products</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            {topProducts.length === 0 ? <EmptyState icon={Package} text="No sales yet" /> : (
              <div className="h-48 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBar data={topProducts} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={fmtTip} />
                    <Bar dataKey="revenue" fill="#7c3aed" name="Revenue" radius={[0, 4, 4, 0]} />
                  </RechartsBar>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
