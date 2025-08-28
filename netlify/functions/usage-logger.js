import { appendFile } from 'node:fs/promises';

export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { status: 405 });
    }
    const body = await req.json();
    const user = context.clientContext?.user || null;
    const email = user?.email || "anonymous";
    const entry = {
      time: new Date().toISOString(),
      email,
      question: body.question,
      answer: body.answer
    };
    await appendFile("site/logs/usage.log", JSON.stringify(entry) + "\n");
    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};