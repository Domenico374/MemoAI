// api/minutes.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------------- CORS helper ----------------
function setCors(res) {
  // Per test va bene *, in produzione metti il tuo dominio (es. https://memo-ai.vercel.app)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Per vedere eventuali payload “grandi” nei log
function safeLog(label, value, max = 500) {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  console.log(label, (v || "").slice(0, max));
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito. Usa POST." });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY mancante o vuota");
      return res.status(500).json({
        ok: false,
        error: "Configurazione mancante: OPENAI_API_KEY non impostata su Vercel.",
      });
    }

    // ------- Body parsing robusto (stringa o oggetto) -------
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, error: "Body non è JSON valido." });
      }
    }
    const notes = (body?.notes || "").trim();

    if (!notes || notes.length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Appunti insufficienti. Inserisci almeno una decina di caratteri.",
      });
    }

    safeLog("📝 Appunti ricevuti:", notes);

    // ------- Chiamata a OpenAI -------
    // Se preferisci, puoi usare anche la Responses API.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente che trasforma appunti in un verbale chiaro, formale e ben strutturato. " +
            "Organizza in intestazione, presenze, ordine del giorno, discussione, decisioni, prossimi passi.",
        },
        {
          role: "user",
          content: `Trasforma i seguenti appunti in un verbale ufficiale:\n\n${notes}`,
        },
      ],
      max_tokens: 600,
      // response_format: { type: "text" } // opzionale
    });

    const minutes = completion?.choices?.[0]?.message?.content?.trim() || "";
    safeLog("✅ Verbale generato:", minutes);

    if (!minutes) {
      return res.status(502).json({
        ok: false,
        error: "Output vuoto dal modello.",
      });
    }

    return res.status(200).json({ ok: true, minutes });
  } catch (err) {
    // Log esteso per capire cosa succede
    const status = err?.status || err?.response?.status;
    const data = err?.response?.data || err?.error || err?.message;
    console.error("❌ Errore OpenAI:", { status, data });

    // restituisco al client un messaggio utile
    return res.status(500).json({
      ok: false,
      error:
        typeof data === "string"
          ? data
          : (data?.message || "Errore interno durante la generazione del verbale"),
      details: data,
    });
  }
}
