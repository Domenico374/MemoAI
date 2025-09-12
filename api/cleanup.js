// api/cleanup.js
import { unlink } from "node:fs/promises";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok:true, route:"/api/cleanup" });
  if (req.method !== "POST") return res.status(405).json({ message:"POST only" });

  try {
    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).json({ message:"fileId mancante" });
    await unlink(`/tmp/${fileId}`).catch(()=>{});
    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error("cleanup error:", e);
    return res.status(500).json({ message:"Errore cleanup" });
  }
}
