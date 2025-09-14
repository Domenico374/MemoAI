// api/blob-url.js
export const runtime = 'edge';

export default async function handler() {
  try {
    // Import dinamico per evitare problemi di bundling
    const { createUploadURL } = await import('@vercel/blob');

    const { url } = await createUploadURL();
    return new Response(
      JSON.stringify({ uploadUrl: url }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        message: 'Errore creazione upload URL',
        detail: e?.message || String(e),
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 500,
      }
    );
  }
}
