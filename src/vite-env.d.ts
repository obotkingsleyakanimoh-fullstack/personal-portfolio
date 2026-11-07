/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_OWNER_DISPLAY_NAME?: string;
  readonly VITE_OWNER_TAGLINE?: string;
  readonly VITE_OWNER_PORTRAIT_URL?: string;
  readonly VITE_OWNER_HERO_IMAGE_URL?: string;
  readonly VITE_OWNER_FEATURE_IMAGE_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
