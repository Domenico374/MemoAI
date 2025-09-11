// api/ping.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    envKey: process.env.OPENAI_API_KEY ? "present" : "missing",
    now: new Date().toISOString(),
    method: req.method,
  });
}
