// /api/audio-upload.js - VERSIONE CON DEBUG ESTESO
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false
  }
};

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
    
    // Configurazione semplice di formidable
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true
    });

    console.log("🔄 Inizio parsing form...");
    
    // Parsing del form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("❌ ERRORE Formidable:", err);
          console.error("❌ Stack:", err.stack);
          reject(err);
        } else {
          console.log("✅ Formidable parsing COMPLETATO!");
          console.log("📁 Files keys:", Object.keys(files));
          console.log("📋 Fields keys:", Object.keys(fields));
          resolve([fields, files]);
        }
      });
    });

    console.log("🔍 Analizzo files ricevuti...");
    
    // DEBUG DETTAGLIATO
    const fileKeys = Object.keys(files);
    console.log("📊 Numero file ricevuti:", fileKeys.length);
    
    if (fileKeys.length === 0) {
      console.log("❌ Nessun file trovato dopo il parsing");
      return res.status(400).json({ 
        success: false, 
        error: "Nessun file ricevuto" 
      });
    }

    console.log("📄 Elaboro il primo file...");
    const firstFileKey = fileKeys[0];
    const fileArray = files[firstFileKey];
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    console.log("✅ FILE TROVATO:", {
      fieldName: firstFileKey,
      fileName: file.originalFilename,
      fileSize: file.size,
      mimeType: file.mimetype,
      tempPath: file.filepath
    });

    // SUCCESSO!
    console.log("🎉 UPLOAD SUCCESSO! Invio response...");
    
    return res.status(200).json({
      success: true,
      message: "File audio ricevuto con successo!",
      fileInfo: {
        name: file.originalFilename,
        size: file.size,
        type: file.mimetype,
        field: firstFileKey
      },
      debug: {
        fileKeys: fileKeys,
        receivedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("💥💥 ERRORE COMPLETO:");
    console.error("💥 Messaggio:", error.message);
    console.error("💥 Stack:", error.stack);
    console.error("💥 Nome:", error.name);
    
    return res.status(500).json({
      success: false,
      error: "Errore server: " + (error.message || "Unknown"),
      step: "check server logs"
    });
  }
}
