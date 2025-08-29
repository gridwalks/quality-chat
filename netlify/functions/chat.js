const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { q, context: ctx } = await req.json();
    const provider = (process.env.PROVIDER || 'OPENAI').toUpperCase();

    if (!q || !q.trim()) {
      return new Response(JSON.stringify({ error: 'Empty prompt' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (provider === 'LUMO') {
      // Placeholder Lumo adapter — enable when Proton publishes an API.
      const url = process.env.LUMO_API_URL || '';
      const key = process.env.LUMO_API_KEY || '';
      if (!url || !key) {
        return new Response(JSON.stringify({ error: 'Lumo API not configured', hint: 'Set LUMO_API_URL and LUMO_API_KEY, or switch PROVIDER=OPENAI' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
      const body = { prompt: q, context: ctx }; // Adjust to Lumo’s real schema when available.
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const t = await r.text();
      if (!r.ok) return new Response(JSON.stringify({ error: 'Lumo error', details: t }), { status: r.status, headers: { 'Content-Type': 'application/json', ...CORS } });
      let data; try { data = JSON.parse(t); } catch { data = { output_text: t }; }
      const answer = data.answer || data.output_text || '';
      return new Response(JSON.stringify({ answer, provider: 'LUMO' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // Default: OpenAI Responses API
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    const body = {
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "You are AcceleraQA, a helpful QA/compliance assistant. Use provided context and be concise." },
        { role: "user", content: q + (ctx ? "\n\nContext:\n" + ctx : "") }
      ]
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'OpenAI error', details: text }), { status: resp.status, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { output_text: text }; }
    const answer = parsed.output_text || (parsed.content && parsed.content[0] && parsed.content[0].text) || '';
    return new Response(JSON.stringify({ answer, provider: 'OPENAI' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
};
