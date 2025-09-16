// api/upload.js — UNICO ENDPOINT DI UPLOAD (multipart -> Blob)
export const runtime = 'nodejs';

import { put } from '@vercel/blob';
import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false }, // NON bufferizzare: usiamo lo stream
};

function safeName(name) {
  return String(name || `upload-${Date.now()}`).replace(/[^\w.\-]/g, '_');
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const blob = await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: req.headers });
      let settled = false;

      bb.on('file', async (fieldname, fileStream, info) => {
        const original = req.query.filename || info?.filename || `upload-${Date.now()}`;
        const filename = safeName(original);
        const mime = info?.mimeType || 'application/octet-stream';

        try {
          const result = await put(`uploads/${filename}`, fileStream, {
            access: 'public',
            contentType: mime,
            addRandomSuffix: true,
            // Se necessario: token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          if (!settled) { settled = true; resolve(result); }
        } catch (err) {
          if (!settled) { settled = true; reject(err); }
        }
      });

      bb.on('error', (err) => { if (!settled) { settled = true; reject(err); } });

      // Se chiude senza aver ricevuto file -> errore
      bb.on('finish', () => {
        if (!settled) reject(new Error('Nessun file trovato nel form-data (campo file)'));
      });

      req.pipe(bb);
    });

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: blob.url,              // URL pubblico
        pathname: blob.pathname,    // percorso nello store
        size: blob.size,            // bytes
        uploadedAt: blob.uploadedAt,
        contentType: blob.contentType,
      },
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
