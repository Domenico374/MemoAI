// /pages/api/cleanup.js
import OpenAI from "openai";

export const config = { api: { bodyParser: true } };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// fallback di pulizia locale (se l'API non risponde)
function localClean(s = "") {
  return String(s)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export default async function handler(req, res) {
  // CORS base
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/cleanup" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    const { notes = "", mode = "default" } = req.body || {};
    if (!notes.trim()) return res.status(400).json({ message: "notes mancanti" });

    const system =
      "Sei un editor professionale: ripulisci trascrizioni mantenendo il contenuto, rimuovi intercalari, correggi refusi, normalizza punteggiatura. Mantieni eventuali timestamp tra [].";
    const user =
      (mode === "transcript"
        ? "Modalità TRASCRIZIONE: elimina bullet e marker rumorosi, sistemando caporiga."
        : "Modalità PULIZIA: rendi il testo scorrevole e formale senza cambiare il senso.") +
      `\n\nTesto:\n<<<${notes}>>>`;

    let text = "";
    try {
      const r = await openai.responses.create({
        model: "gpt-5.1-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
      });
      text = r.output_text || "";
    } catch {
      // fallback locale
      text = localClean(notes);
    }

    return res.status(200).json({ ok: true, text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Errore cleanup" });
  }
}
