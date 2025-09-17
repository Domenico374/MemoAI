// api/format.js
import { withRateLimit, RATE_LIMITS } from '../middleware/rateLimit.js';
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// pulizia locale minimale
function cleanText(s = "") {
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// euristica: sembra già un verbale?
function looksLikeMinutes(s = "") {
  const t = s.toLowerCase();
  const keys = ["verbale", "ordine del giorno", "decisioni", "prossimi passi"];
  return keys.some(k => t.includes(k));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, route: "/api/format" });
  if (req.method !== "POST") return res.status(405).json({ message: "POST only" });

  // Rate limiting
  const rateLimitResult = withRateLimit(RATE_LIMITS.generation)(req, res, () => {});
  if (rateLimitResult !== true) return;

  try {
    const { notes, metadati = {}, mode = "minutes" } = req.body || {};
    if (!notes || !notes.trim()) return res.status(400).json({ message: "notes mancante" });

    // Modalità senza GPT
    if (mode === "none") {
      return res.status(200).json({ ok: true, verbale: notes });
    }
    if (mode === "clean") {
      return res.status(200).json({ ok: true, verbale: cleanText(notes) });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: "OPENAI_API_KEY mancante" });
    }

    // minutes con salvagente: se già verbale, non riformattare pesante
    if (mode === "minutes" && looksLikeMinutes(notes)) {
      // Piccola revisione con istruzione "non cambiare struttura"
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system",
            content: "Se il testo è già un verbale strutturato, restituiscilo quasi invariato, correggendo solo refusi, spazi e punteggiatura. Non duplicare né rinominare le sezioni." },
          { role: "user", content: notes }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });
      const out = resp.choices?.[0]?.message?.content?.trim() || notes;
      return res.status(200).json({ ok: true, verbale: out });
    }

    // minutes "classico"
    if (mode === "minutes") {
      const system = `Sei un assistente che crea verbali chiari e professionali in italiano.
Segui questa struttura:
1. VERBALE DI RIUNIONE (Data/Ora, Luogo se presente, Partecipanti, Oggetto)
2. ORDINE DEL GIORNO
3. DISCUSSIONE (per punti, cronologico)
4. DECISIONI PRESE
5. AZIONI & RESPONSABILITÀ (owner, scadenze)
6. PROSSIMI PASSI (data prossimo incontro se presente)
Evita di duplicare sezioni. Se il testo è già un verbale, mantieni la struttura e migliora solo leggibilità.`;
      const user = `Appunti (italiano):
${notes}

Metadati facoltativi:
${JSON.stringify(metadati)}`;

      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.2,
        max_tokens: 2000
      });

      const verbale = resp.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ ok: true, verbale });
    }

    // summary
    if (mode === "summary") {
      const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system",
            content: "Riassumi in italiano in massimo 10 punti chiari e azionabili. Mantieni date, importi, responsabilità." },
          { role: "user", content: notes }
        ],
        temperature: 0.2,
        max_tokens: 800
      });
      const out = resp.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ ok: true, verbale: out });
    }

    // fallback
    return res.status(400).json({ message: `mode non supportato: ${mode}` });

  } catch (e) {
    console.error("format error:", e);
    return res.status(500).json({ message: "Errore formattazione", detail: e.message });
  }
}
