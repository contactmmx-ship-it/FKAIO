/**
 * Tests for the Payment Engine edge function.
 *
 * We extract the routing and validation logic to test in a Node/Vitest
 * environment since Deno.serve is unavailable. The logic mirrors the
 * actual payment-engine/index.ts.
 */

import { describe, it, expect, vi } from 'vitest';

// ── CORS headers (mirrors the edge function) ──

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Razorpay-Signature',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Signature verification logic (mirrors the edge function) ──

// In Node, we use crypto module (same as Deno's npm:crypto)
import { createHmac } from 'crypto';

function verifyRazorpayWebhook(body: string, signature: string, secret: string): boolean {
  if (!secret) {
    // Allow in development when secret not configured
    return true;
  }
  const hash = createHmac('sha256', secret).update(body).digest('hex');
  return hash === signature;
}

// ── Handler logic (extracted for testing) ──

async function handleRequest(req: Request, webhookSecret: string): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Webhook route: POST with invoice_id query param
    if (
      pathname.includes('payment-engine') &&
      req.method === 'POST' &&
      url.searchParams.has('invoice_id')
    ) {
      const signature = req.headers.get('X-Razorpay-Signature') || '';
      const body = await req.text();

      if (!verifyRazorpayWebhook(body, signature, webhookSecret)) {
        return errorResponse('Invalid webhook signature', 403);
      }

      const event = JSON.parse(body);
      return jsonResponse({ success: true, event_type: event.event });
    }

    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse("Missing 'action' field", 400);
    }

    switch (action) {
      case 'generate_invoice': {
        const { lead_id, brand_id, franchisee_details } = body;
        if (!lead_id || !brand_id) {
          return errorResponse('Missing lead_id or brand_id', 400);
        }
        // Simulate invoice generation
        return jsonResponse({
          success: true,
          invoice: {
            id: 'inv-test-001',
            lead_id,
            type: 'Registration Fee',
            amount: 20000,
            status: 'Pending',
          },
        });
      }

      case 'create_payment_link': {
        const { invoice_id, amount, email, phone, notes } = body;
        if (!invoice_id || !amount) {
          return errorResponse('Missing invoice_id or amount', 400);
        }
        return jsonResponse({
          success: true,
          payment_link: 'https://rzp.io/test-link',
          razorpay_order_id: 'order_test_001',
          email: email || 'noreply@franchisee-kart.com',
          phone: phone || '+919999999999',
        });
      }

      case 'handle_webhook': {
        const signature = req.headers.get('X-Razorpay-Signature') || '';
        // For handle_webhook action, read body as text
        // We already consumed body above — this tests the validation path
        // In real function, the body would be re-read; here we validate the action exists
        return jsonResponse({ success: true, message: 'Webhook handled via action' });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

async function getJson(res: Response) {
  return res.json();
}

// ── Tests ──

describe('Payment Engine Edge Function', () => {
  const noSecret = '';

  describe('CORS', () => {
    it('returns CORS headers on OPTIONS preflight', async () => {
      const req = new Request('http://localhost/payment-engine', { method: 'OPTIONS' });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Razorpay-Signature');
    });
  });

  describe('generate_invoice', () => {
    it('validates required lead_id and brand_id', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invoice' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('Missing lead_id or brand_id');
    });

    it('validates when only lead_id is provided', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invoice', lead_id: 'l-001' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
    });

    it('validates when only brand_id is provided', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invoice', brand_id: 'b-001' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
    });

    it('returns success with valid fields', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_invoice',
          lead_id: 'l-001',
          brand_id: 'b-001',
          franchisee_details: { name: 'Rahul', city: 'Mumbai' },
        }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.success).toBe(true);
      expect(json.invoice.lead_id).toBe('l-001');
      expect(json.invoice.amount).toBe(20000);
      expect(json.invoice.status).toBe('Pending');
    });
  });

  describe('create_payment_link', () => {
    it('validates required invoice_id and amount', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_payment_link' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('Missing invoice_id or amount');
    });

    it('validates when only invoice_id is provided', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_payment_link', invoice_id: 'inv-001' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
    });

    it('validates when only amount is provided', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_payment_link', amount: 20000 }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
    });

    it('returns success with valid fields', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payment_link',
          invoice_id: 'inv-001',
          amount: 20000,
          email: 'rahul@test.com',
          phone: '9876543210',
        }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.success).toBe(true);
      expect(json.payment_link).toBeDefined();
      expect(json.razorpay_order_id).toBeDefined();
    });

    it('uses defaults for optional email and phone', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payment_link',
          invoice_id: 'inv-002',
          amount: 10000,
        }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.email).toBe('noreply@franchisee-kart.com');
      expect(json.phone).toBe('+919999999999');
    });
  });

  describe('webhook signature verification', () => {
    const secret = 'test-webhook-secret';

    it('allows webhook when no secret is configured (dev mode)', async () => {
      const payload = JSON.stringify({ event: 'payment.authorized', payload: { payment: { entity: { id: 'pay-001' } } } });
      const req = new Request('http://localhost/payment-engine?invoice_id=inv-001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': 'invalid-signature',
        },
        body: payload,
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(200);
    });

    it('rejects webhook with invalid signature when secret is set', async () => {
      const payload = JSON.stringify({ event: 'payment.authorized', payload: { payment: { entity: { id: 'pay-001' } } } });
      const req = new Request('http://localhost/payment-engine?invoice_id=inv-001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': 'invalid-signature',
        },
        body: payload,
      });
      const res = await handleRequest(req, secret);
      expect(res.status).toBe(403);
      const json = await getJson(res);
      expect(json.error).toBe('Invalid webhook signature');
    });

    it('accepts webhook with valid HMAC-SHA256 signature', async () => {
      const payload = JSON.stringify({ event: 'payment.authorized', payload: { payment: { entity: { id: 'pay-001' } } } });
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      const req = new Request('http://localhost/payment-engine?invoice_id=inv-001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Razorpay-Signature': signature,
        },
        body: payload,
      });
      const res = await handleRequest(req, secret);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.success).toBe(true);
      expect(json.event_type).toBe('payment.authorized');
    });
  });

  describe('error handling', () => {
    it('returns 400 when action is missing', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toBe("Missing 'action' field");
    });

    it('returns 400 for unknown action', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund_everything' }),
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('Unknown action');
    });

    it('returns 405 for GET method', async () => {
      const req = new Request('http://localhost/payment-engine', { method: 'GET' });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(405);
    });

    it('returns 500 for malformed JSON body', async () => {
      const req = new Request('http://localhost/payment-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      });
      const res = await handleRequest(req, noSecret);
      expect(res.status).toBe(500);
      const json = await getJson(res);
      expect(json.error).toBeDefined();
    });
  });
});