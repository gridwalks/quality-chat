const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function extractAnswer(data) {
  // Prefer Responses API `output_text`
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  // Some SDKs/variants nest content arrays
  const maybeText = data?.output?.[0]?.content?.[0]?.text;
  if (typeof maybeText === "string" && maybeText.trim()) return maybeText.trim();

  // Fallback for Chat Completions style (if endpoint/model mismatched)
  const cc = data?.choices?.[0]?.message?.content;
  if (typeof cc === "string" && cc.trim()) return cc.trim();

  // Nothing usable found
  return "";
}

export default async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    const { messages = [] } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages[]" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    const userPrompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: userPrompt,
        max_output_tokens: 800
      })
    });

    const text = await resp.text();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "OpenAI error", status: resp.status, detail: text }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }

    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    const answer = extractAnswer(data);

    return new Response(JSON.stringify({
      answer: answer || "",
      debug: answer ? undefined : { note: "Empty answer extracted", rawShape: Object.keys(data || {}) }
    }), {
      headers: { "Content-Type": "application/json", ...CORS }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS }
    });
  }
};
