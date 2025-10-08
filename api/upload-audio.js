// /api/upload-audio.js - VERSIONE DEBUG
import fs from "node:fs";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  console.log("📨 Richiesta upload ricevuta");

  const form = formidable({
    multiples: true, // ✅ CAMBIA A TRUE
    maxFileSize: 10 * 1024 * 1024,
    filter: function ({ name, originalFilename, mimetype }) {
      console.log("🔍 Filtro file:", { name, originalFilename, mimetype });
      return mimetype && mimetype.includes("audio");
    }
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ✅ DEBUG ESTESO
    console.log("📂 Files ricevuti:", Object.keys(files));
    console.log("📋 Fields ricevuti:", fields);
    console.log("🔍 Contenuto files:", JSON.stringify(files, null, 2));

    // ✅ CERCHIAMO QUALSIASI FILE
    const fileKeys = Object.keys(files);
    if (fileKeys.length === 0) {
      return res.status(400).json({ 
        ok: false, 
        error: "Nessun file ricevuto dal server",
        debug: { receivedFiles: fileKeys, receivedFields: Object.keys(fields) }
      });
    }

    // ✅ PRENDI IL PRIMO FILE DISPONIBILE (qualunque nome abbia)
    const firstFileKey = fileKeys[0];
    const file = Array.isArray(files[firstFileKey]) 
      ? files[firstFileKey][0] 
      : files[firstFileKey];

    console.log("✅ File elaborato:", {
      name: firstFileKey,
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size
    });

    // ✅ CREA CARTELLA UPLOAD
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ PERCORSO UNIVOCO
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const newPath = `${uploadDir}/${safeFilename}`;

    // ✅ SPOSTA FILE
    fs.renameSync(file.filepath, newPath);

    console.log("🎉 Upload completato:", safeFilename);

    res.status(200).json({
      ok: true,
      message: "File audio caricato correttamente",
      filename: safeFilename,
      path: newPath,
      url: `/uploads/${safeFilename}`,
      debug: {
        fieldName: firstFileKey, // ← TI DICE QUALE NOME USARE
        totalFiles: fileKeys.length
      }
    });

  } catch (error) {
    console.error("❌ Errore upload:", error);
    
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ 
        ok: false, 
        error: "File troppo grande (max 10MB)" 
      });
    }
    
    res.status(500).json({ 
      ok: false, 
      error: "Errore durante l'upload",
      details: error.message 
    });
  }
}
