export const runtime = 'nodejs';

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, hint: "POST something here" });
  }

  try {
    const ct = req.headers["content-type"] || "";
    let body = null;

    if (ct.includes("application/json")) {
      body = await new Response(req).json().catch(() => ({}));
    } else {
      const buf = await new Response(req).arrayBuffer();
      body = { rawBytes: buf ? buf.byteLength : 0, note: "non-json payload" };
    }

    res.status(200).json({ ok: true, contentType: ct, body });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
