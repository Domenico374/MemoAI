// api/whisper.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB


function parseDataURL(dataURL) {
  // data:<mime>;base64,<payload>
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataURL || "");
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

// Costruisce in modo robusto un File con nome e mime (Node 20/22 ha File globale)
function makeFile(buffer, fileName = "audio.mp3", mime = "audio/mpeg") {
  try {
    return new File([buffer], fileName, { type: mime });
  } catch {
    // fallback estremo: prova Blob (alcune versioni potrebbero funzionare ugualmente)
    return new Blob([buffer], { type: mime });
  }
}

async function transcribeWith(model, file) {
  // NB: alcune versioni ignorano "language", ma non fa male provarlo
  return openai.audio.transcriptions.create({
    file,
    model,
    // language: "it",
    // prompt: "Registrazione in italiano di una riunione.",
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/whisper" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: "OPENAI_API_KEY mancante" });
    }

    const { dataURL, fileName } = req.body || {};
    if (!dataURL) {
      return res.status(400).json({
        message: "dataURL mancante",
        detail: "Invia l'audio come data:<mime>;base64,<payload>"
      });
    }

    const parsed = parseDataURL(dataURL);
    if (!parsed) {
      return res.status(400).json({
        message: "dataURL non valido",
        detail: "Formato atteso: data:<mime>;base64,<payload>"
      });
    }

    const { mime, buffer } = parsed;

    if (!buffer.length) {
      return res.status(400).json({ message: "Buffer vuoto", detail: "Payload Base64 decodificato vuoto." });
    }
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({
        message: "Audio troppo grande",
        detail: `Limite: ${MAX_BYTES / (1024 * 1024)} MB`
      });
    }

    // verifica MIME audio
    const isAudioMime = /^audio\//i.test(mime) || /(mpeg|mp3|wav|ogg|webm|m4a)/i.test(mime);
    if (!isAudioMime) {
      return res.status(400).json({
        message: "Formato non riconosciuto come audio",
        detail: `MIME ricevuto: ${mime}`
      });
    }

    // crea un File "vero" con nome e mime
    const safeName = (fileName && String(fileName)) || `audio.${(mime.split("/")[1] || "mp3")}`;
    const file = makeFile(buffer, safeName, mime);

    // primo tentativo: modello nuovo
    const preferredModel = "gpt-4o-mini-transcribe";
    const fallbackModel = "whisper-1";

    let response, usedModel = preferredModel;
    try {
      response = await transcribeWith(preferredModel, file);
    } catch (e) {
      const msg = e?.message || "";
      // Se il modello non è disponibile/permitted, prova whisper-1
      if (/not found|unknown model|unsupported model|does not exist|404/i.test(msg)) {
        try {
          usedModel = fallbackModel;
          response = await transcribeWith(fallbackModel, file);
        } catch (e2) {
          const m2 = e2?.message || "Errore trascrizione (fallback whisper-1)";
          return res.status(500).json({ message: "Errore trascrizione", detail: m2 });
        }
      } else {
        return res.status(500).json({ message: "Errore trascrizione", detail: msg });
      }
    }

    const text = (response?.text || "").trim();
    if (!text) {
      return res.status(422).json({
        message: "Trascrizione vuota",
        detail: "Il modello non ha restituito testo. Verifica qualità/durata dell'audio."
      });
    }

    return res.status(200).json({
      ok: true,
      text,
      meta: {
        model: usedModel,
        mime,
        size: buffer.length,
        fileName: safeName
      }
    });

  } catch (e) {
    console.error("whisper error:", e);
    const msg = e?.message || "Errore trascrizione";
    if (/insufficient_quota/i.test(msg)) {
      return res.status(402).json({ message: "Quota OpenAI esaurita" });
    }
    if (/invalid_api_key|authentication/i.test(msg)) {
      return res.status(401).json({ message: "Chiave API non valida" });
    }
    if (/rate.?limit|too many requests/i.test(msg)) {
      return res.status(429).json({ message: "Rate limit superato. Riprova tra poco." });
    }
    return res.status(500).json({ message: "Errore trascrizione", detail: msg });
  }
}
