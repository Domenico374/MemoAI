// /api/audio-upload.js - VERSIONE CORRETTA
import formidable from "formidable";
import fs from "fs";
import { OpenAI } from "openai";

export const config = {
  api: {
    bodyParser: false
  }
};

// Helper per file conversion (compatibile con Node.js)
async function toFile(buffer, filename, mimetype) {
  const { File } = await import('node-fetch');
  return new File([buffer], filename, { type: mimetype });
}

export default async function handler(req, res) {
  console.log("🚀 Audio Upload Endpoint CHIAMATO!");
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo POST permesso" });
  }

  let tempFilePath = null;

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024,
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

    console.log("✅ File ricevuto:", audioFile.originalFilename);

    // 🔥 TRASCRIZIONE OPENAI
    if (!process.env.OPENAI_API_KEY) {
      console.log("⚠️  OpenAI API Key non configurata");
      return res.status(200).json({
        success: true,
        message: "File ricevuto - Configura OPENAI_API_KEY",
        fileInfo: {
          name: audioFile.originalFilename,
          size: audioFile.size,
          type: audioFile.mimetype
        }
      });
    }

    console.log("🔮 Inizio trascrizione OpenAI...");
    
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    // Leggi il file e crea file per OpenAI
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Usa l'approccio corretto per creare il file
    const openaiFile = await toFile(
      fileBuffer, 
      audioFile.originalFilename, 
      audioFile.mimetype
    );

    console.log("🎙️  Invio a Whisper...");
    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: "whisper-1",
      language: "it",
      response_format: "text"
    });

    console.log("✅ Trascrizione completata!");

    // SUCCESSO
    return res.status(200).json({
      success: true,
      message: "Trascrizione completata!",
      transcription: transcription.text || "",
      fileInfo: {
        name: audioFile.originalFilename,
        size: audioFile.size,
        type: audioFile.mimetype
      },
      stats: {
        textLength: transcription.text?.length || 0,
        words: transcription.text ? transcription.text.split(/\s+/).length : 0
      }
    });

  } catch (error) {
    console.error("💥 ERRORE:", error.message);
    
    // Gestione errori specifici
    let errorMessage = error.message;
    if (error.message?.includes('File')) {
      errorMessage = "Errore processamento file audio";
    } else if (error.message?.includes('API key')) {
      errorMessage = "Problema configurazione OpenAI";
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      step: "trascrizione"
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
