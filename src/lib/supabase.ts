import { createClient } from '@supabase/supabase-js';

// These two values are public by design (safe to keep in the code).
// Your data is protected by login + row level security in the database.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fobesdykkmsdyhbpvzoe.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BwVwLDrdkq3XYmQnq6jIAg_9zGnRYL3';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
