// api/blob-url.js — test di route
export const runtime = 'edge';

export default async function handler() {
  return new Response(
    JSON.stringify({ ok: true, now: Date.now() }),
    { headers: { 'content-type': 'application/json' }, status: 200 }
  );
}
