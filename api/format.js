// api/format.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/format" });
  if (req.method !== "POST") return res.status(405).json({ message:"POST only" });

  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ message:"OPENAI_API_KEY mancante" });

    const { notes, metadati = {} } = req.body || {};
    if (!notes || !notes.trim()) return res.status(400).json({ message:"notes mancante" });

    const system = `Sei un assistente che crea verbali chiari e professionali in italiano.
Segui questa struttura:
1. VERBALE DI RIUNIONE (Data/Ora, Luogo se presente, Partecipanti, Oggetto)
2. ORDINE DEL GIORNO
3. DISCUSSIONE (per punti, cronologico)
4. DECISIONI PRESE
5. AZIONI & RESPONSABILITÀ (owner, scadenze)
6. PROSSIMI PASSI (data prossimo incontro se presente)
Formatta in Markdown ben pulito.`;

    const user = `Appunti (italiano):
${notes}

Metadati (facoltativi):
${JSON.stringify(metadati)}`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const verbale = resp.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ ok:true, verbale });
  } catch (e) {
    console.error("format error:", e);
    return res.status(500).json({ message:"Errore formattazione" });
  }
}
