// api/blob-url.js (Edge Runtime)
// Ritorna un URL di upload temporaneo su Vercel Blob.
// Il client farà POST del file *direttamente* a quell'URL.
import { createUploadURL } from "@vercel/blob";

export const config = { runtime: "edge" };

export default async function handler() {
  try {
    const { url } = await createUploadURL();
    return new Response(JSON.stringify({ uploadUrl: url }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "Errore creazione upload URL", detail: e.message }), {
      headers: { "content-type": "application/json" },
      status: 500,
    });
  }
}
