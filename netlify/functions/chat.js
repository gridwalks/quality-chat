export default async (request, context) => {
  try {
    const { messages = [] } = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { status: 500 });
    }

    const userPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', input: userPrompt, max_output_tokens: 800 })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: 'OpenAI error', detail: text }), { status: 500 });
    }

    const data = await resp.json();
    const answer = data.output_text || (data.output?.[0]?.content?.[0]?.text ?? '');
    return new Response(JSON.stringify({ answer }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};