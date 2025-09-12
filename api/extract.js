// api/extract.js
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";

const MAX_BYTES = 24 * 1024 * 1024; // 24 MB

// Pulizia minima del testo
function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// data:<mime>;base64,<payload> -> { mime, buffer }
function parseDataURL(dataURL) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataURL || "");
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
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
    const { dataURL, fileId, fileName } = req.body || {};
    if (!dataURL) {
      return res.status(400).json({
        message: "dataURL mancante",
        detail: "Invia il file in Base64 come data:<mime>;base64,<payload>"
      });
    }

    const parsed = parseDataURL(dataURL);
    if (!parsed) {
      return res.status(400).json({
        message: "dataURL non valido",
        detail: "Formato atteso: data:<mime>;base64,<payload>"
      });
    }

    let { mime, buffer } = parsed;

    if (!buffer?.length) {
      return res.status(400).json({ message: "Buffer vuoto", detail: "Payload Base64 decodificato vuoto." });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        message: "File troppo grande",
        detail: `Limite: ${MAX_BYTES / (1024 * 1024)} MB`
      });
    }

    // Deduzione estensione: 1) fileName  2) fileId  3) MIME
    const name = (fileName || fileId || "").toLowerCase();
    let ext = name.includes(".") ? name.split(".").pop() : "";
    if (!ext || !/^[a-z0-9]+$/.test(ext)) {
      if (mime.includes("word")) ext = "docx";
      else if (mime.includes("pdf")) ext = "pdf";
      else if (mime.includes("markdown")) ext = "md";
      else if (mime.includes("text")) ext = "txt";
    }

    let text = "";

    // --- DOCX ---
    if (ext === "docx" || mime.includes("wordprocessingml")) {
      try {
        // mammoth preferisce un vero Buffer Node
        const buf2 = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        const result = await mammoth.extractRawText({ buffer: buf2 });
        text = result?.value || "";
      } catch (e) {
        console.error("mammoth error:", e);
        return res.status(500).json({
          message: "Errore estrazione DOCX",
          detail: e?.message || "mammoth non è riuscito a leggere il file"
        });
      }
    }
    // --- PDF (solo testuali) ---
    else if (ext === "pdf" || mime.includes("pdf")) {
      try {
        const r = await pdfParse(buffer);
        text = r?.text || "";
      } catch (e) {
        console.error("pdf-parse error:", e);
        return res.status(415).json({
          message: "PDF non testuale o protetto",
          detail: "Impossibile leggerlo con pdf-parse. Probabile scansione/immagini."
        });
      }
      if (!text.trim()) {
        return res.status(422).json({
          message: "PDF senza testo estraibile",
          detail: "Il PDF sembra una scansione (solo immagini). Serve OCR."
        });
      }
    }
    // --- TXT / MD ---
    else if (ext === "md" || ext === "txt" || mime.includes("text")) {
      text = buffer.toString("utf-8");
    }
    // --- Non supportato ---
    else {
      return res.status(400).json({
        message: "Estensione/MIME non supportati",
        detail: `Ext: ${ext || "?"} · MIME: ${mime}`,
        supported: ["docx", "pdf", "txt", "md"]
      });
    }

    text = normalizeText(text);
    if (!text) {
      return res.status(422).json({
        message: "Testo vuoto dopo l'estrazione",
        detail: "Il file è stato letto ma non contiene testo utile."
      });
    }

    return res.status(200).json({
      ok: true,
      text,
      meta: { mime, ext, size: buffer.length }
    });
  } catch (e) {
    console.error("extract fatal error:", e);
    return res.status(500).json({ message: "Errore estrazione testo", detail: e.message });
  }
}
