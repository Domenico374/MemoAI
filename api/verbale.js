// api/verbale.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 🔑 imposta su Vercel
});

export default async function handler(req, res) {
  // Gestione solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { notes, metadati } = req.body;

    if (!notes || notes.trim().length === 0) {
      return res.status(400).json({ message: "Appunti mancanti" });
    }

    // Chiamata a OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Sei un assistente che trasforma appunti in un verbale chiaro e ordinato."
        },
        {
          role: "user",
          content: `Appunti: ${notes}\n\nMetadati: ${JSON.stringify(metadati)}`
        }
      ],
    });

    const verbale = completion.choices[0].message.content;

    return res.status(200).json({ verbale });
  } catch (error) {
    console.error("Errore API:", error);
    return res.status(500).json({ message: "Errore interno", error: error.message });
  }
}
