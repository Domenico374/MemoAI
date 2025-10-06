// pages/api/extract.js
import { Buffer } from "node:buffer";
import mammoth from "mammoth";

let pdfParse;
try { pdfParse = (await import("pdf-parse")).default; } catch { /* opzionale */ }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { fileUrl, fileName = "" } = req.body || {};
    if (!fileUrl) return res.status(400).json({ ok:false, error:"fileUrl mancante" });

    // Scarica/decodifica il file
    const buf = await getBuffer(fileUrl);
    const ext = (fileName.split(".").pop() || "").toLowerCase();

    let text = "";
    if (ext === "pdf") {
      if (!pdfParse) throw new Error("pdf-parse non installato");
      const out = await pdfParse(buf);
      text = (out && out.text) || "";
    } else if (ext === "docx") {
      const out = await mammoth.extractRawText({ buffer: buf });
      text = (out && out.value) || "";
    } else {
      return res.status(415).json({ ok:false, error:`Formato non supportato: ${ext}` });
    }

    return res.status(200).json({ ok:true, text });
  } catch (e) {
    console.error("extract error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Errore estrazione" });
  }
}

async function getBuffer(url) {
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1] || "";
    return Buffer.from(b64, "base64");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download fallito: ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}
