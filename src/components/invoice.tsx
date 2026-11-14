'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import type { Customer, DuePayment, Sale } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { FileDown, Printer, Store } from 'lucide-react';
import { fmt, formatCurrency, SHEET, PRIMARY_BTN, saleLines, type InvoiceLine } from '@/components/shared';

/* ------------------------------------------------------------------ */
/* Invoice data                                                        */
/* ------------------------------------------------------------------ */

export interface InvoiceSection {
  id: string;
  date: string;
  kind: 'sale' | 'payment';
  title: string;
  lines?: InvoiceLine[];
  amount: number;
  balance?: number; // running balance after this entry (statements)
  note?: string;
}

export interface InvoiceDoc {
  title: string; // "ইনভয়েস" or "হিসাবের বিবরণী"
  number: string;
  date: string;
  customer?: { name: string; phone?: string; address?: string };
  sections: InvoiceSection[];
  showBalance: boolean;
  summary: { label: string; value: number; strong?: boolean; tone?: 'red' | 'green' }[];
  fileName: string;
}

// Customer's total due right after a given moment (due sales minus payments up to then)
export function customerBalanceAt(customerId: string, upTo: string, sales: Sale[], payments: DuePayment[]) {
  const t = new Date(upTo).getTime();
  const charged = sales
    .filter(s => s.customerId === customerId && s.paymentType === 'due' && new Date(s.createdAt).getTime() <= t)
    .reduce((a, s) => a + s.total, 0);
  const paid = payments
    .filter(p => p.customerId === customerId && new Date(p.createdAt).getTime() <= t)
    .reduce((a, p) => a + p.amount, 0);
  return charged - paid;
}

const ymd = (iso: string | Date) => fmt(new Date(iso), 'yyyyMMdd');

// File names must be plain English letters/digits: a Bangla name makes the browser drop the ".pdf" ending
const safeName = (s?: string) => (s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// One sale -> one invoice. balanceAfter = customer's total due right after this sale (for due sales).
export function buildSaleInvoice(sale: Sale, customer?: Customer, balanceAfter?: number): InvoiceDoc {
  const isDue = sale.paymentType === 'due';
  const before = isDue && balanceAfter !== undefined ? Math.max(0, balanceAfter - sale.total) : undefined;
  const summary: InvoiceDoc['summary'] = [];
  if (isDue) {
    summary.push({ label: 'এই বিক্রি (বাকি)', value: sale.total });
    if (before !== undefined && before > 0) summary.push({ label: 'আগের বাকি', value: before });
    if (balanceAfter !== undefined) summary.push({ label: 'মোট বাকি', value: Math.max(0, balanceAfter), strong: true, tone: 'red' });
  } else {
    summary.push({ label: 'মোট', value: sale.total, strong: true });
    summary.push({ label: 'পরিশোধ (নগদ)', value: sale.total, tone: 'green' });
  }
  const name = customer?.name || sale.customerName;
  return {
    title: 'ইনভয়েস',
    number: `INV-${ymd(sale.createdAt)}-${sale.id.slice(-4).toUpperCase()}`,
    date: sale.createdAt,
    customer: name ? { name, phone: customer?.phone, address: customer?.address } : undefined,
    sections: [{
      id: sale.id, date: sale.createdAt, kind: 'sale',
      title: isDue ? 'বাকিতে বিক্রি' : 'নগদ বিক্রি', lines: saleLines(sale), amount: sale.total,
    }],
    showBalance: false,
    summary,
    fileName: ['invoice', safeName(name), ymd(sale.createdAt), sale.id.slice(-4).toUpperCase()].filter(Boolean).join('-'),
  };
}

// Whole khata of a customer: every due sale (with products and the price at that time), every payment, running balance.
export function buildStatement(customer: Customer, sales: Sale[], payments: DuePayment[]): InvoiceDoc {
  const rows = [
    ...sales.filter(s => s.customerId === customer.id && s.paymentType === 'due').map(s => ({
      id: s.id, date: s.createdAt, kind: 'sale' as const, title: 'বাকিতে বিক্রি', lines: saleLines(s), amount: s.total,
    })),
    ...payments.filter(p => p.customerId === customer.id).map(p => ({
      id: p.id, date: p.createdAt, kind: 'payment' as const, title: 'বাকি পরিশোধ', lines: undefined, amount: p.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = 0;
  let charged = 0;
  let paid = 0;
  const sections: InvoiceSection[] = rows.map(r => {
    if (r.kind === 'sale') { balance += r.amount; charged += r.amount; } else { balance -= r.amount; paid += r.amount; }
    return { ...r, balance };
  });

  const now = new Date();
  return {
    title: 'হিসাবের বিবরণী',
    number: `ST-${ymd(now)}`,
    date: now.toISOString(),
    customer: { name: customer.name, phone: customer.phone, address: customer.address },
    sections,
    showBalance: true,
    summary: [
      { label: 'মোট বাকিতে কেনা', value: charged },
      { label: 'মোট পরিশোধ', value: paid, tone: 'green' },
      { label: 'বর্তমান বাকি', value: Math.max(0, balance), strong: true, tone: 'red' },
    ],
    fileName: ['statement', safeName(customer.name), ymd(now)].filter(Boolean).join('-'),
  };
}

/* ------------------------------------------------------------------ */
/* The paper                                                           */
/* ------------------------------------------------------------------ */

const toneClass = (t?: 'red' | 'green') => (t === 'red' ? 'text-red-600' : t === 'green' ? 'text-emerald-600' : 'text-slate-900');

export function InvoiceView({ doc, shop }: { doc: InvoiceDoc; shop?: { name: string; phone: string; address: string; note: string } }) {
  return (
    <div className="bg-white p-5 text-[12.5px] leading-snug text-slate-900">
      {/* header */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-blue-700 pb-3">
        <div className="min-w-0">
          <p className="text-xl font-bold text-blue-700">{shop?.name || 'আমার দোকান'}</p>
          {shop?.phone && <p className="text-slate-600">ফোন: {shop.phone}</p>}
          {shop?.address && <p className="text-slate-600">{shop.address}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold">{doc.title}</p>
          <p className="text-slate-600">নং: {doc.number}</p>
          <p className="text-slate-600">তারিখ: {fmt(new Date(doc.date), 'd MMM yyyy')}</p>
        </div>
      </div>

      {/* customer */}
      {doc.customer && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] text-slate-500">প্রাপক</p>
          <p className="font-semibold">{doc.customer.name}</p>
          {doc.customer.phone && <p className="text-slate-600">ফোন: {doc.customer.phone}</p>}
          {doc.customer.address && <p className="text-slate-600">{doc.customer.address}</p>}
        </div>
      )}

      {/* entries */}
      <div className="mt-3 space-y-2.5">
        {doc.sections.length === 0 && <p className="py-6 text-center text-slate-500">কোনো লেনদেন নেই</p>}
        {doc.sections.map(s => (
          <div key={s.id} data-inv-block className="overflow-hidden rounded border border-slate-300" style={{ breakInside: 'avoid' }}>
            <div className="flex items-start justify-between gap-3 bg-slate-100 px-3 py-1.5">
              <div className="min-w-0">
                <span className="font-semibold">{s.title}</span>
                <span className="ml-2 text-slate-500">{fmt(new Date(s.date), 'd MMM yyyy, h:mm a')}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className={`font-bold ${s.kind === 'payment' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {s.kind === 'payment' ? '−' : ''}{formatCurrency(s.amount)}
                </span>
                {doc.showBalance && s.balance !== undefined && (
                  <p className="text-[11px] text-slate-500">বাকি {formatCurrency(Math.max(0, s.balance))}</p>
                )}
              </div>
            </div>
            {s.lines && s.lines.length > 0 && (
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                    <th className="px-3 py-1 font-medium">পণ্য</th>
                    <th className="px-2 py-1 text-right font-medium">পরিমাণ</th>
                    <th className="px-2 py-1 text-right font-medium">দর</th>
                    <th className="px-3 py-1 text-right font-medium">টাকা</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lines.map((l, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1">{l.name}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">{l.qty}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">{formatCurrency(l.price)}</td>
                      <td className="whitespace-nowrap px-3 py-1 text-right font-medium">{formatCurrency(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* summary */}
      <div data-inv-block className="mt-3 flex justify-end" style={{ breakInside: 'avoid' }}>
        <div className="w-full max-w-[280px] space-y-1 rounded border border-slate-300 px-3 py-2">
          {doc.summary.map(r => (
            <div key={r.label} className={`flex items-center justify-between gap-4 ${r.strong ? 'border-t border-slate-300 pt-1 text-[14px] font-bold' : ''}`}>
              <span className={r.strong ? '' : 'text-slate-600'}>{r.label}</span>
              <span className={`${toneClass(r.tone)} ${r.strong ? '' : 'font-medium'}`}>{formatCurrency(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-slate-500">{shop?.note || 'ধন্যবাদ, আবার আসবেন।'}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview dialog: print + PDF                                         */
/* ------------------------------------------------------------------ */

const PAGE_MM = { w: 210, h: 297, margin: 8 };

async function makePdf(root: HTMLElement): Promise<Blob> {
  // loaded only when someone presses the PDF button, so the app itself stays small
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const scale = canvas.width / root.offsetWidth;
  const rootTop = root.getBoundingClientRect().top;
  // page breaks are placed after whole entries, so no row is cut in half
  const cuts = Array.from(root.querySelectorAll('[data-inv-block]')).map(el => (el.getBoundingClientRect().bottom - rootTop) * scale);

  const contentW = PAGE_MM.w - PAGE_MM.margin * 2;
  const contentH = PAGE_MM.h - PAGE_MM.margin * 2;
  const pagePx = Math.floor((canvas.width * contentH) / contentW);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let y = 0;
  let page = 0;
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height);
    if (end < canvas.height) {
      const fit = cuts.filter(c => c > y + 60 && c <= end);
      if (fit.length) end = Math.max(...fit);
    }
    const h = end - y;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', PAGE_MM.margin, PAGE_MM.margin, contentW, (h * contentW) / canvas.width);
    y = end;
    page++;
  }
  return pdf.output('blob');
}

export function InvoiceDialog({ doc, onClose }: { doc: InvoiceDoc | null; onClose: () => void }) {
  const shopRow = useStore(s => s.shopSettings[0]);
  const saveShop = useStore(s => s.saveShop);
  const shop = shopRow ?? { name: '', phone: '', address: '', note: '' };
  const [editShop, setEditShop] = useState(false);
  const [form, setForm] = useState(shop);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (doc) {
      setForm(shop);
      setEditShop(!shop.name); // ask for the shop name the first time
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const printNow = () => window.print();

  const downloadPdf = async () => {
    if (!doc || !captureRef.current) return;
    setBusy(true);
    try {
      const blob = await makePdf(captureRef.current);
      const file = new File([blob], `${doc.fileName}.pdf`, { type: 'application/pdf' });
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (mobile && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: doc.title }); // WhatsApp, Messenger, Drive…
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      toast({ title: 'PDF বানানো যায়নি', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitShop = () => {
    saveShop({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), note: form.note.trim() });
    setEditShop(false);
    toast({ title: 'দোকানের তথ্য সেভ হয়েছে' });
  };

  const shownShop = editShop ? form : shop;

  return (
    <>
      <Dialog open={!!doc} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className={`${SHEET} sm:max-w-3xl`}>
          <DialogHeader><DialogTitle>{doc?.title}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <Button className={`h-11 ${PRIMARY_BTN}`} onClick={printNow}><Printer /> প্রিন্ট</Button>
            <Button variant="outline" className="h-11" onClick={downloadPdf} disabled={busy}>
              <FileDown /> {busy ? 'বানানো হচ্ছে…' : 'PDF / শেয়ার'}
            </Button>
          </div>

          <button type="button" onClick={() => setEditShop(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
            <Store className="h-3.5 w-3.5" /> {editShop ? 'দোকানের তথ্য বন্ধ করুন' : 'দোকানের নাম, ফোন, ঠিকানা বদলান'}
          </button>

          {editShop && (
            <div className="space-y-2.5 rounded-lg border bg-slate-50 p-3">
              <div className="space-y-1">
                <Label htmlFor="sh-name" className="text-xs">দোকানের নাম *</Label>
                <Input id="sh-name" className="h-10 bg-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="sh-phone" className="text-xs">ফোন</Label>
                  <Input id="sh-phone" type="tel" inputMode="tel" className="h-10 bg-white" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sh-addr" className="text-xs">ঠিকানা</Label>
                  <Input id="sh-addr" className="h-10 bg-white" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sh-note" className="text-xs">নিচের লেখা (ঐচ্ছিক)</Label>
                <Input id="sh-note" className="h-10 bg-white" placeholder="ধন্যবাদ, আবার আসবেন।" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <Button type="button" className={`h-10 w-full ${PRIMARY_BTN}`} onClick={submitShop}>দোকানের তথ্য সেভ করুন</Button>
            </div>
          )}

          <div className="max-h-[52dvh] overflow-auto rounded-lg border bg-slate-100 p-2">
            <div className="min-w-[340px] overflow-hidden rounded bg-white shadow-sm">
              {doc && <InvoiceView doc={doc} shop={shownShop} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden full-size copy of the paper: used for printing and for the PDF */}
      {doc && typeof document !== 'undefined' && createPortal(
        <div id="invoice-root" ref={captureRef}
          style={{ position: 'fixed', left: -10000, top: 0, width: 794, background: '#ffffff' }}>
          <InvoiceView doc={doc} shop={shownShop} />
        </div>,
        document.body,
      )}
    </>
  );
}
