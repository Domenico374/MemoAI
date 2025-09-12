// api/extract.js
import { readFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

function normalizeText(s = "") {
  return String(s).replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/extract" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ message: "fileId mancante" });

    const fullPath = path.join("/tmp", fileId);
    const ext = (fileId.split(".").pop() || "").toLowerCase();
    const buf = await readFile(fullPath);

    let text = "";

    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value || "";
    } else if (ext === "pdf") {
      try {
        const result = await pdfParse(buf);
        text = result.text || "";
      } catch (err) {
        return res.status(415).json({
          message: "PDF non testuale (probabilmente scannerizzato). Serve OCR."
        });
      }
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
