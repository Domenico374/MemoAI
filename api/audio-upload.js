import formidable from "formidable";
import fs from "fs";
import { put } from '@vercel/blob';  // 👈 AGGIUNTO

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

    console.log("✅ File ricevuto:", audioFile.originalFilename, "Dimensione:", audioFile.size);

    // 👇 **NUOVA PARTE: SALVATAGGIO SU VERCEL BLOB**
    
    // Leggi il file temporaneo
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Crea nome file univoco
    const timestamp = Date.now();
    const fileExtension = audioFile.originalFilename.split('.').pop();
    const blobFilename = `audio-${timestamp}.${fileExtension}`;
    
    console.log("📦 Salvando su Vercel Blob...", blobFilename);
    
    // Salva su Vercel Blob
    const { url } = await put(blobFilename, fileBuffer, {
      access: 'public',
      addRandomSuffix: false  // Usiamo il nostro timestamp per unicità
    });

    console.log("✅ File salvato su Blob:", url);

    // 👇 RISPOSTA AGGIORNATA
    return res.status(200).json({
      success: true,
      message: "File audio salvato con successo su cloud storage!",
      fileInfo: {
        name: audioFile.originalFilename,
        size: audioFile.size,
        type: audioFile.mimetype,
        blobUrl: url,  // 👈 NUOVO: URL permanente del file
        blobFilename: blobFilename
      },
      nextStep: "Pronto per trascrizione OpenAI"
    });

  } catch (error) {
    console.error("💥 ERRORE:", error.message);
    
    return res.status(500).json({
      success: false,
      error: "Errore upload: " + error.message
    });
    
  } finally {
    // Pulizia file temporaneo (NECESSARIA ANCHE CON BLOB)
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
