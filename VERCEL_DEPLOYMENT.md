# Deploy Pink Doll Mansion's frontend

> **Check Vercel eligibility before deploying.** This project is designed for paid access to adult-oriented nude and erotic media. Vercel's current Acceptable Use Policy restricts content it classifies as offensive, obscene, graphic or sexually exploitative. The policy does not clearly approve an explicit adult-membership service. Obtain written confirmation from Vercel that this exact website and business model are permitted before deploying it or serving adult content through it. A paid plan does not override the Acceptable Use Policy. Because memberships are paid, Hobby's non-commercial restriction also makes Hobby unsuitable if Vercel approves the project. See [Vercel's Acceptable Use Policy](https://vercel.com/legal/acceptable-use-policy) and [Hobby plan restrictions](https://vercel.com/docs/plans/hobby).

## 1. Prepare the project

1. Extract `Personal-Portfolio-After-Dark-Vercel-WebP.zip`.
2. Open the extracted `personal-portfolio` folder (the folder containing `package.json`).
3. Do not upload `.env`, API keys, webhook secrets, recovery words or wallet private keys to GitHub.
4. Create a private GitHub repository and upload the project files.

## 2. Import into Vercel

After Vercel confirms eligibility:

1. Sign in to [Vercel](https://vercel.com/).
2. Select **Add New → Project**.
3. Import the private GitHub repository.
4. Set the Root Directory to the folder containing `package.json` (normally the repository root).
5. Select **Vite** as the framework preset.
6. Use the following settings:

| Setting | Value |
|---|---|
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Development command | `npm run dev` |

The included `vercel.json` configures the Vite build, security headers and SPA rewrite for TanStack Router routes such as `/admin`, `/chat` and `/membership`.

## 3. Add frontend environment variables

In **Vercel → Project → Settings → Environment Variables**, add the following for Production and Preview:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ydwqnlovmhtwgbnxeoci.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable key or legacy anon key |
| `VITE_SITE_NAME` | `Pink Doll Mansion` |
| `VITE_OWNER_DISPLAY_NAME` | The name you want displayed publicly |
| `VITE_OWNER_TAGLINE` | Your personal tagline |
| `VITE_OWNER_PORTRAIT_URL` | URL of a public, non-explicit portrait you own or are licensed to use |
| `VITE_OWNER_HERO_IMAGE_URL` | URL of a public, non-explicit hero image you own or are licensed to use |
| `VITE_OWNER_FEATURE_IMAGE_URL` | URL of a public, non-explicit feature image you own or are licensed to use |

Only the Supabase project URL and publishable/anon key belong in the browser. **Never add** `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, a wallet recovery phrase or a private key to Vercel environment variables.

Save the variables and deploy. If you change an environment variable later, create a new deployment for the change to take effect.

## 4. Configure Supabase Auth redirects

When Vercel provides the deployed URL:

1. Open Supabase → **Authentication → URL Configuration**.
2. Set **Site URL** to the production Vercel URL.
3. Add the production URL and the required login/reset redirect paths to the Redirect URLs allowlist.
4. Keep `http://localhost:5173/**` in the allowlist while testing locally.
5. Add the custom domain and its redirects later if you connect one.

## 5. Apply the updated media migration

The Owner Studio now requires migration `202611070003_content_previews_webp.sql` for the `preview_storage_path` field and `content-previews` storage bucket.

If migrations 001 and 002 are already applied to your connected Supabase project, open **Supabase → SQL Editor → New query**, paste the contents of migration 003, and run it once. Do not re-run migrations 001 and 002 if they are already applied.

## 6. Keep Bitcoin processing on Supabase

The BTCPay API key and webhook secret remain in **Supabase → Edge Functions → Secrets**, not in Vercel. The Edge Functions are deployed separately from the frontend:

```bash
supabase functions deploy create-btc-invoice
supabase functions deploy get-content-url --no-verify-jwt
supabase functions deploy btcpay-webhook --no-verify-jwt
```

Run these from the project root after linking the Supabase CLI to project `ydwqnlovmhtwgbnxeoci`. The webhook validates BTCPay's signature and re-reads the invoice before granting access. Do not consider a payment complete until end-to-end tests pass and the Bitcoin node has finished initial synchronization.

## 7. Test the deployment

Check each of these before launch:

- Homepage, story, photo gallery, video collection and membership pages load.
- Registration, verification, login, password reset and logout work.
- `/admin`, `/chat`, `/membership` and `/dashboard` still load after a direct refresh.
- The owner can upload a photograph and verify the stored object ends in `.webp` with MIME type `image/webp`.
- The owner can upload an MP4/WebM video and a separate WebP cover; the video remains a video file and the player uses the WebP cover as its poster.
- Public cover images display, while private originals remain inaccessible without the correct entitlement.
- Chat photograph attachments are stored as private WebP files.
- Supabase email links return to the deployed domain.
- BTCPay invoice creation, webhook HMAC verification, invoice reconciliation, duplicate-event handling and paid-access fulfilment all work in tests.

The source environment used to prepare this ZIP did not have npm dependencies installed, and package downloads timed out. Run `npm install` and `npm run build` locally or let Vercel run the build before treating the deployment as production-ready.
