import { readFile } from 'node:fs/promises';

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

    const text = String(q || "").toLowerCase();
    const scored = db.map(item => {
      const words = item.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const unique = Array.from(new Set(words));
      const score = unique.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
      return { ...item, score };
    }).sort((a,b)=>b.score-a.score).slice(0,3);

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
