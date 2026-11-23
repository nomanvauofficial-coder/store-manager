'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { FileDown, FileUp } from 'lucide-react';
import { SHEET, PRIMARY_BTN, formatCurrency, getCategories, catOf, normalizeCategory, DEFAULT_CATEGORY } from '@/components/shared';

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Reading the Excel file                                              */
/* ------------------------------------------------------------------ */

// column names that are understood (Bangla or English, any letter case)
const SYN: Record<'name' | 'price' | 'cost' | 'stock' | 'category' | 'barcode' | 'type', Set<string>> = {
  name: new Set(['নাম', 'পণ্য', 'পণ্যেরনাম', 'name', 'product', 'productname', 'item', 'itemname']),
  price: new Set(['বিক্রিরদাম', 'বিক্রয়মূল্য', 'দাম', 'price', 'sellingprice', 'saleprice', 'mrp']),
  cost: new Set(['কেনাদাম', 'ক্রয়মূল্য', 'cost', 'costprice', 'buyingprice', 'purchaseprice']),
  stock: new Set(['স্টক', 'মজুত', 'পরিমাণ', 'stock', 'qty', 'quantity']),
  category: new Set(['ক্যাটাগরি', 'বিভাগ', 'category']),
  barcode: new Set(['বারকোড', 'barcode', 'ean', 'upc', 'code']),
  type: new Set(['ধরন', 'type', 'unit', 'একক']),
};
const norm = (h: string) => h.toString().toLowerCase().replace(/[\s_\-.]/g, '');

type RawRow = Record<string, unknown>;
const pick = (row: RawRow, key: keyof typeof SYN): unknown => {
  for (const h of Object.keys(row)) if (SYN[key].has(norm(h))) return row[h];
  return undefined;
};
const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[,৳\s]|টাকা/g, '');
  return t === '' ? NaN : Number(t);
};
// Excel often turns long barcodes into numbers; write them back as full digits
const toBarcode = (v: unknown): string => {
  if (blank(v)) return '';
  return typeof v === 'number' ? v.toFixed(0) : String(v).trim();
};
const kindOfType = (v: unknown): 'weight' | 'fixed' | undefined => {
  const t = String(v ?? '').toLowerCase();
  if (!t.trim()) return undefined;
  if (/কেজি|kg|weight|ওজন/.test(t)) return 'weight';
  if (/পিস|pcs|piece|fixed/.test(t)) return 'fixed';
  return undefined;
};

interface Plan {
  line: number;
  name: string;
  kind: 'new' | 'update' | 'same' | 'error';
  reason?: string;
  product?: Product;
}

function makePlans(rows: RawRow[], existing: Product[], overwriteStock: boolean): Plan[] {
  const categories = getCategories(existing);
  const seen = new Set<string>();
  const plans: Plan[] = [];
  rows.forEach((row, i) => {
    const line = i + 2; // row 1 is the header
    const name = String(pick(row, 'name') ?? '').trim();
    if (!name && Object.values(row).every(blank)) return; // empty row
    if (!name) { plans.push({ line, name: '—', kind: 'error', reason: 'নাম নেই' }); return; }

    const barcode = toBarcode(pick(row, 'barcode'));
    // the same name OR the same barcode twice in the file: the second one is skipped
    const nameKey = name.toLowerCase();
    if (seen.has(nameKey) || (barcode && seen.has(`#${barcode}`))) { plans.push({ line, name, kind: 'error', reason: 'ফাইলে দুবার আছে' }); return; }
    seen.add(nameKey);
    if (barcode) seen.add(`#${barcode}`);

    const priceRaw = pick(row, 'price'), costRaw = pick(row, 'cost'), stockRaw = pick(row, 'stock');
    const price = toNum(priceRaw), cost = toNum(costRaw), stock = toNum(stockRaw);
    if (!blank(priceRaw) && !(price >= 0)) { plans.push({ line, name, kind: 'error', reason: 'দাম ঠিক নেই' }); return; }
    if (!blank(costRaw) && !(cost >= 0)) { plans.push({ line, name, kind: 'error', reason: 'কেনা দাম ঠিক নেই' }); return; }
    if (!blank(stockRaw) && !(stock >= 0)) { plans.push({ line, name, kind: 'error', reason: 'স্টক ঠিক নেই' }); return; }
    const cat = String(pick(row, 'category') ?? '').trim();
    const type = kindOfType(pick(row, 'type'));

    const old = (barcode && existing.find(p => p.barcode === barcode)) || existing.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
    if (old) {
      const next: Product = { ...old };
      if (!blank(priceRaw)) next.price = price;
      if (!blank(costRaw)) next.costPrice = cost;
      if (cat) next.category = normalizeCategory(cat, categories);
      if (barcode) next.barcode = barcode;
      if (overwriteStock && !blank(stockRaw)) next.stock = stock;
      const changed = next.price !== old.price || (next.costPrice ?? 0) !== (old.costPrice ?? 0) || next.category !== old.category
        || (next.barcode ?? '') !== (old.barcode ?? '') || next.stock !== old.stock;
      plans.push({ line, name, kind: changed ? 'update' : 'same', product: next });
      return;
    }
    if (blank(priceRaw)) { plans.push({ line, name, kind: 'error', reason: 'নতুন পণ্যে দাম দিতে হবে' }); return; }
    const weight = type === 'weight';
    plans.push({
      line, name, kind: 'new',
      product: {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name, price, costPrice: blank(costRaw) ? 0 : cost, stock: blank(stockRaw) ? 0 : stock,
        category: cat ? normalizeCategory(cat, categories) : DEFAULT_CATEGORY,
        pricingType: weight ? 'weight' : 'fixed', unit: weight ? 'kg' : 'pcs', barcode,
        createdAt: '', updatedAt: '',
      } as Product,
    });
  });
  return plans;
}

/* ------------------------------------------------------------------ */
/* Excel import                                                        */
/* ------------------------------------------------------------------ */

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useStore(s => s.products);
  const upsertProducts = useStore(s => s.upsertProducts);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [overwriteStock, setOverwriteStock] = useState(false);
  const [busy, setBusy] = useState(false);

  const plans = useMemo(() => (rows ? makePlans(rows, products, overwriteStock) : []), [rows, products, overwriteStock]);
  const count = (k: Plan['kind']) => plans.filter(p => p.kind === k).length;
  const toSave = plans.filter(p => p.kind === 'new' || p.kind === 'update');

  const close = () => { setRows(null); setFileName(''); setOverwriteStock(false); onClose(); };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '', raw: true });
      if (data.length === 0) throw new Error('ফাইলে কোনো সারি নেই');
      setRows(data);
      setFileName(file.name);
    } catch (e) {
      toast({ title: 'ফাইল পড়া যায়নি', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const sample = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet([
      { 'নাম': 'সয়াবিন তেল ১ লিটার', 'বারকোড': '8901234567890', 'ক্যাটাগরি': 'মুদি', 'ধরন': 'পিস', 'কেনা দাম': 165, 'বিক্রির দাম': 180, 'স্টক': 20 },
      { 'নাম': 'মিনিকেট চাল', 'বারকোড': '', 'ক্যাটাগরি': 'মুদি', 'ধরন': 'কেজি', 'কেনা দাম': 60, 'বিক্রির দাম': 70, 'স্টক': 100 },
      { 'নাম': 'লাক্স সাবান', 'বারকোড': '', 'ক্যাটাগরি': 'প্রসাধনী', 'ধরন': 'পিস', 'কেনা দাম': 40, 'বিক্রির দাম': 45, 'স্টক': 60 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'পণ্য');
    XLSX.writeFile(wb, 'product-sample.xlsx');
  };

  const apply = () => {
    upsertProducts(toSave.map(p => p.product as Product));
    toast({ title: 'পণ্য তোলা হয়েছে', description: `নতুন ${count('new')}টি, আপডেট ${count('update')}টি` });
    close();
  };

  const errors = plans.filter(p => p.kind === 'error');
  const sampleRows = toSave.slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className={`${SHEET} sm:max-w-lg`}>
        <DialogHeader><DialogTitle>Excel থেকে পণ্য তুলুন</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Excel বা CSV ফাইলের প্রথম সারিতে কলামের নাম থাকতে হবে: <b>নাম, বিক্রির দাম</b> (দরকারি), আর ইচ্ছে হলে
            <b> কেনা দাম, স্টক, ক্যাটাগরি, বারকোড, ধরন</b> (পিস বা কেজি)। আগের পণ্যের নাম বা বারকোড মিললে সেটা আপডেট হবে, নতুন হলে যোগ হবে।
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-700 text-sm font-medium text-white hover:bg-blue-800">
              <FileUp className="h-4 w-4" /> {busy ? 'পড়া হচ্ছে…' : 'ফাইল বাছুন'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="ফাইল"
                onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <Button type="button" variant="outline" className="h-11" onClick={() => void sample()}>
              <FileDown /> নমুনা ফাইল
            </Button>
          </div>

          {rows && (
            <div className="space-y-2.5 rounded-lg border p-3">
              <p className="truncate text-xs text-slate-500">{fileName}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge className="bg-emerald-600">নতুন {count('new')}</Badge>
                <Badge variant="secondary">আপডেট {count('update')}</Badge>
                <Badge variant="outline">অপরিবর্তিত {count('same')}</Badge>
                {errors.length > 0 && <Badge variant="destructive">ভুল {errors.length}</Badge>}
              </div>

              {sampleRows.length > 0 && (
                <ul className="divide-y rounded-md border text-xs">
                  {sampleRows.map(p => (
                    <li key={p.line} className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className={`shrink-0 rounded px-1.5 text-[10px] font-semibold ${p.kind === 'new' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.kind === 'new' ? 'নতুন' : 'আপডেট'}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="shrink-0 font-medium">{formatCurrency(p.product!.price)}</span>
                    </li>
                  ))}
                  {toSave.length > sampleRows.length && (
                    <li className="px-2.5 py-1.5 text-center text-slate-500">আরও {toSave.length - sampleRows.length}টি…</li>
                  )}
                </ul>
              )}

              {errors.length > 0 && (
                <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">
                  <p className="mb-1 font-semibold">এই সারিগুলো বাদ যাবে:</p>
                  {errors.slice(0, 5).map(e => <p key={e.line}>সারি {e.line}: {e.name} — {e.reason}</p>)}
                  {errors.length > 5 && <p>আরও {errors.length - 5}টি…</p>}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={overwriteStock} onChange={e => setOverwriteStock(e.target.checked)} className="h-4 w-4" />
                আগের পণ্যের স্টকও ফাইলের সংখ্যা অনুযায়ী বদলান
              </label>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-white px-4 pt-3 sm:mx-0 sm:px-0">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={close}>বাতিল</Button>
          <Button type="button" className={`h-11 flex-1 ${PRIMARY_BTN}`} disabled={toSave.length === 0} onClick={apply}>
            {toSave.length > 0 ? `${toSave.length}টি পণ্য তুলুন` : 'তোলার মতো কিছু নেই'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Change many prices at once                                          */
/* ------------------------------------------------------------------ */

export function BulkPriceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const products = useStore(s => s.products);
  const upsertProducts = useStore(s => s.upsertProducts);
  const categories = useMemo(() => getCategories(products), [products]);

  const [scope, setScope] = useState('all');
  const [dir, setDir] = useState<'up' | 'down'>('up');
  const [unit, setUnit] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [alsoCost, setAlsoCost] = useState(false);
  const [round, setRound] = useState<'1' | '5' | '0'>('1');

  const v = Number(value);
  const valid = value !== '' && v > 0;
  const step = Number(round);

  const calc = (old: number) => {
    const delta = unit === 'percent' ? old * (v / 100) : v;
    const raw = dir === 'up' ? old + delta : old - delta;
    const rounded = step > 0 ? Math.round(raw / step) * step : r2(raw);
    return Math.max(0, r2(rounded));
  };

  const changes = useMemo(() => {
    if (!valid) return [];
    return products
      .filter(p => scope === 'all' || catOf(p.category) === scope)
      .map(p => {
        const next: Product = { ...p, price: calc(p.price) };
        if (alsoCost && (p.costPrice ?? 0) > 0) next.costPrice = calc(p.costPrice ?? 0);
        return { old: p, next };
      })
      .filter(c => c.next.price !== c.old.price || (c.next.costPrice ?? 0) !== (c.old.costPrice ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, scope, dir, unit, value, alsoCost, round]);

  const apply = () => {
    upsertProducts(changes.map(c => c.next));
    toast({ title: 'দাম বদলানো হয়েছে', description: `${changes.length}টি পণ্য` });
    setValue('');
    onClose();
  };

  const seg = (active: boolean) =>
    `h-9 rounded-md text-xs font-medium ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-md`}>
        <DialogHeader><DialogTitle>সব দাম একসাথে বদলান</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>কোন পণ্যের?</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-11 w-full" aria-label="কোন পণ্যের"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব পণ্য ({products.length}টি)</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
              <button type="button" role="tab" aria-selected={dir === 'up'} className={seg(dir === 'up')} onClick={() => setDir('up')}>বাড়ান</button>
              <button type="button" role="tab" aria-selected={dir === 'down'} className={seg(dir === 'down')} onClick={() => setDir('down')}>কমান</button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
              <button type="button" role="tab" aria-selected={unit === 'percent'} className={seg(unit === 'percent')} onClick={() => setUnit('percent')}>শতাংশ %</button>
              <button type="button" role="tab" aria-selected={unit === 'amount'} className={seg(unit === 'amount')} onClick={() => setUnit('amount')}>টাকা ৳</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-val">{unit === 'percent' ? 'কত শতাংশ?' : 'কত টাকা করে?'}</Label>
            <Input id="bulk-val" inputMode="decimal" className="h-11" placeholder={unit === 'percent' ? 'যেমন ৫' : 'যেমন ২'} value={value} onChange={e => setValue(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="গোল করা">
            {([['1', 'পূর্ণ টাকায়'], ['5', '৫ টাকার ঘরে'], ['0', 'যেমন আসে']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={round === id} className={seg(round === id)} onClick={() => setRound(id)}>{label}</button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={alsoCost} onChange={e => setAlsoCost(e.target.checked)} className="h-4 w-4" />
            কেনা দামও একই হারে বদলান
          </label>

          {valid && (
            <div className="rounded-lg border p-2.5 text-xs">
              <p className="mb-1.5 font-semibold">
                {changes.length === 0 ? 'কোনো পণ্যের দাম বদলাবে না' : `${changes.length}টি পণ্যের দাম বদলাবে`}
              </p>
              <ul className="space-y-0.5">
                {changes.slice(0, 5).map(c => (
                  <li key={c.old.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate">{c.old.name}</span>
                    <span className="shrink-0 text-slate-500">{formatCurrency(c.old.price)} → <b className={c.next.price >= c.old.price ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(c.next.price)}</b></span>
                  </li>
                ))}
                {changes.length > 5 && <li className="text-slate-500">আরও {changes.length - 5}টি…</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-white px-4 pt-3 sm:mx-0 sm:px-0">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>বাতিল</Button>
          <Button type="button" className={`h-11 flex-1 ${PRIMARY_BTN}`} disabled={changes.length === 0} onClick={apply}>
            দাম বদলান
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
