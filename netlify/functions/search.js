// netlify/functions/search.js
export const handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    const b = JSON.parse(event.body || '{}');
    const q = (b.q || '').toString();
    // Return an empty result set (fast). Replace with your real search later.
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, results: [] })
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error: { message: 'Bad JSON', details: String(e) } })
    };
  }
};
