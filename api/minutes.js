// api/minutes.js
import OpenAI from "openai";

// Middleware CORS
const withCors = (handler) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  return handler(req, res);
};

export default withCors(async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { notes } = req.body || {};
    if (!notes || notes.trim().length < 10) {
      return res.status(400).json({ error: "Appunti mancanti o troppo corti" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Prompt per generare un verbale chiaro e ben strutturato
    const sysPrompt = `
      Sei un assistente che trasforma appunti in un verbale di riunione.
      Il verbale deve essere ordinato nelle seguenti sezioni:
      - Partecipanti
      - Ordine del giorno
      - Decisioni prese
      - Azioni da svolgere
      Scrivi in stile formale e chiaro.
    `;

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: notes }
      ],
      temperature: 0.4,
    });

    const minutes = chat.choices?.[0]?.message?.content?.trim() || "Nessun verbale generato.";

    return res.status(200).json({ minutes });
  } catch (err) {
    console.error("MemoAI error:", err);
    return res.status(500).json({ error: "Errore interno del server" });
  }
});
