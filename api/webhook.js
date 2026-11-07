// File: api/webhook.js
// Unified Vercel Serverless Webhook & CORS Proxy for DUD OS 666
import crypto from 'crypto';

export default async function handler(req, res) {
  // 1. CORS Headers so dud-os-666.vercel.app & www.dudcloset.com can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-razorpay-signature, x-api-source');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // =========================================================================
  // 2. GET REQUEST: META (WHATSAPP CLOUD API & INSTAGRAM) WEBHOOK VERIFICATION
  // =========================================================================
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Set META_VERIFY_TOKEN="DUD_OS_666_VERIFY" in Vercel Environment Variables
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'DUD_OS_666_VERIFY';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Meta / WhatsApp / Instagram Webhook Verified');
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      status: 'ONLINE',
      system: 'DUD OS 666 Unified Omnichannel Gateway',
      gstin: '33CVFPP9066H1Z7',
      store: 'Thiru Vi Ka Nagar, Perambur, Chennai - 600082',
      endpoints: [
        'Razorpay Webhook (payment.captured / order.paid)',
        'Shiprocket Proxy & Tracking Webhook',
        'WhatsApp Business Cloud API (v21.0)',
        'Instagram Graph API (@dud__official & @dudclosetofficial)',
        'Amazon SP-API / Flipkart v3 / Meesho Order Sync',
        'Google Business Profile (GMB Perambur)'
      ]
    });
  }

  // =========================================================================
  // 3. POST REQUEST: HANDLE INCOMING WEBHOOKS & OUTBOUND API PROXY ACTIONS
  // =========================================================================
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const action = req.query.action || body.action || '';
      const rzpSignature = req.headers['x-razorpay-signature'];

      // ---------------------------------------------------------------------
      // A. RAZORPAY WEBHOOK (From Hostinger www.dudcloset.com or Payment Links)
      // ---------------------------------------------------------------------
      if (rzpSignature || (body.event && body.event.startsWith('payment.'))) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (secret && rzpSignature) {
          const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(body))
            .digest('hex');
          if (expectedSig !== rzpSignature) {
            return res.status(401).json({ error: 'Invalid Razorpay signature' });
          }
        }

        const payment = body.payload?.payment?.entity || {};
        const orderRecord = {
          source: 'RAZORPAY_HOSTINGER',
          paymentId: payment.id || 'pay_live',
          amount: (payment.amount || 0) / 100,
          customerPhone: payment.contact || '',
          customerEmail: payment.email || '',
          notes: payment.notes || {},
          timestamp: new Date().toISOString()
        };

        // Optional: Auto-push to Supabase if SUPABASE_URL & SUPABASE_SERVICE_KEY are set
        await pushToSupabaseIfConfigured('omnichannel_orders', orderRecord);

        // Optional: Auto-send WhatsApp confirmation via Cloud API
        if (orderRecord.customerPhone && process.env.WA_ACCESS_TOKEN && process.env.WA_PHONE_NUMBER_ID) {
          await sendWhatsAppCloudMessage(
            orderRecord.customerPhone,
            `Thank you for your order at DUD CLOSET! Your payment of ₹${orderRecord.amount} (Ref: ${orderRecord.paymentId}) is confirmed. We are preparing your shipment via Shiprocket.`
          );
        }

        return res.status(200).json({ received: true, type: 'RAZORPAY_CAPTURED', orderRecord });
      }

      // ---------------------------------------------------------------------
      // B. OUTBOUND WHATSAPP CLOUD API DISPATCH (Called from DUD OS 666 POS)
      // ---------------------------------------------------------------------
      if (action === 'send_whatsapp') {
        const phoneId = process.env.WA_PHONE_NUMBER_ID || body.phoneId;
        const token = process.env.WA_ACCESS_TOKEN || body.token;
        const to = String(body.to || '').replace(/\D/g, '').slice(-10);
        const messageText = body.message;

        if (!phoneId || !token || !to) {
          return res.status(400).json({ error: 'Missing WhatsApp Cloud API credentials or recipient phone' });
        }

        const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${to}`,
            type: 'text',
            text: { body: messageText }
          })
        });
        const waData = await waRes.json();
        return res.status(200).json({ status: 'WHATSAPP_DISPATCHED', waData });
      }

      // ---------------------------------------------------------------------
      // C. SHIPROCKET LIVE ORDER CREATION & AWB DISPATCH PROXY
      // ---------------------------------------------------------------------
      if (action === 'shiprocket_create_order') {
        const email = process.env.SHIPROCKET_EMAIL || body.email;
        const password = process.env.SHIPROCKET_PASSWORD || body.password;

        // Step 1: Get JWT Token
        const authRes = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const authData = await authRes.json();
        if (!authData.token) {
          return res.status(401).json({ error: 'Shiprocket Auth Failed', details: authData });
        }

        // Step 2: Create Adhoc Order
        const orderPayload = {
          order_id: body.order_id || `DUD-${Date.now()}`,
          order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          pickup_location: 'Primary',
          billing_customer_name: body.customer_name || 'Customer',
          billing_last_name: '',
          billing_address: body.address || 'Chennai',
          billing_city: body.city || 'Chennai',
          billing_pincode: body.pincode || '600082',
          billing_state: 'Tamil Nadu',
          billing_country: 'India',
          billing_email: 'orders@dudcloset.com',
          billing_phone: body.phone || '9345125257',
          shipping_is_billing: true,
          order_items: [
            {
              name: body.item_name || 'DUD Apparel',
              sku: body.sku || 'DUD-SH-BLK',
              units: Number(body.qty) || 1,
              selling_price: Number(body.amount) || 899
            }
          ],
          payment_method: body.payment_method || 'Prepaid',
          sub_total: Number(body.amount) || 899,
          length: 25,
          breadth: 20,
          height: 5,
          weight: 0.4
        };

        const srOrderRes = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.token}`
          },
          body: JSON.stringify(orderPayload)
        });
        const srOrderData = await srOrderRes.json();
        return res.status(200).json({ status: 'SHIPROCKET_CREATED', srOrderData });
      }

      // ---------------------------------------------------------------------
      // D. SHIPROCKET INCOMING TRACKING WEBHOOK (AWB Status Updates)
      // ---------------------------------------------------------------------
      if (body.awb || body.current_status) {
        const trackingUpdate = {
          source: 'SHIPROCKET_WEBHOOK',
          awb: body.awb,
          orderId: body.order_id,
          status: body.current_status,
          etd: body.etd,
          timestamp: new Date().toISOString()
        };
        await pushToSupabaseIfConfigured('omnichannel_orders', trackingUpdate);
        return res.status(200).json({ received: true, trackingUpdate });
      }

      // ---------------------------------------------------------------------
      // E. DUAL INSTAGRAM (@dud__official & @dudclosetofficial) MEDIA PUBLISH
      // ---------------------------------------------------------------------
      if (action === 'instagram_publish') {
        const igAccount = body.accountType === 'BRAND'
          ? process.env.IG_BRAND_ID // @dud__official
          : process.env.IG_STORE_ID; // @dudclosetofficial
        const accessToken = process.env.META_PAGE_ACCESS_TOKEN || body.token;

        if (!igAccount || !accessToken) {
          return res.status(400).json({ error: 'Configure IG_BRAND_ID, IG_STORE_ID & META_PAGE_ACCESS_TOKEN in Vercel' });
        }

        // Step 1: Create Media Container
        const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igAccount}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: body.image_url,
            video_url: body.video_url,
            media_type: body.video_url ? 'REELS' : 'IMAGE',
            caption: body.caption,
            access_token: accessToken
          })
        });
        const containerData = await containerRes.json();
        return res.status(200).json({ status: 'IG_CONTAINER_CREATED', containerData });
      }

      // ---------------------------------------------------------------------
      // F. MARKETPLACE ORDER WEBHOOK (AMAZON SP-API / FLIPKART / MEESHO)
      // ---------------------------------------------------------------------
      if (action === 'marketplace_order_webhook' || body.marketplace) {
        const mpEvent = {
          source: body.marketplace || 'MARKETPLACE',
          orderId: body.orderId,
          sku: body.sku,
          qty: body.qty || 1,
          amount: body.amount || 0,
          timestamp: new Date().toISOString()
        };
        await pushToSupabaseIfConfigured('omnichannel_orders', mpEvent);
        return res.status(200).json({ status: 'MARKETPLACE_LOGGED', mpEvent });
      }

      return res.status(200).json({ received: true, note: 'Event logged by DUD OS 666 Webhook Gateway' });

    } catch (error) {
      console.error('Webhook Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

// Helper: Send WhatsApp Cloud API Message
async function sendWhatsAppCloudMessage(rawPhone, text) {
  const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) return;
  await fetch(`https://graph.facebook.com/v21.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `91${cleanPhone}`,
      type: 'text',
      text: { body: text }
    })
  });
}

// Helper: Push to Supabase REST API if configured
async function pushToSupabaseIfConfigured(table, record) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(record)
    });
  } catch (e) {
    console.error('Supabase sync skipped:', e.message);
  }
}
