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
  Banknote, LogOut, type LucideIcon,
} from 'lucide-react';
import {
  BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const PERIOD_BN = { daily: 'দৈনিক', weekly: 'সাপ্তাহিক', monthly: 'মাসিক', yearly: 'বার্ষিক' } as const;
export const COLORS = ['#1d4ed8', '#0d9488', '#d97706', '#dc2626', '#64748b', '#0891b2'];
export const LOW_STOCK = 5;

// Dates: Bangla month/day names, but normal 0-9 digits (same as the numbers everywhere else)
export const fmt = (d: Date | number, pattern: string) =>
  dfFormat(d, pattern, { locale: bn }).replace(/[০-৯]/g, c => String('০১২৩৪৫৬৭৮৯'.indexOf(c)));

export const DEFAULT_CATEGORY = 'সাধারণ';
export const catOf = (c?: string | null) => (!c || c === 'General' ? DEFAULT_CATEGORY : c);
export const unitBn = (u?: string) => (u === 'kg' ? 'কেজি' : u === 'pcs' ? 'পিস' : u ?? '');

// Bangladeshi Taka, with thousand separators, no useless ".00"
export const formatCurrency = (amount: number) =>
  `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Mobile: the sheet hugs the TOP of the visible area and shrinks when the keyboard opens,
// so the form and its buttons never hide behind the keyboard.
export const SHEET =
  'bg-white p-4 sm:p-6 sm:max-h-[90dvh] overflow-y-auto overscroll-contain ' +
  'max-sm:top-[calc(var(--vvt,0px)+8px)] max-sm:bottom-auto max-sm:left-2 max-sm:right-2 ' +
  'max-sm:w-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 ' +
  'max-sm:max-h-[calc(var(--vvh,100dvh)-16px)] max-sm:rounded-2xl max-sm:pb-3';

export const PRIMARY_BTN = 'bg-blue-700 text-white hover:bg-blue-800';

export type Range = 'all' | 'today' | 'week' | 'month';
export const RANGES: { id: Range; label: string }[] = [
  { id: 'all', label: 'সব' },
  { id: 'today', label: 'আজ' },
  { id: 'week', label: 'সপ্তাহ' },
  { id: 'month', label: 'মাস' },
];

export function inRange(iso: string, range: Range) {
  if (range === 'all') return true;
  const now = new Date();
  const d = new Date(iso);
  const [start, end] =
    range === 'today' ? [startOfDay(now), endOfDay(now)]
    : range === 'week' ? [startOfWeek(now), endOfWeek(now)]
    : [startOfMonth(now), endOfMonth(now)];
  return isWithinInterval(d, { start, end });
}

export const byNewest = <T extends { createdAt: string }>(a: T, b: T) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const getCategories = (products: Product[]) =>
  Array.from(new Set(products.map(p => catOf(p.category)))).sort((a, b) => a.localeCompare(b));

// Reuse an existing category if the same name is typed again (any letter case)
export const normalizeCategory = (value: string, existing: string[]) => {
  const v = value.trim();
  if (!v) return DEFAULT_CATEGORY;
  return existing.find(c => c.toLowerCase() === v.toLowerCase()) ?? v;
};

export const saleSummary = (sale: Sale) =>
  sale.items
    .map(i => `${i.productName} ${i.pricingType === 'weight' ? `${i.weight ?? i.quantity} কেজি` : `×${i.quantity}`}`)
    .join(', ');

// Customer dues, calculated once
export function useCustomerDues() {
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

// Keeps --vvh / --vvt in sync with the visible area (changes when the phone keyboard opens)
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const sync = () => {
      root.setProperty('--vvh', `${vv.height}px`);
      root.setProperty('--vvt', `${vv.offsetTop}px`);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      root.removeProperty('--vvh');
      root.removeProperty('--vvt');
    };
  }, []);
}

// Buttons stay visible at the bottom of the form, right above the keyboard
export function FormActions({ onCancel, label, submitClass = PRIMARY_BTN }: { onCancel: () => void; label: string; submitClass?: string }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-white px-4 pb-0.5 pt-3 sm:mx-0 sm:border-0 sm:px-0 sm:pt-1">
      <Button type="button" variant="outline" className="h-11 flex-1" onClick={onCancel}>বাতিল</Button>
      <Button type="submit" className={`h-11 flex-1 ${submitClass}`}>{label}</Button>
    </div>
  );
}

export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-slate-500">
      <Icon className="h-8 w-8 text-slate-300" />
      <p className="text-sm">{text}</p>
      {action}
    </div>
  );
}

export function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 sm:w-72" role="tablist">
      {RANGES.map(r => (
        <button
          key={r.id}
          role="tab"
          aria-selected={value === r.id}
          onClick={() => onChange(r.id)}
          className={`h-8 rounded-md text-xs font-medium transition-colors ${
            value === r.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function PaymentBadge({ type }: { type: 'cash' | 'due' }) {
  return (
    <Badge variant={type === 'cash' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">
      {type === 'cash' ? 'নগদ' : 'বাকি'}
    </Badge>
  );
}

export function ConfirmDialog({
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
          <AlertDialogCancel className="max-sm:flex-1 max-sm:mt-0">বাতিল</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600 max-sm:flex-1">মুছুন</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

export function CategoryChips({
  categories, value, onChange, counts, allLabel = 'সব', className = '',
}: {
  categories: string[]; value: string; onChange: (c: string) => void;
  counts?: Record<string, number>; allLabel?: string; className?: string;
}) {
  const chip = (active: boolean) =>
    `h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
      active ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-slate-700 active:bg-slate-100'
    }`;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  return (
    <div className={`flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] ${className}`} role="tablist" aria-label="ক্যাটাগরি">
      <button role="tab" aria-selected={value === ''} className={chip(value === '')} onClick={() => onChange('')}>
        {allLabel}{total !== undefined && ` · ${total}`}
      </button>
      {categories.map(c => (
        <button key={c} role="tab" aria-selected={value === c} className={chip(value === c)} onClick={() => onChange(c)}>
          {c}{counts && ` · ${counts[c] ?? 0}`}
        </button>
      ))}
    </div>
  );
}

export const TONES = {
  green: { card: 'border-slate-200 bg-white', icon: 'bg-emerald-50 text-emerald-600', value: 'text-slate-900' },
  orange: { card: 'border-slate-200 bg-white', icon: 'bg-amber-50 text-amber-600', value: 'text-slate-900' },
  red: { card: 'border-red-200 bg-red-50/60', icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  gray: { card: 'border-slate-200 bg-white', icon: 'bg-slate-100 text-slate-400', value: 'text-slate-900' },
  blue: { card: 'border-slate-200 bg-white', icon: 'bg-blue-50 text-blue-700', value: 'text-slate-900' },
} as const;

export function StatCard({
  label, value, sub, icon: Icon, tone, onClick,
}: { label: string; value: string; sub: string; icon: LucideIcon; tone: keyof typeof TONES; onClick?: () => void }) {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors active:bg-slate-100 sm:p-4 ${t.card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-1 truncate text-lg font-bold sm:text-2xl ${t.value}`}>{value}</div>
      <p className="truncate text-[11px] text-slate-500">{sub}</p>
    </button>
  );
}



/* ------------------------------------------------------------------ */
/* Profit, supplier dues, ledger (added later)                         */
/* ------------------------------------------------------------------ */

// Profit of one sold item. null = buying price was not set, so profit is unknown.
export function itemProfit(i: SaleItem): number | null {
  const cost = i.costPrice ?? 0;
  return cost > 0 ? Math.round((i.subtotal - cost * i.quantity) * 100) / 100 : null;
}

export function profitOf(sales: Sale[]) {
  let profit = 0;
  let known = 0;
  let unknown = 0;
  sales.forEach(s => s.items.forEach(i => {
    const p = itemProfit(i);
    if (p === null) unknown++;
    else { profit += p; known++; }
  }));
  return { profit, known, unknown };
}

// What we still owe each supplier: purchases (total - paid) minus later payments
export function useSupplierDues() {
  const suppliers = useStore(s => s.suppliers);
  const purchases = useStore(s => s.purchases);
  const payments = useStore(s => s.supplierPayments);
  return useMemo(() => {
    const map: Record<string, number> = {};
    suppliers.forEach(s => { map[s.id] = 0; });
    purchases.forEach(p => { if (p.supplierId in map) map[p.supplierId] += p.total - p.paid; });
    payments.forEach(p => { if (p.supplierId in map) map[p.supplierId] -= p.amount; });
    const total = Object.values(map).reduce((sum, v) => sum + Math.max(0, v), 0);
    return { map, total };
  }, [suppliers, purchases, payments]);
}

// ---- dates for the "when" fields ----
const pad2 = (n: number) => String(n).padStart(2, '0');
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
export const dateStrToIso = (s: string) =>
  !s || s === todayStr() ? new Date().toISOString() : new Date(`${s}T12:00:00`).toISOString();

export function DateField({ id, value, onChange, label = 'তারিখ' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" max={todayStr()} className="h-11" value={value}
        onChange={e => onChange(e.target.value || todayStr())} />
    </div>
  );
}

// ---- running-balance ledger (used for customers and suppliers) ----
export interface LedgerRow {
  id: string;
  date: string;
  kind: 'charge' | 'payment';
  amount: number;
  title: string;
  sub?: string;
  onDelete?: () => void;
}

export function buildLedger(rows: LedgerRow[]) {
  const asc = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let balance = 0;
  return asc.map(r => {
    balance += r.kind === 'charge' ? r.amount : -r.amount;
    return { ...r, balance };
  }).reverse(); // newest first
}

export function Ledger({ entries, emptyText }: { entries: (LedgerRow & { balance: number })[]; emptyText: string }) {
  if (entries.length === 0) {
    return <p className="rounded-lg border p-4 text-center text-xs text-slate-500">{emptyText}</p>;
  }
  return (
    <ul className="max-h-[42dvh] divide-y overflow-y-auto rounded-lg border">
      {entries.map(e => (
        <li key={e.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.kind === 'payment' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="truncate">{e.title}</span>
            </p>
            {e.sub && <p className="truncate text-[11px] text-slate-500">{e.sub}</p>}
            <p className="text-[11px] text-slate-400">{fmt(new Date(e.date), 'd MMM yyyy, h:mm a')}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${e.kind === 'payment' ? 'text-emerald-600' : 'text-red-600'}`}>
              {e.kind === 'payment' ? '−' : '+'}{formatCurrency(e.amount)}
            </p>
            <p className="text-[10px] text-slate-400">বাকি {formatCurrency(Math.max(0, e.balance))}</p>
          </div>
          {e.onDelete && (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="মুছুন" onClick={e.onDelete}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
