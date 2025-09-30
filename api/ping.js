export const runtime = 'nodejs';

export default async function handler(req, res) {
  res.status(200).json({ ok: true, time: Date.now(), method: req.method });
}
