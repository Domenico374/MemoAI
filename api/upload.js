// pages/api/upload.js
import fs from "node:fs";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 1) parse multipart con Formidable
    const form = formidable({
      multiples: false,
      maxFileSize: 25 * 1024 * 1024, // 25MB
      keepExtensions: true,
    });

    const { files } = await new Promise((resolve, reject) =>
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })))
    );

    // NB: in alcuni ambienti files.file può essere un array
    let file = files?.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) {
      return res.status(400).json({ ok: false, error: "Campo 'file' mancante nella form-data" });
    }

    const filepath = file.filepath || file.file || file.path; // compat
    const buf = await fs.promises.readFile(filepath);
    const contentType = file.mimetype || "application/octet-stream";
    const filename = (file.originalFilename || file.newFilename || "upload.bin").replace(/[/\\]+/g, "_");

    // 2) Se hai Vercel Blob, usa il token esplicito (evita 401/403)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buf, {
        access: "public",
        contentType,
        // ⚠️ passiamo il token esplicitamente
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return res.status(200).json({
        ok: true,
        url: blob.url,
        size: buf.length,
        contentType,
        storage: "vercel-blob",
      });
    }

    // 3) Fallback: data URL (solo per test o file piccoli)
    if (buf.length > 5 * 1024 * 1024) {
      return res.status(413).json({
        ok: false,
        error: "File troppo grande per fallback data URL (>5MB). Configura BLOB_READ_WRITE_TOKEN.",
      });
    }
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    return res.status(200).json({
      ok: true,
      url: dataUrl,
      size: buf.length,
      contentType,
      storage: "data-url",
    });
  } catch (e) {
    console.error("upload error:", e);
    return res
      .status(500)
      .json({ ok: false, error: e.message || "Errore upload (vedi logs server)" });
  }
}
