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
    const { data } = await supabase.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at,marketing_opt_in').eq('id', session.user.id).maybeSingle();
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
        const { data: p } = await client.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at,marketing_opt_in').eq('id', data.session.user.id).maybeSingle();
        if (alive) setProfile((p as Profile | null) ?? null);
      }
      if (alive) setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setProfile(null); setLoading(false); }
      else {
        // Run profile/email work outside the synchronous auth callback. OAuth
        // creates a Supabase user without an email-confirmation detour; when
        // that new account returns here, send the same Resend welcome used by
        // email/password registration. The delivery log makes this idempotent.
        window.setTimeout(async () => {
          if (!alive) return;
          const { data: p } = await client.from('profiles').select('id,full_name,username,avatar_url,role,status,created_at,marketing_opt_in').eq('id', next.user.id).maybeSingle();
          if (alive) { setProfile((p as Profile | null) ?? null); setLoading(false); }

          {
            const createdAt = Date.parse(next.user.created_at);
            const accountIsNew = Number.isFinite(createdAt) && Date.now() >= createdAt - 60_000 && Date.now() - createdAt <= 45 * 60 * 1000;
            if (accountIsNew) {
              // The registration button stores this short-lived consent before
              // leaving for Google. Existing Google accounts are not forced to
              // re-consent and their marketing preference is never switched off.
              try {
                const rawIntent = window.sessionStorage.getItem('pdm-google-signup-intent');
                if (rawIntent) {
                  const intent = JSON.parse(rawIntent) as { createdAt?: number; adultConfirmed?: boolean; marketingOptIn?: boolean };
                  const intentIsFresh = typeof intent.createdAt === 'number' && Date.now() - intent.createdAt < 15 * 60 * 1000;
                  if (intentIsFresh && intent.adultConfirmed === true) {
                    const updates: { adult_confirmed_at: string; marketing_opt_in?: boolean; full_name?: string } = {
                      adult_confirmed_at: new Date().toISOString(),
                    };
                    if (intent.marketingOptIn === true) updates.marketing_opt_in = true;
                    const fullName = String(next.user.user_metadata?.full_name || next.user.user_metadata?.name || '').trim();
                    if (fullName) updates.full_name = fullName;
                    await client.from('profiles').update(updates).eq('id', next.user.id);
                  }
                  window.sessionStorage.removeItem('pdm-google-signup-intent');
                }
              } catch (intentError) {
                console.warn('Could not apply Google signup preferences:', intentError);
              }
              try {
                const { error: welcomeError } = await client.functions.invoke('email-lifecycle', {
                  body: { action: 'signup_welcome', userId: next.user.id },
                });
                if (welcomeError) console.warn('Google account was created, but its welcome email could not be sent:', welcomeError);
              } catch (welcomeError) {
                console.warn('Google account was created, but the welcome email request failed:', welcomeError);
              }
            }
          }
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
