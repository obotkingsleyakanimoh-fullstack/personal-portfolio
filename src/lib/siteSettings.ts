import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type AssetSlot = 'home_hero' | 'home_intro' | 'home_membership' | 'about_hero' | 'checkout_feature' | 'videos_feature' | 'auth_hero';
export type SiteMediaType = 'image' | 'video';

export interface SiteAsset {
  slot: AssetSlot;
  label: string;
  description: string;
  media_type: SiteMediaType;
  storage_path: string | null;
  source_content_id: string | null;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  deep: string;
  highlight: string;
  border: string;
}

export const defaultSiteTheme: SiteTheme = {
  primary: '#98506A',
  accent: '#D79AAA',
  background: '#F7EFE8',
  surface: '#FFF9F4',
  text: '#30212A',
  muted: '#8E777D',
  deep: '#291A25',
  highlight: '#D7B19B',
  border: '#E8D8D0',
};

export const fallbackSiteAssets: Record<AssetSlot, SiteAsset> = {
  home_hero: { slot: 'home_hero', label: 'Homepage hero portrait', description: 'The large portrait beside the homepage introduction.', media_type: 'image', storage_path: null, source_content_id: null, public_url: import.meta.env.VITE_OWNER_HERO_IMAGE_URL || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=82', alt_text: 'Personal portrait', sort_order: 10, is_active: true },
  home_intro: { slot: 'home_intro', label: 'Homepage introduction portrait', description: 'The portrait beside the personal introduction.', media_type: 'image', storage_path: null, source_content_id: null, public_url: import.meta.env.VITE_OWNER_PORTRAIT_URL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=82', alt_text: 'Personal portrait', sort_order: 20, is_active: true },
  home_membership: { slot: 'home_membership', label: 'Homepage membership feature', description: 'The image beside the membership invitation.', media_type: 'image', storage_path: null, source_content_id: null, public_url: import.meta.env.VITE_OWNER_FEATURE_IMAGE_URL || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=82', alt_text: 'Membership feature portrait', sort_order: 30, is_active: true },
  about_hero: { slot: 'about_hero', label: 'About page portrait', description: 'The portrait at the top of the About page.', media_type: 'image', storage_path: null, source_content_id: null, public_url: import.meta.env.VITE_OWNER_PORTRAIT_URL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=82', alt_text: 'Personal portrait', sort_order: 40, is_active: true },
  checkout_feature: { slot: 'checkout_feature', label: 'Membership checkout portrait', description: 'The portrait inside the membership checkout sidebar.', media_type: 'image', storage_path: null, source_content_id: null, public_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85', alt_text: 'Private collection portrait', sort_order: 50, is_active: true },
  videos_feature: { slot: 'videos_feature', label: 'Videos page featured media', description: 'Featured cover image or short, public-safe video teaser above the video library.', media_type: 'image', storage_path: null, source_content_id: null, public_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&q=82', alt_text: 'Private film collection preview', sort_order: 60, is_active: true },
  auth_hero: { slot: 'auth_hero', label: 'Login and registration visual', description: 'The large image beside the sign-in and registration form.', media_type: 'image', storage_path: null, source_content_id: null, public_url: import.meta.env.VITE_OWNER_PORTRAIT_URL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=82', alt_text: 'Personal portrait', sort_order: 70, is_active: true },
};

export const loadingSiteAssets: Record<AssetSlot, SiteAsset> = Object.fromEntries(Object.entries(fallbackSiteAssets).map(([key, value]) => [key, { ...value, public_url: '' }])) as Record<AssetSlot, SiteAsset>;

export const siteAssetSlots: Array<{ slot: AssetSlot; label: string; description: string; allowVideo: boolean; altText: string }> = [
  { slot: 'home_hero', label: 'Homepage hero portrait', description: 'Large image or muted feature video on the right side of the homepage opening section.', allowVideo: true, altText: 'Homepage personal portrait' },
  { slot: 'home_intro', label: 'Homepage introduction portrait', description: 'Portrait or muted feature video beside the personal introduction section.', allowVideo: true, altText: 'Personal introduction portrait' },
  { slot: 'home_membership', label: 'Homepage membership feature', description: 'Image or muted feature video beside the membership invitation section.', allowVideo: true, altText: 'Membership feature portrait' },
  { slot: 'about_hero', label: 'About page portrait', description: 'Portrait or muted feature video displayed at the top of the About page.', allowVideo: true, altText: 'About page portrait' },
  { slot: 'checkout_feature', label: 'Membership checkout portrait', description: 'Image or muted feature video in the membership checkout sidebar.', allowVideo: true, altText: 'Membership checkout portrait' },
  { slot: 'videos_feature', label: 'Videos page featured media', description: 'Featured image or short public-safe video teaser above the video library.', allowVideo: true, altText: 'Featured video collection media' },
  { slot: 'auth_hero', label: 'Login and registration visual', description: 'Large portrait or muted feature video beside the sign-in and registration form.', allowVideo: true, altText: 'Login and registration portrait' },
];

export function useSiteAssets() {
  return useQuery({
    queryKey: ['site-assets'],
    queryFn: async (): Promise<Record<AssetSlot, SiteAsset>> => {
      if (!supabase) return fallbackSiteAssets;
      const { data, error } = await supabase.from('site_assets').select('slot,label,description,media_type,storage_path,source_content_id,public_url,alt_text,sort_order,is_active').eq('is_active', true).order('sort_order');
      if (error) throw error;
      const merged = { ...fallbackSiteAssets };
      for (const row of (data ?? []) as SiteAsset[]) {
        if (row.slot in merged) merged[row.slot] = { ...merged[row.slot], ...row };
      }
      return merged;
    },
    staleTime: 60_000,
  });
}

export function useSiteTheme() {
  return useQuery({
    queryKey: ['site-theme'],
    queryFn: async (): Promise<SiteTheme> => {
      if (!supabase) return defaultSiteTheme;
      const { data, error } = await supabase.from('site_appearance').select('theme').eq('id', true).maybeSingle();
      if (error) throw error;
      return { ...defaultSiteTheme, ...((data?.theme || {}) as Partial<SiteTheme>) };
    },
    staleTime: 60_000,
  });
}
