import { readFile } from 'node:fs/promises';

function scoreItem(item, query) {
  const q = String(query || "").toLowerCase();
  let score = 0;

  // Title overlap
  item.title.toLowerCase().split(/[^a-z0-9]+/).forEach(w => { if (w && q.includes(w)) score += 2; });

  // Text overlap (unique words)
  const words = Array.from(new Set(item.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
  words.forEach(w => { if (q.includes(w)) score += 1; });

  // Tag boost
  (item.tags || []).forEach(tag => {
    const t = String(tag).toLowerCase();
    if (t && q.includes(t)) score += 3;
  });

  return score;
}

export default async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }});
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const { q = "" } = await request.json();
    const fileUrl = new URL("../../knowledge/faqs.json", import.meta.url);
    const db = JSON.parse(await readFile(fileUrl, "utf8"));

    const scored = db.map(item => ({ ...item, score: scoreItem(item, q) }))
                     .sort((a,b)=>b.score-a.score)
                     .slice(0, 3);

    return new Response(JSON.stringify({ results: scored }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};
