// Restituisce l'endpoint interno che accetta l'upload reale
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const filename = (body.filename || `upload-${Date.now()}.mp4`).replace(/\s+/g, "_");

  // Daremo al client un endpoint POST della tua app
  return res.status(200).json({
    ok: true,
    uploadUrl: `/api/blob-upload?filename=${encodeURIComponent(filename)}`,
    now: Date.now(),
  });
}
