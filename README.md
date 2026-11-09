# Pink Doll Mansion

A single-owner personal portfolio and private membership site built with React, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind CSS and Supabase. Members interact with one website owner; there is no member directory, member-to-member messaging, creator marketplace or group chat.

The project includes Supabase authentication, membership plans, protected media delivery, private one-to-one chat, an owner studio, BTCPay Server checkout, and Pink Doll Mansion branded Resend emails. The frontend is prepared for Cloudflare Pages and runs separately from Supabase and BTCPay Server.

**Production domain and email setup:** use [`CLOUDFLARE_AND_EMAIL_SETUP.md`](./CLOUDFLARE_AND_EMAIL_SETUP.md) as the current deployment guide. It covers `pinkdollmansion.com`, Cloudflare Pages, Resend, Supabase Auth templates, transactional emails and opted-in membership reminders.

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
VITE_SITE_NAME=Pink Doll Mansion
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

The migrations are in `supabase/migrations/` and must be applied in filename order on a fresh project:

1. `202611050001_initial_schema.sql`
2. `202611050002_after_dark_chat_media.sql`
3. `202611070003_content_previews_webp.sql`
4. `202611070004_owner_managed_site_appearance.sql`
5. `202611080005_private_content_watermark.sql`
6. `202611090006_pink_doll_mansion_email_branding.sql`

If migrations 001–005 are already applied on the live Supabase project, apply **only** migration 006 (`202611090006_pink_doll_mansion_email_branding.sql`) now. It adds the marketing preference and private email-delivery log, updates the stored Pink Doll Mansion theme and renames the tier-two plan. Use Supabase SQL Editor if the existing migration history was managed manually. Do not blindly run `db push` against a database whose migration history does not match the files.

Migration 003 creates the public-safe `content-previews` bucket; migration 004 adds owner-managed appearance settings; migration 005 restricts the anonymous content listing and adds private content visibility checks. Keep those in sequence.

### Create the single owner account

1. Register the owner account through the website.
2. Verify the email address.
3. In Supabase SQL Editor, grant the owner role to the correct Auth user UUID using the owner-setup SQL supplied with the project.
4. Never add an owner-role selector to public registration.

The project is intentionally designed around one owner account. Do not make owner-role changes available to members.

## 5. BTCPay Server and Supabase Edge Functions

The frontend uses the Supabase Edge Functions below. They run on Supabase, independently of the Cloudflare Pages frontend:

- `create-btc-invoice` — validates the signed-in member and creates an invoice using the selected membership/content price stored in Supabase.
- `btcpay-webhook` — verifies the BTCPay HMAC signature, fetches the invoice from BTCPay and grants access only after normal settlement and order/amount checks. Late, partial or unexpected payments remain locked for owner review. It also sends the membership activation email after payment is verified and access is granted.
- `get-content-url` — checks a member's access before returning a short-lived URL for protected media.
- `email-lifecycle` — sends the account welcome email, the two opted-in membership reminders and unsubscribe confirmations through Resend.

Supabase provides its project environment values to Edge Functions. Add the BTCPay values under Supabase Dashboard → Edge Functions → Secrets (or use `supabase secrets set`):

```text
BTCPAY_URL=https://btcpay474049.lndyn.com
BTCPAY_STORE_ID=3CnVWWTyhPt7Zuhk6XDy2VpAUkqkoQPrbb95ZxuCXJxY
BTCPAY_API_KEY=YOUR_PRIVATE_BTCPAY_API_KEY
BTCPAY_WEBHOOK_SECRET=YOUR_PRIVATE_WEBHOOK_SECRET
```

Do not put these four values in Cloudflare Pages build variables, `.env`, React code, GitHub, or the browser. Keep them exclusively in Supabase Edge Function Secrets. Do not share the values in screenshots or support chats.

Deploy the functions with the Supabase CLI:

```bash
supabase functions deploy create-btc-invoice
supabase functions deploy get-content-url --no-verify-jwt
supabase functions deploy btcpay-webhook --no-verify-jwt
supabase functions deploy email-lifecycle --no-verify-jwt
```

`get-content-url` and `btcpay-webhook` perform their own authorization checks; the webhook authenticates BTCPay using the `BTCPAY-SIG` HMAC header. The webhook function must be deployed without Supabase JWT verification because BTCPay is not a logged-in Supabase user.

The webhook endpoint for this Supabase project is:

```text
https://ydwqnlovmhtwgbnxeoci.supabase.co/functions/v1/btcpay-webhook
```

The BTCPay webhook secret must be the secret displayed when you created the webhook in your BTCPay store. In BTCPay, subscribe to the invoice events used by the handler: Received Payment, Is Processing, Is Settled, Expired, Became Invalid, Payment Settled, Expired Paid Partial and Expired Paid Late. The function re-queries BTCPay rather than trusting the event name alone.

Before accepting live payments, test invoice creation, normal settlement, pending confirmations, partial payment, overpayment, late settlement, invoice expiry, webhook retries and duplicate webhook delivery. Ensure the Bitcoin node has completed initial blockchain synchronisation. Do not manually activate a membership because a customer sends a screenshot.

## 6. Deploy the frontend to Cloudflare Pages

The current production deployment target is **Cloudflare Pages**. Use [`CLOUDFLARE_AND_EMAIL_SETUP.md`](./CLOUDFLARE_AND_EMAIL_SETUP.md) for the complete Cloudflare, DNS, Resend and Supabase email checklist.

In Cloudflare Dashboard → **Workers & Pages → Create application → Pages → Connect to Git**, select the repository and use:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | folder containing `package.json` |
| Node version | `22` |

Set these frontend build variables under the Cloudflare Pages project settings:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ydwqnlovmhtwgbnxeoci.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase publishable/anon key |
| `VITE_SITE_NAME` | `Pink Doll Mansion` |
| `VITE_OWNER_DISPLAY_NAME` | Your public display name |
| `VITE_OWNER_TAGLINE` | Your public tagline |
| `VITE_OWNER_PORTRAIT_URL` | Optional public-safe portrait URL |
| `VITE_OWNER_HERO_IMAGE_URL` | Optional public-safe hero image URL |
| `VITE_OWNER_FEATURE_IMAGE_URL` | Optional public-safe feature image URL |

Only public frontend values belong in these variables. Do not add a Resend API key, Supabase service-role key, BTCPay API key, webhook secret or cron secret to Cloudflare Pages. Those belong in Supabase Edge Function Secrets.

After the first deployment, add `pinkdollmansion.com` under **Workers & Pages → your Pages project → Custom domains**. Cloudflare Pages can provision the website DNS record when the domain is active in the same Cloudflare zone. Add `www.pinkdollmansion.com` as a second custom domain only if you plan to serve it, then create a redirect to your preferred canonical hostname. The included `public/_redirects` file supports the React/TanStack single-page routes on Pages.

Update Supabase → Authentication → URL Configuration:

- Site URL: `https://pinkdollmansion.com`
- Redirect allow-list: `https://pinkdollmansion.com/**`
- Optional www hostname: `https://www.pinkdollmansion.com/**`
- Local development: `http://localhost:5173/**`

Cloudflare Pages is the current guide. `vercel.json` and `VERCEL_DEPLOYMENT.md` are legacy deployment files and are not used by Cloudflare Pages.

## 7. Production checks and limits

- Replace the demonstration Unsplash portraits with images you own or are licensed to use. Use the `VITE_OWNER_*_URL` variables to personalise the homepage without editing React source.
- Set the real owner display name and tagline in Cloudflare Pages build variables.
- Apply migrations 003–006 after the first two migrations; they add public-safe previews, owner-managed appearance, restricted media listing, the Pink Doll Mansion palette and email lifecycle support.
- Keep explicit originals in the private `private-content` bucket and public-safe teaser images in `content-previews` only.
- Browser-side WebP conversion optimises still images. Video files are validated and uploaded as MP4/WebM/MOV; the browser does not transcode video. Pre-encode large videos to H.264 MP4 before uploading.
- Large media uploads use TUS resumable upload. Supabase recommends TUS for files larger than 6 MB and uses 6 MB chunks.
- Protected assets are delivered using time-limited signed URLs (one hour, suitable for video playback). No browser app can prevent an authorised viewer from recording their screen.
- The 18+ entry prompt is self-attestation, not independent age verification. Add a lawful age-assurance provider where required.
- Only upload lawful content depicting adults who knowingly consented to the specific material and its publication. Keep records of releases and content rights as required.
- Audio/video session requests are requests only. Real-time calls require a separate calling provider and credentials.
- Review privacy, terms, refund, data-protection and age-assurance policies with qualified counsel for the jurisdictions where the site will operate.

For the email and domain setup, see [`CLOUDFLARE_AND_EMAIL_SETUP.md`](./CLOUDFLARE_AND_EMAIL_SETUP.md).

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
    202611070004_owner_managed_site_appearance.sql
    202611080005_private_content_watermark.sql
    202611090006_pink_doll_mansion_email_branding.sql
  functions/
    _shared/email.ts
    create-btc-invoice/index.ts
    btcpay-webhook/index.ts
    email-lifecycle/index.ts
    get-content-url/index.ts
  templates/
    confirmation.html
    recovery.html
    magic_link.html
    email_change.html
    invite.html
    reauthentication.html
public/_redirects
```

## 9. Verification status

The Pink Doll Mansion project branding, email templates, lifecycle email functions, Cloudflare Pages routing file and setup guide are included. The Supabase migration and Edge Functions still need to be applied/deployed, and the Cloudflare, SMTP and Resend dashboard settings must be entered before email delivery is live.

A full `npm run build` could not be completed in this editing environment: the npm dependency installation timed out and left an incomplete `node_modules` directory. Run `npm ci` and then `npm run build` locally or in Cloudflare Pages before treating the deployment as production-ready. Test signup confirmation, password reset, Resend welcome, payment settlement and the opted-in reminder/unsubscribe flow before launch.
