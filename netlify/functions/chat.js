const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
export default async (req)=>{
  if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
  try {
    const bodyIn = await req.json();
    const q = bodyIn.q;
    const ctx = bodyIn.context;
    const providerOverride = (bodyIn.providerOverride || '').toUpperCase();
    let provider = (process.env.PROVIDER || 'OPENAI').toUpperCase();
    if (providerOverride === 'OPENAI' || providerOverride === 'LUMO') provider = providerOverride;

    if(!q || !q.trim()) return new Response(JSON.stringify({error:'Empty prompt'}),{status:400,headers:{'Content-Type':'application/json',...CORS}});

    if(provider==='LUMO'){
      const url=process.env.LUMO_API_URL||''; const key=process.env.LUMO_API_KEY||'';
      if(!url||!key) return new Response(JSON.stringify({error:'Lumo API not configured',hint:'Set LUMO_API_URL and LUMO_API_KEY or switch provider to OPENAI'}),{status:500,headers:{'Content-Type':'application/json',...CORS}});
      const r=await fetch(url,{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prompt:q,context:ctx})});
      const t=await r.text(); if(!r.ok) return new Response(JSON.stringify({error:'Lumo error',details:t}),{status:r.status,headers:{'Content-Type':'application/json',...CORS}});
      let d; try{d=JSON.parse(t);}catch{d={output_text:t}}; const answer=d.answer||d.output_text||''; return new Response(JSON.stringify({answer,provider:'LUMO'}),{status:200,headers:{'Content-Type':'application/json',...CORS}});
    }

    const key=process.env.OPENAI_API_KEY||''; if(!key) return new Response(JSON.stringify({error:'Missing OPENAI_API_KEY'}),{status:500,headers:{'Content-Type':'application/json',...CORS}});
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4o-mini",input:[{role:"system",content:"You are AcceleraQA, a helpful QA/compliance assistant. Use provided context and be concise."},{role:"user",content:q+(ctx?"\n\nContext:\n"+ctx:"")} ]})});
    const t=await r.text(); if(!r.ok) return new Response(JSON.stringify({error:'OpenAI error',details:t}),{status:r.status,headers:{'Content-Type':'application/json',...CORS}});
    let d; try{d=JSON.parse(t);}catch{d={output_text:t}}; const answer=d.output_text||(d.content&&d.content[0]&&d.content[0].text)||''; return new Response(JSON.stringify({answer,provider:'OPENAI'}),{status:200,headers:{'Content-Type':'application/json',...CORS}});
  } catch(e){ return new Response(JSON.stringify({error:e.message}),{status:500,headers:{'Content-Type':'application/json',...CORS}}); }
};