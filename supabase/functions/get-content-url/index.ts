import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Content delivery is not configured.' }, 503);
  const auth = req.headers.get('Authorization');
  let userClient: any = null;
  if (auth) {
    userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) userClient = null; // Public anon-key requests are allowed for published public items only.
  }
  let body: { contentId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (!body.contentId) return json({ error: 'Content ID is required.' }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: item, error } = await admin.from('content_items').select('storage_path,content_type,access_level,is_published').eq('id', body.contentId).eq('is_published', true).single();
  if (error || !item) return json({ error: 'Content not found.' }, 404);
  if (item.access_level !== 'public') {
    if (!userClient) return json({ error: 'Sign in to access this private content.' }, 401);
    const { data: allowed, error: accessError } = await userClient.rpc('can_access_content', { content_uuid: body.contentId });
    if (accessError || !allowed) return json({ error: 'This item is not included in your current access.' }, 403);
  }
  const bucket = Deno.env.get('CONTENT_BUCKET') || 'private-content';
  const { data: signed, error: signedError } = await admin.storage.from(bucket).createSignedUrl(item.storage_path, 3600);
  if (signedError || !signed?.signedUrl) {
    console.error('Private media signing failed:', signedError?.message || 'Missing signed URL');
    return json({ error: 'The protected file could not be prepared. Please try again or contact the owner if the issue continues.' }, 500);
  }
  return json({ signedUrl: signed.signedUrl, contentType: item.content_type, expiresIn: 3600 });
});
