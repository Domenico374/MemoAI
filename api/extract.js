// api/extract.js
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

// Funzione per normalizzare il testo estratto
function normalizeText(text = "") {
  return String(text)
    .replace(/\u0000/g, "")           // Rimuove caratteri null
    .replace(/\r\n/g, "\n")          // Normalizza line breaks Windows
    .replace(/\r/g, "\n")            // Normalizza line breaks Mac
    .replace(/\n{3,}/g, "\n\n")      // Riduce linee vuote multiple
    .replace(/\t/g, " ")             // Sostituisce tab con spazi
    .replace(/ {2,}/g, " ")          // Riduce spazi multipli
    .replace(/^\s+|\s+$/gm, "")      // Trim ogni riga
    .trim();
}

// Funzione per validare il contenuto estratto
function validateExtractedContent(text, fileType) {
  const cleanText = text.replace(/\s/g, "");
  
  // Controlla se il testo è troppo corto
  if (cleanText.length < 10) {
    return {
      valid: false,
      reason: `Contenuto troppo breve per un file ${fileType.toUpperCase()}`
    };
  }
  
  // Per PDF, controlla se contiene principalmente caratteri strani (possibile OCR necessario)
  if (fileType === "pdf") {
    const strangeChars = (text.match(/[^\w\s\p{P}\p{S}]/gu) || []).length;
    const totalChars = text.length;
    
    if (strangeChars / totalChars > 0.3) {
      return {
        valid: false,
        reason: "PDF potrebbe essere una scansione o contenere caratteri non riconoscibili"
      };
    }
  }
  
  return { valid: true };
}

// Funzione per pulire il file temporaneo
async function cleanupTempFile(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    console.warn(`Impossibile eliminare file temporaneo: ${filePath}`, error.message);
  }
}

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Gestisci preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  // Health check per GET
  if (req.method === "GET") {
    return res.status(200).json({ 
      ok: true, 
      route: "/api/extract",
      supportedFormats: ["pdf", "docx", "txt", "md"],
      maxFileSize: "10MB",
      version: "1.1.0"
    });
  }
  
  // Solo POST è permesso per l'estrazione
  if (req.method !== "POST") {
    return res.status(405).json({ 
      error: "Metodo non consentito",
      message: "Utilizza il metodo POST per l'estrazione" 
    });
  }

  const startTime = Date.now();
  let tempFilePath = null;

  try {
    const { fileId, options = {} } = req.body || {};
    
    // Validazione input
    if (!fileId || typeof fileId !== "string") {
      return res.status(400).json({ 
        error: "Parametro mancante",
        message: "Il parametro 'fileId' è obbligatorio" 
      });
    }

    // Sicurezza: previeni path traversal
    const safeFileId = path.basename(fileId);
    tempFilePath = path.join("/tmp", safeFileId);
    
    // Estrai estensione file
    const ext = (safeFileId.split(".").pop() || "").toLowerCase();
    const supportedExtensions = ["pdf", "docx", "txt", "md"];
    
    if (!supportedExtensions.includes(ext)) {
      return res.status(415).json({
        error: "Formato non supportato",
        message: `Estensione .${ext} non supportata. Formati supportati: ${supportedExtensions.join(", ")}`,
        supportedFormats: supportedExtensions
      });
    }

    // Leggi il file
    let buffer;
    try {
      buffer = await readFile(tempFilePath);
    } catch (error) {
      return res.status(404).json({
        error: "File non trovato",
        message: `Impossibile trovare il file ${safeFileId}`,
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }

    // Verifica dimensione file (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      await cleanupTempFile(tempFilePath);
      return res.status(413).json({
        error: "File troppo grande",
        message: `Il file supera la dimensione massima di ${maxSize / (1024 * 1024)}MB`
      });
    }

    let extractedText = "";
    let extractionMetadata = {};

    // Estrazione basata sul tipo di file
    switch (ext) {
      case "docx":
        try {
          const result = await mammoth.extractRawText({ 
            buffer: buffer,
            options: {
              includeEmbeddedStyleMap: true
            }
          });
          extractedText = result.value || "";
          extractionMetadata = {
            warnings: result.messages?.filter(m => m.type === "warning").length || 0,
            errors: result.messages?.filter(m => m.type === "error").length || 0
          };
        } catch (error) {
          return res.status(422).json({
            error: "Errore estrazione DOCX",
            message: "Il file DOCX potrebbe essere corrotto o non valido",
            details: process.env.NODE_ENV === "development" ? error.message : undefined
          });
        }
        break;
        
      case "pdf":
        try {
          const result = await pdfParse(buffer, {
            max: 0, // Estrai tutte le pagine
            version: "v1.10.100"
          });
          extractedText = result.text || "";
          extractionMetadata = {
            pages: result.numpages || 0,
            info: result.info || {},
            version: result.version || "unknown"
          };
          
          // Controllo specifico per PDF vuoti o scannerizzati
          if (!extractedText || extractedText.trim().length < 50) {
            return res.status(422).json({
              error: "PDF senza testo",
              message: "Il PDF caricato non contiene testo estraibile. Potrebbe essere una scansione che richiede OCR.",
              suggestion: "Utilizza uno strumento OCR o carica un PDF con testo selezionabile",
              metadata: extractionMetadata
            });
          }
        } catch (error) {
          console.error("Errore PDF parse:", { fileId: safeFileId, error: error.message });
          return res.status(422).json({
            error: "Errore estrazione PDF",
            message: "Impossibile estrarre testo dal PDF. Potrebbe essere protetto, corrotto o essere una scansione.",
            suggestion: "Verifica che il PDF contenga testo selezionabile"
          });
        }
        break;
        
      case "txt":
      case "md":
        try {
          extractedText = buffer.toString("utf-8");
          extractionMetadata = {
            encoding: "UTF-8",
            originalSize: buffer.length
          };
        } catch (error) {
          return res.status(422).json({
            error: "Errore lettura file di testo",
            message: "Impossibile leggere il file come testo UTF-8",
            suggestion: "Verifica la codifica del file"
          });
        }
        break;
        
      default:
        return res.status(415).json({
          error: "Estensione non gestita",
          message: `Estensione .${ext} non implementata nel processo di estrazione`
        });
    }

    // Normalizza il testo estratto
    const normalizedText = normalizeText(extractedText);
    
    // Valida il contenuto estratto
    const validation = validateExtractedContent(normalizedText, ext);
    if (!validation.valid) {
      await cleanupTempFile(tempFilePath);
      return res.status(422).json({
        error: "Contenuto non valido",
        message: validation.reason,
        suggestion: "Verifica la qualità del file caricato"
      });
    }

    // Pulizia del file temporaneo
    await cleanupTempFile(tempFilePath);

    // Calcola statistiche
    const processingTime = Date.now() - startTime;
    const stats = {
      caractteri_totali: normalizedText.length,
      parole_stimate: normalizedText.split(/\s+/).filter(w => w.length > 0).length,
      righe: normalizedText.split('\n').length,
      tempo_elaborazione_ms: processingTime
    };

    // Risposta di successo
    return res.status(200).json({
      success: true,
      text: normalizedText,
      metadata: {
        fileId: safeFileId,
        fileType: ext.toUpperCase(),
        extractionMethod: ext === "pdf" ? "pdf-parse" : ext === "docx" ? "mammoth" : "utf-8",
        timestamp: new Date().toISOString(),
        ...extractionMetadata,
        statistics: stats
      }
    });

  } catch (error) {
    console.error("Errore generale estrazione:", { 
      fileId: req.body?.fileId, 
      error: error.message,
      stack: error.stack 
    });

    // Cleanup in caso di errore
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }

    return res.status(500).json({
      error: "Errore interno del server",
      message: "Si è verificato un errore durante l'estrazione del testo",
      details: process.env.NODE_ENV === "development" ? {
        message: error.message,
        type: error.constructor.name
      } : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
