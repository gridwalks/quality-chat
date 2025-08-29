// netlify/functions/chat.js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
const DEBUG_ERROR_DETAILS = process.env.DEBUG_ERROR_DETAILS === '1';

const safeString = (v) => (typeof v === 'string' ? v : '');
const nowIso = () => new Date().toISOString();

// Generate a correlation id for tracing across logs and client
const cid = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `cid_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
};

// Unified error builder
function makeError({
  status = 500,
  code = 'INTERNAL_ERROR',
  message = 'Something went wrong',
  provider = 'OPENAI',
  endpoint = '',
  requestId = '',
  hint = '',
  details = undefined,
  model = '',
  cidValue = '',
  stack = '',
  rateLimit = undefined, // { retryAfter, limit, remaining, reset }
}) {
  const payload = {
    ok: false,
    error: {
      code,
      message,
      status,
      provider,
      endpoint,
      requestId,
      when: nowIso(),
      cid: cidValue,
      model: model || undefined,
      hint: hint || undefined,
      details,
      rateLimit,
      // Only include stack in dev or if explicitly enabled
      stack: DEBUG_ERROR_DETAILS || isDev ? stack || undefined : undefined,
    },
  };
  return {
    statusCode: status,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  };
}

// Success builder
function makeSuccess(answer, extra = {}) {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({ ok: true, answer, ...extra }),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const cidValue = cid();

  // Basic body parsing
  let bodyIn = {};
  try {
    bodyIn = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[chat] JSON parse error', { cid: cidValue, err: String(e) });
    return makeError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid JSON body.',
      hint: 'Send a JSON body like {"q":"Hello"}',
      details: { raw: safeString(event.body) },
      cidValue,
      stack: e?.stack,
    });
  }

  const q = safeString(bodyIn.q).trim();
  const ctx = safeString(bodyIn.context);
  const providerOverride = safeString(bodyIn.providerOverride).toUpperCase();
  let provider = safeString(process.env.PROVIDER || 'OPENAI').toUpperCase();
  if (providerOverride === 'OPENAI' || providerOverride === 'LUMO') provider = providerOverride;

  if (!q) {
    return makeError({
      status: 400,
      code: 'MISSING_QUERY',
      message: 'Missing "q" in request body.',
      hint: 'Include a "q" property with your question.',
      cidValue,
      details: { receivedKeys: Object.keys(bodyIn) },
    });
  }

  // Provider: LUMO (optional)
  if (provider === 'LUMO') {
    const url = safeString(process.env.LUMO_API_URL);
    const key = safeString(process.env.LUMO_API_KEY);
    if (!url || !key) {
      return makeError({
        status: 500,
        code: 'MISSING_LUMO_CONFIG',
        message: 'LUMO_API_URL or LUMO_API_KEY not set.',
        hint: 'Set LUMO_API_URL and LUMO_API_KEY in your Netlify env vars.',
        cidValue,
        provider: 'LUMO',
      });
    }

    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q, context: ctx }),
      });

      const text = await r.text();
      const requestId = r.headers.get('x-request-id') || '';

      if (!r.ok) {
        console.error('[chat] LUMO error', { cid: cidValue, status: r.status, text });
        let parsed;
        try { parsed = JSON.parse(text); } catch { /* ignore */ }
        return makeError({
          status: r.status,
          code: 'LUMO_ERROR',
          message: parsed?.error?.message || parsed?.message || 'Upstream LUMO error.',
          provider: 'LUMO',
          endpoint: url,
          requestId,
          details: parsed || { raw: text?.slice?.(0, 2000) },
          hint: 'Verify API key, endpoint URL, and request body shape.',
          cidValue,
        });
      }

      let data;
      try { data = JSON.parse(text); } catch { data = { output_text: text }; }
      const answer = data.output_text || data.answer || '';
      return makeSuccess(answer, { provider: 'LUMO', cid: cidValue });
    } catch (e) {
      console.error('[chat] LUMO network error', { cid: cidValue, err: String(e) });
      return makeError({
        status: 502,
        code: 'LUMO_NETWORK_ERROR',
        message: 'Failed to reach LUMO.',
        hint: 'Check network, DNS, or provider availability.',
        provider: 'LUMO',
        cidValue,
        details: { error: String(e) },
        stack: e?.stack,
      });
    }
  }

  // Default: OPENAI via Chat Completions (stable)
  const OPENAI_API_KEY = safeString(process.env.OPENAI_API_KEY);
  if (!OPENAI_API_KEY) {
    return makeError({
      status: 500,
      code: 'MISSING_OPENAI_KEY',
      message: 'OPENAI_API_KEY is not set.',
      hint: 'Add OPENAI_API_KEY in Netlify → Site settings → Environment variables.',
      cidValue,
    });
  }

  const model = safeString(process.env.OPENAI_MODEL || 'gpt-4o-mini');

  try {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant for quality assurance and compliance topics.' },
          { role: 'user', content: q + (ctx ? `\n\nContext:\n${ctx}` : '') },
        ],
        temperature: 0.2,
      }),
    });

    const text = await r.text();
    const requestId = r.headers.get('x-request-id') || '';
    const retryAfter = r.headers.get('retry-after');

    // Attempt JSON parse either way to surface upstream details
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = undefined; }

    if (!r.ok) {
      // Pull rate-limit headers if present
      const rateLimit = {
        retryAfter: retryAfter ? Number(retryAfter) : undefined,
        limit: r.headers.get('x-ratelimit-limit-requests') || undefined,
        remaining: r.headers.get('x-ratelimit-remaining-requests') || undefined,
        reset: r.headers.get('x-ratelimit-reset-requests') || undefined,
      };

      const upstreamMsg =
        parsed?.error?.message ||
        parsed?.message ||
        (text ? text.slice(0, 2000) : 'Unknown error');

      const upstreamCode =
