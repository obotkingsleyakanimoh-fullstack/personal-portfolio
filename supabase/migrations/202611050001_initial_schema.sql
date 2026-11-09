-- Atelier: single-owner personal portfolio + membership platform
-- Apply with: supabase db push

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  role text not null default 'member' check (role in ('member', 'owner')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_owner_account_only on public.profiles(role) where role = 'owner';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'username', ''),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- A signed-in user can edit their profile but cannot promote themselves to owner.
create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile roles cannot be changed by the account holder';
  end if;
  if auth.uid() = old.id and new.status is distinct from old.status then
    raise exception 'Account status can only be changed by the website owner';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation before update on public.profiles
for each row execute procedure public.prevent_profile_role_escalation();

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_amount numeric(12,2) not null check (price_amount > 0),
  currency text not null default 'USD',
  duration_days integer not null check (duration_days > 0),
  access_tier smallint not null default 1 check (access_tier between 1 and 3),
  can_chat boolean not null default false,
  benefits text[] not null default '{}',
  featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  payment_order_id uuid,
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled','refunded','suspended')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists memberships_user_status_end_idx on public.memberships(user_id, status, ends_at desc);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  content_type text not null check (content_type in ('image','video')),
  category text not null default 'Personal moments',
  access_level text not null default 'members' check (access_level in ('public','members','vip','premium','private')),
  storage_path text not null,
  preview_url text,
  price_amount numeric(12,2),
  currency text not null default 'USD',
  duration_seconds integer,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_amount is null or price_amount >= 0)
);
create index if not exists content_items_published_type_idx on public.content_items(is_published, content_type, published_at desc);

-- Deliberately excludes storage_path. This view is the only content metadata exposed to visitors.
create or replace view public.content_public as
select id, title, description, content_type, category, access_level,
       preview_url, price_amount, currency, duration_seconds, published_at
from public.content_items
where is_published = true;
grant select on public.content_public to anon, authenticated;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null check (product_type in ('membership','content')),
  product_id uuid not null,
  plan_id uuid references public.membership_plans(id),
  content_id uuid references public.content_items(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  btc_amount numeric(20,10),
  btc_exchange_rate numeric(24,10),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','payment_detected','confirmation_pending','confirmed','expired','underpaid','overpaid','failed','refunded')),
  provider text not null default 'btcpay',
  provider_invoice_id text unique,
  checkout_url text,
  expires_at timestamptz,
  transaction_id text,
  fulfillment_applied boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_user_created_idx on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_idx on public.payment_orders(status, created_at desc);

alter table public.memberships
  drop constraint if exists memberships_payment_order_id_fkey;
alter table public.memberships
  add constraint memberships_payment_order_id_fkey foreign key (payment_order_id) references public.payment_orders(id) on delete set null;

create table if not exists public.content_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  payment_order_id uuid references public.payment_orders(id),
  status text not null default 'active' check (status in ('active','refunded','revoked')),
  purchased_at timestamptz not null default now(),
  unique(user_id, content_id)
);

create table if not exists public.chat_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'manual' check (source in ('membership','chat_pass','manual')),
  source_id uuid,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chat_entitlements_user_end_idx on public.chat_entitlements(user_id, ends_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  status text not null default 'open' check (status in ('open','closed','blocked')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_id <> owner_id)
);
create index if not exists conversations_owner_updated_idx on public.conversations(owner_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  attachment_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text unique,
  order_id uuid references public.payment_orders(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.get_owner_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where role = 'owner' order by created_at asc limit 1;
$$;
grant execute on function public.get_owner_user_id() to authenticated;

create or replace function public.can_use_chat()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare account_status text;
begin
  if public.is_owner() then return true; end if;
  select status into account_status from public.profiles where id = auth.uid();
  if account_status is distinct from 'active' then return false; end if;
  return exists (
    select 1 from public.memberships m
    join public.membership_plans p on p.id = m.plan_id
    where m.user_id = auth.uid() and m.status = 'active'
      and m.starts_at <= now() and m.ends_at > now() and p.can_chat = true
  ) or exists (
    select 1 from public.chat_entitlements c
    where c.user_id = auth.uid() and c.source in ('chat_pass', 'manual')
      and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
  );
end;
$$;
grant execute on function public.can_use_chat() to authenticated;

create or replace function public.can_access_content(content_uuid uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  item public.content_items%rowtype;
  active_tier integer;
begin
  select * into item from public.content_items where id = content_uuid and is_published = true;
  if not found then return false; end if;
  if item.access_level = 'public' then return true; end if;
  if public.is_owner() then return true; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then return false; end if;
  select max(p.access_tier) into active_tier
  from public.memberships m join public.membership_plans p on p.id = m.plan_id
  where m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= now() and m.ends_at > now();
  if item.access_level = 'members' and coalesce(active_tier, 0) >= 1 then return true; end if;
  if item.access_level = 'vip' and coalesce(active_tier, 0) >= 3 then return true; end if;
  if item.access_level = 'premium' and exists (
    select 1 from public.content_purchases cp where cp.user_id = auth.uid()
      and cp.content_id = content_uuid and cp.status = 'active'
  ) then return true; end if;
  if item.access_level = 'private' and exists (
    select 1 from public.content_purchases cp where cp.user_id = auth.uid()
      and cp.content_id = content_uuid and cp.status = 'active'
  ) then return true; end if;
  return false;
end;
$$;
grant execute on function public.can_access_content(uuid) to authenticated;

create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists touch_conversation_after_message on public.messages;
create trigger touch_conversation_after_message after insert on public.messages
for each row execute procedure public.touch_conversation_on_message();

-- Updated-at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','membership_plans','memberships','content_items','payment_orders','conversations'] LOOP
    EXECUTE format('drop trigger if exists set_updated_at on public.%I', t);
    EXECUTE format('create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t);
  END LOOP;
END $$;

-- Starter tiers. Change prices, names and descriptions in the owner-controlled database before launch.
insert into public.membership_plans (name, slug, description, price_amount, currency, duration_days, access_tier, can_chat, benefits, featured, sort_order)
values
  ('The Tease', 'the-tease', 'A first look at the private side: intimate portraits and selected behind-the-scenes moments.', 12, 'USD', 30, 1, false, array['Members-only intimate picture sets','New private pictures throughout the month','Personal updates and behind-the-scenes notes'], false, 1),
  ('The Mansion', 'the-mansion', 'A deeper look inside Pink Doll Mansion, with private boudoir photography, intimate films and personal conversation.', 29, 'USD', 30, 2, true, array['Everything in The Tease','Selected private films','Private text, photo and voice-note chat','Early access to new intimate collections'], true, 2),
  ('The Private Suite', 'private-suite', 'The most personal access, with VIP collections and priority private interaction.', 69, 'USD', 30, 3, true, array['Everything in The Mansion','VIP intimate picture and video collections','Priority one-to-one text, photo and voice messages','Priority requests for private audio or video sessions'], false, 3)
on conflict (slug) do nothing;

-- Row-level security
alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.content_items enable row level security;
alter table public.payment_orders enable row level security;
alter table public.content_purchases enable row level security;
alter table public.chat_entitlements enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.payment_events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Profiles
create policy "profiles_select_self_or_owner" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner());
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'member');
create policy "profiles_update_self_or_owner" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());

-- Plans: active plans can be read by visitors; only the owner can manage plans.
create policy "plans_read_active" on public.membership_plans for select to anon, authenticated
  using (is_active = true or public.is_owner());
create policy "plans_owner_manage" on public.membership_plans for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Memberships are issued by the trusted payment webhook or owner, never by the browser.
create policy "memberships_read_self_or_owner" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "memberships_owner_manage" on public.memberships for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Private source media records are owner-only. Public page reads the restricted content_public view.
create policy "content_owner_manage" on public.content_items for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "orders_read_self_or_owner" on public.payment_orders for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "orders_owner_manage" on public.payment_orders for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "purchases_read_self_or_owner" on public.content_purchases for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "purchases_owner_manage" on public.content_purchases for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "chat_entitlements_read_self_or_owner" on public.chat_entitlements for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "chat_entitlements_owner_manage" on public.chat_entitlements for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Exactly one conversation per member; no member-to-member conversation can be created.
create policy "conversation_read_participant_or_owner" on public.conversations for select to authenticated
  using (member_id = auth.uid() or owner_id = auth.uid() or public.is_owner());
create policy "member_create_own_owner_conversation" on public.conversations for insert to authenticated
  with check (member_id = auth.uid() and owner_id = public.get_owner_user_id() and public.can_use_chat());
create policy "owner_update_conversation" on public.conversations for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "messages_read_conversation_participant" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c where c.id = conversation_id
      and (c.member_id = auth.uid() or c.owner_id = auth.uid() or public.is_owner())
      and (public.is_owner() or public.can_use_chat())
  ));
create policy "messages_insert_entitled_participant" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and char_length(body) between 1 and 5000
    and exists (
      select 1 from public.conversations c where c.id = conversation_id
        and (c.member_id = auth.uid() or c.owner_id = auth.uid() or public.is_owner())
        and c.status = 'open'
    )
    and (public.is_owner() or public.can_use_chat())
  );
create policy "messages_recipient_mark_read" on public.messages for update to authenticated
  using (sender_id <> auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and (c.member_id = auth.uid() or c.owner_id = auth.uid() or public.is_owner())
  ))
  with check (sender_id <> auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id and (c.member_id = auth.uid() or c.owner_id = auth.uid() or public.is_owner())
  ));

create policy "notifications_read_self_or_owner" on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy "notifications_update_self" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "payment_events_owner_only" on public.payment_events for select to authenticated using (public.is_owner());
create policy "audit_owner_only" on public.admin_audit_logs for select to authenticated using (public.is_owner());

-- Supabase Storage: private-content is deliberately not readable by normal authenticated members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-content', 'private-content', false, 524288000, array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false;

create policy "owner_upload_private_content" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-content' and public.is_owner());
create policy "owner_read_private_content" on storage.objects for select to authenticated
  using (bucket_id = 'private-content' and public.is_owner());
create policy "owner_update_private_content" on storage.objects for update to authenticated
  using (bucket_id = 'private-content' and public.is_owner())
  with check (bucket_id = 'private-content' and public.is_owner());
create policy "owner_delete_private_content" on storage.objects for delete to authenticated
  using (bucket_id = 'private-content' and public.is_owner());

-- Enable Realtime for private messages. Access is still governed by messages RLS.
DO $$
BEGIN
  alter publication supabase_realtime add table public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Explicit table grants: RLS still controls which rows are visible or writable.
grant select on public.profiles to authenticated;
grant update (full_name, username, avatar_url, updated_at, status) on public.profiles to authenticated;
grant select on public.membership_plans to anon, authenticated;
grant insert, update, delete on public.membership_plans to authenticated;
grant select on public.memberships to authenticated;
grant insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.content_items to authenticated;
grant select on public.payment_orders to authenticated;
grant insert, update, delete on public.payment_orders to authenticated;
grant select on public.content_purchases to authenticated;
grant insert, update, delete on public.content_purchases to authenticated;
grant select on public.chat_entitlements to authenticated;
grant insert, update, delete on public.chat_entitlements to authenticated;
grant select, insert, update on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.payment_events, public.admin_audit_logs to authenticated;

-- A short claim lease prevents duplicate webhook deliveries racing to fulfil the same order.
alter table public.payment_orders add column if not exists fulfillment_claimed_at timestamptz;
alter table public.memberships drop constraint if exists memberships_payment_order_unique;
alter table public.memberships add constraint memberships_payment_order_unique unique (payment_order_id);
alter table public.chat_entitlements drop constraint if exists chat_entitlements_source_id_unique;
alter table public.chat_entitlements add constraint chat_entitlements_source_id_unique unique (source_id);

create or replace function public.claim_payment_fulfillment(order_uuid uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare claimed_id uuid;
begin
  update public.payment_orders
     set fulfillment_claimed_at = now()
   where id = order_uuid
     and fulfillment_applied = false
     and (fulfillment_claimed_at is null or fulfillment_claimed_at < now() - interval '5 minutes')
  returning id into claimed_id;
  return claimed_id is not null;
end;
$$;
revoke all on function public.claim_payment_fulfillment(uuid) from public, anon, authenticated;
grant execute on function public.claim_payment_fulfillment(uuid) to service_role;
