import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName, totalChunks } = req.body;
    const chunkDir = '/tmp/chunks';
    const outputPath = path.join('/tmp', fileName);
    
    const writeStream = fs.createWriteStream(outputPath);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `${fileName}.part${i}`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      
      // Pulizia chunk
      fs.unlinkSync(chunkPath);
    }
    
    writeStream.end();
    
    // Ritorna il path del file completo
    res.status(200).json({
      success: true,
      filePath: outputPath,
      message: 'File assemblato con successo'
    });
    
  } catch (error) {
    console.error("💥 ERRORE MERGE:", error.message);
    res.status(500).json({ error: error.message });
  }
}
