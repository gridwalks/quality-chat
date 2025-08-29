AcceleraQA — Netlify Drag-and-Drop Pack
=====================================

What this contains
------------------
- index.html                → Frontend chat UI (Netlify Identity + chat/search calls)
- login.html                → Simple identity login page
- assets/logo.svg           → Placeholder logo
- netlify/functions/chat.js → Serverless function calling OpenAI Chat Completions with structured errors
- netlify/functions/search.js → Stub search that returns []
- netlify/functions/usage-logger.js → Console logger
- netlify.toml              → Netlify config (functions dir, Node 20, headers)

Environment variables (Netlify → Site settings → Environment variables)
-----------------------------------------------------------------------
OPENAI_API_KEY   (REQUIRED)
OPENAI_MODEL     (optional, defaults to gpt-4o-mini)
DEBUG_ERROR_DETAILS (optional, set to 1 to include stack traces in JSON errors during debugging)
NODE_ENV         (optional, set to production to hide stack traces)

Deploy steps
------------
1) Download the zip and unzip locally if you want to inspect it.
2) Drag-and-drop the folder (or the zip) into Netlify.
3) Set environment variables on the site (OPENAI_API_KEY at minimum).
4) Redeploy the site to apply env vars.
5) Open /login.html to sign in via Netlify Identity, then it will redirect you to /.

Notes
-----
- The search function is a stub that returns an empty array quickly to avoid timeouts.
  Replace it with a real search when ready.
- The chat function caps context to 6000 chars and uses a 9s timeout to avoid 502 timeouts.
- The frontend shows detailed, helpful error messages (requestId/cid) when something goes wrong.
