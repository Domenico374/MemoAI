// api/extract.js
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const MAX_BYTES = 120 * 1024 * 1024; // 120 MB

function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(s = "") {
  const basic = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  s = s.replace(/(&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;)/g, m => basic[m] || m);
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
  return s;
}

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

function parseDataURL(dataURL) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataURL || "");
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

async function fetchFileBuffer(fileUrl) {
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Download fallito (${resp.status})`);
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/extract" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    const { dataURL, fileId, fileName, fileUrl } = req.body || {};
    let buffer, mime, ext;

    // --- 1) fileUrl (Blob/S3) ---
    if (fileUrl) {
      buffer = await fetchFileBuffer(fileUrl);
      try {
        mime = (await fetch(fileUrl, { method: "HEAD" })).headers.get("content-type") || "";
      } catch {}
      const name = (fileName || fileId || fileUrl).toLowerCase();
      ext = name.includes(".") ? name.split(".").pop() : "";
    }
    // --- 2) dataURL ---
    else if (dataURL) {
      const parsed = parseDataURL(dataURL);
      if (!parsed) {
        return res.status(400).json({ message: "dataURL non valido", detail: "Formato atteso: data:<mime>;base64,<payload>" });
      }
      mime = parsed.mime;
      buffer = parsed.buffer;
      const name = (fileName || fileId || "").toLowerCase();
      ext = name.includes(".") ? name.split(".").pop() : "";
    } else {
      return res.status(400).json({ message: "Fornisci fileUrl o dataURL" });
    }

    if (!buffer?.length) return res.status(400).json({ message: "Buffer vuoto" });
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ message: "File troppo grande", detail: `Limite: ${MAX_BYTES / (1024 * 1024)} MB` });
    }

    // deduci ext se mancante
    if (!ext) {
      if ((mime || "").includes("word")) ext = "docx";
      else if ((mime || "").includes("pdf")) ext = "pdf";
      else if ((mime || "").includes("markdown")) ext = "md";
      else if ((mime || "").includes("text")) ext = "txt";
    }

    let text = "";

    // --- DOCX ---
    if (ext === "docx" || mime.includes("wordprocessingml")) {
      const buf2 = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      try {
        const raw = await mammoth.extractRawText({ buffer: buf2 });
        text = raw?.value || "";
        if (!text || text.trim().length < 5) {
          const htmlRes = await mammoth.convertToHtml({ buffer: buf2 });
          const fallbackText = htmlToText(htmlRes?.value || "");
          if (fallbackText) text = fallbackText;
        }
        if (!text) {
          return res.status(422).json({ message: "DOCX senza testo estraibile", detail: "Contiene solo immagini o testo non standard" });
        }
      } catch (e) {
        return res.status(500).json({ message: "Errore estrazione DOCX", detail: e.message });
      }
    }
    // --- PDF ---
    else if (ext === "pdf" || mime.includes("pdf")) {
      try {
        const r = await pdfParse(buffer);
        text = r?.text || "";
      } catch (e) {
        return res.status(415).json({ message: "PDF non testuale o protetto", detail: "Probabile scansione/immagini" });
      }
      if (!text.trim()) {
        return res.status(422).json({ message: "PDF senza testo estraibile", detail: "Il PDF sembra una scansione. Serve OCR." });
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
      return res.status(422).json({ message: "Testo vuoto dopo estrazione" });
    }

    return res.status(200).json({ ok: true, text, meta: { mime, ext, size: buffer.length } });
  } catch (e) {
    console.error("extract fatal error:", e);
    return res.status(500).json({ message: "Errore estrazione testo", detail: e.message });
  }
}
