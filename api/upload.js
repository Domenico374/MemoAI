// api/upload.js — UNICO ENDPOINT UPLOAD (robusto)
export const runtime = 'nodejs';

import { put } from '@vercel/blob';
import Busboy from 'busboy';

export const config = {
  api: { bodyParser: false }, // NON bufferizzare: usiamo lo stream
};

function safeName(name) {
  return String(name || `upload-${Date.now()}`).replace(/[^\w.\-]/g, '_');
}

async function uploadStreamToBlob({ stream, filename, contentType }) {
  const result = await put(`uploads/${filename}`, stream, {
    access: 'public',
    contentType: contentType || 'application/octet-stream',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN || undefined, // opzionale: se c’è lo usa
  });
  return result;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, message: 'upload endpoint live' });
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const ct = req.headers['content-type'] || '';
    const isMultipart = ct.includes('multipart/form-data');

    // ---- Caso 1: multipart/form-data (FormData dal browser) ----
    if (isMultipart) {
      const blob = await new Promise((resolve, reject) => {
        const bb = Busboy({ headers: req.headers });
        let settled = false;
        let foundFile = false;

        bb.on('file', async (fieldname, fileStream, info) => {
          foundFile = true;
          const original = req.query.filename || info?.filename || `upload-${Date.now()}`;
          const filename = safeName(original);
          const mime = info?.mimeType || 'application/octet-stream';
          try {
            const result = await uploadStreamToBlob({ stream: fileStream, filename, contentType: mime });
            if (!settled) { settled = true; resolve(result); }
          } catch (err) {
            if (!settled) { settled = true; reject(err); }
          }
        });

        bb.on('field', () => {}); // ignoriamo altri campi

        bb.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
        bb.on('finish', () => {
          if (!settled) {
            if (!foundFile) reject(new Error('Nessun file trovato nel form-data (campo "file")'));
            else reject(new Error('Upload non completato'));
          }
        });

        req.pipe(bb);
      });

      return res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          contentType: blob.contentType,
        },
      });
    }

    // ---- Caso 2: stream “grezzo” (non multipart), serve ?filename= ----
    const filenameRaw = req.query.filename || `upload-${Date.now()}`;
    const filename = safeName(filenameRaw);
    const mimeGuess =
      ct && !ct.includes('multipart') ? ct : 'application/octet-stream';

    const blob = await uploadStreamToBlob({
      stream: req, // attenzione: qui l’intera request È il file
      filename,
      contentType: mimeGuess,
    });

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        contentType: blob.contentType,
      },
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error?.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
