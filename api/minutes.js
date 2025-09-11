// /api/minutes.js
import OpenAI from "openai";

export default async function handler(req, res) {
  // Permettiamo solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Log di debug (compariranno in Vercel → Runtime Logs)
    console.log("[minutes] Request received");

    // Controlla che la key ci sia
    if (!process.env.OPENAI_API_KEY) {
      console.error("[minutes] Missing OPENAI_API_KEY");
      return res.status(500).json({ ok: false, error: "Server not configured (missing OPENAI_API_KEY)" });
    }

    // Parsing body
    let notes = "";
    try {
      // Vercel normalmente popola req.body già parsato quando Content-Type = application/json
      if (req.body && typeof req.body === "object") {
        notes = (req.body.notes || "").trim();
      } else {
        // fallback se arrivasse come raw string
        const txt = req.body?.toString?.() || "";
        try {
          const parsed = JSON.parse(txt);
          notes = (parsed.notes || "").trim();
        } catch {
          notes = txt.trim();
        }
      }
    } catch (e) {
      console.error("[minutes] Body parse error:", e);
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }

    if (!notes || notes.length < 8) {
      return res.status(400).json({ ok: false, error: "notes mancanti o troppo corti" });
    }

    console.log("[minutes] Notes length:", notes.length);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente che trasforma appunti in un verbale chiaro, in italiano, breve e con punti elenco quando utile. Evita fronzoli, mantieni date, nomi e decisioni."
        },
        {
          role: "user",
          content:
            `Appunti:\n${notes}\n\nGenera un verbale conciso, con:\n- Data, presenti (se indicati)\n- Punti discussi\n- Decisioni\n- Prossimi passi (se indicati)`
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) {
      console.error("[minutes] Empty response from OpenAI");
      return res.status(502).json({ ok: false, error: "OpenAI response empty" });
    }

    return res.status(200).json({ ok: true, minutes: text });
  } catch (err) {
    console.error("[minutes] ERROR:", err?.message, err?.stack);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}
