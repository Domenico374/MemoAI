import formidable from "formidable";
import fs from "fs";
import { put } from '@vercel/blob';
import { OpenAI } from "openai";

export const config = {
  api: {
    bodyParser: false
  }
};

// ✅ CONTROLLO MIGLIORATO DELLA API KEY
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export default async function handler(req, res) {
  console.log("🚀 Audio Upload Endpoint CHIAMATO!");
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST permesso" });

  // ✅ CONTROLLO INIZIALE CRITICO
  if (!openai) {
    console.error("❌ OPENAI_API_KEY non configurata");
    return res.status(500).json({
      success: false,
      error: "Configurazione API Key mancante"
    });
  }

  let tempFilePath = null;

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 200 * 1024 * 1024,
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

    // 🎯 PRIMA SALVA SU BLOB (SENZA OPENAI - TEST)
    const fileBuffer = fs.readFileSync(tempFilePath);
    const timestamp = Date.now();
    const fileExtension = audioFile.originalFilename.split('.').pop();
    const blobFilename = `audio-${timestamp}.${fileExtension}`;
    
    console.log("📦 Salvando su Vercel Blob...");
    
    try {
      const { url } = await put(blobFilename, fileBuffer, {
        access: 'public',
        addRandomSuffix: false
      });

      console.log("✅ File salvato su Blob:", url);

      // ✅ RITONA SUCCESSO SOLO CON BLOB (PER TEST)
      return res.status(200).json({
        success: true,
        message: "File audio salvato su cloud storage!",
        fileInfo: {
          audioUrl: url,
          blobFilename: blobFilename
        },
        nextStep: "Trascrizione da implementare"
      });

    } catch (blobError) {
      console.error("❌ Errore Blob:", blobError);
      return res.status(403).json({
        success: false,
        error: "Errore autorizzazione Blob Storage: " + blobError.message
      });
    }

  } catch (error) {
    console.error("💥 ERRORE GENERICO:", error.message);
    
    return res.status(500).json({
      success: false,
      error: "Errore upload: " + error.message
    });
    
  } finally {
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
