// netlify/functions/chat.js
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    let bodyIn = {};
    try {
      bodyIn = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const q = (bodyIn.q || '').trim();
    const ctx = bodyIn.context || '';
    const providerOverride = String(bodyIn.providerOverride || '').toUpperCase();

    if (!q) {
      return {
        statusCode: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing "q" in request body' }),
      };
    }

    let provider = String(process.env.PROVIDER || 'OPENAI').toUpperCase();
    if (providerOverride === 'OPENAI' || providerOverride === 'LUMO') {
      provider = providerOverride;
    }

    // Provider: LUMO (optional, only if you actually use it)
    if (provider === 'LUMO') {
      const url = process.env.LUMO_API_URL || '';
      const key = process.env.LUMO_API_KEY || '';
      if (!url || !key) {
        return {
          statusCode: 500,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'LUMO_API_URL or LUMO_API_KEY not set' }),
        };
      }

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: q, context: ctx }),
      });

      const text = await r.text();
      if (!r.ok) {
        return {
          statusCode: r.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'LUMO error', detail: text }),
        };
      }

      let data;
      try { data = JSON.parse(text); } catch { data = { output_text: text }; }
      const answer = data.output_text || data.answer || '';
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      };
    }

    // Default: OPENAI via Chat Completions (stable)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OPENAI_API_KEY not set' }),
      };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for quality assurance and compliance topics.',
          },
          {
            role: 'user',
            content: q + (ctx ? `\n\nContext:\n${ctx}` : ''),
          },
        ],
        temperature: 0.2,
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      return {
        statusCode: r.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI error', detail: text }),
      };
    }

    let data;
    try { data = JSON.parse(text); } catch { data = {}; }

    const answer =
      data?.choices?.[0]?.message?.content?.trim?.() ||
      data?.choices?.[0]?.message?.content ||
      '';

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || String(e) }),
    };
  }
};
