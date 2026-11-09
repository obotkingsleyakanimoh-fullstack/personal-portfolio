import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { emailLayout, getPublicTeaser, sendEmailOnce, signUnsubscribeUser } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const encoder = new TextEncoder();

async function unsubscribe(req: Request, admin: any, url: URL) {
  const userId = url.searchParams.get('user_id') || '';
  const supplied = url.searchParams.get('signature') || '';
  const expected = await signUnsubscribeUser(userId);
  if (!userId || !supplied || !expected || supplied.length !== expected.length) {
    return new Response(unsubscribeHtml(false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const a = encoder.encode(supplied.toLowerCase());
  const b = encoder.encode(expected);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) return new Response(unsubscribeHtml(false), { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const { error } = await admin.from('profiles').update({ marketing_opt_in: false }).eq('id', userId);
  return new Response(unsubscribeHtml(!error), { status: error ? 500 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function unsubscribeHtml(success: boolean) {
  return `<!doctype html><html><body style="margin:0;padding:48px 16px;background:#fff4f8;font-family:Arial,sans-serif;color:#351a29;text-align:center"><main style="max-width:520px;margin:auto;padding:36px;background:#fff;border:1px solid #f2d5e0;border-radius:20px"><h1 style="font-family:Georgia,serif;color:#4a1630">Pink Doll Mansion</h1><h2>${success ? 'You are unsubscribed.' : 'We could not update that preference.'}</h2><p style="line-height:1.7;color:#765666">${success ? 'You will no longer receive membership reminders or promotional updates. Essential account and payment messages may still be sent.' : 'Please contact us through pinkdollmansion.com/contact if you need help.'}</p><a href="https://pinkdollmansion.com" style="display:inline-block;background:#b83268;color:white;padding:14px 22px;border-radius:24px;text-decoration:none">Return to Pink Doll Mansion</a></main></body></html>`;
}

async function handleSignupWelcome(admin: any, userId: string) {
  if (!userId) return json({ error: 'Missing user ID' }, 400);
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user?.email) return json({ error: 'The new account could not be verified' }, 404);
  const createdAt = new Date(user.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 45 * 60 * 1000 || createdAt > Date.now() + 60_000) {
    return json({ error: 'Welcome email is only available immediately after registration' }, 403);
  }
  const [{ data: profile }, teaser] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    getPublicTeaser(admin),
  ]);
  const firstName = String(profile?.full_name || user.user_metadata?.full_name || '').trim().split(/\s+/)[0];
  const html = emailLayout({
    preheader: 'Thank you for creating your Pink Doll Mansion account.',
    eyebrow: 'WELCOME TO THE MANSION',
    title: firstName ? `A warm welcome, ${firstName}.` : 'Your invitation has arrived.',
    intro: 'Thank you for creating an account at Pink Doll Mansion. This is your private place to explore the public gallery, discover membership rooms and manage your own access.',
    bodyHtml: '<p style="font-size:14px;line-height:1.8;color:#765666;margin:20px 0 0">A separate confirmation message has been sent to verify your email address. Confirm it before signing in or purchasing a membership. Your private originals remain protected behind account and access checks.</p><p style="font-size:13px;line-height:1.8;color:#765666;margin:18px 0 0">You can also <a href="https://pinkdollmansion.com/membership" style="color:#b83268">compare the membership rooms</a> and read our <a href="https://pinkdollmansion.com/privacy" style="color:#b83268">privacy information</a> before choosing your access.</p>',
    imageUrl: teaser.url,
    imageAlt: teaser.title ? `Public preview: ${teaser.title}` : 'A public preview from Pink Doll Mansion',
    buttonUrl: 'https://pinkdollmansion.com/gallery',
    buttonText: 'Explore the public gallery',
    footerNote: 'This is a one-time account welcome message. Membership and promotional reminders are sent only when you have opted in.',
  });
  const result = await sendEmailOnce(admin, { userId, eventKey: 'signup_welcome', to: user.email, subject: 'Welcome to Pink Doll Mansion — your private invitation', html });
  if (!result.sent && !result.alreadySent) console.error('Welcome email failed:', result.error);
  return json({ ok: result.sent, alreadySent: Boolean(result.alreadySent), error: result.error || undefined }, result.error && !result.alreadySent ? 502 : 200);
}

async function handleReminders(admin: any) {
  const now = Date.now();
  const windows = [
    { key: 'membership_nudge_day_2', days: 2 },
    { key: 'membership_nudge_day_7', days: 7 },
  ];
  const { data: profiles, error } = await admin.from('profiles')
    .select('id,full_name,created_at')
    .eq('role', 'member')
    .eq('marketing_opt_in', true)
    .limit(500);
  if (error) return json({ error: error.message }, 500);
  const { data: subscribedRows, error: membershipError } = await admin.from('memberships').select('user_id');
  if (membershipError) return json({ error: membershipError.message }, 500);
  const subscribed = new Set((subscribedRows || []).map((row: { user_id: string }) => row.user_id));
  const teaser = await getPublicTeaser(admin);
  let sent = 0;
  let skipped = 0;
  for (const profile of profiles || []) {
    if (!profile.created_at || subscribed.has(profile.id)) { skipped++; continue; }
    const ageDays = (now - new Date(profile.created_at).getTime()) / 86_400_000;
    const window = windows.find((candidate) => ageDays >= candidate.days && ageDays < candidate.days + 1);
    if (!window) { skipped++; continue; }
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(profile.id);
    const user = authData?.user;
    if (authError || !user?.email || !user.email_confirmed_at) { skipped++; continue; }
    const signature = await signUnsubscribeUser(profile.id);
    const unsubscribeUrl = signature
      ? `https://ydwqnlovmhtwgbnxeoci.supabase.co/functions/v1/email-lifecycle?action=unsubscribe&user_id=${encodeURIComponent(profile.id)}&signature=${signature}`
      : 'https://pinkdollmansion.com/account';
    const firstName = String(profile.full_name || user.user_metadata?.full_name || '').trim().split(/\s+/)[0];
    const dayTwo = window.days === 2;
    const html = emailLayout({
      preheader: dayTwo ? 'Your Pink Doll Mansion invitation is still here.' : 'A final gentle reminder about your Pink Doll Mansion account.',
      eyebrow: 'A GENTLE REMINDER',
      title: dayTwo ? 'Your private space is waiting.' : 'Still curious about the mansion?',
      intro: `${firstName ? `Hello ${firstName}, ` : 'Hello, '}you created a Pink Doll Mansion account but have not chosen a membership yet. Your account is ready whenever you decide to explore further.`,
      bodyHtml: '<p style="font-size:14px;line-height:1.8;color:#765666;margin:20px 0 0">Membership is optional. Take a look at the available access levels, what each includes and the price before deciding. There is no automatic renewal.</p>',
      imageUrl: teaser.url,
      imageAlt: teaser.title ? `Public preview: ${teaser.title}` : 'A public preview from Pink Doll Mansion',
      buttonUrl: 'https://pinkdollmansion.com/membership',
      buttonText: 'View membership options',
      footerHtml: `You asked to receive occasional Pink Doll Mansion updates. <a href="${unsubscribeUrl}" style="color:#b83268">Unsubscribe from these reminders</a>.`,
    });
    const result = await sendEmailOnce(admin, {
      userId: profile.id,
      eventKey: window.key,
      to: user.email,
      subject: dayTwo ? 'Your Pink Doll Mansion invitation is waiting' : 'A final Pink Doll Mansion membership reminder',
      html,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (result.sent) sent++; else skipped++;
  }
  return json({ ok: true, sent, skipped });
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Email service is not configured' }, 503);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (url.searchParams.get('action') === 'unsubscribe') return unsubscribe(req, admin, url);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const action = String(body.action || '');
  if (action === 'signup_welcome') return handleSignupWelcome(admin, String(body.userId || ''));
  if (action === 'send_reminders') {
    const expected = Deno.env.get('CRON_SECRET');
    const supplied = req.headers.get('x-cron-secret') || '';
    if (!expected || supplied !== expected) return json({ error: 'Not authorized' }, 401);
    return handleReminders(admin);
  }
  return json({ error: 'Unknown email action' }, 400);
});
