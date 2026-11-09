const encoder = new TextEncoder();

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] as string);
}

export function emailLayout(options: {
  preheader: string;
  eyebrow?: string;
  title: string;
  intro: string;
  bodyHtml?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  buttonUrl: string;
  buttonText: string;
  footerNote?: string;
  footerHtml?: string;
}): string {
  const image = options.imageUrl && /^https:\/\//i.test(options.imageUrl)
    ? `<a href="https://pinkdollmansion.com/gallery" style="display:block;margin:26px 0 0"><img src="${escapeHtml(options.imageUrl)}" alt="${escapeHtml(options.imageAlt || 'A preview from Pink Doll Mansion')}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:16px" /></a>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pink Doll Mansion</title></head>
  <body style="margin:0;padding:0;background:#fff4f8;font-family:Arial,Helvetica,sans-serif;color:#351a29">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff4f8;padding:34px 12px"><tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #f2d5e0;border-radius:22px;overflow:hidden">
        <tr><td style="padding:26px 34px;background:#4a1630;text-align:center">
          <div style="font-family:Georgia,serif;font-size:31px;letter-spacing:.03em;color:#fff7fa">Pink Doll Mansion</div>
          <div style="margin-top:8px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#f4bdd0">A private world · Adults 18+</div>
        </td></tr>
        <tr><td style="padding:36px 34px 34px">
          <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#b83268;font-weight:bold">${escapeHtml(options.eyebrow || 'A PRIVATE INVITATION')}</div>
          <h1 style="margin:14px 0 12px;font-family:Georgia,serif;font-size:34px;line-height:1.15;font-weight:normal;color:#4a1630">${escapeHtml(options.title)}</h1>
          <p style="font-size:15px;line-height:1.8;color:#765666;margin:0">${escapeHtml(options.intro)}</p>
          ${options.bodyHtml || ''}${image}
          <div style="padding:28px 0 10px"><a href="${escapeHtml(options.buttonUrl)}" style="display:inline-block;background:#b83268;color:#ffffff;text-decoration:none;padding:15px 24px;border-radius:999px;font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(options.buttonText)}</a></div>
          <p style="font-size:12px;line-height:1.7;color:#987585;margin:18px 0 0">${options.footerHtml || escapeHtml(options.footerNote || 'Please keep your account details private. Pink Doll Mansion is intended for adults aged 18 and over.')}</p>
        </td></tr>
        <tr><td style="padding:22px 34px;background:#fff7fa;border-top:1px solid #f2d5e0;text-align:center">
          <div style="font-family:Georgia,serif;font-size:18px;color:#4a1630">Pink Doll Mansion</div>
          <div style="margin-top:8px;font-size:11px;color:#987585"><a href="https://pinkdollmansion.com" style="color:#b83268;text-decoration:none">pinkdollmansion.com</a> · <a href="https://pinkdollmansion.com/privacy" style="color:#b83268;text-decoration:none">Privacy</a> · <a href="https://pinkdollmansion.com/terms" style="color:#b83268;text-decoration:none">Terms</a></div>
          <div style="margin-top:10px;font-size:10px;color:#ad98a2">You received this message because of activity on Pink Doll Mansion.</div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

export async function getPublicTeaser(admin: any): Promise<{ url: string | null; title: string | null }> {
  const { data } = await admin.from('content_public')
    .select('title,preview_url')
    .eq('access_level', 'public')
    .not('preview_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const url = typeof data?.preview_url === 'string' && /^https:\/\//i.test(data.preview_url) ? data.preview_url : null;
  return { url, title: typeof data?.title === 'string' ? data.title : null };
}

export async function sendEmailOnce(admin: any, options: {
  userId: string;
  eventKey: string;
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}): Promise<{ sent: boolean; alreadySent?: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') || 'Pink Doll Mansion <hello@pinkdollmansion.com>';
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not configured' };

  const { data: existing, error: lookupError } = await admin.from('email_deliveries')
    .select('id,status,created_at')
    .eq('user_id', options.userId)
    .eq('event_key', options.eventKey)
    .maybeSingle();
  if (lookupError) return { sent: false, error: lookupError.message };
  if (existing?.status === 'sent') return { sent: true, alreadySent: true };
  if (existing?.status === 'pending' && Date.now() - new Date(existing.created_at).getTime() < 5 * 60 * 1000) {
    return { sent: false, alreadySent: true, error: 'A delivery attempt is already in progress' };
  }

  if (existing?.id) {
    const { error } = await admin.from('email_deliveries').update({ status: 'pending', error_message: null, updated_at: new Date().toISOString() }).eq('id', existing.id);
    if (error) return { sent: false, error: error.message };
  } else {
    const { error } = await admin.from('email_deliveries').insert({ user_id: options.userId, event_key: options.eventKey, status: 'pending' });
    if (error) {
      if (error.code === '23505') return { sent: false, alreadySent: true, error: 'This email event has already been claimed' };
      return { sent: false, error: error.message };
    }
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [options.to], subject: options.subject, html: options.html, headers: options.headers }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resend request failed';
    await admin.from('email_deliveries').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() }).eq('user_id', options.userId).eq('event_key', options.eventKey);
    return { sent: false, error: message };
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(result?.message || result?.name || `Resend returned HTTP ${response.status}`);
    await admin.from('email_deliveries').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() }).eq('user_id', options.userId).eq('event_key', options.eventKey);
    return { sent: false, error: message };
  }
  await admin.from('email_deliveries').update({ status: 'sent', provider_message_id: String(result?.id || ''), sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq('user_id', options.userId).eq('event_key', options.eventKey);
  return { sent: true };
}

export async function signUnsubscribeUser(userId: string): Promise<string | null> {
  const secret = Deno.env.get('EMAIL_PREFERENCE_SECRET');
  if (!secret) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`pinkdollmansion-unsubscribe:${userId}`));
  return Array.from(new Uint8Array(signature)).map((part) => part.toString(16).padStart(2, '0')).join('');
}
