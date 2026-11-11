'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { PurchaseItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Phone, Trash2, Truck, X, Wallet } from 'lucide-react';
import {
  formatCurrency, fmt, SHEET, PRIMARY_BTN, FormActions, EmptyState, SearchBar, ConfirmDialog, StatCard,
  useSupplierDues, todayStr, dateStrToIso, DateField, buildLedger, Ledger, unitBn,
} from '@/components/shared';

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Buying goods                                                        */
/* ------------------------------------------------------------------ */

function PurchaseDialog({ open, onClose, supplierId: presetSupplier }: { open: boolean; onClose: () => void; supplierId?: string }) {
  const suppliers = useStore(s => s.suppliers);
  const products = useStore(s => s.products);
  const addPurchase = useStore(s => s.addPurchase);

  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');
  const [manualTotal, setManualTotal] = useState('');
  const [paid, setPaid] = useState('');
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    if (!open) return;
    setSupplierId(presetSupplier || '');
    setItems([]); setProductId(''); setQty(''); setUnitCost('');
    setNote(''); setManualTotal(''); setPaid(''); setDate(todayStr());
  }, [open, presetSupplier]);

  const product = products.find(p => p.id === productId);
  const isWeight = product?.pricingType === 'weight';
  const itemsTotal = round2(items.reduce((s, i) => s + i.subtotal, 0));
  const total = items.length > 0 ? itemsTotal : Number(manualTotal) || 0;
  const paidN = Number(paid) || 0;
  const due = round2(total - paidN);

  const addLine = () => {
    if (!product) return;
    const q = Number(qty);
    const c = Number(unitCost);
    if (!(q > 0) || !(c >= 0) || (!isWeight && !Number.isInteger(q))) {
      toast({ title: 'পরিমাণ ও দাম সঠিক দিন', description: isWeight ? undefined : 'পিসের সংখ্যা পূর্ণ সংখ্যা হতে হবে', variant: 'destructive' });
      return;
    }
    const existing = items.find(i => i.productId === product.id);
    const newQty = round2((existing?.quantity ?? 0) + q);
    const line: PurchaseItem = {
      productId: product.id, productName: product.name, quantity: newQty, unitCost: c,
      subtotal: round2(newQty * c), unit: product.unit,
    };
    setItems(prev => (existing ? prev.map(i => (i.productId === product.id ? line : i)) : [...prev, line]));
    setProductId(''); setQty(''); setUnitCost('');
  };

  const submit = () => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      toast({ title: 'সরবরাহকারী বাছুন', variant: 'destructive' });
      return;
    }
    if (!(total > 0)) {
      toast({ title: 'মোট টাকা দিন', description: 'পণ্য যোগ করুন অথবা মোট টাকা লিখুন', variant: 'destructive' });
      return;
    }
    if (paidN < 0 || paidN > total) {
      toast({ title: 'দেওয়া টাকা ঠিক নেই', description: `০ থেকে ${formatCurrency(total)} এর মধ্যে হতে হবে`, variant: 'destructive' });
      return;
    }
    addPurchase({
      supplierId: supplier.id, supplierName: supplier.name, note: note.trim(),
      items, total: round2(total), paid: round2(paidN), createdAt: dateStrToIso(date),
    });
    toast({
      title: 'মাল কেনা সেভ হয়েছে',
      description: items.length ? 'পণ্যের স্টক বেড়ে গেছে' : formatCurrency(total),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-lg`}>
        <DialogHeader><DialogTitle>মাল কেনা</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>সরবরাহকারী *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-11 w-full" aria-label="সরবরাহকারী"><SelectValue placeholder="সরবরাহকারী বাছুন" /></SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 && <div className="p-3 text-sm text-slate-500">আগে একজন সরবরাহকারী যোগ করুন</div>}
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Optional product lines: they add stock and update the buying price */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-slate-600">কোন পণ্য কিনলেন? (স্টকে নিজে থেকে যোগ হবে)</p>
            <Select value={productId} onValueChange={id => {
              setProductId(id);
              const p = products.find(x => x.id === id);
              setUnitCost(p && (p.costPrice ?? 0) > 0 ? String(p.costPrice) : '');
            }}>
              <SelectTrigger className="h-11 w-full" aria-label="পণ্য"><SelectValue placeholder="পণ্য বাছুন" /></SelectTrigger>
              <SelectContent>
                {products.length === 0 && <div className="p-3 text-sm text-slate-500">কোনো পণ্য নেই</div>}
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {product && (
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pq" className="text-xs">পরিমাণ ({unitBn(product.unit)})</Label>
                  <Input id="pq" inputMode="decimal" className="h-11" value={qty} onChange={e => setQty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pc" className="text-xs">কেনা দাম {isWeight ? '(প্রতি কেজি)' : '(প্রতি পিস)'}</Label>
                  <Input id="pc" inputMode="decimal" className="h-11" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                </div>
                <Button type="button" className={`h-11 ${PRIMARY_BTN}`} onClick={addLine}>যোগ</Button>
              </div>
            )}

            {items.length > 0 && (
              <ul className="divide-y rounded-md border bg-slate-50/60">
                {items.map(i => (
                  <li key={i.productId} className="flex items-center gap-2 px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.productName}</p>
                      <p className="text-[11px] text-slate-500">{i.quantity} {unitBn(i.unit)} × {formatCurrency(i.unitCost)}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(i.subtotal)}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`সরান ${i.productName}`}
                      onClick={() => setItems(items.filter(x => x.productId !== i.productId))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length === 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="p-total">মোট টাকা (পণ্য না বাছলে) *</Label>
              <Input id="p-total" inputMode="decimal" className="h-11" value={manualTotal} onChange={e => setManualTotal(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="p-paid">এখন কত টাকা দিলেন?</Label>
            <div className="flex gap-2">
              <Input id="p-paid" inputMode="decimal" className="h-11" placeholder="0" value={paid} onChange={e => setPaid(e.target.value)} />
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setPaid(String(total))}>পুরো</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField id="p-date" value={date} onChange={setDate} label="কেনার তারিখ" />
            <div className="space-y-1.5">
              <Label htmlFor="p-note">নোট</Label>
              <Input id="p-note" className="h-11" placeholder="ঐচ্ছিক" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-white px-4 pt-3 sm:mx-0 sm:px-0">
          <div className="leading-tight">
            <p className="text-[11px] text-slate-500">মোট {formatCurrency(total)}</p>
            <p className={`text-base font-bold ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {due > 0 ? `বাকি ${formatCurrency(due)}` : 'পুরো দেওয়া'}
            </p>
          </div>
          <Button type="button" onClick={submit} className={`h-11 flex-1 ${PRIMARY_BTN}`}>সেভ করুন</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Suppliers page                                                      */
/* ------------------------------------------------------------------ */

export function SupplierModule() {
  const suppliers = useStore(s => s.suppliers);
  const purchases = useStore(s => s.purchases);
  const payments = useStore(s => s.supplierPayments);
  const addSupplier = useStore(s => s.addSupplier);
  const deleteSupplier = useStore(s => s.deleteSupplier);
  const deletePurchase = useStore(s => s.deletePurchase);
  const addSupplierPayment = useStore(s => s.addSupplierPayment);
  const deleteSupplierPayment = useStore(s => s.deleteSupplierPayment);
  const { map: dues, total: totalDue } = useSupplierDues();

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null); // '' = choose inside the dialog
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [payNote, setPayNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);
  const [deletePayId, setDeletePayId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.phone.includes(q))
      .sort((a, b) => (dues[b.id] ?? 0) - (dues[a.id] ?? 0) || a.name.localeCompare(b.name));
  }, [suppliers, search, dues]);

  const detailsSupplier = suppliers.find(s => s.id === detailsId);
  const paySupplier = suppliers.find(s => s.id === payId);
  const payDue = payId ? Math.max(0, dues[payId] ?? 0) : 0;

  const ledger = useMemo(() => {
    if (!detailsId) return [];
    return buildLedger([
      ...purchases.filter(p => p.supplierId === detailsId).map(p => ({
        id: p.id, date: p.createdAt, kind: 'charge' as const, amount: round2(p.total - p.paid),
        title: `মাল কেনা · মোট ${formatCurrency(p.total)}`,
        sub: [p.items.map(i => `${i.productName} ${i.quantity}${unitBn(i.unit)}`).join(', '), p.note, p.paid > 0 ? `দেওয়া ${formatCurrency(p.paid)}` : '']
          .filter(Boolean).join(' · '),
        onDelete: () => setDeletePurchaseId(p.id),
      })),
      ...payments.filter(p => p.supplierId === detailsId).map(p => ({
        id: p.id, date: p.createdAt, kind: 'payment' as const, amount: p.amount,
        title: 'পেমেন্ট দিয়েছেন', sub: p.note || undefined,
        onDelete: () => setDeletePayId(p.id),
      })),
    ]);
  }, [detailsId, purchases, payments]);
  const boughtTotal = purchases.filter(p => p.supplierId === detailsId).reduce((a, p) => a + p.total, 0);
  const givenTotal = purchases.filter(p => p.supplierId === detailsId).reduce((a, p) => a + p.paid, 0)
    + payments.filter(p => p.supplierId === detailsId).reduce((a, p) => a + p.amount, 0);

  const lastPay = useMemo(() => {
    const m: Record<string, { createdAt: string; amount: number }> = {};
    payments.forEach(p => {
      if (!m[p.supplierId] || new Date(p.createdAt) > new Date(m[p.supplierId].createdAt)) m[p.supplierId] = p;
    });
    return m;
  }, [payments]);

  const submitSupplier = () => {
    if (!form.name.trim()) {
      toast({ title: 'নাম দিতে হবে', variant: 'destructive' });
      return;
    }
    addSupplier({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
    toast({ title: 'সরবরাহকারী যোগ হয়েছে' });
    setAddOpen(false);
    setForm({ name: '', phone: '', address: '' });
  };

  const openPay = (id: string) => { setPayId(id); setPayAmount(''); setPayNote(''); setPayDate(todayStr()); };

  const submitPayment = () => {
    const amount = Number(payAmount);
    if (!paySupplier || !(amount > 0)) {
      toast({ title: 'সঠিক টাকার পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    if (amount > payDue) {
      toast({ title: 'পরিমাণ বেশি', description: `এখন দিতে হবে ${formatCurrency(payDue)}`, variant: 'destructive' });
      return;
    }
    addSupplierPayment({
      supplierId: paySupplier.id, supplierName: paySupplier.name, amount, note: payNote.trim(),
      createdAt: dateStrToIso(payDate),
    });
    toast({ title: 'পেমেন্ট সেভ হয়েছে', description: formatCurrency(amount) });
    setPayId(null);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2">
        <SearchBar value={search} onChange={setSearch} placeholder="সরবরাহকারী খুঁজুন…" />
        <Button variant="outline" className="h-10 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus /> <span className="max-sm:hidden">সরবরাহকারী যোগ</span><span className="sm:hidden">যোগ</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <StatCard label="সরবরাহকারীর পাওনা" value={formatCurrency(totalDue)} sub="আপনি দেবেন" icon={Wallet} tone={totalDue > 0 ? 'orange' : 'gray'} />
        <Button className={`h-full min-h-[84px] flex-col gap-1 rounded-xl text-sm ${PRIMARY_BTN}`} onClick={() => setPurchaseFor('')}>
          <Truck className="!h-5 !w-5" /> মাল কেনা
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-0">
          <EmptyState icon={Truck} text={suppliers.length ? 'কোনো সরবরাহকারী পাওয়া যায়নি' : 'এখনো কোনো সরবরাহকারী নেই'}
            action={!suppliers.length && <Button size="sm" className={PRIMARY_BTN} onClick={() => setAddOpen(true)}>প্রথম সরবরাহকারী যোগ করুন</Button>} />
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {filtered.map(s => {
            const due = Math.max(0, dues[s.id] ?? 0);
            return (
              <div key={s.id} className={`rounded-xl border bg-white p-3 shadow-sm ${due > 0 ? 'border-amber-200 bg-amber-50/50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />{s.phone}
                      </a>
                    )}
                    {s.address && <p className="truncate text-xs text-slate-400">{s.address}</p>}
                    {lastPay[s.id] && (
                      <p className="mt-0.5 text-[11px] text-emerald-700">
                        সর্বশেষ পেমেন্ট: {fmt(new Date(lastPay[s.id].createdAt), 'd MMM')} · {formatCurrency(lastPay[s.id].amount)}
                      </p>
                    )}
                  </div>
                  <Badge variant={due > 0 ? 'destructive' : 'secondary'} className="shrink-0 text-[10px]">
                    {due > 0 ? `দিতে হবে ${formatCurrency(due)}` : 'পাওনা নেই'}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" className="h-9 flex-1 text-xs" onClick={() => setDetailsId(s.id)}>খাতা</Button>
                  <Button variant="outline" className="h-9 text-xs" onClick={() => setPurchaseFor(s.id)}>মাল কেনা</Button>
                  {due > 0 && (
                    <Button className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-700" onClick={() => openPay(s.id)}>পেমেন্ট</Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`মুছুন ${s.name}`} onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add supplier */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false); }}>
        <DialogContent className={`${SHEET} sm:max-w-md`}>
          <DialogHeader><DialogTitle>নতুন সরবরাহকারী</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitSupplier(); }}>
            <div className="space-y-1.5"><Label htmlFor="s-name">নাম *</Label>
              <Input id="s-name" className="h-11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-phone">ফোন</Label>
              <Input id="s-phone" type="tel" inputMode="tel" className="h-11" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-addr">ঠিকানা</Label>
              <Input id="s-addr" className="h-11" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <FormActions onCancel={() => setAddOpen(false)} label="যোগ করুন" />
          </form>
        </DialogContent>
      </Dialog>

      {/* Khata */}
      <Dialog open={!!detailsId} onOpenChange={o => { if (!o) setDetailsId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-lg`}>
          <DialogHeader><DialogTitle>{detailsSupplier?.name}</DialogTitle></DialogHeader>
          {detailsSupplier && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {detailsSupplier.phone && (
                  <a href={`tel:${detailsSupplier.phone}`} className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{detailsSupplier.phone}</a>
                )}
                {detailsSupplier.address && <span>{detailsSupplier.address}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                <div><p className="text-slate-500">মোট কেনা</p><p className="font-semibold">{formatCurrency(boughtTotal)}</p></div>
                <div><p className="text-slate-500">মোট দিয়েছেন</p><p className="font-semibold text-emerald-600">{formatCurrency(givenTotal)}</p></div>
                <div><p className="text-slate-500">এখন দিতে হবে</p><p className="font-semibold text-red-600">{formatCurrency(Math.max(0, dues[detailsSupplier.id] ?? 0))}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10" onClick={() => { const id = detailsSupplier.id; setDetailsId(null); setPurchaseFor(id); }}>মাল কেনা</Button>
                {(dues[detailsSupplier.id] ?? 0) > 0 ? (
                  <Button className="h-10 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { const id = detailsSupplier.id; setDetailsId(null); openPay(id); }}>পেমেন্ট দিন</Button>
                ) : <span />}
              </div>
              <p className="text-xs font-medium text-slate-500">হিসাবের খাতা (কবে কী হয়েছে)</p>
              <Ledger entries={ledger} emptyText="এখনো কোনো লেনদেন নেই" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay supplier */}
      <Dialog open={!!payId} onOpenChange={o => { if (!o) setPayId(null); }}>
        <DialogContent className={`${SHEET} sm:max-w-sm`}>
          <DialogHeader><DialogTitle>পেমেন্ট দিন{paySupplier && ` · ${paySupplier.name}`}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitPayment(); }}>
            <p className="text-sm">এখন দিতে হবে: <span className="font-bold text-red-600">{formatCurrency(payDue)}</span></p>
            <div className="space-y-1.5">
              <Label htmlFor="sp-amt">টাকার পরিমাণ (৳)</Label>
              <div className="flex gap-2">
                <Input id="sp-amt" inputMode="decimal" className="h-11" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setPayAmount(String(payDue))}>পুরো</Button>
              </div>
            </div>
            <DateField id="sp-date" value={payDate} onChange={setPayDate} label="কোন তারিখে দিলেন" />
            <div className="space-y-1.5">
              <Label htmlFor="sp-note">নোট</Label>
              <Input id="sp-note" className="h-11" placeholder="ঐচ্ছিক" value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
            <FormActions onCancel={() => setPayId(null)} label="সেভ করুন" submitClass="bg-emerald-600 text-white hover:bg-emerald-700" />
          </form>
        </DialogContent>
      </Dialog>

      <PurchaseDialog open={purchaseFor !== null} onClose={() => setPurchaseFor(null)} supplierId={purchaseFor || undefined} />

      <ConfirmDialog
        open={!!deleteId} title="সরবরাহকারী মুছবেন?" description="তার হিসাবের খাতাও আর দেখা যাবে না।"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) { deleteSupplier(deleteId); toast({ title: 'সরবরাহকারী মুছে ফেলা হয়েছে' }); }
          setDeleteId(null);
        }}
      />
      <ConfirmDialog
        open={!!deletePurchaseId} title="এই মাল কেনা মুছবেন?" description="কেনা পণ্যের স্টক আবার কমে যাবে।"
        onCancel={() => setDeletePurchaseId(null)}
        onConfirm={() => {
          if (deletePurchaseId) { deletePurchase(deletePurchaseId); toast({ title: 'মাল কেনা মুছে ফেলা হয়েছে' }); }
          setDeletePurchaseId(null);
        }}
      />
      <ConfirmDialog
        open={!!deletePayId} title="এই পেমেন্ট মুছবেন?" description="সরবরাহকারীর পাওনা আবার বেড়ে যাবে।"
        onCancel={() => setDeletePayId(null)}
        onConfirm={() => {
          if (deletePayId) { deleteSupplierPayment(deletePayId); toast({ title: 'পেমেন্ট মুছে ফেলা হয়েছে' }); }
          setDeletePayId(null);
        }}
      />
    </div>
  );
}
