'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { ReturnItem, Sale, SaleReturn } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Trash2, Undo2 } from 'lucide-react';
import { fmt, formatCurrency, SHEET, PRIMARY_BTN, EmptyState, useCustomerDues, unitBn } from '@/components/shared';

const r2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* Take goods back from a sale                                         */
/* ------------------------------------------------------------------ */

export function ReturnDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const returns = useStore(s => s.returns);
  const addReturn = useStore(s => s.addReturn);
  const { map: dues } = useCustomerDues();

  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<'due' | 'cash'>('cash');

  // how much of each product was already brought back from THIS sale
  const alreadyBack = useMemo(() => {
    const m: Record<string, number> = {};
    if (sale) returns.filter(r => r.saleId === sale.id).forEach(r => r.items.forEach(i => { m[i.productId] = (m[i.productId] || 0) + i.quantity; }));
    return m;
  }, [returns, sale]);

  const customerDue = sale?.customerId ? Math.max(0, dues[sale.customerId] ?? 0) : 0;

  useEffect(() => {
    if (sale) {
      setQtys({});
      setMethod(customerDue > 0 ? 'due' : 'cash');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id]);

  if (!sale) return null;

  // the bill's discount is shared across the items, so a returned item is worth a little less than its shelf price
  const itemsSubtotal = sale.items.reduce((a, i) => a + i.subtotal, 0);
  const factor = itemsSubtotal > 0 ? sale.total / itemsSubtotal : 1;

  const lines = sale.items.map(i => {
    const remaining = r2(i.quantity - (alreadyBack[i.productId] || 0));
    const q = Number(qtys[i.productId] || 0);
    return { item: i, remaining, q, value: q > 0 ? r2(q * i.price * factor) : 0 };
  });

  const value = r2(lines.reduce((a, l) => a + l.value, 0));
  const credit = method === 'due' ? Math.min(value, customerDue) : 0;
  const cashBack = r2(value - credit);

  const submit = () => {
    for (const l of lines) {
      if (l.q > l.remaining || l.q < 0) {
        toast({ title: 'ফেরতের পরিমাণ বেশি', description: `${l.item.productName}: সর্বোচ্চ ${l.remaining}`, variant: 'destructive' });
        return;
      }
      if (l.q > 0 && l.item.pricingType !== 'weight' && !Number.isInteger(l.q)) {
        toast({ title: 'পূর্ণ সংখ্যা দিন', description: l.item.productName, variant: 'destructive' });
        return;
      }
    }
    const items: ReturnItem[] = lines.filter(l => l.q > 0).map(l => ({
      productId: l.item.productId, productName: l.item.productName, quantity: l.q, price: l.item.price,
      costPrice: l.item.costPrice ?? 0, subtotal: l.value, pricingType: l.item.pricingType, unit: l.item.unit,
    }));
    if (items.length === 0) {
      toast({ title: 'কোন পণ্য ফেরত এসেছে?', description: 'অন্তত একটি পণ্যের পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    addReturn({
      saleId: sale.id, customerId: sale.customerId, customerName: sale.customerName,
      items, total: value, credit, note: '',
    });
    toast({
      title: 'পণ্য ফেরত নেওয়া হয়েছে',
      description: cashBack > 0 ? `নগদ ফেরত দিন ${formatCurrency(cashBack)}` : credit > 0 ? `বাকি থেকে ${formatCurrency(credit)} কাটা হয়েছে` : undefined,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${SHEET} sm:max-w-lg`}>
        <DialogHeader><DialogTitle>পণ্য ফেরত</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {fmt(new Date(sale.createdAt), 'd MMM yyyy, h:mm a')}
            {sale.customerName && ` · ${sale.customerName}`} · বিল {formatCurrency(sale.total)}
          </p>

          <ul className="divide-y rounded-lg border">
            {lines.map(l => (
              <li key={l.item.productId} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.item.productName}</p>
                  <p className="text-[11px] text-slate-500">
                    কেনা {l.item.quantity} {unitBn(l.item.unit)} × {formatCurrency(l.item.price)}
                    {l.remaining < l.item.quantity && ` · ফেরত হয়েছে ${r2(l.item.quantity - l.remaining)}`}
                  </p>
                </div>
                {l.remaining > 0 ? (
                  <div className="w-24 shrink-0">
                    <Input inputMode="decimal" placeholder={`০–${l.remaining}`} aria-label={`${l.item.productName} ফেরত পরিমাণ`}
                      className="h-10 text-right" value={qtys[l.item.productId] ?? ''}
                      onChange={e => setQtys({ ...qtys, [l.item.productId]: e.target.value })} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">সব ফেরত</span>
                )}
              </li>
            ))}
          </ul>

          {sale.customerId && customerDue > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={method === 'due' ? 'default' : 'outline'} className="h-11 text-xs" onClick={() => setMethod('due')}>
                বাকি থেকে কাটুন
              </Button>
              <Button type="button" variant={method === 'cash' ? 'default' : 'outline'} className="h-11 text-xs" onClick={() => setMethod('cash')}>
                নগদ ফেরত দিন
              </Button>
            </div>
          )}

          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">ফেরত পণ্যের মূল্য</span><span className="font-semibold">{formatCurrency(value)}</span></div>
            {credit > 0 && (
              <div className="flex justify-between"><span className="text-slate-600">বাকি থেকে কাটা হবে</span><span className="font-medium text-emerald-600">{formatCurrency(credit)}</span></div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>নগদ ফেরত দিতে হবে</span><span className={cashBack > 0 ? 'text-red-600' : ''}>{formatCurrency(cashBack)}</span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-white px-4 pt-3 sm:mx-0 sm:px-0">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>বাতিল</Button>
          <Button type="button" className={`h-11 flex-1 ${PRIMARY_BTN}`} onClick={submit}>ফেরত নিন</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* List of returns                                                     */
/* ------------------------------------------------------------------ */

export function ReturnsList({ returns, onDelete }: { returns: SaleReturn[]; onDelete: (id: string) => void }) {
  if (returns.length === 0) return <EmptyState icon={Undo2} text="এখনো কোনো পণ্য ফেরত নেই" />;
  return (
    <ul className="divide-y">
      {returns.map(r => (
        <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {r.items.map(i => `${i.productName} ${i.quantity}${unitBn(i.unit)}`).join(', ')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {fmt(new Date(r.createdAt), 'd MMM, h:mm a')}
              {r.customerName && ` · ${r.customerName}`}
              {r.credit > 0 && ` · বাকি থেকে কাটা ${formatCurrency(r.credit)}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-red-600">−{formatCurrency(r.total)}</span>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="ফেরত মুছুন" onClick={() => onDelete(r.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
