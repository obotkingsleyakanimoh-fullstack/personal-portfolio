-- After Dark: richer private chat formats and private attachment storage.
-- Apply after 202611050001_initial_schema.sql.

-- Refresh built-in plan labels and benefit copy for the adult editorial positioning.
-- Existing plan prices are preserved; review plan copy in the owner studio before launch.
update public.membership_plans set
  name = 'The Tease',
  slug = 'the-tease',
  description = 'A first look at the private side: intimate portraits and selected behind-the-scenes moments.',
  benefits = array['Members-only intimate picture sets','New private pictures throughout the month','Personal updates and behind-the-scenes notes']
where slug = 'the-edit';
update public.membership_plans set
  name = 'After Dark',
  slug = 'after-dark',
  description = 'A more intimate collection of private pictures, adult videos and personal conversation.',
  benefits = array['Everything in The Tease','Selected exclusive adult videos','Private text, photo and voice-note chat','Early access to new intimate collections']
where slug = 'inner-circle';
update public.membership_plans set
  description = 'The most personal access, with VIP collections and priority private interaction.',
  benefits = array['Everything in After Dark','VIP intimate picture and video collections','Priority one-to-one text, photo and voice messages','Priority requests for private audio or video sessions']
where slug = 'private-suite';


alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists duration_seconds integer,
  add column if not exists session_kind text,
  add column if not exists session_scheduled_at timestamptz;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'voice', 'session_request'));

alter table public.messages drop constraint if exists messages_session_kind_check;
alter table public.messages add constraint messages_session_kind_check
  check (session_kind is null or session_kind in ('audio', 'video'));

alter table public.messages drop constraint if exists messages_attachment_metadata_check;
alter table public.messages add constraint messages_attachment_metadata_check check (
  (message_type = 'text' and attachment_path is null and session_kind is null)
  or (message_type = 'image' and attachment_path is not null and attachment_mime_type like 'image/%' and session_kind is null)
  or (message_type = 'voice' and attachment_path is not null and attachment_mime_type like 'audio/%' and session_kind is null)
  or (message_type = 'session_request' and attachment_path is null and session_kind in ('audio', 'video'))
);

alter table public.messages drop constraint if exists messages_duration_seconds_check;
alter table public.messages add constraint messages_duration_seconds_check
  check (duration_seconds is null or duration_seconds between 1 and 3600);

-- A message attachment is private to the two participants in its conversation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-messages',
  'private-messages',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/avif','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/m4a']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "private_chat_participant_read_attachments" on storage.objects;
create policy "private_chat_participant_read_attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-messages'
  and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (c.member_id = auth.uid() or c.owner_id = auth.uid())
  )
);

drop policy if exists "private_chat_participant_upload_attachments" on storage.objects;
create policy "private_chat_participant_upload_attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-messages'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and c.status = 'open'
      and (c.member_id = auth.uid() or c.owner_id = auth.uid())
      and (public.is_owner() or public.can_use_chat())
  )
);

-- Do not permit a sender to point a message at someone else's storage path.
drop policy if exists "messages_insert_entitled_participant" on public.messages;
create policy "messages_insert_entitled_participant" on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and char_length(body) between 1 and 5000
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.member_id = auth.uid() or c.owner_id = auth.uid() or public.is_owner())
      and c.status = 'open'
  )
  and (public.is_owner() or public.can_use_chat())
  and (
    (message_type = 'text' and attachment_path is null and session_kind is null)
    or (message_type = 'image'
      and attachment_path like conversation_id::text || '/' || auth.uid()::text || '/%'
      and attachment_mime_type like 'image/%'
      and session_kind is null)
    or (message_type = 'voice'
      and attachment_path like conversation_id::text || '/' || auth.uid()::text || '/%'
      and attachment_mime_type like 'audio/%'
      and session_kind is null)
    or (message_type = 'session_request'
      and not public.is_owner()
      and attachment_path is null
      and session_kind in ('audio','video'))
  )
);

grant select, insert on public.messages to authenticated;

comment on column public.messages.message_type is 'text, private image, private voice note, or an audio/video session request';
comment on column public.messages.attachment_path is 'Path within the private-messages bucket; accessible only to conversation participants';
comment on column public.messages.session_kind is 'Requested session format; the owner must confirm details separately';
