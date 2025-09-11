// api/minutes.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    // Test: prendiamo degli appunti finti e chiediamo a OpenAI un mini verbale
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sei un assistente che trasforma appunti in verbali chiari." },
        { role: "user", content: "Appunti: Assemblea 12/09, discussione budget e spese varie. Decisione: approvato." }
      ],
      max_tokens: 100,
    });

    res.status(200).json({
      ok: true,
      result: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
