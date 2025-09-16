// api/blob-url.js
import { generateUploadUrl } from "@vercel/blob";

export default async function handler(req, res) {
  // Header CORS (serve se chiami da frontend/browser)
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
    const { filename = `upload-${Date.now()}`, contentType = "video/mp4" } =
      req.body && typeof req.body === "object" ? req.body : {};

    // Genera un URL temporaneo per caricare direttamente su Vercel Blob
    const { url, pathname, expiration } = await generateUploadUrl({
      pathname: `uploads/${filename}`, // percorso nel tuo blob store
      contentType,
      access: "public", // oppure "private" se vuoi file non pubblici
      token: process.env.BLOB_READ_WRITE_TOKEN, // token dalle Env
    });

    return res.status(200).json({
      ok: true,
      uploadUrl: url,     // URL firmato per l'upload
      blobPath: pathname, // percorso nel blob store
      expiresAt: expiration,
      now: Date.now(),
    });
  } catch (err) {
    console.error("blob-url error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
