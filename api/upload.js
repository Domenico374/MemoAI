// pages/api/upload.js
import fs from "node:fs";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 }); // 25MB
  try {
    const { files } = await new Promise((resolve, reject) =>
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })))
    );
    const file = files.file;
    if (!file) return res.status(400).json({ ok:false, error:"file mancante" });

    const buf = await fs.promises.readFile(file.filepath);
    const contentType = file.mimetype || "application/octet-stream";
    const filename = file.originalFilename || "upload.bin";

    // Se hai configurato Vercel Blob, usalo
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buf, { access: "public", contentType });
      return res.status(200).json({ ok: true, url: blob.url, size: buf.length, contentType });
    }

    // Fallback: data URL (va bene per test e file medio-piccoli)
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    return res.status(200).json({ ok: true, url: dataUrl, size: buf.length, contentType });
  } catch (e) {
    console.error("upload error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Errore upload" });
  }
}
