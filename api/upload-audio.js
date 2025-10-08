// /api/upload-audio.js
import fs from "node:fs";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ✅ 1. CONFIGURA FORMIDABLE CON FILTRI
  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    filter: function ({ name, originalFilename, mimetype }) {
      // ✅ SOLO FILE AUDIO
      const isAudio = mimetype && mimetype.includes("audio");
      if (!isAudio) {
        console.error("File non audio:", mimetype);
      }
      return isAudio;
    }
  });

  try {
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // ✅ 2. VERIFICA CHE IL FILE ESISTA
    if (!files.audio) { // ← CAMBIATO DA "file" A "audio"
      return res.status(400).json({ 
        ok: false, 
        error: "Nessun file audio ricevuto - usa campo 'audio'" 
      });
    }

    const file = files.audio[0] || files.audio; // Gestione array/singolo
    
    // ✅ 3. VERIFICA MIME TYPE
    if (!file.mimetype.includes("audio")) {
      return res.status(400).json({ 
        ok: false, 
        error: "Tipo file non supportato. Solo audio permesso." 
      });
    }

    // ✅ 4. CREA CARTELLA SE NON ESISTE
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ 5. PERCORSO UNIVOCO PER FILE
    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const newPath = `${uploadDir}/${safeFilename}`;

    // ✅ 6. SPOSTA FILE
    fs.renameSync(file.filepath, newPath);

    console.log("✅ Upload riuscito:", safeFilename);

    res.status(200).json({
      ok: true,
      message: "File audio caricato correttamente",
      filename: safeFilename,
      path: newPath,
      url: `/uploads/${safeFilename}` // ← URL per accesso
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
