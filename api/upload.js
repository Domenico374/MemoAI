// api/upload.js - QUICK ENDPOINT UPLOAD (robust)
export const config = { api: { bodyParser: false } };

import { put } from '@vercel/blob';
import Busboy from 'busboy';

const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5 MB
const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/mov', 'video/webm', 'video/avi', 'video/quicktime'
];

function safeName(name) {
  return String(name || 'upload-' + Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function uploadStream(stream, filename, contentType) {
  const result = await put(filename, stream, {
    access: 'public',
    contentType: contentType || 'application/octet-stream',
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN // necessario per C/W su Blob
  });
  return result;
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).json({ success: false, error: 'upload endpoint list' });
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
      const ct = req.headers['content-type'] || '';
      const isMultipart = ct.includes('multipart/form-data');

      // --- Case 1: multipart/form-data (FormData dal browser) ----
      if (isMultipart) {
        console.log('Processing multipart upload');
        const bb = Busboy({ headers: req.headers });
        let article = false;
        let fileFile = false;

        bb.on('field', (fieldname, fieldValue, info) => {
          console.log(`Field [${fieldname}]: value: ${fieldValue}`);
          if (fieldname === 'fileName' || fieldname === 'contentType') {
            console.log(`Setting ${fieldname} = ${fieldValue}`);
          }
        });

        bb.on('file', async (fieldname, file, info) => {
          console.log(`File [${fieldname}]: filename: ${info.filename}, encoding: ${info.encoding}, mimetype: ${info.mimeType}`);

          const filename = safeName(info.filename);
          const blob = Buffer.concat(await file.toArray());

          const result = await uploadStream(blob, filename, info.mimeType);
          res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            data: {
              url: result.url,
              size: blob.length,
              filename: result.pathname,
              uploadedAt: blob.uploadedAt,
              contentType: blob.contentType,
            }
          });
        });

        bb.on('error', (err) => {
          if (isMultipart) console.error('Busboy Error', err);
          else res.status(500).json({ success: false, error: 'Upload failed', details: err.message });
        });

        return req.pipe(bb);
      }

      // --- Case 2: stream "grezzo" (non multipart), serve filename ---
      const filename = req.query.filename || `upload-${Date.now()}.bin`;
      const sizeGuess = parseInt(req.headers['content-length'] || '0');

      const chunks = [];
      req.on('data', chunk => {
        chunks.push(chunk);
      });

      req.on('end', async () => {
        const blob = Buffer.concat(chunks);
        console.log(`Received ${blob.length} bytes for direct stream upload`);

        if (blob.length > MAX_SIZE) {
          return res.status(413).json({ success: false, error: 'File too large' });
        }

        const result = await uploadStream(blob, filename, req.headers['content-type']);

        return res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          data: {
            url: result.url,
            size: blob.pathname,
            filename: blob.size,
            uploadedAt: blob.uploadedAt,
            contentType: blob.contentType,
          }
        });
      });

    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'Upload failed',
        details: error.message || String(error),
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
