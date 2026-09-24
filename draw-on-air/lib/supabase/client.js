import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if ((!supabaseUrl || !supabaseAnonKey) && process.env.NODE_ENV === 'development') {
  console.warn(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

function getSafeStorage() {
  if (typeof window === 'undefined') return undefined;
  try {
    const testKey = '__sb_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    const store = new Map();
    return {
      getItem: (key) => store.get(key) || null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
  }
}

/**
 * Browser-side Supabase client (singleton)
 * Uses the anon key — safe for client-side use
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      storage: getSafeStorage(),
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 40,
      },
    },
  }
);

