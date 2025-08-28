import { appendFile, readFile, writeFile, access, rename } from 'node:fs/promises';
import { constants } from 'node:fs';

const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
const LOG = '/tmp/quality-chat-usage.log';
const ARCHIVE_PREFIX = '/tmp/quality-chat-usage-archive-';

function isAdmin(context){
  const roles = context?.clientContext?.user?.app_metadata?.roles || [];
  return Array.isArray(roles) && roles.includes('admin');
}

async function ensureFile(path){
  try { await access(path, constants.F_OK); } catch { await writeFile(path, ''); }
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method === 'POST') {
      const body = await req.json();
      const email = context?.clientContext?.user?.email || 'anonymous';
      const entry = { time: new Date().toISOString(), email, question: body?.question || '', answer: body?.answer || '' };
      await appendFile(LOG, JSON.stringify(entry) + '\n');
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (req.method === 'GET') {
      if (!isAdmin(context)) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { 'Content-Type':'application/json', ...CORS } });
      await ensureFile(LOG);
      const text = (await readFile(LOG, 'utf8')) || '';
      const rows = text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin(context)) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { 'Content-Type':'application/json', ...CORS } });
      await ensureFile(LOG);
      const ts = new Date().toISOString().replace(/[:]/g, '-');
      const archive = ARCHIVE_PREFIX + ts + '.log';
      try { await rename(LOG, archive); } catch {}
      await writeFile(LOG, '');
      return new Response(JSON.stringify({ ok: true, archive }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type':'application/json', ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type':'application/json', ...CORS } });
  }
};