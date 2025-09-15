// api/extract-data.js
// Serverless (Node) – niente Edge: mammoth e pdf-parse richiedono Node
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

// CORS base
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function dataURLToBuffer(dataURL = "") {
  // es: data:application/pdf;base64,JVBERi0xLjcKJYGBgYEK...
  const comma = dataURL.indexOf(",");
  if (comma === -1) return Buffer.from([]);
  const base64 = dataURL.slice(comma + 1);
  return Buffer.from(base64, "base64");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }

  try {
    const { fileName, dataURL } = req.body || {};
    if (!fileName || !dataURL) {
      return res.status(400).json({ ok: false, message: "fileName e dataURL sono obbligatori" });
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase();
    const buf = dataURLToBuffer(dataURL);

    let text = "";

    if (ext === "txt" || ext === "md") {
      text = buf.toString("utf-8");
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value || "";
    } else if (ext === "pdf") {
      const result = await pdfParse(buf);
      text = result.text || "";
    } else {
      return res.status(400).json({
        ok: false,
        message: `Estensione .${ext} non supportata da extract-data (usa txt, md, docx, pdf)`
      });
    }

    text = String(text || "").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      return res.status(422).json({ ok: false, message: "Testo vuoto dopo l'estrazione" });
    }

    return res.status(200).json({
      ok: true,
      text,
      meta: {
        fileName,
        extension: ext,
        size: buf.length,
      }
    });
  } catch (e) {
    console.error("extract-data error:", e);
    return res.status(500).json({
      ok: false,
      message: "Errore elaborazione file",
      detail: e?.message || String(e),
    });
  }
}
