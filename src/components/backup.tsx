'use client';

import { useEffect, useState } from 'react';
import { useStore, fetchAll, TABLES, type Key } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { CloudOff, Database, DatabaseBackup, FileSpreadsheet, LogOut, RefreshCw, Upload, X } from 'lucide-react';
import { ConfirmDialog, SHEET, PRIMARY_BTN, useCustomerDues, useSupplierDues, unitBn, saleDue, fmt } from '@/components/shared';

const LAST_BACKUP_KEY = 'sm-last-backup';

const getLastBackup = (): number | null => {
  try { const v = localStorage.getItem(LAST_BACKUP_KEY); return v ? Number(v) : null; } catch { return null; }
};
const markBackup = () => { try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch { /* ignore */ } };

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};
// sortable text date for Excel, e.g. 2026-11-12 14:05
const when = (iso: string) => new Date(iso).toLocaleString('sv-SE').slice(0, 16);

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------------------------------------------ */
/* Banner on the home page                                             */
/* ------------------------------------------------------------------ */

export function BackupBanner({ onOpen }: { onOpen: () => void }) {
  const hasData = useStore(s => s.products.length + s.sales.length > 0);
  const [last, setLast] = useState<number | null | undefined>(undefined);
  useEffect(() => { setLast(getLastBackup()); }, []);
  if (last === undefined || !hasData) return null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if (days !== null && days < 7) return null;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
      <DatabaseBackup className="h-5 w-5 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1 text-xs">
        <b className="text-slate-900">ডেটার ব্যাকআপ নিন</b>
        <span className="block text-slate-600">{days === null ? 'এখনো কোনো ব্যাকআপ নেওয়া হয়নি।' : `শেষ ব্যাকআপ ${days} দিন আগে।`}</span>
      </span>
      <span className="text-xs font-semibold text-amber-700">নিন</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Little status chip in the header                                    */
/* ------------------------------------------------------------------ */

export function SyncChip({ onClick }: { onClick: () => void }) {
  const online = useStore(s => s.online);
  const pending = useStore(s => s.pending);
  const syncing = useStore(s => s.syncing);
  if (online && pending === 0 && !syncing) return null;
  const offline = !online;
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${offline ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
      {offline ? <CloudOff className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 animate-spin" />}
      {offline ? 'অফলাইন' : 'সিঙ্ক হচ্ছে'}{pending > 0 && ` · ${pending}`}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Settings dialog                                                     */
/* ------------------------------------------------------------------ */

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const st = useStore();
  const { map: custDues } = useCustomerDues();
  const { map: supDues } = useSupplierDues();
  const shopRow = st.shopSettings[0];
  const [shop, setShop] = useState({ name: '', phone: '', address: '', note: '' });
  const [busy, setBusy] = useState<'' | 'xlsx' | 'json' | 'restore'>('');
  const [last, setLast] = useState<number | null>(null);
  const [restoreFile, setRestoreFile] = useState<{ name: string; tables: Record<string, Record<string, unknown>[]> } | null>(null);

  useEffect(() => {
    if (open) {
      setShop(shopRow ?? { name: '', phone: '', address: '', note: '' });
      setLast(getLastBackup());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const exportExcel = async () => {
    setBusy('xlsx');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const add = (name: string, rows: Record<string, unknown>[]) =>
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
      const cust = (id?: string) => st.customers.find(c => c.id === id)?.name ?? '';

      add('পণ্য', st.products.map(p => ({
        'নাম': p.name, 'বারকোড': p.barcode ?? '', 'ক্যাটাগরি': p.category, 'ধরন': p.pricingType === 'weight' ? 'কেজি দরে' : 'পিস দরে',
        'কেনা দাম': p.costPrice ?? 0, 'বিক্রির দাম': p.price, 'স্টক': p.stock, 'একক': unitBn(p.unit),
      })));
      add('কাস্টমার', st.customers.map(c => ({
        'নাম': c.name, 'ফোন': c.phone, 'ঠিকানা': c.address, 'বর্তমান বাকি': Math.max(0, custDues[c.id] ?? 0),
      })));
      add('বিক্রি', [...st.sales].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(s => ({
        'তারিখ': when(s.createdAt), 'কাস্টমার': s.customerName ?? cust(s.customerId), 'মোট বিল': s.total, 'ছাড়': s.discount,
        'পরিশোধ': s.paid, 'বাকি': saleDue(s) || Math.max(0, s.total - s.paid),
        'পণ্য': s.items.map(i => `${i.productName} ${i.quantity}${unitBn(i.unit)}`).join(', '),
      })));
      add('বিক্রির আইটেম', st.sales.flatMap(s => s.items.map(i => ({
        'তারিখ': when(s.createdAt), 'কাস্টমার': s.customerName ?? cust(s.customerId), 'পণ্য': i.productName,
        'পরিমাণ': i.quantity, 'একক': unitBn(i.unit), 'দর': i.price, 'কেনা দাম': i.costPrice ?? 0, 'টাকা': i.subtotal,
      }))));
      add('বাকি পরিশোধ', st.duePayments.map(p => ({ 'তারিখ': when(p.createdAt), 'কাস্টমার': p.customerName || cust(p.customerId), 'টাকা': p.amount })));
      add('ফেরত', st.returns.map(r => ({
        'তারিখ': when(r.createdAt), 'কাস্টমার': r.customerName ?? cust(r.customerId),
        'পণ্য': r.items.map(i => `${i.productName} ${i.quantity}${unitBn(i.unit)}`).join(', '), 'মূল্য': r.total, 'বাকি থেকে কাটা': r.credit,
      })));
      add('খরচ', st.expenses.map(e => ({ 'তারিখ': when(e.createdAt), 'বিবরণ': e.description, 'ক্যাটাগরি': e.category, 'টাকা': e.amount })));
      add('সরবরাহকারী', st.suppliers.map(s => ({ 'নাম': s.name, 'ফোন': s.phone, 'ঠিকানা': s.address, 'দিতে হবে': Math.max(0, supDues[s.id] ?? 0) })));
      add('মাল কেনা', st.purchases.map(p => ({
        'তারিখ': when(p.createdAt), 'সরবরাহকারী': p.supplierName,
        'পণ্য': p.items.map(i => `${i.productName} ${i.quantity}${unitBn(i.unit)}`).join(', '),
        'মোট': p.total, 'দেওয়া': p.paid, 'বাকি': p.total - p.paid, 'নোট': p.note,
      })));
      add('সরবরাহকারীকে পেমেন্ট', st.supplierPayments.map(p => ({ 'তারিখ': when(p.createdAt), 'সরবরাহকারী': p.supplierName, 'টাকা': p.amount, 'নোট': p.note })));

      XLSX.writeFile(wb, `store-data-${stamp()}.xlsx`);
      markBackup();
      setLast(Date.now());
      toast({ title: 'Excel ফাইল ডাউনলোড হয়েছে' });
    } catch (e) {
      toast({ title: 'Excel বানানো যায়নি', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  // full copy of the database rows (this is the file you can restore from)
  const exportJson = async () => {
    setBusy('json');
    try {
      const tables: Record<string, unknown[]> = {};
      for (const k of Object.keys(TABLES) as Key[]) tables[k] = await fetchAll(TABLES[k].table);
      const blob = new Blob([JSON.stringify({ app: 'store-manager', version: 1, createdAt: new Date().toISOString(), tables })], { type: 'application/json' });
      download(blob, `store-backup-${stamp()}.json`);
      markBackup();
      setLast(Date.now());
      toast({ title: 'ব্যাকআপ ফাইল ডাউনলোড হয়েছে', description: 'ফাইলটি Google Drive বা WhatsApp-এ নিজেকে পাঠিয়ে রাখুন' });
    } catch (e) {
      toast({ title: 'ব্যাকআপ নেওয়া যায়নি', description: 'ইন্টারনেট চালু আছে কি না দেখুন', variant: 'destructive' });
      console.error(e);
    } finally {
      setBusy('');
    }
  };

  const pickRestore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== 'store-manager' || typeof data.tables !== 'object') throw new Error('ভুল ফাইল');
      setRestoreFile({ name: file.name, tables: data.tables });
    } catch {
      toast({ title: 'এটা সঠিক ব্যাকআপ ফাইল নয়', variant: 'destructive' });
    }
  };

  const restore = async () => {
    if (!restoreFile) return;
    setBusy('restore');
    try {
      for (const k of Object.keys(TABLES) as Key[]) {
        const rows = restoreFile.tables[k] ?? [];
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from(TABLES[k].table).upsert(rows.slice(i, i + 500));
          if (error) throw error;
        }
      }
      await st.refresh();
      toast({ title: 'ব্যাকআপ থেকে ডেটা ফিরিয়ে আনা হয়েছে' });
      setRestoreFile(null);
    } catch (e) {
      toast({ title: 'ফিরিয়ে আনা যায়নি', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const saveShop = () => {
    st.saveShop({ name: shop.name.trim(), phone: shop.phone.trim(), address: shop.address.trim(), note: shop.note.trim() });
    toast({ title: 'দোকানের তথ্য সেভ হয়েছে' });
  };

  const signOut = async () => {
    if (st.pending > 0 && !window.confirm(`${st.pending}টি পরিবর্তন এখনো ক্লাউডে সেভ হয়নি। এখন সাইন আউট করলে সেগুলো হারিয়ে যাবে। তবুও সাইন আউট করবেন?`)) return;
    await st.wipeLocal();
    await supabase.auth.signOut();
  };

  const counts = restoreFile
    ? `${restoreFile.tables.products?.length ?? 0}টি পণ্য, ${restoreFile.tables.sales?.length ?? 0}টি বিক্রি, ${restoreFile.tables.customers?.length ?? 0}জন কাস্টমার`
    : '';

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className={`${SHEET} sm:max-w-md`}>
          <DialogHeader><DialogTitle>সেটিংস ও ব্যাকআপ</DialogTitle></DialogHeader>

          {/* sync */}
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-xs">
            {st.online ? <Database className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-amber-600" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{st.online ? 'ক্লাউডের সাথে যুক্ত' : 'অফলাইন'}</p>
              <p className="text-slate-600">
                {st.pending > 0 ? `${st.pending}টি পরিবর্তন সেভ হওয়ার অপেক্ষায় (ইন্টারনেট এলে নিজে সেভ হবে)` : 'সব পরিবর্তন সেভ হয়েছে'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => void st.sync()} disabled={st.syncing}>
              <RefreshCw className={st.syncing ? 'animate-spin' : ''} /> সিঙ্ক
            </Button>
          </div>

          {/* backup */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">ডেটার ব্যাকআপ</p>
            <p className="text-xs text-slate-500">
              {last ? `শেষ ব্যাকআপ: ${fmt(new Date(last), 'd MMM yyyy, h:mm a')}` : 'এখনো ব্যাকআপ নেওয়া হয়নি।'}
              {' '}ফ্রি Supabase প্ল্যানে নিজে থেকে ব্যাকআপ হয় না, তাই সপ্তাহে একবার নিন।
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button className={`h-11 ${PRIMARY_BTN}`} onClick={exportJson} disabled={busy !== ''}>
                <DatabaseBackup /> {busy === 'json' ? 'নেওয়া হচ্ছে…' : 'পুরো ব্যাকআপ'}
              </Button>
              <Button variant="outline" className="h-11" onClick={exportExcel} disabled={busy !== ''}>
                <FileSpreadsheet /> {busy === 'xlsx' ? 'বানানো হচ্ছে…' : 'Excel ফাইল'}
              </Button>
            </div>
            <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> ব্যাকআপ ফাইল থেকে ডেটা ফিরিয়ে আনুন
              <input type="file" accept="application/json,.json" className="hidden"
                onChange={e => { void pickRestore(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>

          {/* shop details */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold">দোকানের তথ্য (ইনভয়েসে ছাপা হয়)</p>
            <div className="space-y-1">
              <Label htmlFor="st-name" className="text-xs">দোকানের নাম</Label>
              <Input id="st-name" className="h-10" value={shop.name} onChange={e => setShop({ ...shop, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="st-phone" className="text-xs">ফোন</Label>
                <Input id="st-phone" type="tel" inputMode="tel" className="h-10" value={shop.phone} onChange={e => setShop({ ...shop, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="st-addr" className="text-xs">ঠিকানা</Label>
                <Input id="st-addr" className="h-10" value={shop.address} onChange={e => setShop({ ...shop, address: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="st-note" className="text-xs">নিচের লেখা</Label>
              <Input id="st-note" className="h-10" placeholder="ধন্যবাদ, আবার আসবেন।" value={shop.note} onChange={e => setShop({ ...shop, note: e.target.value })} />
            </div>
            <Button className={`h-10 w-full ${PRIMARY_BTN}`} onClick={saveShop}>দোকানের তথ্য সেভ করুন</Button>
          </div>

          <Button variant="outline" className="h-10 w-full text-red-600" onClick={signOut}>
            <LogOut /> সাইন আউট
          </Button>
          <Button variant="ghost" size="icon" className="absolute right-3 top-3 hidden h-8 w-8" onClick={onClose}><X /></Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!restoreFile}
        title="ব্যাকআপ থেকে ফিরিয়ে আনবেন?"
        description={`${counts}। একই আইডির ডেটা ব্যাকআপের অবস্থায় ফিরে যাবে (যেমন পণ্যের স্টক)। এখনকার অন্য ডেটা মুছবে না।`}
        confirmLabel={busy === 'restore' ? 'হচ্ছে…' : 'ফিরিয়ে আনুন'}
        confirmClass="bg-blue-700 hover:bg-blue-800"
        onCancel={() => setRestoreFile(null)}
        onConfirm={() => void restore()}
      />
    </>
  );
}
