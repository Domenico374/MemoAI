// api/blob-url.js

// Import compatibile con pacchetti CommonJS
import blobPkg from "@vercel/blob";
const { generateUploadUrl } = blobPkg;

export default async function handler(req, res) {
  // CORS base (utile dal browser)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Parametri opzionali dal body
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const filename = body.filename || `upload-${Date.now()}`;
    const contentType = body.contentType || "video/mp4";

    // URL firmato per upload diretto su Vercel Blob
    const { url, pathname, expiration } = await generateUploadUrl({
      pathname: `uploads/${filename}`,
      contentType,
      access: "public", // usa "private" se non vuoi URL pubblici
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({
      ok: true,
      uploadUrl: url,
      blobPath: pathname,
      expiresAt: expiration,
      now: Date.now(),
    });
  } catch (err) {
    console.error("blob-url error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
