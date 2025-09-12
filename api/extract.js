// api/extract.js
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const MAX_BYTES = 24 * 1024 * 1024; // 24 MB

function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDataURL(dataURL) {
  // data:<mime>;base64,<payload>
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataURL || "");
  if (!m) return null;
  const mime = m[1];
  const buffer = Buffer.from(m[2], "base64");
  return { mime, buffer };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/extract" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    const { dataURL, fileId } = req.body || {};
    if (!dataURL) {
      return res.status(400).json({ message: "dataURL mancante" });
    }

    const parsed = parseDataURL(dataURL);
    if (!parsed) {
      return res.status(400).json({ message: "dataURL non valido" });
    }

    const { mime, buffer } = parsed;

    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ message: `File troppo grande (> ${MAX_BYTES / (1024 * 1024)} MB)` });
    }

    let ext = (fileId?.split(".").pop() || "").toLowerCase();
    if (!ext) {
      if (mime.includes("word")) ext = "docx";
      else if (mime.includes("pdf")) ext = "pdf";
      else if (mime.includes("markdown")) ext = "md";
      else if (mime.includes("text")) ext = "txt";
    }

    let text = "";

    if (ext === "docx" || mime.includes("wordprocessingml")) {
      // DOCX → mammoth
      const r = await mammoth.extractRawText({ buffer });
      text = r?.value || "";
    } else if (ext === "pdf" || mime.includes("pdf")) {
      // PDF testuali → pdf-parse
      try {
        const r = await pdfParse(buffer);
        text = r?.text || "";
      } catch (e) {
        // pdf-parse non riesce (protetto/scansione)
        return res.status(415).json({
          message: "PDF non testuale o protetto. OCR richiesto.",
          detail: e.message
        });
      }
      if (!text.trim()) {
        return res.status(422).json({ message: "PDF senza testo estraibile (probabile scansione). OCR richiesto." });
      }
    } else if (ext === "md" || ext === "txt" || mime.includes("text")) {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({
        message: `Estensione non supportata (${ext || mime || "sconosciuta"})`,
        supported: ["docx", "pdf", "txt", "md"]
      });
    }

    text = normalizeText(text);
    if (!text) {
      return res.status(422).json({ message: "Testo vuoto dopo l'estrazione" });
    }

    return res.status(200).json({
      ok: true,
      text,
      meta: { mime, ext, size: buffer.length }
    });
  } catch (e) {
    console.error("extract error:", e);
    return res.status(500).json({ message: "Errore estrazione testo", detail: e.message });
  }
}
