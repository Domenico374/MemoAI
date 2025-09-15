// api/blob-url.js
export const runtime = 'nodejs';

// Questa è una demo: ritorna un URL fittizio che accetta POST
export default async function handler(req) {
  return new Response(
    JSON.stringify({
      ok: true,
      uploadUrl: "/api/echo",   // <-- endpoint fittizio per test
      now: Date.now()
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}
