// /api/tranecribe-audio.js
import fs from "node:fs";
import formidable from "formidable";
import OpenAI, { toFile } from "openai";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  console.log("🎯 ENDPOINT CHIAMATO: tranecribe-audio");
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024,
    filter: function ({ mimetype }) {
      console.log("🔍 MimeType ricevuto:", mimetype);
      return mimetype && mimetype.includes("audio");
    }
  });

  try {
    console.log("📨 Inizio parsing form...");
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("❌ ERRORE Formidable:", err);
          reject(err);
        } else {
          console.log("✅ Formidable success:", { 
            fileKeys: Object.keys(files),
            fieldKeys: Object.keys(fields),
            firstFile: files[Object.keys(files)[0]]
          });
          resolve({ fields, files });
        }
      });
    });

    const fileKeys = Object.keys(files);
    console.log("📁 File keys trovati:", fileKeys);
    
    if (fileKeys.length === 0) {
      console.log("❌ Nessun file trovato in files object");
      return res.status(400).json({ ok: false, error: "Nessun file audio ricevuto" });
    }

    const file = files[fileKeys[0]];
    const audioFile = Array.isArray(file) ? file[0] : file;
    
    console.log("✅ File elaborato:", {
      name: audioFile.originalFilename,
      size: audioFile.size,
      mimetype: audioFile.mimetype,
      filepath: audioFile.filepath
    });

    // VERIFICA OPENAI API KEY
    console.log("🔑 OpenAI Key presente:", !!process.env.OPENAI_API_KEY);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log("⚠️  Test mode - OpenAI key mancante");
      return res.status(200).json({ 
        ok: true, 
        text: "[TEST] File ricevuto: " + audioFile.originalFilename 
      });
    }

    console.log("🔮 Inizio trascrizione OpenAI...");
    
    // TRASCRIZIONE CON OPENAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Leggi il file temporaneo
    console.log("📖 Lettura file buffer...");
    const fileBuffer = fs.readFileSync(audioFile.filepath);
    console.log("📦 Buffer size:", fileBuffer.length);
    
    console.log("🔄 Conversione toFile...");
    const openaiFile = await toFile(fileBuffer, audioFile.originalFilename);
    
    console.log("🎙️  Invio a OpenAI...");
    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: "whisper-1", 
      language: "it",
      response_format: "text"
    });

    console.log("✅ Trascrizione completata:", transcription.text?.substring(0, 50) + "...");

    // Pulizia
    if (fs.existsSync(audioFile.filepath)) {
      fs.unlinkSync(audioFile.filepath);
    }

    return res.status(200).json({ 
      ok: true, 
      text: transcription.text || "",
      filename: audioFile.originalFilename 
    });

  } catch (error) {
    console.error("❌ ERRORE COMPLETO:", error);
    console.error("❌ Stack:", error.stack);
    
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Errore sconosciuto",
      step: "check console logs"
    });
  }
}
