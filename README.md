# Atelier After Dark

A single-owner personal portfolio and private membership site built with React, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS and Supabase. Members interact with one website owner; there is no member directory, member-to-member messaging, creator marketplace or group chat.

The project includes Supabase authentication, membership plans, protected media delivery, private one-to-one chat, an owner studio, and a BTCPay Server checkout integration. The frontend can be deployed separately from Supabase and BTCPay Server.

## 1. Stack

- React 18 + TypeScript
- Vite 6
- TanStack Router and TanStack Query
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, Realtime and Edge Functions
- BTCPay Server Greenfield API for Bitcoin invoices
- `tus-js-client` for resumable large-file uploads to Supabase Storage

Use Node.js 20.19+ (Node 22 LTS is suitable).

## 2. Install and run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`).

Before running the site, edit `.env` and set:

```env
VITE_SUPABASE_URL=https://ydwqnlovmhtwgbnxeoci.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_SITE_NAME=Atelier After Dark
VITE_OWNER_DISPLAY_NAME=YOUR_DISPLAY_NAME
VITE_OWNER_TAGLINE=YOUR_PERSONAL_TAGLINE
VITE_OWNER_PORTRAIT_URL=https://YOUR_PUBLIC_IMAGE_URL
VITE_OWNER_HERO_IMAGE_URL=https://YOUR_PUBLIC_HERO_IMAGE_URL
VITE_OWNER_FEATURE_IMAGE_URL=https://YOUR_PUBLIC_FEATURE_IMAGE_URL
```

The Supabase publishable/anon key is designed for browser use. Database Row Level Security and Storage policies—not secrecy of this key—must protect user data. Never place the Supabase service-role key or any BTCPay secret in a `VITE_` variable.

The three owner image URLs should point to public, non-explicit brand/portrait images. Protected adult originals belong in the private `private-content` bucket, not in frontend environment variables or public URLs.

## 3. Media optimisation in Owner Studio

The Owner Studio media uploader now processes files before saving them:

### Photographs

- Accepts JPEG, PNG, WebP and AVIF source images.
- Converts every still image to WebP in the browser.
- Resizes the long edge to a maximum of 2,400 pixels.
- Uses WebP quality 0.84 to reduce file size while retaining useful detail.
- Rejects source images above 40 MB or extreme pixel dimensions that could exhaust browser memory.
- Stores the WebP original in the private `private-content` bucket.

### Public-safe cover image

- Required and uploaded separately from the protected original.
- Converted to WebP, resized to a maximum 1,000-pixel edge and compressed at quality 0.78.
- Stored in the public `content-previews` bucket.
- The uploader requires the owner to confirm that the cover is non-explicit, has no visible nudity and is approved for public display.
- Never place an explicit original in `content-previews`. Keep explicit or otherwise restricted media in the private bucket.

### Videos

WebP is a still-image format; it cannot encode video. Videos therefore remain in a browser-compatible video format:

- Recommended: MP4 with H.264 video and AAC audio.
- Also accepted: WebM and MOV.
- Maximum file size in the Owner Studio: 450 MB (the private-content bucket limit is 500 MB).
- Large files use Supabase Storage's resumable TUS upload with a progress indicator. Files up to 6 MB use the normal Supabase upload method.

For best playback and faster delivery, export videos as 1080p MP4 (H.264), use a moderate quality setting, enable “fast start”/web optimisation, and upload a separate non-explicit WebP cover image. The application validates the video container; it does not transcode or re-encode video in the browser.

Example FFmpeg command for creating a browser-friendly copy:

```bash
ffmpeg -i input.mov -vf "scale=w='min(1920,iw)':h=-2" -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart output.mp4
```

### Resumable uploads

Supabase recommends TUS resumable uploads for files larger than 6 MB, unreliable connections and progress reporting. This project uses 6 MB chunks and the direct `PROJECT_REF.storage.supabase.co` storage hostname. See the [Supabase resumable upload guide](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

## 4. Supabase database setup

The migrations are in `supabase/migrations/` and must be applied in filename order:

1. `202611050001_initial_schema.sql`
2. `202611050002_after_dark_chat_media.sql`
3. `202611070003_content_previews_webp.sql`

The third migration adds `preview_storage_path` and creates the public-safe WebP `content-previews` bucket with owner-only upload/update/delete policies. Apply this migration before using the updated Owner Studio uploader.

If the first two migrations are already applied to your connected Supabase project, apply **only** `202611070003_content_previews_webp.sql` now:

- Open Supabase Dashboard → SQL Editor → New query.
- Paste the contents of that migration file.
- Run the query and confirm it completes successfully.

If you manage migrations with the Supabase CLI and the first two are already recorded in migration history, use:

```bash
supabase link --project-ref ydwqnlovmhtwgbnxeoci
supabase db push
```

If you previously ran the first migrations manually in SQL Editor, do not blindly run `db push` until you have checked the migration history. Use the SQL Editor method for migration 003 to avoid attempting to re-run earlier migrations.

### Create the single owner account

1. Register the owner account through the website.
2. Verify the email address.
3. In Supabase SQL Editor, grant the owner role to the correct Auth user UUID using the owner-setup SQL supplied with the project.
4. Never add an owner-role selector to public registration.

The project is intentionally designed around one owner account. Do not make owner-role changes available to members.

## 5. BTCPay Server and Supabase Edge Functions

The frontend uses the Supabase Edge Functions below. They are separate from the Vercel frontend deployment:

- `create-btc-invoice` — validates the signed-in member and creates an invoice using the selected membership/content price stored in Supabase.
- `btcpay-webhook` — verifies the BTCPay HMAC signature, fetches the invoice from BTCPay and grants access only after normal settlement and order/amount checks. Late, partial or unexpected payments remain locked for owner review.
- `get-content-url` — checks a member's access before returning a short-lived URL for protected media.

Supabase provides its project environment values to Edge Functions. Add the BTCPay values under Supabase Dashboard → Edge Functions → Secrets (or use `supabase secrets set`):

```text
BTCPAY_URL=https://btcpay474049.lndyn.com
BTCPAY_STORE_ID=3CnVWWTyhPt7Zuhk6XDy2VpAUkqkoQPrbb95ZxuCXJxY
BTCPAY_API_KEY=YOUR_PRIVATE_BTCPAY_API_KEY
BTCPAY_WEBHOOK_SECRET=YOUR_PRIVATE_WEBHOOK_SECRET
```

Do not put these four values in Vercel, `.env`, React code, GitHub, or the browser. Keep them exclusively in Supabase Edge Function Secrets. Do not share the values in screenshots or support chats.

Deploy the functions with the Supabase CLI:

```bash
supabase functions deploy create-btc-invoice
supabase functions deploy get-content-url --no-verify-jwt
supabase functions deploy btcpay-webhook --no-verify-jwt
```

`get-content-url` and `btcpay-webhook` perform their own authorization checks; the webhook authenticates BTCPay using the `BTCPAY-SIG` HMAC header. The webhook function must be deployed without Supabase JWT verification because BTCPay is not a logged-in Supabase user.

The webhook endpoint for this Supabase project is:

```text
https://ydwqnlovmhtwgbnxeoci.supabase.co/functions/v1/btcpay-webhook
```

The BTCPay webhook secret must be the secret displayed when you created the webhook in your BTCPay store. In BTCPay, subscribe to the invoice events used by the handler: Received Payment, Is Processing, Is Settled, Expired, Became Invalid, Payment Settled, Expired Paid Partial and Expired Paid Late. The function re-queries BTCPay rather than trusting the event name alone.

Before accepting live payments, test invoice creation, normal settlement, pending confirmations, partial payment, overpayment, late settlement, invoice expiry, webhook retries and duplicate webhook delivery. Ensure the Bitcoin node has completed initial blockchain synchronisation. Do not manually activate a membership because a customer sends a screenshot.

## 6. Deploy the frontend to Vercel

**Policy check before deploying:** this site is designed to sell access to adult-oriented nude/erotic material. Vercel's current Acceptable Use Policy prohibits content or conduct it classifies as “offensive, obscene, graphic” or sexually exploitative, among other restrictions. The policy does not give a simple blanket approval for an adult-membership service. Obtain written confirmation from Vercel that this exact website and business model are allowed before deploying the live service or serving adult content through it. A paid plan does not automatically override the Acceptable Use Policy. The Vercel Hobby plan is restricted to personal, non-commercial use; paid memberships make this a commercial project, so Hobby is not the appropriate plan if Vercel approves the service.

Official references:

- [Vercel Acceptable Use Policy](https://vercel.com/legal/acceptable-use-policy)
- [Vercel plans and Hobby restrictions](https://vercel.com/docs/plans/hobby)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

If Vercel confirms the project is eligible, follow the separate, step-by-step guide in [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md). The concise settings below are also included for reference:

### A. Prepare the source repository

1. Extract the ZIP to a folder on your computer.
2. Open the project folder (the one containing `package.json`).
3. Put the project in a private GitHub repository, or use Vercel's supported Git integration.
4. Ensure `.env` is not committed. `.gitignore` already excludes local environment files.

### B. Import into Vercel

1. Sign in at [Vercel](https://vercel.com/).
2. Choose **Add New → Project**.
3. Import the GitHub repository.
4. Set the Root Directory to the folder containing `package.json` (normally the repository root).
5. Choose **Vite** as the framework if Vercel does not detect it automatically.
6. Use these build settings:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Development command | `npm run dev` |

The included `vercel.json` already defines Vite, the build output, security headers and the SPA rewrite needed for TanStack Router deep links.

### C. Add frontend environment variables

In Vercel → Project → Settings → Environment Variables, add the following for Production and Preview as needed:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ydwqnlovmhtwgbnxeoci.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable/anon key |
| `VITE_SITE_NAME` | `Atelier After Dark` |
| `VITE_OWNER_DISPLAY_NAME` | Your public display name |
| `VITE_OWNER_TAGLINE` | Your personal tagline |
| `VITE_OWNER_PORTRAIT_URL` | URL of your public, non-explicit portrait |
| `VITE_OWNER_HERO_IMAGE_URL` | URL of your public, non-explicit hero image |
| `VITE_OWNER_FEATURE_IMAGE_URL` | URL of your public, non-explicit feature image |

Only the Supabase URL and publishable/anon key belong in the browser environment. **Do not add** `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any other private server credential to Vercel.

After adding or changing environment variables, trigger a new deployment. Vercel applies environment variable changes to new deployments.

### D. Update Supabase Auth URLs

After Vercel gives you a production address (for example `https://your-project.vercel.app`):

1. Open Supabase Dashboard → Authentication → URL Configuration.
2. Set Site URL to your production frontend address.
3. Add the exact production URL and required callback/redirect paths to the Redirect URLs allowlist.
4. Keep `http://localhost:5173/**` in the allowlist for local testing.
5. When you later attach a custom domain, add that domain and its authentication redirect URLs too.

### E. Confirm deployment

1. Open the Vercel deployment URL.
2. Test the public homepage, gallery, video page, membership page, registration, login, member dashboard and `/admin` owner route.
3. Test direct refresh on routes such as `/membership`, `/chat` and `/admin`; the included SPA rewrite should return `index.html` for these client-side routes.
4. Test Supabase email verification and password reset redirects.
5. Test image and video uploads from Owner Studio after applying migration 003.
6. Test BTCPay invoice creation and webhook delivery separately; those calls still run on Supabase Edge Functions, not Vercel.

## 7. Production checks and limits

- Replace the demonstration Unsplash portraits with images you own or are licensed to use. Use the `VITE_OWNER_*_URL` variables to personalise the homepage without editing React source.
- Set the real owner display name and tagline in Vercel environment variables.
- Apply migration 003 before uploading teaser images; otherwise the `preview_storage_path` column and `content-previews` bucket will be missing.
- Keep explicit originals in the private `private-content` bucket and public-safe teaser images in `content-previews` only.
- Browser-side WebP conversion optimises still images. Video files are validated and uploaded as MP4/WebM/MOV; the browser does not transcode video. Pre-encode large videos to H.264 MP4 before uploading.
- Large media uploads use TUS resumable upload. Supabase recommends TUS for files larger than 6 MB and uses 6 MB chunks.
- Protected assets are delivered using time-limited signed URLs (one hour, suitable for video playback). No browser app can prevent an authorised viewer from recording their screen.
- The 18+ entry prompt is self-attestation, not independent age verification. Add a lawful age-assurance provider where required.
- Only upload lawful content depicting adults who knowingly consented to the specific material and its publication. Keep records of releases and content rights as required.
- Audio/video session requests are requests only. Real-time calls require a separate calling provider and credentials.
- Review privacy, terms, refund, data-protection and age-assurance policies with qualified counsel for the jurisdictions where the site will operate.

For a shorter deployment checklist, see [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md).

## 8. Project structure

```text
src/
  components/SiteLayout.tsx
  lib/AuthContext.tsx
  lib/data.ts
  lib/media.ts
  lib/supabase.ts
  lib/types.ts
  pages/Pages.tsx
  router.tsx
  main.tsx
  styles.css
supabase/
  config.toml
  migrations/
    202611050001_initial_schema.sql
    202611050002_after_dark_chat_media.sql
    202611070003_content_previews_webp.sql
  functions/
    create-btc-invoice/index.ts
    btcpay-webhook/index.ts
    get-content-url/index.ts
vercel.json
```

## 9. Verification status

The project files and configuration were reviewed and repaired. The package now includes `tus-js-client`; the upload helper follows Supabase's documented resumable-upload pattern and the 6 MB chunk recommendation. The Vercel SPA rewrite and build settings are included.

A full `npm run build` could not be completed in the editing environment because npm dependencies were not installed and the package download timed out. Run `npm install` followed by `npm run build` locally or in Vercel before treating the deployment as production-ready. Do not accept live payments until BTCPay and Supabase end-to-end tests pass.
