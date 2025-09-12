// api/whisper.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function parseDataURL(dataURL) {
  // data:<mime>;base64,<payload>
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataURL || "");
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
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

    const { dataURL, fileName, language = "it" } = req.body || {};
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

    // Controllo di massima sul MIME
    const isAudioMime = /^audio\//i.test(mime) || /(mpeg|mp3|wav|ogg|webm|m4a)/i.test(mime);
    if (!isAudioMime) {
      return res.status(400).json({
        message: "Formato non riconosciuto come audio",
        detail: `MIME ricevuto: ${mime}`
      });
    }

    // Node 18+/20+ ha Blob nativo
    const blob = new Blob([buffer], { type: mime });

    // Puoi usare anche "whisper-1"
    const model = "gpt-4o-mini-transcribe";

    // Opzionale: hint lingua (non sempre rispettato ma aiuta)
    const response = await openai.audio.transcriptions.create({
      file: blob,
      model,
      // language: language, // alcune versioni ignorano il parametro, ma non fa male lasciarlo commentato
      // prompt: "Audio di una riunione in italiano sul progetto Memo AI.", // opzionale per aiutare il modello
    });

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
        model,
        mime,
        size: buffer.length,
        fileName: fileName || null
      }
    });
  } catch (e) {
    console.error("whisper error:", e);

    // Errori OpenAI comuni con messaggi chiari
    const msg = e?.message || "Errore trascrizione";
    if (/insufficient_quota/i.test(msg)) {
      return res.status(402).json({ message: "Quota OpenAI esaurita" });
    }
    if (/invalid_api_key|authentication/i.test(msg)) {
      return res.status(401).json({ message: "Chiave API non valida" });
    }
    if (/rate.limit|too.many.requests/i.test(msg)) {
      return res.status(429).json({ message: "Rate limit superato. Riprova tra poco." });
    }

    return res.status(500).json({ message: "Errore trascrizione", detail: msg });
  }
}
