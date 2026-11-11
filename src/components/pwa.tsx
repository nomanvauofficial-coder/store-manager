'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share, X } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const DISMISS_KEY = 'sm-install-dismissed';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// The browser fires "beforeinstallprompt" only once and early, so it is kept at module level.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

// Mounted once in the layout: registers the service worker and catches the install event.
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallEvent;
      notify();
    };
    const onInstalled = () => { deferred = null; notify(); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}

// Small banner on the home page: "install this as an app on your phone"
export function InstallBanner() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(true);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    try { setHidden(localStorage.getItem(DISMISS_KEY) === '1'); } catch { setHidden(false); }
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const canPrompt = !!deferred;
  if (standalone || hidden || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    notify();
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
        <Download className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-slate-900">ফোনে অ্যাপের মতো ইনস্টল করুন</p>
        {canPrompt ? (
          <>
            <p className="text-xs text-slate-600">হোম স্ক্রিনে আইকন থাকবে, এক ট্যাপে খুলবে।</p>
            <Button size="sm" className="mt-2 h-9 bg-blue-700 text-white hover:bg-blue-800" onClick={install}>ইনস্টল করুন</Button>
          </>
        ) : (
          <p className="text-xs text-slate-600">
            Safari-তে নিচের <Share className="mx-0.5 inline h-3.5 w-3.5" /> শেয়ার বাটন চাপুন, তারপর
            <b> “Add to Home Screen”</b> বেছে নিন।
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="বন্ধ করুন" onClick={dismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
