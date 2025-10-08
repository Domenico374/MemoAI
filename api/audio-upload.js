// /api/audio-upload.js - SEMPLICE E FUNZIONANTE
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  // Configura CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("🎯 Audio Upload Endpoint Chiamato!");

  try {
    // Configura formidable
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true
    });

    // Parsing del form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    console.log("✅ Form parsing completato!");
    console.log("📁 Files ricevuti:", Object.keys(files));
    console.log("📋 Fields ricevuti:", Object.keys(fields));

    // Cerca qualsiasi file audio
    const fileKeys = Object.keys(files);
    if (fileKeys.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Nessun file ricevuto" 
      });
    }

    const firstFileKey = fileKeys[0];
    const fileArray = files[firstFileKey];
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    console.log("🔍 File trovato:", {
      fieldName: firstFileKey,
      fileName: file.originalFilename,
      fileSize: file.size,
      mimeType: file.mimetype
    });

    // SUCCESSO!
    return res.status(200).json({
      success: true,
      message: "File audio ricevuto con successo!",
      fileInfo: {
        name: file.originalFilename,
        size: file.size,
        type: file.mimetype,
        field: firstFileKey
      },
      nextStep: "Aggiungere trascrizione OpenAI"
    });

  } catch (error) {
    console.error("❌ Errore durante l'upload:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Errore sconosciuto durante l'upload"
    });
  }
}
