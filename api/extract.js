// api/extract.js
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // usare la build giusta

const MAX_BYTES = 24 * 1024 * 1024; // 24 MB

function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// decode minimale per entità HTML comuni + numeriche
function decodeEntities(s = "") {
  const basic = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  };
  s = s.replace(/(&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;)/g, m => basic[m] || m);
  // &#xHH; esadecimali
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // &#DD; decimali
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
  return s;
}

// HTML -> testo semplice
function htmlToText(html = "") {
  return normalizeText(
    decodeEntities(
      String(html)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/(h[1-6]|li|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
    )
  );
}

// data:<mime>;base64,<payload>
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
        detail: "Invia il file come data:<mime>;base64,<payload>",
      });
    }

    const parsed = parseDataURL(dataURL);
    if (!parsed) {
      return res.status(400).json({
        message: "dataURL non valido",
        detail: "Formato atteso: data:<mime>;base64,<payload>",
      });
    }

    let { mime, buffer } = parsed;

    if (!buffer?.length) {
      return res.status(400).json({ message: "Buffer vuoto", detail: "Payload Base64 decodificato vuoto." });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        message: "File troppo grande",
        detail: `Limite: ${MAX_BYTES / (1024 * 1024)} MB`,
      });
    }

    // Estensione da fileName/fileId/mime
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
        const buf2 = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

        // 1) tentativo: testo raw
        const raw = await mammoth.extractRawText({ buffer: buf2 });
        text = raw?.value || "";

        // 2) fallback: HTML -> testo (se raw è vuoto o troppo corto)
        if (!text || text.trim().length < 5) {
          const htmlRes = await mammoth.convertToHtml({ buffer: buf2 });
          const html = htmlRes?.value || "";
          const fallbackText = htmlToText(html);
          if (fallbackText && fallbackText.trim()) {
            text = fallbackText;
          }
        }

        if (!text || !text.trim()) {
          return res.status(422).json({
            message: "DOCX senza testo estraibile",
            detail: "Il documento sembra contenere solo immagini o testo non standard. Prova a esportare come PDF con testo selezionabile o a copiare/incollare il testo.",
          });
        }
      } catch (e) {
        console.error("mammoth error:", e);
        return res.status(500).json({
          message: "Errore estrazione DOCX",
          detail: e?.message || "mammoth non è riuscito a leggere il file",
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
          detail: "Impossibile leggerlo con pdf-parse. Probabile scansione/immagini.",
        });
      }
      if (!text.trim()) {
        return res.status(422).json({
          message: "PDF senza testo estraibile",
          detail: "Il PDF sembra una scansione (solo immagini). Serve OCR.",
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
        supported: ["docx", "pdf", "txt", "md"],
      });
    }

    text = normalizeText(text);
    if (!text) {
      return res.status(422).json({
        message: "Testo vuoto dopo l'estrazione",
        detail: "Il file è stato letto ma non contiene testo utile.",
      });
    }

    return res.status(200).json({ ok: true, text, meta: { mime, ext, size: buffer.length } });
  } catch (e) {
    console.error("extract fatal error:", e);
    return res.status(500).json({ message: "Errore estrazione testo", detail: e.message });
  }
}
