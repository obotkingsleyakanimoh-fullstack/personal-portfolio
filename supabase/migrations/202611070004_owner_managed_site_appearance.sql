-- Owner-managed site artwork, public-safe feature media, theme colors and content ordering.
-- Apply after migrations 001-003 with: supabase db push

alter table public.content_items
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (order by coalesce(published_at, created_at) desc, created_at desc) * 10 as position
  from public.content_items
)
update public.content_items ci
set sort_order = ranked.position
from ranked
where ci.id = ranked.id and ci.sort_order = 0;

create or replace view public.content_public as
select id, title, description, content_type, category, access_level,
       preview_url, price_amount, currency, duration_seconds, published_at, sort_order
from public.content_items
where is_published = true;
grant select on public.content_public to anon, authenticated;

create table if not exists public.site_appearance (
  id boolean primary key default true check (id is true),
  theme jsonb not null default '{
    "primary":"#54253c",
    "accent":"#c17c91",
    "background":"#fbf5f3",
    "surface":"#f1e2e4",
    "text":"#2b1a24",
    "muted":"#907b83",
    "deep":"#321923",
    "highlight":"#d6a0ae",
    "border":"#e8d8dc"
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.site_appearance (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.site_assets (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique check (slot in ('home_hero','home_intro','home_membership','about_hero','checkout_feature','videos_feature','auth_hero')),
  label text not null,
  description text not null default '',
  media_type text not null check (media_type in ('image','video')),
  storage_path text,
  source_content_id uuid references public.content_items(id) on delete set null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.site_assets alter column storage_path drop not null;
alter table public.site_assets add column if not exists source_content_id uuid references public.content_items(id) on delete set null;

alter table public.site_assets drop constraint if exists site_assets_slot_check;
alter table public.site_assets add constraint site_assets_slot_check check (slot in ('home_hero','home_intro','home_membership','about_hero','checkout_feature','videos_feature','auth_hero'));


create or replace function public.deactivate_site_artwork_for_deleted_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.site_assets
     set source_content_id = null,
         is_active = false,
         updated_at = now()
   where source_content_id = old.id;
  return old;
end;
$$;

drop trigger if exists content_items_deactivate_site_artwork on public.content_items;
create trigger content_items_deactivate_site_artwork
before delete on public.content_items
for each row execute function public.deactivate_site_artwork_for_deleted_content();

alter table public.site_appearance enable row level security;
alter table public.site_assets enable row level security;

drop policy if exists "site_appearance_public_read" on public.site_appearance;
create policy "site_appearance_public_read"
  on public.site_appearance for select to anon, authenticated using (true);

drop policy if exists "site_appearance_owner_manage" on public.site_appearance;
create policy "site_appearance_owner_manage"
  on public.site_appearance for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "site_assets_public_read_active" on public.site_assets;
create policy "site_assets_public_read_active"
  on public.site_assets for select to anon, authenticated using (is_active = true or public.is_owner());

drop policy if exists "site_assets_owner_manage" on public.site_assets;
create policy "site_assets_owner_manage"
  on public.site_assets for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  524288000,
  array['image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_assets_storage_public_read" on storage.objects;
create policy "site_assets_storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'site-assets');

drop policy if exists "site_assets_storage_owner_insert" on storage.objects;
create policy "site_assets_storage_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_owner());

drop policy if exists "site_assets_storage_owner_update" on storage.objects;
create policy "site_assets_storage_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and public.is_owner())
  with check (bucket_id = 'site-assets' and public.is_owner());

drop policy if exists "site_assets_storage_owner_delete" on storage.objects;
create policy "site_assets_storage_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets' and public.is_owner());

comment on table public.site_assets is
  'Public-safe owner-managed imagery and teaser video used in fixed website design slots. Explicit originals must stay in private-content.';
comment on table public.site_appearance is
  'Owner-managed global website theme colors.';
comment on column public.content_items.sort_order is
  'Owner-managed display order for gallery, videos and featured content.';
