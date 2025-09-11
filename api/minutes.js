// api/minutes.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { notes } = req.body || {};
    if (!notes || typeof notes !== "string" || notes.trim().length < 10) {
      return res.status(400).json({ ok: false, error: "Notes mancanti o troppo corti" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY non configurata" });
    }

    const system = `Sei un assistente che redige verbali chiari, sintetici e formali partendo da appunti.`;
    const user = `Appunti:\n${notes}\n\nGenera un verbale formale, con punti, decisioni e prossimi passi.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.4,
        max_tokens: 600
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `OpenAI error ${r.status}`;
      return res.status(500).json({ ok: false, error: msg });
    }

    const minutes = data.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ ok: true, minutes });
  } catch (err) {
    console.error("MemoAI minutes error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Errore interno" });
  }
}
