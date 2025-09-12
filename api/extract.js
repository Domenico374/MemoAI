// api/extract.js
import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";     // DOCX -> testo
import pdfParse from "pdf-parse";  // PDF  -> testo

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/extract" });
  if (req.method !== "POST") return res.status(405).json({ message:"POST only" });

  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ message:"fileId mancante" });

    const fullPath = path.join("/tmp", fileId);
    const ext = (fileId.split(".").pop() || "").toLowerCase();

    // Limite prudenziale (10 MB)
    const buf = await readFile(fullPath);
    if (buf.length > 10 * 1024 * 1024) {
      return res.status(413).json({ message:"File troppo grande (>10MB) per estrazione" });
    }

    let text = "";
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = (result.value || "").trim();
    } else if (ext === "pdf") {
      const result = await pdfParse(buf);
      text = (result.text || "").trim();
    } else if (ext === "txt" || ext === "md") {
      text = buf.toString("utf-8");
    } else {
      return res.status(400).json({ message:`Estrazione non supportata per .${ext}` });
    }

    // Pulizia minima
    text = text.replace(/\u0000/g, "").trim();

    return res.status(200).json({ ok:true, text });
  } catch (e) {
    console.error("extract error:", e);
    return res.status(500).json({ message:"Errore estrazione testo" });
  }
}
