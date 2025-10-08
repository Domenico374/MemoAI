// /api/audio-upload.js - VERSIONE CORRETTA
import formidable from "formidable";
import fs from "fs";
import { OpenAI } from "openai";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  console.log("🚀 Audio Upload Endpoint CHIAMATO!");
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST permesso" });

  let tempFilePath = null;

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 200 * 1024 * 1024,  // 👈 ✅ CORRETTO: 200MB
      keepExtensions: true
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileKeys = Object.keys(files);
    if (fileKeys.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Nessun file ricevuto" 
      });
    }

    const file = files[fileKeys[0]];
    const audioFile = Array.isArray(file) ? file[0] : file;
    tempFilePath = audioFile.filepath;

    console.log("✅ File ricevuto:", audioFile.originalFilename, "Dimensione:", audioFile.size);

    // PRIMA FASE: Solo upload (senza OpenAI)
    console.log("📦 Upload completato, ritorno successo...");
    
    return res.status(200).json({
      success: true,
      message: "File audio ricevuto con successo!",
      fileInfo: {
        name: audioFile.originalFilename,
        size: audioFile.size,
        type: audioFile.mimetype,
        field: fileKeys[0]
      },
      nextStep: "Trascrizione OpenAI da implementare"
    });

  } catch (error) {
    console.error("💥 ERRORE:", error.message);
    
    return res.status(500).json({
      success: false,
      error: "Errore upload: " + error.message
    });
    
  } finally {
    // Pulizia file temporaneo
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("🧹 File temporaneo pulito");
      } catch (cleanError) {
        console.error("Errore pulizia:", cleanError);
      }
    }
  }
}
