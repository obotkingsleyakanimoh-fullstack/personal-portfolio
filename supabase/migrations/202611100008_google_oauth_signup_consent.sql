-- Google OAuth signup consent support for Pink Doll Mansion.
-- Apply after migrations 001-007. This does not change existing users or passwords.

alter table public.profiles
  add column if not exists adult_confirmed_at timestamptz;

grant update (adult_confirmed_at, marketing_opt_in)
  on public.profiles to authenticated;

-- Preserve the existing new-user profile trigger while also reading the
-- standard Google name claim and recording the 18+ signup attestation supplied
-- by the app's registration flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, username, role, marketing_opt_in, adult_confirmed_at
  )
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    nullif(new.raw_user_meta_data->>'username', ''),
    'member',
    coalesce(new.raw_user_meta_data->>'marketing_opt_in', 'false') = 'true',
    case
      when coalesce(new.raw_user_meta_data->>'adult_confirmed_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
      then (new.raw_user_meta_data->>'adult_confirmed_at')::timestamptz
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on column public.profiles.adult_confirmed_at is
  'Timestamp of the member self-attesting that they are at least 18 and legally permitted to access the site.';
