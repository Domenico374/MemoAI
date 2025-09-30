import Busboy from "busboy";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB (alza/abbassa a piacere)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "POST only" });

  try {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES } });

    let filename = "file";
    let mimetype = "application/octet-stream";
    const chunks = [];
    let size = 0;

    bb.on("file", (name, file, info) => {
      filename = info?.filename || filename;
      mimetype = info?.mimeType || info?.mimetype || mimetype;

      file.on("data", (d) => {
        chunks.push(d);
        size += d.length;
      });
    });

    bb.on("error", (e) => {
      res.status(500).json({ ok: false, message: e.message });
    });

    bb.on("finish", () => {
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) {
        return res.status(400).json({ ok: false, message: "Nessun file ricevuto" });
      }
      const b64 = buffer.toString("base64");
      const url = `data:${mimetype};base64,${b64}`;
      res.status(200).json({ ok: true, url, name: filename, mime: mimetype, size });
    });

    req.pipe(bb);
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}
