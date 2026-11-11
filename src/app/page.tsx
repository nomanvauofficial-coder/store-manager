'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { AuthGate } from '@/components/auth-gate';
import { Product, Sale, SaleItem } from '@/lib/types';
import {
  format as dfFormat, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth,
  subDays, subMonths, isWithinInterval,
} from 'date-fns';
import { bn } from 'date-fns/locale/bn';
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
  Banknote, LogOut, Truck, type LucideIcon,
} from 'lucide-react';
import {
  BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

import {
  PERIOD_BN,
  COLORS,
  LOW_STOCK,
  fmt,
  DEFAULT_CATEGORY,
  catOf,
  unitBn,
  formatCurrency,
  SHEET,
  PRIMARY_BTN,
  Range,
  RANGES,
  inRange,
  byNewest,
  getCategories,
  normalizeCategory,
  saleSummary,
  useCustomerDues,
  useVisualViewport,
  FormActions,
  EmptyState,
  RangeTabs,
  PaymentBadge,
  ConfirmDialog,
  SearchBar,
  CategoryChips,
  TONES,
  StatCard,
  itemProfit, profitOf, useSupplierDues, todayStr, dateStrToIso, DateField, buildLedger, Ledger,
} from '@/components/shared';
import { SupplierModule } from '@/components/suppliers';
import { InstallBanner } from '@/components/pwa';

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'হোম', icon: HomeIcon },
  { id: 'sales', label: 'বিক্রি', icon: ShoppingCart },
  { id: 'products', label: 'পণ্য', icon: Package },
  { id: 'customers', label: 'কাস্টমার', icon: Users },
  { id: 'suppliers', label: 'সরবরাহ', icon: Truck },
  { id: 'expenses', label: 'খরচ', icon: Wallet },
  { id: 'reports', label: 'রিপোর্ট', icon: BarChart3 },
];

export default function Page() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}

function Home() {
  useVisualViewport();
  const [activeTab, setActiveTab] = useState('dashboard');
  const lowStockCount = useStore(s => s.products.filter(p => p.stock <= LOW_STOCK).length);

  const go = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-40 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-3 sm:h-14 sm:px-4">
          <h1 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Package className="h-4 w-4" />
            </span>
            স্টোর ম্যানেজার
          </h1>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 sm:text-sm">{fmt(new Date(), 'EEE, MMM d')}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="সাইন আউট"
              onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pb-24 pt-3 sm:px-4 sm:pb-8 sm:pt-6">
        <Tabs value={activeTab} onValueChange={go}>
          {/* Desktop / tablet tabs */}
          <TabsList className="mb-6 hidden w-full grid-cols-7 sm:grid">
            {NAV.map(n => (
              <TabsTrigger key={n.id} value={n.id}>{n.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><Dashboard go={go} /></TabsContent>
          <TabsContent value="sales"><SalesModule /></TabsContent>
          <TabsContent value="products"><ProductManagement /></TabsContent>
          <TabsContent value="customers"><CustomerManagement /></TabsContent>
          <TabsContent value="suppliers"><SupplierModule /></TabsContent>
          <TabsContent value="expenses"><ExpenseTracking /></TabsContent>
          <TabsContent value="reports"><Reports /></TabsContent>
        </Tabs>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="মেনু"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="grid grid-cols-7">
          {NAV.map(n => {
            const active = activeTab === n.id;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? 'text-blue-700' : 'text-slate-500'
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-700" />}
                <Icon className="h-5 w-5" />
                {n.label}
                {n.id === 'products' && lowStockCount > 0 && (
                  <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-500" aria-label="কম স্টক" />
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
  const monthProfit = profitOf(sales.filter(s => inRange(s.createdAt, 'month')));
  const profit = monthProfit.profit - monthlyExpenses;

  return (
    <div className="space-y-3 sm:space-y-6">
      <InstallBanner />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="আজকের বিক্রি" value={formatCurrency(todayRevenue)} sub={`${todaySales.length}টি লেনদেন`}
          icon={Banknote} tone="green" onClick={() => go('sales')} />
        <StatCard label="মোট বাকি" value={formatCurrency(totalDue)} sub="অনাদায়ী"
          icon={CreditCard} tone="orange" onClick={() => go('customers')} />
        <StatCard label="কম স্টক" value={String(lowStockProducts.length)} sub="মাল তুলতে হবে"
          icon={AlertCircle} tone={lowStockProducts.length > 0 ? 'red' : 'gray'} onClick={() => go('products')} />
        <StatCard label="এই মাসের লাভ" value={monthProfit.known === 0 && monthProfit.unknown > 0 ? '—' : formatCurrency(profit)}
          sub={monthProfit.unknown > 0 ? `${monthProfit.unknown}টি আইটেমে কেনা দাম নেই` : `বিক্রি ${formatCurrency(monthlyRevenue)}`}
          icon={TrendingUp} tone={profit >= 0 || monthProfit.known === 0 ? 'blue' : 'red'} onClick={() => go('reports')} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Button onClick={() => setSaleOpen(true)} className={`h-11 sm:h-14 sm:text-base ${PRIMARY_BTN}`}>
          <ShoppingCart /> নতুন বিক্রি
        </Button>
        <Button variant="outline" onClick={() => setProductOpen(true)} className="h-11 sm:h-14 sm:text-base">
          <Package /> পণ্য
        </Button>
        <Button variant="outline" onClick={() => setExpenseOpen(true)} className="h-11 sm:h-14 sm:text-base">
          <Receipt /> খরচ
        </Button>
      </div>

      {lowStockProducts.length > 0 && (
        <button
          onClick={() => go('products')}
          className="flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="min-w-0 text-xs">
            <p className="font-semibold text-red-700">শীঘ্রই মাল তুলুন</p>
            <p className="truncate text-red-600">
              {lowStockProducts.slice(0, 4).map(p => `${p.name} (${p.stock})`).join(', ')}
              {lowStockProducts.length > 4 && ` +${lowStockProducts.length - 4} আরও`}
            </p>
          </div>
        </button>
      )}

      <Card className="gap-0 py-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-3 py-3 sm:px-6">
          <CardTitle className="text-sm sm:text-lg">সাম্প্রতিক বিক্রি</CardTitle>
          {sales.length > 5 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-700" onClick={() => go('sales')}>
              সব দেখুন
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <SalesList sales={recentSales} emptyAction={
            <Button size="sm" className={PRIMARY_BTN} onClick={() => setSaleOpen(true)}>প্রথম বিক্রি করুন</Button>
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
  if (sales.length === 0) return <EmptyState icon={Receipt} text="এখনো কোনো বিক্রি নেই" action={emptyAction} />;
  return (
    <>
      <ul className="divide-y sm:hidden">
        {sales.map(sale => (
          <li key={sale.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{saleSummary(sale)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                {fmt(new Date(sale.createdAt), 'MMM d, h:mm a')}
                <PaymentBadge type={sale.paymentType} />
                {sale.customerName && <span className="truncate">· {sale.customerName}</span>}
              </p>
            </div>
            <span className="text-sm font-semibold text-emerald-600">{formatCurrency(sale.total)}</span>
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="বিক্রি মুছুন" onClick={() => onDelete(sale.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>তারিখ</TableHead>
              <TableHead>পণ্য</TableHead>
              <TableHead>পেমেন্ট</TableHead>
              <TableHead>কাস্টমার</TableHead>
              <TableHead className="text-right">মোট</TableHead>
              {onDelete && <TableHead className="text-right">কাজ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map(sale => (
              <TableRow key={sale.id}>
                <TableCell className="text-xs">{fmt(new Date(sale.createdAt), 'MMM d, h:mm a')}</TableCell>
                <TableCell className="max-w-xs truncate text-xs">{saleSummary(sale)}</TableCell>
                <TableCell><PaymentBadge type={sale.paymentType} /></TableCell>
                <TableCell className="text-xs">{sale.customerName || '-'}</TableCell>
                <TableCell className="text-right text-xs font-medium text-emerald-600">{formatCurrency(sale.total)}</TableCell>
                {onDelete && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label="বিক্রি মুছুন" onClick={() => onDelete(sale.id)}>
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
          <Plus /> নতুন বিক্রি
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
        <span className="text-slate-500">{filtered.length}টি বিক্রি</span>
        <span className="font-semibold text-emerald-700">{formatCurrency(total)}</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          <SalesList sales={filtered} onDelete={setDeleteId} />
        </CardContent>
      </Card>

      <NewSaleDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!deleteId}
        title="বিক্রি মুছবেন?"
        description="স্টক আগের অবস্থায় ফিরে যাবে।"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteSale(deleteId); toast({ title: 'মুছে ফেলা হয়েছে', description: 'বিক্রি মুছে ফেলা হয়েছে' }); }
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
  const [saleCat, setSaleCat] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');
  const [weight, setWeight] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'due'>('cash');
  const [customerId, setCustomerId] = useState('');

  useEffect(() => {
    if (!open) {
      setItems([]); setSearch(''); setSaleCat(''); setSelectedId(''); setQty('1'); setWeight('');
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
      .filter(p => p.stock > 0
        && (!saleCat || catOf(p.category) === saleCat)
        && (!q || `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [products, search, saleCat]);

  const saleCategories = useMemo(() => getCategories(products.filter(p => p.stock > 0)), [products]);

  const addItem = () => {
    if (!selected) return;
    if (!(amount > 0) || amount > available) {
      toast({ title: 'ভুল পরিমাণ', description: `আছে: ${available} ${unitBn(selected.unit)}`, variant: 'destructive' });
      return;
    }
    if (!isWeight && !Number.isInteger(amount)) {
      toast({ title: 'ভুল সংখ্যা', description: 'পূর্ণ সংখ্যা দিন', variant: 'destructive' });
      return;
    }
    const newQty = Math.round((inCart + amount) * 1000) / 1000;
    const line: SaleItem = {
      productId: selected.id,
      productName: selected.name,
      quantity: newQty,
      weight: isWeight ? newQty : undefined,
      price: selected.price,
      costPrice: selected.costPrice ?? 0,
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
      toast({ title: 'কাস্টমার বাছুন', description: 'বাকিতে বিক্রির জন্য কাস্টমার দিতে হবে', variant: 'destructive' });
      return;
    }
    const customer = customers.find(c => c.id === customerId);
    addSale({
      items, total, paymentType,
      customerId: paymentType === 'due' ? customerId : undefined,
      customerName: paymentType === 'due' ? customer?.name : undefined,
    });
    toast({ title: 'বিক্রি সম্পন্ন', description: formatCurrency(total) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-xl`}>
        <DialogHeader><DialogTitle>নতুন বিক্রি</DialogTitle></DialogHeader>

        <div className="space-y-3">
          {/* Product picker */}
          {!selected ? (
            <div className="space-y-2">
              <SearchBar value={search} onChange={setSearch} placeholder="পণ্য খুঁজুন…" />
              {saleCategories.length > 1 && (
                <CategoryChips categories={saleCategories} value={saleCat} onChange={setSaleCat} />
              )}
              <div className="max-h-44 divide-y overflow-y-auto rounded-lg border">
                {matches.length === 0 ? (
                  <p className="p-4 text-center text-sm text-slate-500">স্টকে কোনো পণ্য নেই</p>
                ) : matches.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedId(p.id); setQty('1'); setWeight(''); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-slate-100"
                  >
                    {p.pricingType === 'weight' && <Scale className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.stock} {unitBn(p.unit)}</span>
                    <span className="text-sm font-semibold">{formatCurrency(p.price)}{p.pricingType === 'weight' && '/কেজি'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="text-xs text-slate-600">
                    {formatCurrency(selected.price)}/{isWeight ? 'কেজি' : 'পিস'} · আছে {available} {unitBn(selected.unit)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="পণ্য বদলান" onClick={() => setSelectedId('')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isWeight ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      inputMode="decimal" placeholder="ওজন (কেজি)" aria-label="ওজন কেজিতে"
                      value={weight} onChange={e => setWeight(e.target.value)} className="h-11 flex-1"
                    />
                    <Button onClick={addItem} disabled={!(amount > 0)} className={`h-11 px-5 ${PRIMARY_BTN}`}>যোগ</Button>
                  </div>
                  <div className="flex gap-1.5">
                    {['0.25', '0.5', '1', '2'].map(w => (
                      <button key={w} onClick={() => setWeight(w)}
                        className="h-8 flex-1 rounded-md border bg-white text-xs font-medium active:bg-slate-100">
                        {w} কেজি
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border bg-white">
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="কমান"
                      onClick={() => setQty(String(Math.max(1, (parseInt(qty) || 1) - 1)))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      inputMode="numeric" aria-label="পরিমাণ" value={qty}
                      onChange={e => setQty(e.target.value.replace(/\D/g, ''))}
                      className="h-11 w-14 border-0 text-center shadow-none focus-visible:ring-0"
                    />
                    <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="বাড়ান"
                      onClick={() => setQty(String((parseInt(qty) || 0) + 1))}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={addItem} disabled={!(amount > 0)} className={`h-11 flex-1 ${PRIMARY_BTN}`}>
                    যোগ · {formatCurrency((amount > 0 ? amount : 0) * selected.price)}
                  </Button>
                </div>
              )}
              {isWeight && amount > 0 && (
                <p className="text-right text-xs text-slate-600">= {formatCurrency(amount * selected.price)}</p>
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
                    <p className="text-xs text-slate-500">
                      {item.pricingType === 'weight' ? `${item.weight} কেজি` : `${item.quantity} পিস`} × {formatCurrency(item.price)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(item.subtotal)}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`সরান ${item.productName}`}
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
              <Wallet /> নগদ
            </Button>
            <Button variant={paymentType === 'due' ? 'default' : 'outline'} className="h-11" onClick={() => setPaymentType('due')}>
              <CreditCard /> বাকি
            </Button>
          </div>

          {paymentType === 'due' && (
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-11 w-full" aria-label="কাস্টমার"><SelectValue placeholder="কাস্টমার বাছুন" /></SelectTrigger>
              <SelectContent>
                {customers.length === 0 && <div className="p-3 text-sm text-slate-500">আগে একটি কাস্টমার যোগ করুন</div>}
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone && ` · ${c.phone}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Sticky total + action */}
        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-white px-4 pt-3 sm:mx-0 sm:px-0">
          <div className="leading-tight">
            <p className="text-[11px] text-slate-500">মোট</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(total)}</p>
          </div>
          <Button onClick={handleSubmit} disabled={items.length === 0} className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
            বিক্রি সম্পন্ন করুন
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function ProductFormDialog({
  open, onClose, product, defaultCategory,
}: { open: boolean; onClose: () => void; product?: Product | null; defaultCategory?: string }) {
  const products = useStore(s => s.products);
  const addProduct = useStore(s => s.addProduct);
  const updateProduct = useStore(s => s.updateProduct);
  const empty = { name: '', price: '', costPrice: '', stock: '', category: '', pricingType: 'fixed' as 'fixed' | 'weight' };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setForm(product
      ? {
        name: product.name, price: String(product.price), costPrice: product.costPrice ? String(product.costPrice) : '', stock: String(product.stock),
        category: product.category || '', pricingType: product.pricingType || 'fixed',
      }
      : { ...empty, category: defaultCategory || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, defaultCategory]);

  const categories = useMemo(() => getCategories(products), [products]);

  const submit = () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    const costPrice = Number(form.costPrice || 0);
    if (!form.name.trim() || form.price === '' || form.stock === '' || !(price >= 0) || !(stock >= 0) || !(costPrice >= 0)) {
      toast({ title: 'ফর্মটি দেখুন', description: 'নাম, দাম ও স্টক দিতে হবে', variant: 'destructive' });
      return;
    }
    const data = {
      name: form.name.trim(), price, costPrice, stock,
      category: normalizeCategory(form.category, categories),
      pricingType: form.pricingType,
      unit: form.pricingType === 'weight' ? 'kg' : 'pcs',
    };
    if (product) {
      updateProduct(product.id, data);
      toast({ title: 'পণ্য আপডেট হয়েছে' });
    } else {
      addProduct(data);
      toast({ title: 'পণ্য যোগ হয়েছে' });
    }
    onClose();
  };

  const isWeight = form.pricingType === 'weight';
  const margin = Number(form.price) > 0 && Number(form.costPrice) > 0 ? Number(form.price) - Number(form.costPrice) : null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>{product ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য'}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">নাম *</Label>
            <Input id="p-name" className="h-11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(['fixed', 'weight'] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm({ ...form, pricingType: t })}
                className={`h-9 rounded-md text-sm font-medium ${form.pricingType === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
                {t === 'fixed' ? 'পিস হিসেবে' : 'কেজি হিসেবে'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-cost">কেনা দাম {isWeight ? '(প্রতি কেজি)' : ''}</Label>
              <Input id="p-cost" inputMode="decimal" className="h-11" value={form.costPrice}
                onChange={e => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">বিক্রির দাম {isWeight ? '(প্রতি কেজি)' : ''} *</Label>
              <Input id="p-price" inputMode="decimal" className="h-11" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          {margin !== null && (
            <p className={`-mt-1 text-xs font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {margin >= 0 ? 'লাভ' : 'লোকসান'} {formatCurrency(Math.abs(margin))} প্রতি {isWeight ? 'কেজি' : 'পিস'}
              {' '}({Math.round((Math.abs(margin) / Number(form.price)) * 100)}%)
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="p-stock">স্টক {isWeight ? '(কেজি)' : '(পিস)'} *</Label>
            <Input id="p-stock" inputMode="decimal" className="h-11" value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-cat">ক্যাটাগরি</Label>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => {
                  const active = form.category.trim().toLowerCase() === c.toLowerCase();
                  return (
                    <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                      className={`h-8 rounded-full border px-3 text-xs font-medium ${
                        active ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-slate-700 active:bg-slate-100'
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
            <Input id="p-cat" className="h-11" placeholder={categories.length ? 'অথবা নতুন ক্যাটাগরি লিখুন' : 'যেমন: পানীয়, স্ন্যাকস, মুদি'}
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <FormActions onCancel={onClose} label={product ? 'আপডেট' : 'যোগ করুন'} />
        </form>
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

  const [cat, setCat] = useState('');

  const categories = useMemo(() => getCategories(products), [products]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach(p => { const c = catOf(p.category); m[c] = (m[c] || 0) + 1; });
    return m;
  }, [products]);
  const activeCat = categories.includes(cat) ? cat : ''; // falls back to "All" if the category became empty

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => (!activeCat || catOf(p.category) === activeCat)
        && (!q || p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)))
      .sort((a, b) => catOf(a.category).localeCompare(catOf(b.category)) || a.name.localeCompare(b.name));
  }, [products, search, activeCat]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="পণ্য খুঁজুন…" />
        <Button onClick={openAdd} className={`h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> <span className="max-sm:hidden">{activeCat ? `${activeCat}-এ যোগ` : 'পণ্য যোগ'}</span><span className="sm:hidden">যোগ</span></Button>
      </div>

      {categories.length > 0 && (
        <CategoryChips categories={categories} counts={counts} value={activeCat} onChange={setCat}
          className="-mx-3 px-3 sm:mx-0 sm:px-0" />
      )}

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Package} text={products.length ? 'খোঁজা পণ্য পাওয়া যায়নি' : 'এখনো কোনো পণ্য নেই'}
              action={!products.length && <Button size="sm" className={PRIMARY_BTN} onClick={openAdd}>প্রথম পণ্য যোগ করুন</Button>} />
          ) : (
            <>
              {/* Mobile list */}
              <ul className="divide-y sm:hidden">
                {filtered.map(p => (
                  <li key={p.id} className="flex items-center">
                    <button onClick={() => openEdit(p)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left active:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {p.pricingType === 'weight' && <Scale className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                          <span className="truncate">{p.name}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {catOf(p.category)}
                          {(p.costPrice ?? 0) > 0
                            ? <span className={p.price >= (p.costPrice ?? 0) ? 'text-emerald-600' : 'text-red-600'}> · লাভ {formatCurrency(p.price - (p.costPrice ?? 0))}</span>
                            : <span className="text-amber-600"> · কেনা দাম দিন</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(p.price)}{p.pricingType === 'weight' && <span className="text-[10px] font-normal text-slate-400">/কেজি</span>}</p>
                        <p className={`text-[11px] ${p.stock <= LOW_STOCK ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                          {p.stock} {unitBn(p.unit)}
                        </p>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="mr-1 h-10 w-10 shrink-0" aria-label={`মুছুন ${p.name}`} onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>নাম</TableHead><TableHead>ধরন</TableHead>
                      <TableHead className="text-right">কেনা দাম</TableHead><TableHead className="text-right">বিক্রির দাম</TableHead><TableHead className="text-right">লাভ</TableHead><TableHead className="text-right">স্টক</TableHead>
                      <TableHead>ক্যাটাগরি</TableHead><TableHead className="text-right">কাজ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {p.pricingType === 'weight' && <Scale className="h-4 w-4 text-blue-600" />}{p.name}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={p.pricingType === 'weight' ? 'default' : 'secondary'}>{p.pricingType === 'weight' ? 'কেজি দরে' : 'পিস দরে'}</Badge></TableCell>
                        <TableCell className="text-right text-slate-500">{(p.costPrice ?? 0) > 0 ? formatCurrency(p.costPrice ?? 0) : '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.price)}{p.pricingType === 'weight' && <span className="text-xs text-slate-400">/কেজি</span>}</TableCell>
                        <TableCell className={`text-right ${p.price >= (p.costPrice ?? 0) ? 'text-emerald-600' : 'text-red-600'}`}>{(p.costPrice ?? 0) > 0 ? formatCurrency(p.price - (p.costPrice ?? 0)) : '—'}</TableCell>
                        <TableCell className={`text-right ${p.stock <= LOW_STOCK ? 'font-semibold text-red-600' : ''}`}>{p.stock} {unitBn(p.unit)}</TableCell>
                        <TableCell><Badge variant="outline">{p.category || '-'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`সম্পাদনা ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label={`মুছুন ${p.name}`} onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

      <ProductFormDialog open={formOpen} onClose={() => setFormOpen(false)} product={editing} defaultCategory={activeCat} />
      <ConfirmDialog
        open={!!deleteId} title="পণ্য মুছবেন?" description="এটি আর ফেরানো যাবে না।"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteProduct(deleteId); toast({ title: 'পণ্য মুছে ফেলা হয়েছে' }); }
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
  const deleteDuePayment = useStore(s => s.deleteDuePayment);
  const duePayments = useStore(s => s.duePayments);
  const { map: dues } = useCustomerDues();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [deletePayId, setDeletePayId] = useState<string | null>(null);

  // latest payment of every customer (shown on the card)
  const lastPay = useMemo(() => {
    const m: Record<string, { createdAt: string; amount: number }> = {};
    duePayments.forEach(p => {
      if (!m[p.customerId] || new Date(p.createdAt) > new Date(m[p.customerId].createdAt)) m[p.customerId] = p;
    });
    return m;
  }, [duePayments]);

  // full khata of the open customer: due purchases and payments with the balance after each
  const ledger = useMemo(() => {
    if (!detailsId) return [];
    return buildLedger([
      ...sales.filter(s => s.customerId === detailsId && s.paymentType === 'due').map(s => ({
        id: s.id, date: s.createdAt, kind: 'charge' as const, amount: s.total, title: 'বাকিতে কেনা', sub: saleSummary(s),
      })),
      ...duePayments.filter(p => p.customerId === detailsId).map(p => ({
        id: p.id, date: p.createdAt, kind: 'payment' as const, amount: p.amount, title: 'বাকি পরিশোধ',
        onDelete: () => setDeletePayId(p.id),
      })),
    ]);
  }, [detailsId, sales, duePayments]);
  const chargedTotal = ledger.filter(l => l.kind === 'charge').reduce((a, l) => a + l.amount, 0);
  const paidTotal = ledger.filter(l => l.kind === 'payment').reduce((a, l) => a + l.amount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, search]);

  const detailsCustomer = customers.find(c => c.id === detailsId);
  const payCustomer = customers.find(c => c.id === payId);
  const payDue = payId ? dues[payId] ?? 0 : 0;

  const submitCustomer = () => {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিতে হবে', variant: 'destructive' });
      return;
    }
    addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
    toast({ title: 'কাস্টমার যোগ হয়েছে' });
    setAddOpen(false);
    setForm({ name: '', phone: '', address: '' });
  };

  const submitPayment = () => {
    const amount = Number(payAmount);
    if (!payCustomer || !(amount > 0)) {
      toast({ title: 'সঠিক টাকার পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (amount > payDue) {
      toast({ title: 'পরিমাণ বেশি', description: `বর্তমান বাকি ${formatCurrency(payDue)}`, variant: 'destructive' });
      return;
    }
    addDuePayment({ customerId: payCustomer.id, customerName: payCustomer.name, amount, createdAt: dateStrToIso(payDate) });
    toast({ title: 'পেমেন্ট জমা হয়েছে', description: formatCurrency(amount) });
    setPayId(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="কাস্টমার খুঁজুন…" />
        <Button onClick={() => setAddOpen(true)} className={`h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> <span className="max-sm:hidden">কাস্টমার যোগ</span><span className="sm:hidden">যোগ</span></Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Users} text="কোনো কাস্টমার পাওয়া যায়নি" /></CardContent></Card>
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
                      <a href={`tel:${c.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />{c.phone}
                      </a>
                    )}
                    {c.address && <p className="truncate text-xs text-slate-400">{c.address}</p>}
                    {lastPay[c.id] && (
                      <p className="mt-0.5 text-[11px] text-emerald-700">
                        সর্বশেষ পরিশোধ: {fmt(new Date(lastPay[c.id].createdAt), 'd MMM')} · {formatCurrency(lastPay[c.id].amount)}
                      </p>
                    )}
                  </div>
                  <Badge variant={due > 0 ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                    {due > 0 ? `বাকি ${formatCurrency(due)}` : 'বাকি নেই'}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => setDetailsId(c.id)}>বিস্তারিত</Button>
                  {due > 0 && (
                    <Button className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      onClick={() => { setPayId(c.id); setPayAmount(''); setPayDate(todayStr()); }}>পরিশোধ</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`মুছুন ${c.name}`} onClick={() => setDeleteId(c.id)}>
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
          <DialogHeader><DialogTitle>নতুন কাস্টমার</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitCustomer(); }}>
            <div className="space-y-1.5"><Label htmlFor="c-name">নাম *</Label>
              <Input id="c-name" className="h-11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-phone">ফোন</Label>
              <Input id="c-phone" type="tel" inputMode="tel" className="h-11" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-addr">ঠিকানা</Label>
              <Input id="c-addr" className="h-11" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <FormActions onCancel={() => setAddOpen(false)} label="যোগ করুন" />
          </form>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!detailsId} onOpenChange={o => { if (!o) setDetailsId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-lg`}>
          <DialogHeader><DialogTitle>{detailsCustomer?.name}</DialogTitle></DialogHeader>
          {detailsCustomer && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {detailsCustomer.phone && (
                  <a href={`tel:${detailsCustomer.phone}`} className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{detailsCustomer.phone}</a>
                )}
                {detailsCustomer.address && <span>{detailsCustomer.address}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                <div><p className="text-slate-500">বাকিতে কেনা</p><p className="font-semibold">{formatCurrency(chargedTotal)}</p></div>
                <div><p className="text-slate-500">পরিশোধ</p><p className="font-semibold text-emerald-600">{formatCurrency(paidTotal)}</p></div>
                <div><p className="text-slate-500">এখনকার বাকি</p><p className="font-semibold text-red-600">{formatCurrency(Math.max(0, dues[detailsCustomer.id] ?? 0))}</p></div>
              </div>
              {(dues[detailsCustomer.id] ?? 0) > 0 && (
                <Button className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => { const id = detailsCustomer.id; setDetailsId(null); setPayId(id); setPayAmount(''); setPayDate(todayStr()); }}>
                  বাকি পরিশোধ নিন
                </Button>
              )}
              <p className="text-xs font-medium text-slate-500">বাকির খাতা (কবে কী হয়েছে)</p>
              <Ledger entries={ledger} emptyText="এখনো কোনো বাকির লেনদেন নেই" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <Dialog open={!!payId} onOpenChange={o => { if (!o) setPayId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-sm`}>
          <DialogHeader><DialogTitle>বাকি আদায়{payCustomer && ` · ${payCustomer.name}`}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitPayment(); }}>
            <p className="text-sm">বর্তমান বাকি: <span className="font-bold text-red-600">{formatCurrency(payDue)}</span></p>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amt">টাকার পরিমাণ (৳)</Label>
              <div className="flex gap-2">
                <Input id="pay-amt" inputMode="decimal" className="h-11" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setPayAmount(String(payDue))}>পুরো</Button>
              </div>
            </div>
            <DateField id="pay-date" value={payDate} onChange={setPayDate} label="কোন তারিখে পেয়েছেন" />
            <FormActions onCancel={() => setPayId(null)} label="জমা করুন" submitClass="bg-emerald-600 text-white hover:bg-emerald-700" />
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletePayId} title="এই পরিশোধ মুছবেন?" description="কাস্টমারের বাকি আবার বেড়ে যাবে।"
        onCancel={() => setDeletePayId(null)}
        onConfirm={() => {
          if (deletePayId) { deleteDuePayment(deletePayId); toast({ title: 'পরিশোধ মুছে ফেলা হয়েছে' }); }
          setDeletePayId(null);
        }}
      />
      <ConfirmDialog
        open={!!deleteId} title="কাস্টমার মুছবেন?" description="বিক্রির ইতিহাস থেকে যাবে।"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteCustomer(deleteId); toast({ title: 'কাস্টমার মুছে ফেলা হয়েছে' }); }
          setDeleteId(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

const EXPENSE_CATEGORIES = ['ভাড়া', 'ইউটিলিটি বিল', 'বেতন', 'যাতায়াত', 'মেরামত', 'অন্যান্য'];

function ExpenseFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addExpense = useStore(s => s.addExpense);
  const [form, setForm] = useState({ description: '', amount: '', category: '' });

  useEffect(() => { if (!open) setForm({ description: '', amount: '', category: '' }); }, [open]);

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.description.trim() || !(amount > 0)) {
      toast({ title: 'ফর্মটি দেখুন', description: 'বিবরণ ও সঠিক টাকার পরিমাণ দিতে হবে', variant: 'destructive' });
      return;
    }
    addExpense({ description: form.description.trim(), amount, category: form.category.trim() || DEFAULT_CATEGORY });
    toast({ title: 'খরচ যোগ হয়েছে', description: formatCurrency(amount) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>খরচ যোগ</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className="space-y-1.5"><Label htmlFor="e-desc">বিবরণ *</Label>
            <Input id="e-desc" className="h-11" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="e-amt">টাকার পরিমাণ (৳) *</Label>
            <Input id="e-amt" inputMode="decimal" className="h-11" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="e-cat">ক্যাটাগরি</Label>
            <Input id="e-cat" className="h-11" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                  className={`h-8 rounded-full border px-3 text-xs ${form.category === c ? 'border-blue-700 bg-blue-50 text-blue-700' : 'bg-white text-slate-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <FormActions onCancel={onClose} label="যোগ করুন" />
        </form>
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
        <Button onClick={() => setOpen(true)} className={`ml-auto h-10 shrink-0 ${PRIMARY_BTN}`}><Plus /> যোগ</Button>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
        <span className="text-slate-500">{filtered.length}টি খরচ</span>
        <span className="font-semibold text-red-600">-{formatCurrency(total)}</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Wallet} text="কোনো খরচ পাওয়া যায়নি" />
          ) : (
            <>
              <ul className="divide-y sm:hidden">
                {filtered.map(e => (
                  <li key={e.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.description}</p>
                      <p className="text-[11px] text-slate-500">{fmt(new Date(e.createdAt), 'MMM d')} · {catOf(e.category)}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-600">-{formatCurrency(e.amount)}</span>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label={`মুছুন ${e.description}`} onClick={() => setDeleteId(e.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>তারিখ</TableHead><TableHead>বিবরণ</TableHead><TableHead>ক্যাটাগরি</TableHead>
                      <TableHead className="text-right">টাকা</TableHead><TableHead className="text-right">কাজ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{fmt(new Date(e.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs">{e.description}</TableCell>
                        <TableCell><Badge variant="outline">{catOf(e.category)}</Badge></TableCell>
                        <TableCell className="text-right text-xs font-medium text-red-600">-{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label={`মুছুন ${e.description}`} onClick={() => setDeleteId(e.id)}>
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
        open={!!deleteId} title="খরচ মুছবেন?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteExpense(deleteId); toast({ title: 'খরচ মুছে ফেলা হয়েছে' }); }
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
  const { total: supplierDue } = useSupplierDues();
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
        push(fmt(h, 'HH:mm'), h, hEnd);
      }
    } else if (period === 'weekly' || period === 'monthly') {
      const n = period === 'weekly' ? 7 : 30;
      for (let i = n - 1; i >= 0; i--) {
        const d = subDays(today, i);
        push(fmt(d, period === 'weekly' ? 'EEE' : 'MMM d'), startOfDay(d), endOfDay(d));
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(today, i);
        push(fmt(m, 'MMM'), startOfMonth(m), endOfMonth(m));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, expenses, period]);

  const paymentData = useMemo(() => [
    { name: 'নগদ', value: sales.filter(s => s.paymentType === 'cash').reduce((a, s) => a + s.total, 0), color: COLORS[0] },
    { name: 'বাকি', value: sales.filter(s => s.paymentType === 'due').reduce((a, s) => a + s.total, 0), color: COLORS[1] },
  ], [sales]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    sales.forEach(sale => sale.items.forEach(i => {
      map[i.productId] ??= { name: i.productName, revenue: 0 };
      map[i.productId].revenue += i.subtotal;
    }));
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const topProfit = useMemo(() => {
    const map: Record<string, { name: string; profit: number }> = {};
    sales.forEach(sale => sale.items.forEach(i => {
      const p = itemProfit(i);
      if (p === null) return;
      map[i.productId] ??= { name: i.productName, profit: 0 };
      map[i.productId].profit += p;
    }));
    return Object.values(map).sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [sales]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { const c = catOf(e.category); map[c] = (map[c] || 0) + e.amount; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [expenses]);

  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const gross = profitOf(sales);
  const net = gross.profit - totalExpenses;
  const fmtTip = (v: unknown) => formatCurrency(Number(v));

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 sm:w-96">
        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`h-8 rounded-md text-xs font-medium capitalize ${period === p ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            {PERIOD_BN[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        <StatCard label="বিক্রি" value={formatCurrency(totalRevenue)} sub="সর্বমোট" icon={Banknote} tone="green" />
        <StatCard label="মোট লাভ" value={gross.known === 0 && gross.unknown > 0 ? '—' : formatCurrency(gross.profit)}
          sub={gross.unknown > 0 ? `${gross.unknown}টি আইটেমে কেনা দাম নেই` : 'বিক্রি − কেনা দাম'} icon={TrendingUp} tone="blue" />
        <StatCard label="খরচ" value={formatCurrency(totalExpenses)} sub="দোকানের খরচ" icon={Receipt} tone="red" />
        <StatCard label="নিট লাভ" value={gross.known === 0 && gross.unknown > 0 ? '—' : formatCurrency(net)} sub="মোট লাভ − খরচ"
          icon={TrendingUp} tone={net >= 0 || gross.known === 0 ? 'green' : 'red'} />
        <StatCard label="কাস্টমারের বাকি" value={formatCurrency(totalDue)} sub="আপনি পাবেন" icon={CreditCard} tone="orange" />
        <StatCard label="সরবরাহকারীর পাওনা" value={formatCurrency(supplierDue)} sub="আপনি দেবেন" icon={Truck} tone="orange" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-2">
        <Card className="gap-2 py-3 shadow-sm lg:col-span-2 sm:py-6">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">বিক্রি বনাম খরচ</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            <div className="h-52 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.6} /><stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.6} /><stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} width={42} />
                  <Tooltip formatter={fmtTip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="sales" stroke="#1d4ed8" fill="url(#gSales)" name="বিক্রি" />
                  <Area type="monotone" dataKey="expenses" stroke="#d97706" fill="url(#gExp)" name="খরচ" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2 py-3 shadow-sm sm:py-6">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">নগদ বনাম বাকি</CardTitle></CardHeader>
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
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">ক্যাটাগরি অনুযায়ী খরচ</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            {expenseByCategory.length === 0 ? <EmptyState icon={Wallet} text="কোনো খরচ নেই" /> : (
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
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">সর্বাধিক বিক্রিত পণ্য</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            {topProducts.length === 0 ? <EmptyState icon={Package} text="এখনো কোনো বিক্রি নেই" /> : (
              <div className="h-48 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBar data={topProducts} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={fmtTip} />
                    <Bar dataKey="revenue" fill="#1d4ed8" name="বিক্রি" radius={[0, 4, 4, 0]} />
                  </RechartsBar>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-3 shadow-sm sm:py-6 lg:col-span-2">
          <CardHeader className="px-3 sm:px-6"><CardTitle className="text-sm sm:text-base">সবচেয়ে বেশি লাভের পণ্য</CardTitle></CardHeader>
          <CardContent className="px-1 sm:px-6">
            {topProfit.length === 0 ? <EmptyState icon={TrendingUp} text="পণ্যে কেনা দাম দিলে এখানে লাভ দেখা যাবে" /> : (
              <div className="h-48 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBar data={topProfit} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={72} />
                    <Tooltip formatter={fmtTip} />
                    <Bar dataKey="profit" fill="#0d9488" name="লাভ" radius={[0, 4, 4, 0]} />
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
