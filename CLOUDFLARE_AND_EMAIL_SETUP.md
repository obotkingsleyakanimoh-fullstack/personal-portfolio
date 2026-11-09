# Pink Doll Mansion — Cloudflare, Supabase Auth and Resend setup

Production website: **https://pinkdollmansion.com**  
Supabase project: **ydwqnlovmhtwgbnxeoci**

This package contains the website changes, the Auth email HTML templates, and the Resend Edge Function code. The code is not live until you apply the migration, deploy the Edge Functions, configure Supabase SMTP/templates, confirm the Resend DNS status, attach the Cloudflare Pages custom domain and deploy the frontend.

## 1. Cloudflare Pages hosting

In **Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git**. This project is a Vite static frontend, so use Cloudflare Pages (not a Workers-only deployment):

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | the folder containing `package.json` |
| Node version | `22` (or any supported Node version 20.19+) |

Add these build environment variables to the Cloudflare Pages project:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ydwqnlovmhtwgbnxeoci.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable key / legacy anon key |
| `VITE_SITE_NAME` | `Pink Doll Mansion` |
| `VITE_OWNER_DISPLAY_NAME` | The display name you want visitors to see |
| `VITE_OWNER_TAGLINE` | Your short personal tagline |
| `VITE_OWNER_PORTRAIT_URL` | Optional HTTPS URL for a public-safe portrait you own or may use |
| `VITE_OWNER_HERO_IMAGE_URL` | Optional HTTPS URL for a public-safe hero image you own or may use |
| `VITE_OWNER_FEATURE_IMAGE_URL` | Optional HTTPS URL for a public-safe feature image you own or may use |

Set the Cloudflare Pages environment variable `NODE_VERSION` to `22` under Settings → Builds & deployments → Environment variables. The included `public/_redirects` file makes TanStack Router paths such as `/login`, `/membership`, `/dashboard` and `/admin` work on Cloudflare Pages after a refresh.

After the first Pages deployment, go to **Workers & Pages → your Pages project → Custom domains → Set up a custom domain**, add `pinkdollmansion.com`, and complete the wizard. For an apex domain, the domain must be an active Cloudflare zone and its nameservers must point to Cloudflare; Cloudflare then creates the Pages CNAME record. Add `www.pinkdollmansion.com` only if you want that hostname too, then create a redirect rule to the apex hostname. Do not manually invent a Pages CNAME before associating the hostname with the Pages project.

Do not put `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `EMAIL_PREFERENCE_SECRET`, or BTCPay secrets into Cloudflare Pages browser/build variables. They belong in Supabase Edge Function secrets only.

## 2. Resend domain DNS in Cloudflare

You said the sending domain is already verified in Resend. First confirm the domain still shows **Verified** in **Resend → Domains**. Do not add duplicate records. If any record is still missing, copy the exact values Resend displays into **Cloudflare → DNS → Records**. Cloudflare Pages domain setup does not create Resend authentication records.

- Add every DKIM record exactly as Resend shows it.
- Add the SPF TXT record at the exact name Resend provides. Do not create a second SPF record for the same hostname; merge with an existing SPF record if one is already present.
- Add the DMARC record if Resend recommends it and if one does not already exist.
- Add any MX record only if Resend shows it as required. Do not delete MX records used by an existing mailbox provider.
- Leave mail-related records as **DNS only** (grey cloud), not proxied through Cloudflare.

The values are unique to your Resend domain configuration, so do not copy DNS values from another tutorial or website. Wait until Resend reports the domain as verified. Use a From address on that verified domain; this setup defaults to `hello@pinkdollmansion.com`. Change `EMAIL_FROM` below if your verified sender is a different address.

## 3. Configure Resend for Supabase Auth emails

In **Supabase Dashboard → Authentication → Email → SMTP Settings**:

1. Enable custom SMTP.
2. Enter the values below. Use a Resend API key with sending permission as the password.

| Supabase SMTP field | Value |
|---|---|
| Sender name | `Pink Doll Mansion` |
| Sender email | `hello@pinkdollmansion.com` (or your verified sender) |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |

The SMTP settings above are Resend's published credentials. If you prefer, Supabase also lists a Resend integration that can prefill the SMTP fields. Do not disable email confirmation. Resend SMTP sends the Supabase confirmation/reset/security templates; the separate Edge Function calls Resend's email API for the welcome, membership receipt and reminder messages.

In Resend, turn off click/link tracking for Auth emails. Link rewriting can invalidate Supabase confirmation and password-reset URLs.

## 4. Configure Supabase URL redirects

In **Supabase → Authentication → URL Configuration**:

- Site URL: `https://pinkdollmansion.com`
- Add Redirect URLs: `https://pinkdollmansion.com/**`
- Add `https://www.pinkdollmansion.com/**` if the www hostname is active.
- Keep `http://localhost:5173/**` while testing locally.
- Add the Cloudflare Pages preview URL pattern only if you will test email links from preview deployments.

The signup code redirects to `/login?confirmed=1`. Password-reset emails redirect to `/login?type=recovery`. The same Site URL and redirect allow-list are also recorded in the local `supabase/config.toml`; update the hosted dashboard separately.

## 5. Add the Pink Doll Mansion Auth templates

The HTML files are in `supabase/templates/`. For the hosted Supabase project, open **Authentication → Email Templates** and paste each file's content into its matching template. The local Supabase CLI configuration has also been written to `supabase/config.toml`, but local template files do not automatically change templates in an already-hosted Supabase project.

| Supabase template | File | Subject |
|---|---|---|
| Confirm signup | `confirmation.html` | Welcome to Pink Doll Mansion — confirm your email |
| Reset password | `recovery.html` | Reset your Pink Doll Mansion password |
| Magic link | `magic_link.html` | Your private Pink Doll Mansion sign-in link |
| Change email | `email_change.html` | Confirm your new Pink Doll Mansion email address |
| Invite user | `invite.html` | You have a private Pink Doll Mansion invitation |
| Reauthentication | `reauthentication.html` | Confirm your Pink Doll Mansion account action |

The local config also includes password-changed and email-changed security notification templates. Enable the equivalent notification types in the hosted Supabase Auth settings if you want these security notices sent.

## 6. Apply the database migration and deploy Edge Functions

Apply `supabase/migrations/202611090006_pink_doll_mansion_email_branding.sql` once, after migrations 001–005. If you use Supabase CLI and the existing migration history is up to date, run `supabase db push` from the project root. Alternatively, paste the migration into **Supabase → SQL Editor** and run it once.

This migration:

- Changes the saved website theme and watermark label to Pink Doll Mansion.
- Adds an explicit `marketing_opt_in` preference to profiles (default `false`).
- Adds a private `email_deliveries` log so welcome, payment and reminder messages are not duplicated.

Create these Edge Function secrets in **Supabase → Project Settings → Edge Functions → Secrets** (or use `supabase secrets set`):

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | `Pink Doll Mansion <hello@pinkdollmansion.com>` (change if needed) |
| `EMAIL_PREFERENCE_SECRET` | A long random secret (at least 32 random characters) |
| `CRON_SECRET` | A different long random secret (at least 32 random characters) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Supabase Edge Functions. Do not expose the service-role key in the website.

Deploy the email function and the updated BTCPay webhook:

```bash
supabase functions deploy email-lifecycle --no-verify-jwt
supabase functions deploy btcpay-webhook --no-verify-jwt
```

The email lifecycle function handles the signup welcome email, opted-in reminders and unsubscribe requests. The BTCPay webhook sends the membership thank-you only after it independently verifies a settled invoice and grants the membership.

## 7. Schedule membership reminders

Reminders are intentionally limited to two messages: one around day 2 and another around day 7 after signup. They are sent only to members who checked the optional email-updates box, have confirmed their email, and have never had a membership. Unsubscribing or turning off the preference in Account Settings stops future reminders.

Enable `pg_cron`, `pg_net` and Vault in **Supabase → Database → Extensions** (Vault is available in hosted Supabase). Then run the following SQL in the SQL Editor. Replace the two secret placeholders with the exact same values you entered for `CRON_SECRET` and your Supabase publishable/anon key.

```sql
select vault.create_secret(
  'https://ydwqnlovmhtwgbnxeoci.supabase.co',
  'pinkdollmansion_project_url'
);

select vault.create_secret(
  'PASTE_THE_SAME_CRON_SECRET_USED_IN_EDGE_FUNCTION_SECRETS',
  'pinkdollmansion_cron_secret'
);

select vault.create_secret(
  'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY',
  'pinkdollmansion_publishable_key'
);

-- Avoid duplicate schedules if this SQL is run a second time.
select cron.unschedule(jobid)
from cron.job
where jobname = 'pinkdollmansion-membership-reminders';

-- 10:00 UTC is 11:00 in Lagos (WAT).
select cron.schedule(
  'pinkdollmansion-membership-reminders',
  '0 10 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pinkdollmansion_project_url') || '/functions/v1/email-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'pinkdollmansion_publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pinkdollmansion_cron_secret')
    ),
    body := '{"action":"send_reminders"}'::jsonb
  );
  $$
);
```

Monitor the schedule under **Supabase → Integrations → Cron** and check **Edge Functions → email-lifecycle → Logs**. The reminders are not scheduled until this SQL is run.

## 8. Test before announcing the domain

1. Create a test account with an email inbox you control. Confirm both the Supabase confirmation email and the separate Resend welcome email arrive and their buttons open the right domain.
2. Request a password reset and ensure the link opens `/login?type=recovery`, then allows a new password to be saved.
3. Test changing email and the security notification templates.
4. Subscribe with a small BTCPay test invoice. Confirm the payment first appears as pending, then settles, then grants the plan and sends one membership email. Do not test using an unpaid or merely opened invoice.
5. Tick the email-updates checkbox on a separate test account, confirm it, and run the reminder function manually with the cron secret after adjusting the user's `created_at` only in a test database. Check that unsubscribing turns off `marketing_opt_in`.
6. Test as a visitor and as each membership tier to verify that email previews only point to `public` content. Private originals must never be embedded in email.

## Important notes

- The signup welcome and membership confirmation are transactional messages. Membership reminders are promotional, and are sent only after explicit opt-in with an unsubscribe option.
- The email image is selected from the latest published `public` content preview. If there is no public preview image in the gallery, the email simply omits the image. It never uses private originals or member/VIP preview records.
- This package updates the code and supplies the exact settings, but it cannot log in to your Cloudflare, Resend or Supabase dashboards. Those dashboard steps must be completed by you before the emails are live.
