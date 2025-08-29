export default async (req, context) => {
  const { identity, clientContext } = context;
  const { action, email } = await req.json();

  if (!identity || !clientContext || !clientContext.identity || !clientContext.identity.token) {
    return new Response(JSON.stringify({ error: "Missing Identity admin token" }), { status: 401 });
  }

  const headers = {
    Authorization: `Bearer ${clientContext.identity.token}`,
    "Content-Type": "application/json"
  };

  let url = "";
  if (action === "invite") url = `${identity.url}/invite`;
  else if (action === "recovery") url = `${identity.url}/recover`;
  else return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ email }) });
  const data = await res.json();
  return new Response(JSON.stringify(data), { status: res.status });
};