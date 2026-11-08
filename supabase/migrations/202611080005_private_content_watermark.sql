-- Keep member/VIP/private collection records out of the anonymous media listing.
-- Apply after migrations 001-004.

alter table public.site_appearance
  add column if not exists watermark jsonb not null default '{
    "enabled": true,
    "text": "Atelier After Dark",
    "position": "bottom-right",
    "opacity": 0.62,
    "size": 0.035
  }'::jsonb;

create or replace view public.content_public as
select id, title, description, content_type, category, access_level,
       preview_url, price_amount, currency, duration_seconds, published_at, sort_order
from public.content_items
where is_published = true
  and access_level = 'public';

grant select on public.content_public to anon, authenticated;

create or replace function public.get_visible_content()
returns table (
  id uuid,
  title text,
  description text,
  content_type text,
  category text,
  access_level text,
  preview_url text,
  price_amount numeric,
  currency text,
  duration_seconds integer,
  published_at timestamptz,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select ci.id, ci.title, ci.description, ci.content_type, ci.category,
         ci.access_level, ci.preview_url, ci.price_amount, ci.currency,
         ci.duration_seconds, ci.published_at, ci.sort_order
  from public.content_items ci
  where ci.is_published = true
    and (
      ci.access_level = 'public'
      or (auth.uid() is not null and public.can_access_content(ci.id))
    )
  order by ci.sort_order asc, ci.published_at desc nulls last;
$$;

revoke all on function public.get_visible_content() from public;
grant execute on function public.get_visible_content() to anon, authenticated;

comment on view public.content_public is
  'Anonymous-safe listing containing public items only. Member/VIP previews are not exposed to anonymous visitors.';
comment on function public.get_visible_content() is
  'Returns public content plus only content the authenticated caller is entitled to view.';

