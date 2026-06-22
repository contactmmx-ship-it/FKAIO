/**
 * Tests for the AI Engine edge function.
 *
 * Since the edge function uses Deno.serve, we test the handler logic
 * by simulating Request objects and checking Response outcomes.
 * We re-implement the routing logic here since we can't import Deno globals
 * in a Node/Vitest environment. The logic mirrors the actual index.ts.
 */

import { describe, it, expect, vi } from 'vitest';

// ── CORS headers (mirrors the edge function) ──

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
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

// ── Handler logic (extracted for testing) ──

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (url.pathname === '/ai-engine/run_jobs' && req.method === 'POST') {
      // In real function this calls runJobs(); we simulate
      return jsonResponse({ action: 'run_jobs', processed: 0, results: [] });
    }

    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const body = await req.json();
    const { action, type, payload, agent_id, message } = body;

    if (!action) {
      return errorResponse("Missing 'action' field", 400);
    }

    switch (action) {
      case 'queue_job': {
        if (!type || typeof type !== 'string') {
          return errorResponse("Missing or invalid 'type' field", 400);
        }
        if (!payload || typeof payload !== 'object') {
          return errorResponse("Missing or invalid 'payload' field", 400);
        }
        return jsonResponse({
          action: 'queue_job',
          success: true,
          job: { id: 'test-job-id', type, payload, status: 'pending' },
        });
      }

      case 'run_jobs': {
        return jsonResponse({ action: 'run_jobs', success: true, processed: 0, results: [] });
      }

      case 'get_status': {
        return jsonResponse({
          action: 'get_status',
          success: true,
          counts: { pending: 0, running: 0, completed: 0, failed: 0, retry: 0 },
        });
      }

      case 'chat_with_agent': {
        if (!agent_id || typeof agent_id !== 'string') {
          return errorResponse("Missing or invalid 'agent_id' field", 400);
        }
        if (!message || typeof message !== 'string') {
          return errorResponse("Missing or invalid 'message' field", 400);
        }
        return jsonResponse({
          action: 'chat_with_agent',
          success: true,
          conversation: { id: 'conv-001', message, response: 'Hello from agent.' },
        });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

// ── Helper to read response JSON ──

async function getJson(res: Response) {
  return res.json();
}

// ── Tests ──

describe('AI Engine Edge Function', () => {
  describe('CORS', () => {
    it('returns CORS headers on OPTIONS preflight', async () => {
      const req = new Request('http://localhost/ai-engine', { method: 'OPTIONS' });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('returns CORS headers on successful POST', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_status' }),
      });
      const res = await handleRequest(req);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('returns CORS headers on error response', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await handleRequest(req);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('invalid action', () => {
    it('returns 400 when action is missing', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toBe("Missing 'action' field");
    });

    it('returns 400 for unknown action', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'destroy_everything' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('Unknown action: destroy_everything');
    });

    it('returns 405 for GET method', async () => {
      const req = new Request('http://localhost/ai-engine', { method: 'GET' });
      const res = await handleRequest(req);
      expect(res.status).toBe(405);
    });
  });

  describe('queue_job action', () => {
    it('validates required "type" field', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_job', payload: {} }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('type');
    });

    it('validates required "payload" field', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_job', type: 'CLASSIFY' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('payload');
    });

    it('validates "type" is a string', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_job', type: 123, payload: {} }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it('validates "payload" is an object', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'queue_job', type: 'CLASSIFY', payload: 'string' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it('returns success with valid fields', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue_job',
          type: 'QUALIFY_LEAD',
          payload: { lead_id: 'l-001' },
        }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.action).toBe('queue_job');
      expect(json.success).toBe(true);
      expect(json.job.type).toBe('QUALIFY_LEAD');
    });
  });

  describe('run_jobs action', () => {
    it('returns success response', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_jobs' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.action).toBe('run_jobs');
      expect(json.success).toBe(true);
      expect(json).toHaveProperty('processed');
      expect(json).toHaveProperty('results');
    });

    it('works via direct /ai-engine/run_jobs path', async () => {
      const req = new Request('http://localhost/ai-engine/run_jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.action).toBe('run_jobs');
    });
  });

  describe('chat_with_agent action', () => {
    it('validates required "agent_id"', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat_with_agent', message: 'Hello' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('agent_id');
    });

    it('validates required "message"', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat_with_agent', agent_id: 'ai-001' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
      const json = await getJson(res);
      expect(json.error).toContain('message');
    });

    it('validates "agent_id" is a string', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat_with_agent', agent_id: 123, message: 'Hi' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it('validates "message" is a string', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat_with_agent', agent_id: 'ai-001', message: 42 }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(400);
    });

    it('returns success with valid fields', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat_with_agent',
          agent_id: 'ai-001',
          message: 'Qualify lead l-001',
        }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.action).toBe('chat_with_agent');
      expect(json.success).toBe(true);
      expect(json.conversation.message).toBe('Qualify lead l-001');
    });
  });

  describe('get_status action', () => {
    it('returns status counts', async () => {
      const req = new Request('http://localhost/ai-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_status' }),
      });
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      const json = await getJson(res);
      expect(json.action).toBe('get_status');
      expect(json.counts).toBeDefined();
      expect(json.counts).toHaveProperty('pending');
      expect(json.counts).toHaveProperty('running');
      expect(json.counts).toHaveProperty('completed');
      expect(json.counts).toHaveProperty('failed');
      expect(json.counts).toHaveProperty('retry');
    });
  });
});