// api/blob-upload.js
import blobPkg from "@vercel/blob";
import { Readable } from "node:stream";

const { put } = blobPkg;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // nome file dalla query: /api/blob-upload?filename=video.mp4
    const filename = (req.query.filename || `upload-${Date.now()}.mp4`)
      .toString()
      .replace(/\s+/g, "_");

    const contentType = req.headers["content-type"] || "application/octet-stream";

    // Converto lo stream Node in Web stream (robusto con @vercel/blob)
    const webStream = Readable.toWeb(req);

    // Lo store è già "Connected": non serve passare il token a put()
    const result = await put(`uploads/${filename}`, webStream, {
      access: "public",   // "private" se non vuoi URL pubblici
      contentType,
      // addRandomSuffix: true, // opzionale
    });

    // result: { url, pathname, size, uploadedAt, ... }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("blob-upload error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
