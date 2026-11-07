import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from './types';
import { isSupabaseConfigured, supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  isOwner: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at').eq('id', session.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  };

  useEffect(() => {
    // Capture the configured client once so TypeScript can safely narrow it
    // inside the async callbacks below.
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let alive = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user) {
        const { data: p } = await client.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at').eq('id', data.session.user.id).maybeSingle();
        if (alive) setProfile((p as Profile | null) ?? null);
      }
      if (alive) setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setProfile(null); setLoading(false); }
      else {
        window.setTimeout(async () => {
          if (!alive) return;
          const { data: p } = await client.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at').eq('id', next.user.id).maybeSingle();
          if (alive) { setProfile((p as Profile | null) ?? null); setLoading(false); }
        }, 0);
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session, user: session?.user ?? null, profile, loading,
    configured: isSupabaseConfigured, isOwner: profile?.role === 'owner',
    refreshProfile,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
