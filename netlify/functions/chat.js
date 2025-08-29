// netlify/functions/chat.js
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
const DEBUG_ERROR_DETAILS = process.env.DEBUG_ERROR_DETAILS === '1';

const nowIso = () => new Date().toISOString();
const safeString = (v) => (typeof v === 'string' ? v : '');

function cid(){
  try { return crypto.randomUUID(); }
  catch { return 'cid_' + Date.now() + '_' + Math.random().toString(16).slice(2,10); }
}

function makeError({ status=500, code='INTERNAL_ERROR', message='Something went wrong',
  provider='OPENAI', endpoint='', requestId='', hint='', details=undefined, model='',
  cidValue='', stack='', rateLimit=undefined }){
  const payload = {
    ok: false,
    error: {
      code, message, status, provider, endpoint, requestId,
      when: nowIso(), cid: cidValue, model: model || undefined, hint: hint || undefined,
      details, rateLimit,
      stack: (DEBUG_ERROR_DETAILS || isDev) ? (stack || undefined) : undefined
    }
  };
  return { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

function makeSuccess(answer, extra={}){
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok:true, answer, ...extra }) };
}

// Simple timeout wrapper
function fetchWithTimeout(url, options={}, ms=9000){
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  const merged = { ...options, signal: controller.signal };
  return fetch(url, merged)
    .finally(() => clearTimeout(id));
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  const cidValue = cid();

  let bodyIn={};
  try { bodyIn = JSON.parse(event.body || '{}'); }
  catch(e){
    return makeError({ status:400, code:'BAD_REQUEST', message:'Invalid JSON body.',
      hint:'Send JSON like {"q":"Hello"}', details:{ raw: safeString(event.body) }, cidValue, stack:e?.stack });
  }

  const q = safeString(bodyIn.q).trim();
  let ctx = safeString(bodyIn.context);
  if (!q){
    return makeError({ status:400, code:'MISSING_QUERY', message:'Missing "q" in request body.', hint:'Include a "q" property with your question.', cidValue, details:{ receivedKeys:Object.keys(bodyIn) } });
  }

  // Cap context to keep payloads small and fast
  if (ctx.length > 6000) ctx = ctx.slice(0,6000) + '…';

  const OPENAI_API_KEY = safeString(process.env.OPENAI_API_KEY);
  if (!OPENAI_API_KEY){
    return makeError({ status:500, code:'MISSING_OPENAI_KEY', message:'OPENAI_API_KEY is not set.', hint:'Add OPENAI_API_KEY in Netlify → Site settings → Environment variables.', cidValue });
  }
  const model = safeString(process.env.OPENAI_MODEL || 'gpt-4o-mini');

  try {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const r = await fetchWithTimeout(endpoint, {
      method:'POST',
      headers:{ 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model, temperature: 0.2,
        messages: [
          { role:'system', content:'You are a helpful assistant for quality assurance and compliance topics.' },
          { role:'user', content: q + (ctx ? `\n\nContext:\n${ctx}` : '') }
        ]
      })
    }, 9000);

    const text = await r.text();
    const requestId = r.headers.get('x-request-id') || '';
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = undefined; }

    if (!r.ok){
      const rateLimit = {
        retryAfter: r.headers.get('retry-after') || undefined,
        limit: r.headers.get('x-ratelimit-limit-requests') || undefined,
        remaining: r.headers.get('x-ratelimit-remaining-requests') || undefined,
        reset: r.headers.get('x-ratelimit-reset-requests') || undefined,
      };
      const msg = parsed?.error?.message || parsed?.message || (text || 'Unknown error');
      const code = parsed?.error?.code || parsed?.error?.type || 'OPENAI_ERROR';
      const hint =
        r.status === 401 ? 'Auth failed. Confirm OPENAI_API_KEY is valid.' :
        r.status === 404 ? 'Model not found. Check OPENAI_MODEL.' :
        r.status === 429 ? 'Rate limited. Reduce request rate or change model.' :
        r.status >= 500 ? 'OpenAI service issue. Retry with backoff.' :
        'Check request body or model availability.';

      return makeError({ status:r.status, code, message:msg, provider:'OPENAI', endpoint, requestId, details: parsed or { raw:text }, hint, cidValue, model, rateLimit });
    }

    const answer = parsed?.choices?.[0]?.message?.content?.trim?.() || parsed?.choices?.[0]?.message?.content || '';
    return makeSuccess(answer, { provider:'OPENAI', model, cid: cidValue, requestId });
  } catch(e){
    const isAbort = (e and getattr(e, 'name', '') == 'AbortError') or ('AbortError' in str(e)) or ('The operation was aborted' in str(e));
    if (isAbort){
      return makeError({ status:504, code:'UPSTREAM_TIMEOUT', message:'Model call exceeded the per-request timeout.', hint:'Try a faster model or reduce context size.', provider:'OPENAI', cidValue, endpoint:'https://api.openai.com/v1/chat/completions', model });
    }
    return makeError({ status:502, code:'OPENAI_NETWORK_ERROR', message:'Failed to reach OpenAI or process the response.', hint:'Check network connectivity from Netlify and verify payload.', provider:'OPENAI', cidValue, details:{ error:String(e) }, endpoint:'https://api.openai.com/v1/chat/completions', model, stack:e?.stack });
  }
};
