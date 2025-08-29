AcceleraQA — Public Index Variant
=================================

This build removes all forced redirects to /login.html and keeps the index page publicly viewable.
Identity simply decorates the header once it initializes. Chat works for guests.

Files
-----
- index.html                → Public landing + chat UI (no login redirect)
- login.html                → Manual Identity launcher (optional)
- assets/logo.svg
- netlify/functions/chat.js → OpenAI call w/ structured errors, timeout, context cap
- netlify/functions/search.js → stub (returns [])
- netlify/functions/usage-logger.js
- netlify.toml

Env Vars (Netlify → Site settings → Environment variables)
----------------------------------------------------------
OPENAI_API_KEY   (REQUIRED)
OPENAI_MODEL     (optional, defaults to gpt-4o-mini)
DEBUG_ERROR_DETAILS (optional, set 1 while debugging)
NODE_ENV         (optional, production to hide stacks)

Deploy
------
- Drag-and-drop this folder or the zip into Netlify.
- Set env vars, then redeploy.
- Visit / to use chat as guest. Click "Sign in" to authenticate. /admin/ remains protected by Identity.
