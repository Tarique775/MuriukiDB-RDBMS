// Centralized session cache to prevent repeated getSession() calls
// This reduces auth token refresh storms that cause unexpected logouts

import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface SessionCache {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  userId: string | null;
  lastUpdated: number;
  isInitialized: boolean;
}

const cache: SessionCache = {
  session: null,
  user: null,
  accessToken: null,
  userId: null,
  lastUpdated: 0,
  isInitialized: false,
};

// Initialize and subscribe to auth changes once
let subscriptionInitialized = false;

export function initSessionCache(): void {
  if (subscriptionInitialized) return;
  subscriptionInitialized = true;

  // Subscribe to auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    updateCache(session);
  });

  // Initial session fetch
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateCache(session);
    cache.isInitialized = true;
  });
}

function updateCache(session: Session | null): void {
  cache.session = session;
  cache.user = session?.user ?? null;
  cache.accessToken = session?.access_token ?? null;
  cache.userId = session?.user?.id ?? null;
  cache.lastUpdated = Date.now();
}

// Synchronous getters - use these in hot paths
export function getCachedUserId(): string | null {
  return cache.userId;
}

export function getCachedAccessToken(): string | null {
  return cache.accessToken;
}

export function getCachedSession(): Session | null {
  return cache.session;
}

export function getCachedUser(): User | null {
  return cache.user;
}

export function isSessionInitialized(): boolean {
  return cache.isInitialized;
}

// Async getter - only use when cache might be empty (startup)
export async function ensureSession(): Promise<Session | null> {
  if (cache.isInitialized && cache.lastUpdated > 0) {
    return cache.session;
  }

  // Fallback: fetch fresh session
  const { data: { session } } = await supabase.auth.getSession();
  updateCache(session);
  cache.isInitialized = true;
  return session;
}

// Force refresh - use sparingly
export async function refreshSessionCache(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  updateCache(session);
  return session;
}

// Export for testing
export function __resetCache(): void {
  cache.session = null;
  cache.user = null;
  cache.accessToken = null;
  cache.userId = null;
  cache.lastUpdated = 0;
  cache.isInitialized = false;
}
