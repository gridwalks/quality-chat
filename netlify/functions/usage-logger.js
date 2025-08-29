// netlify/functions/usage-logger.js
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    const b = JSON.parse(event.body || '{}');
    console.log('[usage]', { when: new Date().toISOString(), ...b });
  } catch (e) {
    console.log('[usage-logger] parse error', String(e));
  }
  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type':'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
