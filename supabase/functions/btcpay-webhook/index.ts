import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = `sha256=${toHex(digest)}`;
  // Constant-time comparison for equal-length UTF-8 strings.
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signature.toLowerCase());
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('BTCPAY_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const btcpayUrl = Deno.env.get('BTCPAY_URL')?.replace(/\/$/, '');
  const storeId = Deno.env.get('BTCPAY_STORE_ID');
  const apiKey = Deno.env.get('BTCPAY_API_KEY');
  if (!secret || !supabaseUrl || !serviceKey || !btcpayUrl || !storeId || !apiKey) return new Response('Webhook not configured', { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get('BTCPay-Sig');
  if (!(await verifySignature(rawBody, signature, secret))) return new Response('Invalid signature', { status: 401 });

  let event: Record<string, unknown>;
  try { event = JSON.parse(rawBody); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const invoiceId = String(event.invoiceId || event.invoice_id || '');
  const eventType = String(event.type || 'Unknown');
  const deliveryId = String(event.deliveryId || event.originalDeliveryId || `${eventType}:${invoiceId}`);
  if (!invoiceId) return new Response('Missing invoice identifier', { status: 400 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: order, error: lookupError } = await admin.from('payment_orders').select('*').eq('provider_invoice_id', invoiceId).maybeSingle();
  if (lookupError) return new Response('Order lookup failed', { status: 500 });
  if (!order) return new Response('Invoice not associated with an order', { status: 202 });

  const { error: eventError } = await admin.from('payment_events').upsert({
    provider_event_id: deliveryId,
    order_id: order.id,
    event_type: eventType,
    payload: event,
  }, { onConflict: 'provider_event_id', ignoreDuplicates: true });
  if (eventError) return new Response('Could not record payment event', { status: 500 });

  // Do not fulfil based only on the notification label. Re-read the invoice from BTCPay.
  let invoice: Record<string, unknown>;
  try {
    const response = await fetch(`${btcpayUrl}/api/v1/stores/${encodeURIComponent(storeId)}/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: { Authorization: `token ${apiKey}` },
    });
    if (!response.ok) return new Response('Invoice reconciliation failed', { status: 503 });
    invoice = await response.json();
  } catch { return new Response('Invoice reconciliation unavailable', { status: 503 }); }

  const invoiceStatus = String(invoice.status || '');
  const additionalStatus = String(invoice.additionalStatus || '');
  const additionalKey = additionalStatus.toLowerCase();
  // Only a normally settled invoice can unlock access. Late/over/under payments
  // are deliberately sent to manual review rather than being treated as paid.
  const settled = invoiceStatus.toLowerCase() === 'settled' && (additionalKey === '' || additionalKey === 'none');

  if (!settled) {
    let status = 'awaiting_payment';
    if (invoiceStatus.toLowerCase() === 'processing' || invoiceStatus.toLowerCase() === 'new') status = 'confirmation_pending';
    if (invoiceStatus.toLowerCase() === 'expired') status = 'expired';
    if (invoiceStatus.toLowerCase() === 'invalid') status = 'failed';
    if (additionalKey.includes('partial')) status = 'underpaid';
    else if (additionalKey.includes('over')) status = 'overpaid';
    else if (invoiceStatus.toLowerCase() === 'settled' && additionalKey.includes('under')) status = 'underpaid';
    else if (invoiceStatus.toLowerCase() === 'settled') status = 'failed'; // late or unexpected settlement: owner review required
    await admin.from('payment_orders').update({ status, transaction_id: String(event.paymentId || '') || null }).eq('id', order.id);
    await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', deliveryId);
    return new Response('Event recorded; no access granted', { status: 200 });
  }

  if (order.fulfillment_applied) return new Response('Already fulfilled', { status: 200 });
  const { data: claimed, error: claimError } = await admin.rpc('claim_payment_fulfillment', { order_uuid: order.id });
  if (claimError) return new Response('Could not claim payment fulfilment', { status: 500 });
  if (!claimed) return new Response('Fulfilment is already being processed', { status: 200 });
  // Compare BTCPay's fiat invoice fields with the original order. `amountPaid` is
  // not a Greenfield invoice field; payment-method totals can be denominated in BTC.
  const invoiceAmount = Number(invoice.amount);
  const paidAmount = Number(invoice.paidAmount);
  const expectedAmount = Number(order.amount);
  const invoiceCurrency = String(invoice.currency || '').toUpperCase();
  const orderCurrency = String(order.currency || '').toUpperCase();
  const orderMatchesInvoice = Number.isFinite(invoiceAmount) &&
    Math.abs(invoiceAmount - expectedAmount) <= 0.00000001 && invoiceCurrency === orderCurrency;
  const paymentCoversInvoice = Number.isFinite(paidAmount) && paidAmount + 0.00000001 >= invoiceAmount;
  if (!orderMatchesInvoice || !paymentCoversInvoice) {
    const reviewStatus = Number.isFinite(paidAmount) && paidAmount + 0.00000001 < invoiceAmount ? 'underpaid' : 'failed';
    await admin.from('payment_orders').update({ status: reviewStatus, fulfillment_claimed_at: null }).eq('id', order.id);
    await admin.from('payment_events').update({ processed_at: new Date().toISOString() }).eq('provider_event_id', deliveryId);
    return new Response('Invoice amount or currency does not match the order; no access granted', { status: 200 });
  }

  const now = new Date();
  if (order.product_type === 'membership' && order.plan_id) {
    const { data: plan, error: planError } = await admin.from('membership_plans').select('duration_days,can_chat').eq('id', order.plan_id).single();
    if (planError || !plan) { await admin.from('payment_orders').update({ fulfillment_claimed_at: null }).eq('id', order.id); return new Response('Membership plan missing', { status: 500 }); }
    const { data: currentMembership } = await admin.from('memberships').select('ends_at').eq('user_id', order.user_id).eq('status', 'active').gt('ends_at', now.toISOString()).order('ends_at', { ascending: false }).limit(1).maybeSingle();
    const startsAt = currentMembership?.ends_at && new Date(currentMembership.ends_at).getTime() > now.getTime() ? new Date(currentMembership.ends_at) : now;
    const endsAt = new Date(startsAt.getTime() + Number(plan.duration_days) * 86400000).toISOString();
    const { error: grantError } = await admin.from('memberships').upsert({
      user_id: order.user_id, plan_id: order.plan_id, payment_order_id: order.id,
      status: 'active', starts_at: startsAt.toISOString(), ends_at: endsAt,
    }, { onConflict: 'payment_order_id' });
    if (grantError) { await admin.from('payment_orders').update({ fulfillment_claimed_at: null }).eq('id', order.id); return new Response('Could not grant membership', { status: 500 }); }
    await admin.from('notifications').insert({ user_id: order.user_id, type: 'membership_activated', title: 'Your membership is active', body: 'Your private edition access has been activated.' });
  } else if (order.product_type === 'content' && order.content_id) {
    const { error: purchaseError } = await admin.from('content_purchases').upsert({ user_id: order.user_id, content_id: order.content_id, payment_order_id: order.id, status: 'active' }, { onConflict: 'user_id,content_id' });
    if (purchaseError) { await admin.from('payment_orders').update({ fulfillment_claimed_at: null }).eq('id', order.id); return new Response('Could not unlock content', { status: 500 }); }
    await admin.from('notifications').insert({ user_id: order.user_id, type: 'content_unlocked', title: 'Your content is unlocked', body: 'Your premium content purchase is ready.' });
  } else {
    await admin.from('payment_orders').update({ fulfillment_claimed_at: null }).eq('id', order.id);
    return new Response('Unsupported order type', { status: 400 });
  }

  await admin.from('payment_orders').update({ status: 'confirmed', confirmed_at: now.toISOString(), fulfillment_applied: true, transaction_id: String(event.paymentId || '') || null }).eq('id', order.id);
  await admin.from('payment_events').update({ processed_at: now.toISOString() }).eq('provider_event_id', deliveryId);
  return new Response('Payment verified and access granted', { status: 200 });
});
