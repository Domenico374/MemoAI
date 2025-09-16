// api/blob-url.js
export const runtime = "edge"; // obbligatorio per Edge Function

// Import "a prova di bomba": prende sia named export sia default
import * as blobNS from "@vercel/blob";
const generateUploadUrl =
  blobNS.generateUploadUrl ??
  (blobNS.default && blobNS.default.generateUploadUrl);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "content-type": "application/json",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: CORS }
    );
  }

  // leggi body in sicurezza
  let filename = `upload-${Date.now()}.mp4`;
  let contentType = "video/mp4";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object") {
      if (body.filename) filename = String(body.filename).replace(/\s+/g, "_");
      if (body.contentType) contentType = String(body.contentType);
    }
  } catch {}

  try {
    // diagnostica: verifica che l'export esista
    if (typeof generateUploadUrl !== "function") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "generateUploadUrl_unavailable",
          availableExports: Object.keys(blobNS),
          hint:
            "Aggiorna @vercel/blob alla versione più recente e redeploy. " +
            "Questo endpoint richiede generateUploadUrl.",
        }),
        { status: 500, headers: CORS }
      );
    }

    // lo Store è collegato al progetto → non serve token
    const { url, pathname, expiration } = await generateUploadUrl({
      pathname: `uploads/${filename}`,
      access: "public",
      contentType,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        uploadUrl: url, // <-- https://blob.vercel-storage.com/...
        blobPath: pathname,
        expiresAt: expiration,
        now: Date.now(),
      }),
      { status: 200, headers: CORS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err?.message || err),
      }),
      { status: 500, headers: CORS }
    );
  }
}
