import { useEffect, useState } from 'react';

// Free, open product databases (no key needed, they allow requests from web pages).
// Food first, then beauty/personal care, then general products.
const SOURCES = [
  { host: 'world.openfoodfacts.org', label: 'Open Food Facts' },
  { host: 'world.openbeautyfacts.org', label: 'Open Beauty Facts' },
  { host: 'world.openproductsfacts.org', label: 'Open Products Facts' },
] as const;

export interface BarcodeInfo {
  name: string;
  source: string;
}

type CacheEntry = { t: number; info: BarcodeInfo | null };
const CACHE_KEY = 'sm-barcode-cache';
const FOUND_DAYS = 30;
const MISSING_DAYS = 1; // a missing product may be added to the database later

const readCache = (): Record<string, CacheEntry> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};
const writeCache = (code: string, info: BarcodeInfo | null) => {
  try {
    const c = readCache();
    c[code] = { t: Date.now(), info };
    const keys = Object.keys(c);
    if (keys.length > 500) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 500).forEach(k => delete c[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* ignore */ }
};

type Raw = { product_name?: string; product_name_en?: string; product_name_bn?: string; generic_name?: string; brands?: string; quantity?: string };

// "Pran" + "Potato Crackers" + "60 g"  ->  "Pran Potato Crackers 60 g"
export function composeName(p: Raw): string {
  const base = (p.product_name_bn || p.product_name || p.product_name_en || p.generic_name || '').trim();
  const brand = (p.brands || '').split(',')[0].trim();
  const qty = (p.quantity || '').trim();
  if (!base && !brand) return '';
  let name = base;
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = `${brand} ${name}`.trim();
  if (qty && !name.toLowerCase().includes(qty.toLowerCase())) name = `${name} ${qty}`.trim();
  return name;
}

async function ask(host: string, code: string, signal: AbortSignal): Promise<Raw | null> {
  const fields = 'product_name,product_name_en,product_name_bn,generic_name,brands,quantity';
  const res = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`status ${res.status}`);
  const json = await res.json();
  return json?.status === 1 && json.product ? (json.product as Raw) : null;
}

/** Looks the barcode up online. `error` is set when the internet (or the database) could not be reached. */
export async function lookupBarcode(code: string): Promise<{ info: BarcodeInfo | null; error?: 'offline' }> {
  const hit = readCache()[code];
  if (hit && Date.now() - hit.t < (hit.info ? FOUND_DAYS : MISSING_DAYS) * 86400000) return { info: hit.info };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const results = await Promise.allSettled(SOURCES.map(s => ask(s.host, code, ctl.signal)));
    if (results.every(r => r.status === 'rejected')) return { info: null, error: 'offline' };
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const name = composeName(r.value);
        if (name) {
          const info = { name, source: SOURCES[i].label };
          writeCache(code, info);
          return { info };
        }
      }
    }
    writeCache(code, null);
    return { info: null };
  } finally {
    clearTimeout(timer);
  }
}

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; info: BarcodeInfo }
  | { status: 'none' }
  | { status: 'offline' };

export function useBarcodeLookup(code: string | null): LookupState {
  const [state, setState] = useState<LookupState>({ status: 'idle' });
  useEffect(() => {
    if (!code) { setState({ status: 'idle' }); return; }
    let live = true;
    setState({ status: 'loading' });
    lookupBarcode(code).then(r => {
      if (!live) return;
      setState(r.info ? { status: 'found', info: r.info } : r.error ? { status: 'offline' } : { status: 'none' });
    });
    return () => { live = false; };
  }, [code]);
  return state;
}
