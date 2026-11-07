import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { ContentItem, MembershipPlan } from './types';

export const fallbackPlans: MembershipPlan[] = [
  { id: 'silver', name: 'The Tease', slug: 'the-tease', description: 'A first glimpse of my private side: sensual portraits, selected boudoir photographs and intimate behind-the-scenes moments.', price_amount: 12, currency: 'USD', duration_days: 30, access_tier: 1, can_chat: false, benefits: ['Members-only intimate photo collection', 'Fresh private photographs added throughout the month', 'Personal updates and private behind-the-scenes notes'], featured: false, is_active: true },
  { id: 'gold', name: 'After Dark', slug: 'after-dark', description: 'A deeper look into my boudoir collection, artistic nude portraits, erotic films and private conversations with me.', price_amount: 29, currency: 'USD', duration_days: 30, access_tier: 2, can_chat: true, benefits: ['Everything included in The Tease', 'Selected private erotic films', 'Private text, photograph and voice-note exchange', 'Early access to new nude and boudoir collections'], featured: true, is_active: true },
  { id: 'vip', name: 'The Private Suite', slug: 'private-suite', description: 'My most intimate collection: VIP nude photography, private erotic films and priority one-to-one conversation with me.', price_amount: 69, currency: 'USD', duration_days: 30, access_tier: 3, can_chat: true, benefits: ['Everything included in After Dark', 'VIP nude photography and erotic film collections', 'Priority one-to-one text, photo and voice messages with me', 'Priority requests for personal audio or video sessions'], featured: false, is_active: true },
];

export const fallbackContent: ContentItem[] = [
  { id: 'story-01', title: 'Soft light, bare confidence', description: 'A public-safe preview from my personal portrait collection.', content_type: 'image', category: 'Intimate portraits', access_level: 'public', preview_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1000&auto=format&fit=crop&q=85', price_amount: null, currency: 'USD', duration_seconds: null, published_at: null },
  { id: 'story-02', title: 'Behind closed doors', description: 'An intimate boudoir set reserved for members.', content_type: 'image', category: 'Boudoir collection', access_level: 'members', preview_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=85', price_amount: null, currency: 'USD', duration_seconds: null, published_at: null },
  { id: 'story-03', title: 'The private edit', description: 'An exclusive artistic nude and intimate photography set.', content_type: 'image', category: 'VIP pictures', access_level: 'vip', preview_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1000&auto=format&fit=crop&q=85', price_amount: null, currency: 'USD', duration_seconds: null, published_at: null },
  { id: 'story-04', title: 'A private moment in motion', description: 'A public-safe teaser for a private erotic film.', content_type: 'video', category: 'Private videos', access_level: 'members', preview_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1000&auto=format&fit=crop&q=85', price_amount: null, currency: 'USD', duration_seconds: 94, published_at: null },
  { id: 'story-05', title: 'After hours', description: 'An intimate film reserved for members.', content_type: 'video', category: 'Erotic video collection', access_level: 'premium', preview_url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1000&auto=format&fit=crop&q=85', price_amount: 8, currency: 'USD', duration_seconds: 126, published_at: null },
  { id: 'story-06', title: 'The art of anticipation', description: 'A public portrait teaser from my personal collection.', content_type: 'image', category: 'Public portraits', access_level: 'public', preview_url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1000&auto=format&fit=crop&q=85', price_amount: null, currency: 'USD', duration_seconds: null, published_at: null },
];

export function usePlans() {
  return useQuery({
    queryKey: ['membership-plans'],
    queryFn: async () => {
      if (!supabase) return fallbackPlans;
      const { data, error } = await supabase.from('membership_plans').select('*').eq('is_active', true).order('price_amount');
      if (error) throw error;
      return (data ?? []) as MembershipPlan[];
    },
    staleTime: 60_000,
  });
}
export function useContent(type?: 'image' | 'video') {
  return useQuery({
    queryKey: ['content-public', type],
    queryFn: async () => {
      if (!supabase) return fallbackContent.filter((item) => !type || item.content_type === type);
      let query = supabase.from('content_public').select('*').order('published_at', { ascending: false });
      if (type) query = query.eq('content_type', type);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
    staleTime: 60_000,
  });
}
