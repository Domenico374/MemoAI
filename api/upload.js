// api/upload.js
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/upload" });
  if (req.method !== "POST") return res.status(405).json({ message:"POST only" });

  try {
    const { fileName, dataURL } = req.body || {};
    if (!dataURL) return res.status(400).json({ message:"dataURL mancante" });
    const m = dataURL.match(/^data:(.+);base64,(.*)$/);
    if (!m) return res.status(400).json({ message:"dataURL non valido" });

    const ext = (fileName?.split(".").pop() || "bin").toLowerCase();
    const fileId = `${randomUUID()}.${ext}`;
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 25*1024*1024) return res.status(413).json({ message:"File >25MB" });

    await writeFile(`/tmp/${fileId}`, buf);
    return res.status(200).json({ ok:true, fileId });
  } catch (e) {
    console.error("upload error:", e);
    return res.status(500).json({ message:"Errore upload" });
  }
}
