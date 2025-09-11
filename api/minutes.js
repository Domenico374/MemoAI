// api/minutes.js
export default async function handler(req, res) {
  try {
    // (Facoltativo) preflight CORS — utile se chiami l'API da origini diverse
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY non configurata" });
    }

    // ✅ LEGGI GLI APPUNTI DAL BODY
    const { notes } = req.body || {};
    if (typeof notes !== "string" || notes.trim().length < 10) {
      return res
        .status(400)
        .json({ ok: false, error: "Appunti mancanti o troppo brevi (min 10 caratteri)" });
    }

    const system =
      "Sei un assistente che redige verbali chiari, sintetici e formali partendo da appunti. " +
      "Restituisci SOLO il verbale in Markdown, con sezioni come Presenze, Ordine del Giorno, Discussione, Decisioni, Prossimi passi.";

    const user = `Appunti grezzi:\n${notes}\n\nTrasforma in un verbale formale e ben strutturato.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = data?.error?.message || `OpenAI error ${r.status}`;
      return res.status(500).json({ ok: false, error: msg });
    }

    const minutes =
      data?.choices?.[0]?.message?.content?.trim?.() || "Nessun testo generato.";
    return res.status(200).json({ ok: true, minutes });
  } catch (err) {
    console.error("MemoAI minutes error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Errore interno" });
  }
}
