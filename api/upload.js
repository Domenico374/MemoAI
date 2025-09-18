import { put } from '@vercel/blob';
import Busboy from 'busboy';
import axios from 'axios';
import { transcribeAudio } from './transcribe-audio.js';

export const config = { api: { bodyParser: false } };

const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5 MB
const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/avi'
];

function safeName(name) {
  return String(name || 'upload-' + Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function uploadStream(stream, filename, contentType) {
  try {
    console.log(`Uploading stream for file: ${filename} with contentType: ${contentType}`);
    const result = await put(filename, stream, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
      addRandomSuffix: true,
    });
    console.log('Upload su blob avvenuto:', result);
    return result;
  } catch (e) {
    console.error('Errore durante uploadStream:', e);
    throw e;
  }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const bb = Busboy({ headers: req.headers });
    let fileInfo = {};

    bb.on('field', (fieldname, fieldValue, info) => {
      console.log(`Field [${fieldname}]: value: ${fieldValue}`);
    });

    bb.on('file', async (fieldname, file, info) => {
      console.log(`File received: filename=${info.filename}, mimetype=${info.mimeType}`);

      const filename = safeName(info.filename);
      const isMedia = info.mimeType.startsWith('audio/') || info.mimeType.startsWith('video/');

      try {
        const result = await uploadStream(file, filename, info.mimeType);
        fileInfo = {
          url: result.url,
          filename: result.pathname,
          contentType: info.mimeType
        };

        if (isMedia) {
          console.log(`Inizio trascrizione per file media (${info.mimeType}) su URL: ${fileInfo.url}`);

          transcribeAudio(fileInfo.url)
            .then(transcribedText => {
              console.log("Trascrizione completata per URL:", fileInfo.url);
              console.log("Testo trascritto:", transcribedText);
            })
            .catch(error => {
              console.error("Errore durante la trascrizione:", error);
            });

          res.status(202).json({
            success: true,
            message: 'File caricato con successo. Trascrizione in corso...',
            data: fileInfo
          });

        } else {
          console.log("File di tipo documento caricato su Blob. Elaborazione documenti...");

          res.status(200).json({
            success: true,
            message: 'File caricato e processato con successo.',
            data: fileInfo
          });
        }

      } catch (uploadError) {
        console.error('Errore durante upload o processing:', uploadError);
        res.status(500).json({ success: false, error: 'Upload failed', details: uploadError.message });
      }
    });

    bb.on('error', (err) => {
      console.error('Busboy Error:', err);
      res.status(500).json({ success: false, error: 'Upload failed', details: err.message });
    });

    req.pipe(bb);

  } catch (error) {
    console.error('Internal server error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
}
