// /api/audio-upload.js - VERSIONE COMPLETA CON TRASCRIZIONE
import formidable from "formidable";
import fs from "fs";
import { OpenAI } from "openai";

export const config = {
  api: {
    bodyParser: false
  }
};

// Helper function per convertire buffer in file OpenAI
async function bufferToFile(buffer, filename) {
  const blob = new Blob([buffer]);
  return new File([blob], filename);
}

export default async function handler(req, res) {
  console.log("🚀🎯 Audio Upload Endpoint CHIAMATO!");
  
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    console.log("✅ Preflight OK");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permesso" });
  }

  console.log("📨 Inizio elaborazione upload...");

  try {
    console.log("🔧 Configuro formidable...");
    
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true
    });

    console.log("🔄 Inizio parsing form...");
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("❌ ERRORE Formidable:", err);
          reject(err);
        } else {
          console.log("✅ Formidable parsing COMPLETATO!");
          console.log("📁 Files keys:", Object.keys(files));
          resolve([fields, files]);
        }
      });
    });

    const fileKeys = Object.keys(files);
    console.log("📊 Numero file ricevuti:", fileKeys.length);
    
    if (fileKeys.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Nessun file ricevuto" 
      });
    }

    const firstFileKey = fileKeys[0];
    const fileArray = files[firstFileKey];
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    console.log("✅ FILE TROVATO:", {
      fileName: file.originalFilename,
      fileSize: file.size,
      mimeType: file.mimetype
    });

    // 🔥 TRASCRIZIONE OPENAI
    console.log("🎙️  Verifica OpenAI API Key...");
    
    if (!process.env.OPENAI_API_KEY) {
      console.log("⚠️  OpenAI API Key non configurata");
      // Pulizia file temporaneo
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      
      return res.status(200).json({
        success: true,
        message: "File ricevuto - Configura OPENAI_API_KEY per la trascrizione",
        fileInfo: {
          name: file.originalFilename,
          size: file.size,
          type: file.mimetype
        },
        transcription: null
      });
    }

    console.log("🔑 OpenAI configurato, avvio trascrizione...");
    
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    // Leggi il file temporaneo
    const fileBuffer = fs.readFileSync(file.filepath);
    console.log("📖 File letto, dimensione buffer:", fileBuffer.length);

    // Crea file per OpenAI
    const openaiFile = await bufferToFile(fileBuffer, file.originalFilename);
    
    console.log("🔮 Invio a Whisper...");
    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: "whisper-1",
      language: "it",
      response_format: "text"
    });

    console.log("✅ Trascrizione completata!");
    console.log("📝 Lunghezza testo:", transcription.text.length);

    // Pulizia file temporaneo
    if (fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    // SUCCESSO COMPLETO!
    return res.status(200).json({
      success: true,
      message: "Trascrizione completata con successo!",
      transcription: transcription.text,
      fileInfo: {
        name: file.originalFilename,
        size: file.size,
        type: file.mimetype
      },
      stats: {
        textLength: transcription.text.length,
        words: transcription.text.split(/\s+/).length
      }
    });

  } catch (error) {
    console.error("💥 ERRORE COMPLETO:");
    console.error("💥 Messaggio:", error.message);
    console.error("💥 Stack:", error.stack);
    
    // Pulizia file temporaneo in caso di errore
    try {
      if (files && Object.keys(files).length > 0) {
        const firstFile = files[Object.keys(files)[0]];
        const file = Array.isArray(firstFile) ? firstFile[0] : firstFile;
        if (file && file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      }
    } catch (cleanupError) {
      console.error("Errore pulizia:", cleanupError);
    }
    
    return res.status(500).json({
      success: false,
      error: "Errore: " + (error.message || "Unknown"),
      step: "trascrizione"
    });
  }
}
