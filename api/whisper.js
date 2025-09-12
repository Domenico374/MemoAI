// api/whisper.js
import OpenAI from "openai";
import { readFile } from "node:fs/promises";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/whisper" });
  if (req.method !== "POST") return res.status(405).json({ message:"POST only" });

  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ message:"OPENAI_API_KEY mancante" });
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ message:"fileId mancante" });

    const path = `/tmp/${fileId}`;
    const buffer = await readFile(path);
    const blob = new Blob([buffer]); // Node 18+/22: Web Blob esiste

    // Scegli un modello:
    const model = "gpt-4o-mini-transcribe"; // oppure "whisper-1"

    const r = await openai.audio.transcriptions.create({
      file: blob,
      model,
      // language: "it", // opzionale
    });

    return res.status(200).json({ ok:true, text: r.text || "", model });
  } catch (e) {
    console.error("whisper error:", e);
    return res.status(500).json({ message:"Errore trascrizione" });
  }
}
