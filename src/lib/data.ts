import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { ContentItem, MembershipPlan } from './types';
import { useAuth } from './AuthContext';

export const fallbackPlans: MembershipPlan[] = [
  { id: 'silver', name: 'The Tease', slug: 'the-tease', description: 'A first glimpse of my private side: sensual portraits, selected boudoir photographs and intimate behind-the-scenes moments.', price_amount: 12, currency: 'USD', duration_days: 30, access_tier: 1, can_chat: false, benefits: ['Members-only intimate photo collection', 'Fresh private photographs added throughout the month', 'Personal updates and private behind-the-scenes notes'], featured: false, is_active: true },
  { id: 'gold', name: 'The Mansion', slug: 'the-mansion', description: 'A deeper look inside Pink Doll Mansion, with private boudoir photography, intimate films and personal conversation.', price_amount: 29, currency: 'USD', duration_days: 30, access_tier: 2, can_chat: true, benefits: ['Everything included in The Tease', 'Selected private films', 'Private text, photograph and voice-note exchange', 'Early access to new nude and boudoir collections'], featured: true, is_active: true },
  { id: 'vip', name: 'The Private Suite', slug: 'private-suite', description: 'My most intimate collection: VIP nude photography, private erotic films and priority one-to-one conversation with me.', price_amount: 69, currency: 'USD', duration_days: 30, access_tier: 3, can_chat: true, benefits: ['Everything included in The Mansion', 'VIP nude photography and erotic film collections', 'Priority one-to-one text, photo and voice messages with me', 'Priority requests for personal audio or video sessions'], featured: false, is_active: true },
];

export const fallbackContent: ContentItem[] = [];

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
  const { user } = useAuth();
  return useQuery({
    queryKey: ['content-public', user?.id ?? 'anonymous', type],
    queryFn: async () => {
      if (!supabase) return fallbackContent.filter((item) => !type || item.content_type === type);
      let rows: any[] = [];
      if (user) {
        const { data, error } = await supabase.rpc('get_visible_content');
        if (error) throw error;
        rows = data ?? [];
      } else {
        let query = supabase.from('content_public').select('*').order('sort_order', { ascending: true }).order('published_at', { ascending: false });
        if (type) query = query.eq('content_type', type);
        const { data, error } = await query;
        if (error) throw error;
        rows = data ?? [];
      }
      return rows.filter((item) => !type || item.content_type === type) as ContentItem[];
    },
    staleTime: 60_000,
  });
}
