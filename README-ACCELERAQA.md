# AcceleraQA — Provider Switch

This build lets you switch the chat backend between **OpenAI** (default) and **Proton Lumo** (when Proton publishes an API).

## Environment variables (Netlify → Site settings → Environment)

### Default (OpenAI)
- `PROVIDER=OPENAI` (or leave unset)
- `OPENAI_API_KEY=sk-...`

### Prepare for Lumo
- `PROVIDER=LUMO`
- `LUMO_API_URL=https://api.lumo.proton.me/v1/chat`  *(placeholder until Proton publishes docs)*
- `LUMO_API_KEY=...`

> If `PROVIDER=LUMO` but `LUMO_API_URL` / `LUMO_API_KEY` are missing, the function returns:
> `{ error: 'Lumo API not configured' }`

## Files touched
- `netlify/functions/chat.js` — provider abstraction + CORS + clear errors
- `chat.html` — shows a tiny “via PROVIDER” label after responses

## Deploy
1. Upload the `site/` folder to Netlify.
2. Set env vars above.
3. Trigger redeploy.
