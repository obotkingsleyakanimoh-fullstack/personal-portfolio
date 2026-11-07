import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const btcpayUrl = Deno.env.get('BTCPAY_URL')?.replace(/\/$/, '');
  const storeId = Deno.env.get('BTCPAY_STORE_ID');
  const apiKey = Deno.env.get('BTCPAY_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !btcpayUrl || !storeId || !apiKey) {
    return json({ error: 'Payment service is not configured. No invoice was created.' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in is required.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Your session is invalid. Please sign in again.' }, 401);
  if (!userData.user.email_confirmed_at) return json({ error: 'Verify your email address before purchasing a membership or premium content.' }, 403);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: accountProfile } = await admin.from('profiles').select('status').eq('id', userData.user.id).maybeSingle();
  if (!accountProfile || accountProfile.status !== 'active') return json({ error: 'This account is not currently allowed to make purchases.' }, 403);

  let body: { productType?: string; productId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  const productType = body.productType;
  const productId = body.productId;
  if (!productId || !['membership', 'content'].includes(productType || '')) return json({ error: 'Select a valid membership or content item.' }, 400);

  let amount: number;
  let currency: string;
  let planId: string | null = null;
  let contentId: string | null = null;
  let description: string;

  if (productType === 'membership') {
    const { data: plan, error } = await admin.from('membership_plans').select('id,name,price_amount,currency,is_active').eq('id', productId).eq('is_active', true).maybeSingle();
    if (error || !plan) return json({ error: 'That membership plan is unavailable.' }, 404);
    amount = Number(plan.price_amount); currency = plan.currency; planId = plan.id; description = `Membership: ${plan.name}`;
  } else {
    const { data: item, error } = await admin.from('content_items').select('id,title,price_amount,currency,access_level,is_published').eq('id', productId).eq('is_published', true).maybeSingle();
    if (error || !item || item.access_level !== 'premium' || !item.price_amount) return json({ error: 'That premium content item is unavailable for individual purchase.' }, 404);
    contentId = item.id; amount = Number(item.price_amount); currency = item.currency; description = `Premium content: ${item.title}`;
  }
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'The configured price is invalid.' }, 400);

  const { data: order, error: orderError } = await admin.from('payment_orders').insert({
    user_id: userData.user.id,
    product_type: productType,
    product_id: productId,
    plan_id: planId,
    content_id: contentId,
    amount,
    currency,
    status: 'awaiting_payment',
    provider: 'btcpay',
  }).select('id').single();
  if (orderError || !order) return json({ error: 'Could not create the payment order.' }, 500);

  try {
    const response = await fetch(`${btcpayUrl}/api/v1/stores/${encodeURIComponent(storeId)}/invoices`, {
      method: 'POST',
      headers: { Authorization: `token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount.toFixed(2), currency, metadata: { orderId: order.id, orderDescription: description }, checkout: { paymentMethods: ['BTC-CHAIN'], defaultPaymentMethod: 'BTC-CHAIN' } }),
    });
    if (!response.ok) {
      const detail = await response.text();
      await admin.from('payment_orders').update({ status: 'failed' }).eq('id', order.id);
      console.error('BTCPay invoice request failed:', response.status, detail.slice(0, 500));
      return json({ error: 'The Bitcoin provider could not create an invoice. Please try again later.' }, 502);
    }
    const invoice = await response.json();
    if (!invoice.id || !invoice.checkoutLink) {
      await admin.from('payment_orders').update({ status: 'failed' }).eq('id', order.id);
      return json({ error: 'The payment provider returned an incomplete invoice.' }, 502);
    }
    await admin.from('payment_orders').update({
      provider_invoice_id: invoice.id,
      checkout_url: invoice.checkoutLink,
      expires_at: invoice.expirationTime || invoice.expiresAt || null,
      status: 'awaiting_payment',
    }).eq('id', order.id);
    return json({ orderId: order.id, invoiceId: invoice.id, checkoutLink: invoice.checkoutLink, amount: invoice.amount || amount.toFixed(2), currency, expiresAt: invoice.expirationTime || invoice.expiresAt || null });
  } catch (error) {
    await admin.from('payment_orders').update({ status: 'failed' }).eq('id', order.id);
    console.error('BTCPay network error:', error);
    return json({ error: 'Could not reach the Bitcoin payment provider.' }, 502);
  }
});
