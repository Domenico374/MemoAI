import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log("🚀 Chunk Upload Endpoint CHIAMATO!");
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST permesso" });

  try {
    const chunks = [];
    
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    
    const body = Buffer.concat(chunks);
    const { fileName, chunkIndex, totalChunks, fileData } = JSON.parse(body.toString());
    
    console.log(`📦 Ricevuto chunk ${chunkIndex + 1}/${totalChunks} per ${fileName}`);
    
    // Salva il chunk temporaneamente
    const chunkDir = '/tmp/chunks';
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    
    const chunkPath = path.join(chunkDir, `${fileName}.part${chunkIndex}`);
    fs.writeFileSync(chunkPath, Buffer.from(fileData, 'base64'));
    
    return res.status(200).json({
      success: true,
      chunk: chunkIndex,
      received: true
    });
    
  } catch (error) {
    console.error("💥 ERRORE CHUNK UPLOAD:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
