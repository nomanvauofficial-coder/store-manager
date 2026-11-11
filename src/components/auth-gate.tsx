'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

// Supabase sends English error messages; show the common ones in Bangla
function bnAuthError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'ইমেইল বা পাসওয়ার্ড ভুল হয়েছে';
  if (m.includes('already registered')) return 'এই ইমেইলে আগেই অ্যাকাউন্ট খোলা আছে';
  if (m.includes('not confirmed')) return 'ইমেইল এখনো কনফার্ম করা হয়নি';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'নতুন অ্যাকাউন্ট খোলা বন্ধ আছে';
  if (m.includes('rate limit') || m.includes('too many')) return 'অনেকবার চেষ্টা করা হয়েছে, একটু পরে আবার করুন';
  if (m.includes('valid email') || m.includes('invalid email')) return 'সঠিক ইমেইল দিন';
  if (m.includes('password')) return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
  if (m.includes('fetch') || m.includes('network')) return 'ইন্টারনেট সংযোগ দেখুন';
  return `সমস্যা হয়েছে: ${msg}`;
}

type Status = 'checking' | 'signed-out' | 'denied' | 'error' | 'ready';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white">
            <Package className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-bold">স্টোর ম্যানেজার</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (password.length < 6) {
      setMsg({ type: 'error', text: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
      return;
    }
    setBusy(true);
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: bnAuthError(error.message) });
    else if (mode === 'up' && !data.session)
      setMsg({ type: 'info', text: 'অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল কনফার্ম করে তারপর সাইন ইন করুন।' });
  };

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">ইমেইল</Label>
          <Input id="email" type="email" autoComplete="email" required className="h-11"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">পাসওয়ার্ড</Label>
          <Input id="password" type="password" required className="h-11"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{msg.text}</p>
        )}
        <Button type="submit" disabled={busy} className="h-11 w-full bg-blue-700 text-white hover:bg-blue-800">
          {busy ? 'অপেক্ষা করুন…' : mode === 'in' ? 'সাইন ইন' : 'অ্যাকাউন্ট খুলুন'}
        </Button>
        <button type="button" className="w-full text-center text-sm text-blue-700"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'প্রথমবার? অ্যাকাউন্ট খুলুন' : 'অ্যাকাউন্ট আছে? সাইন ইন করুন'}
        </button>
      </form>
    </Shell>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [errorText, setErrorText] = useState('');
  const currentUser = useRef<string | null>(null);

  const enter = async (userId: string | null) => {
    if (!userId) {
      currentUser.current = null;
      useStore.getState().stop();
      setStatus('signed-out');
      return;
    }
    if (currentUser.current === userId && useStore.getState()._loaded) return; // already inside
    currentUser.current = userId;
    setStatus('checking');
    const { data: isMember, error } = await supabase.rpc('claim_store');
    if (error) {
      setErrorText(error.message);
      setStatus('error');
      return;
    }
    if (!isMember) {
      setStatus('denied');
      return;
    }
    await useStore.getState().start();
    setStatus('ready');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => enter(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setTimeout(() => enter(session?.user.id ?? null), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking')
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
        <p className="text-sm text-slate-500">স্টোর ম্যানেজার লোড হচ্ছে…</p>
      </div>
    );

  if (status === 'signed-out') return <LoginForm />;

  if (status === 'denied' || status === 'error')
    return (
      <Shell>
        <p className="text-sm text-slate-700">
          {status === 'denied'
            ? 'এই অ্যাকাউন্টের এই দোকানে প্রবেশের অনুমতি নেই। মালিকের কাছ থেকে অনুমতি নিন, অথবা মালিকের অ্যাকাউন্টে সাইন ইন করুন।'
            : `সংযোগ করা যায়নি: ${errorText}`}
        </p>
        <div className="mt-4 flex gap-2">
          {status === 'error' && (
            <Button className="h-11 flex-1 bg-blue-700 text-white hover:bg-blue-800"
              onClick={() => { currentUser.current = null; supabase.auth.getSession().then(({ data }) => enter(data.session?.user.id ?? null)); }}>
              আবার চেষ্টা করুন
            </Button>
          )}
          <Button variant="outline" className="h-11 flex-1" onClick={() => supabase.auth.signOut()}>সাইন আউট</Button>
        </div>
      </Shell>
    );

  return <>{children}</>;
}
