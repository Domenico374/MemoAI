// api/minutes.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo non consentito. Usa POST." });
  }

  try {
    const { notes } = req.body || {};

    if (!notes || notes.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "Appunti insufficienti per generare un verbale." });
    }

    console.log("📝 Input ricevuto:", notes);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Sei un assistente che trasforma appunti in un verbale chiaro, formale e ben strutturato.",
        },
        {
          role: "user",
          content: `Trasforma i seguenti appunti in un verbale ufficiale:\n\n${notes}`,
        },
      ],
      max_tokens: 300,
    });

    const minutes = completion.choices[0]?.message?.content?.trim() || "";

    console.log("✅ Verbale generato:", minutes);

    res.status(200).json({
      ok: true,
      minutes,
    });
  } catch (err) {
    console.error("❌ Errore OpenAI:", err);
    res.status(500).json({ ok: false, error: err.message || "Errore interno" });
  }
}
