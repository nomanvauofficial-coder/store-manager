'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

type Status = 'checking' | 'signed-out' | 'denied' | 'error' | 'ready';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white">
            <Package className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-bold">Store Manager</h1>
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
      setMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setBusy(true);
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ type: 'error', text: error.message });
    else if (mode === 'up' && !data.session)
      setMsg({ type: 'info', text: 'Account created. Check your email to confirm, then sign in.' });
  };

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required className="h-11"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required className="h-11"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</p>
        )}
        <Button type="submit" disabled={busy} className="h-11 w-full bg-purple-600 text-white hover:bg-purple-700">
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </Button>
        <button type="button" className="w-full text-center text-sm text-purple-700"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
          {mode === 'in' ? 'First time? Create account' : 'Already have an account? Sign in'}
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-gray-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
        <p className="text-sm text-gray-500">Loading Store Manager…</p>
      </div>
    );

  if (status === 'signed-out') return <LoginForm />;

  if (status === 'denied' || status === 'error')
    return (
      <Shell>
        <p className="text-sm text-gray-700">
          {status === 'denied'
            ? 'This account does not have access to this store. Ask the owner to give you access, or sign in with the owner account.'
            : `Could not connect: ${errorText}`}
        </p>
        <div className="mt-4 flex gap-2">
          {status === 'error' && (
            <Button className="h-11 flex-1 bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => { currentUser.current = null; supabase.auth.getSession().then(({ data }) => enter(data.session?.user.id ?? null)); }}>
              Retry
            </Button>
          )}
          <Button variant="outline" className="h-11 flex-1" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </Shell>
    );

  return <>{children}</>;
}
