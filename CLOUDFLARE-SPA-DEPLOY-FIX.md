# Pink Doll Mansion — Cloudflare SPA deployment fix

## Why the deployment failed

The build completed successfully. Wrangler failed while publishing because `public/_redirects` contained:

    /* /index.html 200

That wildcard rewrite also matched `/index.html`, so Cloudflare detected a possible redirect/rewrite loop (error 100324).

## Files in this patch

- `wrangler.jsonc`: tells Wrangler to serve the Vite `dist` directory and use Cloudflare's native single-page-application fallback for React routes.
- `public/_redirects`: intentionally empty. It replaces the old wildcard rewrite. You may alternatively delete `public/_redirects` entirely.

## Apply it

1. Extract this ZIP into the root of your existing GitHub project, preserving the folder paths and replacing files when asked.
2. Confirm the root now contains `wrangler.jsonc`.
3. Confirm `public/_redirects` is empty, or delete it.
4. Commit and push the changes:

       git add wrangler.jsonc public/_redirects
       git commit -m "Fix Cloudflare SPA routing"
       git push origin main

5. In Cloudflare's Workers & Pages build settings, keep:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Deploy command: `npx wrangler deploy`
   - Worker name: `personal-portfolio`

Wrangler will read the committed `wrangler.jsonc` rather than generating a temporary configuration. The SPA fallback is handled by Workers Static Assets, so React routes such as `/login`, `/membership`, `/gallery`, and `/admin` can load on direct visits or refreshes without a wildcard `_redirects` rule.

## What this does not change

This patch does not change React components, Supabase configuration, authentication, BTCPay, Resend, database migrations, DNS records, or the domain-level redirects configured in the Cloudflare dashboard.

## Verify after deployment

Open these routes directly in a new browser tab and refresh each one:

- `https://pinkdollmansion.com/`
- `https://pinkdollmansion.com/login`
- `https://pinkdollmansion.com/membership`
- `https://pinkdollmansion.com/gallery`

Each should load the React app rather than return a Cloudflare 404.
