// api/extract.js - Versione con debug migliorato
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// Import condizionali per gestire dipendenze mancanti
let mammoth, pdfParse;
try {
  mammoth = require("mammoth");
} catch (e) {
  console.warn("mammoth non installato - .docx non supportati");
}

try {
  pdfParse = require("pdf-parse");
} catch (e) {
  console.warn("pdf-parse non installato - .pdf non supportati");
}

function normalizeText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  
  if (req.method === "GET") {
    return res.status(200).json({ 
      ok: true, 
      route: "/api/extract",
      dependencies: {
        mammoth: !!mammoth,
        pdfParse: !!pdfParse
      }
    });
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ message: "POST only" });
  }

  console.log("🔍 DEBUG - Extract API chiamata:", {
    body: req.body,
    timestamp: new Date().toISOString()
  });

  try {
    const { fileId } = req.body || {};
    
    // Validazione input con debug
    if (!fileId) {
      console.error("❌ fileId mancante nel body:", req.body);
      return res.status(400).json({ 
        message: "fileId mancante",
        debug: { receivedBody: req.body }
      });
    }

    console.log("📁 Tentativo lettura file:", fileId);

    // Percorso file - prova diverse cartelle
    const possiblePaths = [
      path.join("/tmp", fileId),
      path.join(process.cwd(), "uploads", fileId),
      path.join(process.cwd(), "tmp", fileId),
      path.join("./uploads", fileId)
    ];

    let fullPath = null;
    let fileExists = false;

    // Trova il file in una delle possibili cartelle
    for (const testPath of possiblePaths) {
      try {
        await access(testPath, constants.F_OK);
        fullPath = testPath;
        fileExists = true;
        console.log("✅ File trovato in:", testPath);
        break;
      } catch (e) {
        console.log("❌ File NON trovato in:", testPath);
      }
    }

    if (!fileExists || !fullPath) {
      console.error("❌ File non trovato in nessuna cartella:", {
        fileId,
        searchedPaths: possiblePaths
      });
      return res.status(404).json({ 
        message: `File ${fileId} non trovato`,
        debug: { 
          searchedPaths: possiblePaths,
          workingDirectory: process.cwd()
        }
      });
    }

    // Estrai estensione
    const ext = (fileId.split(".").pop() || "").toLowerCase();
    console.log("📄 Estensione file:", ext);

    // Leggi il file
    let buf;
    try {
      buf = await readFile(fullPath);
      console.log("✅ File letto con successo, dimensione:", buf.length, "bytes");
    } catch (readError) {
      console.error("❌ Errore lettura file:", readError);
      return res.status(500).json({ 
        message: "Errore lettura file",
        debug: { 
          path: fullPath,
          error: readError.message 
        }
      });
    }

    let text = "";

    // Estrazione basata su estensione
    try {
      if (ext === "docx") {
        if (!mammoth) {
          return res.status(500).json({ 
            message: "mammoth non installato - installa con: npm install mammoth" 
          });
        }
        console.log("📝 Estrazione DOCX con mammoth...");
        const result = await mammoth.extractRawText({ buffer: buf });
        text = result.value || "";
        console.log("✅ DOCX estratto, lunghezza:", text.length);
        
      } else if (ext === "pdf") {
        if (!pdfParse) {
          return res.status(500).json({ 
            message: "pdf-parse non installato - installa con: npm install pdf-parse" 
          });
        }
        console.log("📄 Estrazione PDF con pdf-parse...");
        const result = await pdfParse(buf);
        text = result.text || "";
        console.log("✅ PDF estratto, lunghezza:", text.length);
        
        // Controllo PDF vuoto
        if (!text || text.trim().length < 50) {
          return res.status(415).json({
            message: "PDF non contiene testo estraibile. Potrebbe essere una scansione."
          });
        }
        
      } else if (ext === "txt" || ext === "md") {
        console.log("📝 Lettura file di testo...");
        text = buf.toString("utf-8");
        console.log("✅ File testo letto, lunghezza:", text.length);
        
      } else {
        console.error("❌ Estensione non supportata:", ext);
        return res.status(400).json({ 
          message: `Estensione .${ext} non supportata`,
          supportedExtensions: ["pdf", "docx", "txt", "md"]
        });
      }
      
    } catch (extractionError) {
      console.error("❌ Errore durante estrazione:", {
        ext,
        error: extractionError.message,
        stack: extractionError.stack
      });
      
      return res.status(500).json({ 
        message: `Errore estrazione ${ext.toUpperCase()}`,
        debug: { 
          error: extractionError.message,
          type: extractionError.constructor.name
        }
      });
    }

    // Normalizza il testo
    text = normalizeText(text);
    console.log("✅ Testo normalizzato, lunghezza finale:", text.length);

    // Controlla che ci sia effettivamente del testo
    if (!text || text.trim().length === 0) {
      console.warn("⚠️  Testo estratto vuoto");
      return res.status(422).json({
        message: "File non contiene testo estraibile",
        debug: { 
          originalLength: buf.length,
          extractedLength: text.length 
        }
      });
    }

    console.log("🎉 Estrazione completata con successo!");

    return res.status(200).json({ 
      ok: true, 
      text,
      debug: {
        fileId,
        extension: ext,
        filePath: fullPath,
        originalSize: buf.length,
        extractedLength: text.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (e) {
    console.error("💥 ERRORE GENERALE:", {
      message: e.message,
      stack: e.stack,
      fileId: req.body?.fileId
    });
    
    return res.status(500).json({ 
      message: "Errore generale estrazione",
      debug: {
        error: e.message,
        type: e.constructor.name,
        stack: process.env.NODE_ENV === "development" ? e.stack : undefined
      }
    });
  }
}
