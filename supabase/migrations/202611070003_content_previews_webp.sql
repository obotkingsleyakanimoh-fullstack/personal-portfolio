-- After Dark: owner-managed, public-safe WebP preview images.
-- Apply after 202611050001_initial_schema.sql and 202611050002_after_dark_chat_media.sql.
-- Full-resolution photographs and original videos remain in the private-content bucket.

alter table public.content_items
  add column if not exists preview_storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-previews',
  'content-previews',
  true,
  10485760,
  array['image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/webp'];

-- Only the website owner may publish a preview image. Public reads are intentional:
-- the owner must upload a non-explicit teaser image, never the private original.
drop policy if exists "owner_upload_content_previews" on storage.objects;
create policy "owner_upload_content_previews"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'content-previews'
  and public.is_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "owner_update_content_previews" on storage.objects;
create policy "owner_update_content_previews"
on storage.objects for update to authenticated
using (
  bucket_id = 'content-previews'
  and public.is_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'content-previews'
  and public.is_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "owner_delete_content_previews" on storage.objects;
create policy "owner_delete_content_previews"
on storage.objects for delete to authenticated
using (
  bucket_id = 'content-previews'
  and public.is_owner()
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on column public.content_items.preview_storage_path is
  'Path to the public-safe WebP teaser image in the content-previews bucket. Never store explicit originals here.';
