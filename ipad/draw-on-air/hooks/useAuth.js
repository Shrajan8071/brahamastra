'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Hook to manage Supabase anonymous authentication.
 * Automatically signs in anonymously if no session exists.
 */
function getOrCreateLocalUserId() {
  if (typeof window === 'undefined') return null;
  // Use sessionStorage so each browser tab gets an independent user ID in local/fallback mode
  let id = sessionStorage.getItem('draw_on_air_user_id');
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'user-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem('draw_on_air_user_id', id);
  }
  return id;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user?.id) {
          if (mounted) {
            setUser(session.user);
            setLoading(false);
          }
          return;
        }

        // No existing session — sign in anonymously
        const { data, error: signInError } = await supabase.auth.signInAnonymously();
        
        if (!signInError && data?.user?.id) {
          if (mounted) {
            setUser(data.user);
            setLoading(false);
          }
          return;
        }

        // Fallback for custom/disabled anon auth or network issues
        const localId = getOrCreateLocalUserId();
        if (mounted) {
          setUser({ id: localId, is_anonymous: true, is_local_fallback: true });
        }
      } catch {
        const localId = getOrCreateLocalUserId();
        if (mounted) {
          setUser({ id: localId, is_anonymous: true, is_local_fallback: true });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted && session?.user?.id) {
          setUser(session.user);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const ensureAuth = useCallback(async () => {
    if (user?.id) return user;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUser(session.user);
        return session.user;
      }

      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (!signInError && data?.user?.id) {
        setUser(data.user);
        return data.user;
      }
    } catch {}

    const localId = getOrCreateLocalUserId();
    const fallbackUser = { id: localId, is_anonymous: true, is_local_fallback: true };
    setUser(fallbackUser);
    return fallbackUser;
  }, [user]);

  return { user, loading, error, ensureAuth };
}
