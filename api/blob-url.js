// api/blob-url.js
export const config = { runtime: "edge" }; // usa l’Edge runtime

import blobPkg from "@vercel/blob";
const { generateUploadUrl } = blobPkg;

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
    if (!generateUploadUrl) {
      throw new Error("generateUploadUrl not available from @vercel/blob");
    }

    // lo Store è collegato al progetto → non serve token
    const { url, pathname, expiration } = await generateUploadUrl({
      pathname: `uploads/${filename}`,
      access: "public",     // usa "private" se non vuoi URL pubblici
      contentType,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        uploadUrl: url,      // <-- https://blob.vercel-storage.com/...
        blobPath: pathname,
        expiresAt: expiration,
        now: Date.now(),
      }),
      { status: 200, headers: CORS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: CORS }
    );
  }
}
