// api/blob-url.js
export const config = { runtime: "edge" }; // usa Edge per il direct upload

import blobPkg from "@vercel/blob";
const { generateUploadUrl } = blobPkg;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: CORS });

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...CORS, "content-type": "application/json" } }
    );
  }

  let body = {};
  try { body = await req.json(); } catch (_) {}
  const filename =
    (body.filename || `upload-${Date.now()}.mp4`).replace(/\s+/g, "_");
  const contentType = body.contentType || "video/mp4";

  try {
    // con lo Store collegato al progetto NON serve passare token
    const { url, pathname, expiration } = await generateUploadUrl({
      pathname: `uploads/${filename}`,
      access: "public",
      contentType,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        uploadUrl: url,      // <-- URL Vercel Blob (https://blob.vercel-storage.com/...)
        blobPath: pathname,
        expiresAt: expiration,
        now: Date.now(),
      }),
      { status: 200, headers: { ...CORS, "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500, headers: { ...CORS, "content-type": "application/json" } }
    );
  }
}
