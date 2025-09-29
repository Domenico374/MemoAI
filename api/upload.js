// api/upload.js
import { put } from "@vercel/blob";
import Busboy from "busboy";
import transcribeAudio from "./-transcribe-audio.js"; // lascialo come ce l'hai

const MAX_BYTES = 45 * 1024 * 1024; // 45 MB
const ALLOWED_TYPES = new Set([
  "text/plain", "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm",
  "video/mp4", "video/quicktime", "video/webm", "video/avi"
]);

function safeFilename(name = "upload") {
  return String(name)
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "POST only" });

  try {
    const bb = Busboy({ headers: req.headers });
    let responded = false;

    bb.on("file", async (fieldname, stream, info) => {
      try {
        const mime = info.mimeType || info.mime || "application/octet-stream";
        const filename = safeFilename(info.filename || "file");

        if (!ALLOWED_TYPES.has(mime)) {
          responded = true;
          stream.resume();
          return res.status(415).json({ ok: false, message: "Tipo non supportato", mime });
        }

        // Limite dimensione
        let size = 0;
        stream.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            stream.destroy(new Error("File troppo grande"));
          }
        });

        // Upload su Vercel Blob (serve BLOB_READ_WRITE_TOKEN sulle env di Vercel)
        const result = await put(filename, stream, {
          access: "public",
          contentType: mime,
          addRandomSuffix: true,
        });

        const fileInfo = {
          ok: true,
          name: filename,
          mime,
          size,
          url: result.url,
          path: result.pathname,
        };

        // Se audio/video → prova la trascrizione
        if (mime.startsWith("audio") || mime.startsWith("video")) {
          try {
            const { text } = await transcribeAudio(fileInfo.url);
            responded = true;
            return res.status(200).json({ ...fileInfo, transcribed: true, text });
          } catch (err) {
            // Se la trascrizione fallisce, consegna comunque l'URL con 202
            responded = true;
            return res.status(202).json({
              ...fileInfo,
              transcribed: false,
              message: "Trascrizione in coda/non disponibile al momento",
            });
          }
        }

        // Documento / testo: ritorna solo i dettagli del file
        responded = true;
        return res.status(200).json(fileInfo);
      } catch (e) {
        if (!responded) {
          responded = true;
          return res.status(500).json({ ok: false, message: "Errore upload", detail: e.message });
        }
      }
    });

    bb.on("error", (err) => {
      if (!responded) {
        responded = true;
        res.status(500).json({ ok: false, message: "Busboy error", detail: err.message });
      }
    });

    req.pipe(bb);
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Internal server error", detail: err.message });
  }
}
