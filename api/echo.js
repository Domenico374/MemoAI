// api/echo.js
export default async function handler(req, res) {
  try {
    // Leggi sempre il body in modo robusto
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");

    let json = {};
    try { json = raw ? JSON.parse(raw) : {}; } catch { /* noop */ }

    return res.status(200).json({
      ok: true,
      headers: req.headers,
      raw,
      parsed: json,
      tip: "Se 'parsed.notes' è valorizzato, il body arriva bene a Vercel."
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
