// pages/api/transcribe-audio.js
import { Buffer } from "node:buffer";
import OpenAI, { toFile } from "openai";

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ ok:false, error:"url mancante" });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ ok:true, text:"[TEST] Trascrizione disabilitata: set OPENAI_API_KEY" });
    }

    const buf = await getBuffer(url);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = await toFile(buf, "audio.webm");
    const tr = await openai.audio.transcriptions.create({ model: "whisper-1", file, language: "it" });
    return res.status(200).json({ ok:true, text: tr.text || "" });
  } catch(e){
    console.error("transcribe error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Errore trascrizione" });
  }
}

async function getBuffer(url){
  if (url.startsWith("data:")) {
    const b64 = url.split(",")[1] || "";
    return Buffer.from(b64, "base64");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download fallito: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
