import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 8 } },
    })
  : null;

export const siteName = import.meta.env.VITE_SITE_NAME || 'Atelier After Dark';
export const ownerName = import.meta.env.VITE_OWNER_DISPLAY_NAME || 'The Owner';
export const ownerTagline = import.meta.env.VITE_OWNER_TAGLINE || 'Sensual portraits, artistic nudes and private conversations — shared on my terms.';
