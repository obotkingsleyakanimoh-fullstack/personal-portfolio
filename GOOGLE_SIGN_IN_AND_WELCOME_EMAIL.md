# Pink Doll Mansion — Google sign-in and welcome email setup

## What this adds

- A Google sign-in / create-account button on the existing login page.
- Users authenticate with Google and return to `https://pinkdollmansion.com/login`; there is no separate password to create and Google accounts do not need a second Supabase email-confirmation link.
- Google OAuth users who are newly created receive the same one-time Pink Doll Mansion welcome email through the existing Resend `email-lifecycle` function.
- The existing email/password registration welcome email remains in place. The `email_deliveries` unique `(user_id, event_key)` record prevents duplicate welcome messages if the signup form and auth callback both fire.
- Google registration requires an 18+ acknowledgement: the create-account tab checks its registration box, while the sign-in tab relies on the site’s existing 18+ entry gate. The optional marketing checkbox remains unchecked unless the user chooses it.
- The site requests only Google sign-in identity (email/profile) through Supabase Auth. It does **not** request Gmail API access, inbox, messages, contacts or send-mail permissions. Resend sends the welcome email to the Google account's email address.

## Apply the app/database update

1. Copy this patch into the current Pink Doll Mansion repository, preserving the folder paths.
2. Run the SQL migration `supabase/migrations/202611100008_google_oauth_signup_consent.sql` after migrations 001–007. Do not rerun the original schema SQL.
3. Run `npm ci` and `npm run build`.
4. Commit and push the changed files to GitHub. Cloudflare should build/deploy from the repository using the existing `npm run build` and `npx wrangler deploy` workflow.
5. Make sure the existing Supabase `email-lifecycle` Edge Function is deployed and these secrets remain configured: `RESEND_API_KEY`, `EMAIL_FROM`, plus the existing Supabase service-role environment that is injected automatically. `EMAIL_FROM` should be `Pink Doll Mansion <hello@pinkdollmansion.com>` or your verified Resend sender.

## Configure Google OAuth in Supabase

### A. Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create the Google Cloud project for Pink Doll Mansion.
3. Open **Google Auth Platform → Clients** (or **APIs & Services → Credentials**, depending on the console layout).
4. Create an OAuth client ID with application type **Web application**.
5. Under **Authorized JavaScript origins**, add:
   - `https://pinkdollmansion.com`
   - `https://www.pinkdollmansion.com`
   - `http://localhost:5173` (development only)
6. Under **Authorized redirect URIs**, add the exact callback URL shown on the Supabase Google provider screen. For this project it should be:
   - `https://ydwqnlovmhtwgbnxeoci.supabase.co/auth/v1/callback`
7. Create the client, then copy its Client ID and Client Secret. Keep the secret private; do not put it in Vite variables, GitHub or `wrangler.jsonc`.

### B. Enable Google in Supabase

1. Open the Supabase project `ydwqnlovmhtwgbnxeoci`.
2. Go to **Authentication → Sign In / Providers → Google**.
3. Enable Google.
4. Paste the Google Client ID and Client Secret.
5. Save.

### C. Verify Supabase redirect URLs

In **Authentication → URL Configuration**:

- Site URL: `https://pinkdollmansion.com`
- Additional Redirect URLs:
  - `https://pinkdollmansion.com/**`
  - `https://www.pinkdollmansion.com/**`
  - `http://localhost:5173/**`

The code requests the canonical return URL `https://pinkdollmansion.com/login?oauth=google` in production, even if the visitor started on `www`. The `www` URL is included for compatibility, though Cloudflare should redirect it to the apex domain.

## Welcome email behaviour

Google sign-in returns the user directly to the website. For a newly created Google Auth user, the `AuthContext` checks the account creation time and invokes the existing `email-lifecycle` function. That function looks up the account email in Supabase Auth and sends the welcome through Resend. A one-time delivery record prevents repeat messages. Existing Google users signing in later are not treated as new accounts.

Google accounts normally arrive with a verified provider email, so they do not need the separate Supabase email-confirmation link. The welcome message is still sent by Resend. Its copy is provider-aware: Google signups are told they can return using Google and do not need a confirmation link; email/password signups are told to confirm their email address. Email/password registrations continue using the existing Supabase confirmation email plus the separate Resend welcome message.

## Important distinction

This is **Google OAuth sign-in**, not Gmail inbox integration. The app does not read a user's Gmail inbox or request access to their private messages. It only receives the identity claims needed to sign in (email and basic profile). The welcome message is delivered by Resend to that address.

## Verification checklist

- [ ] Google provider is enabled in Supabase.
- [ ] Google OAuth client has the Supabase callback URI.
- [ ] Supabase allows the production `/login?oauth=google` redirect.
- [ ] `email-lifecycle` is deployed and `RESEND_API_KEY` / `EMAIL_FROM` are correct.
- [ ] Test a fresh Google account: complete Google sign-in, verify return to Pink Doll Mansion, and check that exactly one welcome email arrives.
- [ ] Test an existing Google account: sign in again and verify it does not receive another welcome email.
- [ ] Test email/password signup separately to ensure its confirmation and welcome emails still work.

## Deploy the email function update

From the repository root, after the project has been linked to the existing Supabase project:

```bash
supabase functions deploy email-lifecycle --no-verify-jwt
```

The function uses the existing Supabase `SUPABASE_URL` and service-role runtime secrets supplied by Supabase Edge Functions. Confirm these project secrets are configured in **Supabase → Edge Functions → Secrets**:

- `RESEND_API_KEY` — your Resend API key (server-side only)
- `EMAIL_FROM` — `Pink Doll Mansion <hello@pinkdollmansion.com>`

Do not place the Resend API key or Google Client Secret in Cloudflare Pages variables, Vite `VITE_` variables, source files, or GitHub.

## Database migration

Apply `supabase/migrations/202611100008_google_oauth_signup_consent.sql` once, after the earlier migrations 001–007 are already installed. If those migrations have already been applied, run only migration 008; do not rerun the original schema SQL or drop/recreate existing views.

## Google consent screen

In Google Auth Platform, complete the app name, support email, developer contact email and privacy-policy link (`https://pinkdollmansion.com/privacy`). Add `pinkdollmansion.com` as an authorized domain if Google requests it. While the OAuth consent screen is in **Testing**, only the test users you list can use the Google button. Move the app to **Production** when you are ready for public sign-ins. Because this site requests only basic identity scopes for authentication, do not add Gmail API scopes.

## What the email flow does

- Email/password registration continues to receive Supabase's email-confirmation email and a separate one-time welcome email through Resend.
- First-time Google registration returns directly to the website; Google provider email is normally considered verified, so no additional Supabase confirmation email is needed. The new account receives the same one-time Resend welcome email, with wording specific to Google sign-in.
- Later Google sign-ins do not generate another welcome email. `email_deliveries` uses the unique `(user_id, event_key)` key to avoid duplicate welcome messages.
- The app does not access a person's Gmail inbox, mail, contacts or send-mail APIs. The welcome email is sent by Resend to the email address attached to the new Supabase Auth account.
