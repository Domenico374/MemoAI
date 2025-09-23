// /pages/api/format.js
import OpenAI from "openai";

export const config = { api: { bodyParser: true } };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `Sei un segretario d'aula. 
Genera un VERBALE PROFESSIONALE in Markdown chiaro e conciso.
Includi sempre:
- Titolo
- Data e Ora (se mancano: —)
- Partecipanti (Nome – Ruolo; se ignoti lascia —)
- Agenda (elenco)
- Riassunto (2–4 paragrafi brevi)
- Punti salienti (max 10 bullet)
- Decisioni (bullet)
- Azioni/To-Do (tabella: Attività | Responsabile | Scadenza | Stato)
- Tag (3–6)
- Allegati/Link
Non inventare dati mancanti; usa '—' o 'TBD'. Tono formale e leggibile.`;

export default async function handler(req, res) {
  // CORS base
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/format" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  try {
    const { notes = "" } = req.body || {};
    if (!notes.trim()) return res.status(400).json({ message: "notes mancanti" });

    const prompt = `Crea il verbale partendo da questi appunti/trascrizione:\n<<<${notes}>>>`;

    const r = await openai.responses.create({
      model: "gpt-5.1",
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    const verbale = r.output_text || "";
    return res.status(200).json({ ok: true, verbale });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Errore format" });
  }
}
