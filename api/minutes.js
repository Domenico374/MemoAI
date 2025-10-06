// /api/minutes.js
import OpenAI from "openai";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } } // <— attiva/lascia attivo il parser JSON
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/minutes", hint:"POST notes to generate" });
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    // ✅ qui req.body è già valorizzato (il tuo test invia application/json)
    let { notes, meetingDate, participants, subject, formatoVerbale } = req.body || {};

    // Se per qualunque motivo è vuoto, prova a rileggere lo stream (fallback)
    if (!notes && (!req.body || Object.keys(req.body).length === 0)) {
      const raw = await new Promise((resolve) => {
        let data = ""; req.on("data", c => data += c); req.on("end", () => resolve(data));
      });
      try { ({ notes, meetingDate, participants, subject, formatoVerbale } = JSON.parse(raw)); } catch {}
    }

    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ ok:false, error:"Il campo notes è obbligatorio" });
    }

    // … (tua logica OpenAI o fallback locale) …
    return res.status(200).json({ ok:true, verbale: `# Verbale\n\n${notes}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message || "Errore interno" });
  }
}
