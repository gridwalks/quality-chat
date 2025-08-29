const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
export default async (req, context) => {
  if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
  try {
    const { q, context:ctx } = await req.json();
    const key = process.env.OPENAI_API_KEY;
    if(!key) {
      return new Response(JSON.stringify({error:'Missing OPENAI_API_KEY'}),{status:500,headers:{'Content-Type':'application/json',...CORS}});
    }

    // Minimal streaming-free call for reliability
    const body = {
      model: "gpt-4o-mini",
      input: [
        {"role":"system","content":"You are AcceleraQA, a helpful QA/compliance assistant. Use provided context if relevant and be concise."},
        {"role":"user","content": q + (ctx ? "\n\nContext:\n"+ctx : "") }
      ]
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    if(!resp.ok) {
      return new Response(JSON.stringify({error:'OpenAI error', details:text}),{status:resp.status,headers:{'Content-Type':'application/json',...CORS}});
    }
    let parsed;
    try { parsed = JSON.parse(text); } catch(e) { parsed = { output_text: text }; }
    const answer = (parsed.output_text) || (parsed.content && parsed.content[0] && parsed.content[0].text) || '';
    return new Response(JSON.stringify({answer}),{status:200,headers:{'Content-Type':'application/json',...CORS}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{'Content-Type':'application/json',...CORS}});
  }
};
