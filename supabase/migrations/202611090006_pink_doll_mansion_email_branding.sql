-- Pink Doll Mansion brand palette, marketing consent and private email-delivery log.
-- Apply once after migrations 001-005.

alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false;

-- The signup checkbox is optional and unchecked by default. Store its value at
-- profile creation so reminder campaigns never assume marketing consent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, role, marketing_opt_in)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'username', ''),
    'member',
    coalesce(new.raw_user_meta_data->>'marketing_opt_in', 'false') = 'true'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

grant update (full_name, username, avatar_url, updated_at, status, marketing_opt_in)
  on public.profiles to authenticated;

-- Only service-role Edge Functions can access this table. It prevents duplicate
-- welcome/receipt/reminder messages and records Resend delivery failures.
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, event_key)
);
create index if not exists email_deliveries_status_created_idx
  on public.email_deliveries(status, created_at desc);
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from anon, authenticated;

-- Rename the previous mid-tier label while preserving existing membership/payment references.
update public.membership_plans
set name = 'The Mansion',
    slug = 'the-mansion',
    description = 'A deeper look inside Pink Doll Mansion, with private boudoir photography, intimate films and personal conversation.',
    benefits = array['Everything in The Tease','Selected private films','Private text, photo and voice-note chat','Early access to new intimate collections']
where slug = 'after-dark' or name = 'After Dark';

update public.membership_plans
set benefits = array['Everything in The Mansion','VIP intimate picture and video collections','Priority one-to-one text, photo and voice messages','Priority requests for private audio or video sessions']
where slug = 'private-suite';

-- New Pink Doll Mansion website theme and image watermark defaults.
update public.site_appearance
set theme = '{
  "primary":"#B83268",
  "accent":"#E58BAC",
  "background":"#FFF7FA",
  "surface":"#FCE7EF",
  "text":"#2B1721",
  "muted":"#987585",
  "deep":"#4A1630",
  "highlight":"#F4BDD0",
  "border":"#F2D5E0"
}'::jsonb,
watermark = jsonb_set(coalesce(watermark, '{}'::jsonb), '{text}', '"Pink Doll Mansion"'::jsonb, true),
updated_at = now()
where id = true;

comment on column public.profiles.marketing_opt_in is
  'Explicit opt-in for occasional promotional content and membership reminders; false by default.';
comment on table public.email_deliveries is
  'Private idempotency and delivery log for server-sent transactional and opted-in reminder emails.';
