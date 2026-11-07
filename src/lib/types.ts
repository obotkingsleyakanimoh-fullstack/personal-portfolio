export type Role = 'member' | 'owner';
export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: Role;
  status?: 'active' | 'suspended';
  created_at?: string;
}
export interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_amount: number;
  currency: string;
  duration_days: number;
  access_tier: number;
  can_chat: boolean;
  benefits: string[];
  featured: boolean;
  is_active: boolean;
}
export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: 'image' | 'video';
  category: string;
  access_level: 'public' | 'members' | 'vip' | 'premium' | 'private';
  preview_url: string | null;
  price_amount: number | null;
  currency: string;
  duration_seconds: number | null;
  published_at: string | null;
  sort_order?: number;
}
