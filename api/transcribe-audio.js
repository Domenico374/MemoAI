// pages/api/transcribe-audio.js
import fs from "node:fs";
import formidable from "formidable";
import OpenAI, { toFile } from "openai";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  console.log("🎯 Transcribe-audio chiamato con upload file");

  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024,
    filter: function ({ mimetype }) {
      return mimetype && mimetype.includes("audio");
    }
  });

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Cerca il file con qualsiasi nome
    const fileKeys = Object.keys(files);
    if (fileKeys.length === 0) {
      return res.status(400).json({ ok: false, error: "Nessun file audio ricevuto" });
    }

    const file = files[fileKeys[0]];
    const audioFile = Array.isArray(file) ? file[0] : file;

    console.log("🔍 File ricevuto:", audioFile.originalFilename);

    // ✅ TRASCRIZIONE CON OPENAI
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ 
        ok: true, 
        text: "[TEST] Trascrizione disabilitata - File ricevuto: " + audioFile.originalFilename 
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Leggi il file temporaneo
    const fileBuffer = fs.readFileSync(audioFile.filepath);
    const openaiFile = await toFile(fileBuffer, audioFile.originalFilename);

    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: "whisper-1", 
      language: "it",
      response_format: "text"
    });

    // Pulizia file temporaneo
    fs.unlinkSync(audioFile.filepath);

    return res.status(200).json({ 
      ok: true, 
      text: transcription.text || "",
      filename: audioFile.originalFilename 
    });

  } catch (error) {
    console.error("❌ Errore trascrizione:", error);
    return res.status(500).json({ 
      ok: false, 
      error: error.message || "Errore durante la trascrizione" 
    });
  }
}
