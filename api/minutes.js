// api/minutes.js
export default async function handler(req, res) {
  // CORS per la tua pagina statica
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 1) Leggi e valida il body (Node runtime Vercel non fa auto-parsing)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");

    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return res.status(400).json({ ok: false, error: "Body non valido (JSON)" });
    }

    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    if (!notes || notes.length < 5) {
      return res.status(400).json({ ok: false, error: "Campo 'notes' mancante o troppo corto" });
    }

    // 2) Verifica API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY non configurata" });
    }

    // 3) Costruisci il prompt
    const system =
      "Sei un assistente che redige verbali chiari, sintetici e formali partendo da appunti.";
    const user =
      `Appunti:\n${notes}\n\n` +
      "Genera un verbale formale in italiano, con punti, decisioni e prossimi passi.";

    // 4) Chiamata OpenAI (chat completions v1)
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
        max_tokens: 900,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      // Ritorna errori leggibili dal frontend
      const msg = data?.error?.message || `OpenAI error ${r.status}`;
      return res.status(500).json({ ok: false, error: msg, openai_status: r.status });
    }

    const minutes = data?.choices?.[0]?.message?.content?.trim?.() || "";
    return res.status(200).json({ ok: true, minutes });
  } catch (err) {
    console.error("MemoAI minutes error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Errore interno" });
  }
}
