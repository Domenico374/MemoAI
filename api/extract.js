// api/extract.js
import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";     // DOCX -> testo
import pdfParse from "pdf-parse";  // PDF  -> testo

function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")        // null chars
    .replace(/[ \t]+\n/g, "\n")    // spazi a fine riga
    .replace(/\n{3,}/g, "\n\n")    // più di 2 newline -> 2
    .trim();
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/extract" });
  if (req.method !== "POST") {
    return res.status(405).json({ message: "POST only" });
  }

  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ message: "fileId mancante" });

    const fullPath = path.join("/tmp", fileId);
    const ext = (fileId.split(".").pop() || "").toLowerCase();

    // Leggi file (limite prudenziale 10MB per la funzione serverless)
    const buf = await readFile(fullPath);
    if (buf.length > 10 * 1024 * 1024) {
      return res.status(413).json({ message: "File troppo grande (>10MB) per estrazione" });
    }

    let text = "";
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result?.value || "";
    } else if (ext === "pdf") {
      // pdf-parse gestisce testo nativo; per PDF scansionati serve OCR (non incluso)
      const result = await pdfParse(buf);
      text = result?.text || "";
    } else if (ext === "txt" || ext === "md") {
      text = buf.toString("utf-8");
    } else {
      return res.status(400).json({ message: `Estrazione non supportata per .${ext}` });
    }

    text = normalizeText(text);
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    console.error("extract error:", e);
    return res.status(500).json({ message: "Errore estrazione testo" });
  }
}
