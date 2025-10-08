export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if(req.method === 'OPTIONS'){
    return res.status(200).end();
  }
  
  if(req.method !== 'POST'){
    return res.status(405).json({error: 'Method not allowed'});
  }
  
  const { url } = req.body;
  
  if(!url){
    return res.status(400).json({error: 'URL mancante'});
  }
  
  try {
    console.log('Scaricamento file da:', url);
    
    // Scarica file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MemoAI/1.0'
      }
    });
    
    if(!response.ok) {
      return res.status(400).json({ 
        error: `File non accessibile (${response.status}). Assicurati che il link sia pubblico.` 
      });
    }
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    
    console.log('File scaricato - Tipo:', contentType, 'Dimensione:', contentLength);
    
    // Verifica dimensione (limite Vercel 4.5 MB)
    if(contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024){
      return res.status(413).json({
        error: `File troppo grande (${(contentLength / 1024 / 1024).toFixed(1)} MB). Limite: 4.5 MB`
      });
    }
    
    const buffer = await response.arrayBuffer();
    const sizeInMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
    
    console.log('Buffer ricevuto:', sizeInMB, 'MB');
    
    // Converti in base64 per passarlo al frontend
    const base64 = Buffer.from(buffer).toString('base64');
    
    res.json({ 
      success: true,
      size: buffer.byteLength,
      sizeInMB: sizeInMB,
      type: contentType,
      data: base64,
      message: 'File scaricato con successo'
    });
    
  } catch(error) {
    console.error('Errore:', error);
    res.status(500).json({ 
      error: error.message || 'Errore durante il download del file'
    });
  }
}
