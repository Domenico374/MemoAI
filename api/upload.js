// Aggiungi gli import necessari
import { put } from '@vercel/blob';
import Busboy from 'busboy';
import axios from 'axios';
import { transcribeAudio } from './transcribe-audio.js'; // Importa la funzione di trascrizione

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
  // Ho rimosso il token perché Vercel lo gestisce automaticamente.
  const result = await put(filename, stream, {
    access: 'public',
    contentType: contentType || 'application/octet-stream',
    addRandomSuffix: true,
  });
  return result;
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
    let fileInfo = {}; // Per salvare i metadati del file

    // Evento per la gestione dei campi (se presenti)
    bb.on('field', (fieldname, fieldValue, info) => {
      console.log(`Field [${fieldname}]: value: ${fieldValue}`);
      // Puoi gestire qui campi come 'userId', 'fileType' ecc.
    });

    // Evento per la gestione del file
    bb.on('file', async (fieldname, file, info) => {
      console.log(`File [${fieldname}]: filename: ${info.filename}, mimetype: ${info.mimeType}`);
      
      const filename = safeName(info.filename);
      const isMedia = info.mimeType.startsWith('audio/') || info.mimeType.startsWith('video/');

      // Carica il file su Vercel Blob
      try {
        const result = await uploadStream(file, filename, info.mimeType);
        fileInfo = {
          url: result.url,
          filename: result.pathname,
          contentType: info.mimeType
        };

        // Se il file è audio o video, avvia la trascrizione
        if (isMedia) {
          console.log(`File di tipo media (${info.mimeType}) caricato su Blob. Avvio la trascrizione...`);
          
          // Chiama la tua funzione di trascrizione
          // La trascrizione è un'operazione asincrona, quindi non aspettiamo il risultato qui.
          // Invece, restituiamo un ID al client per il polling.
          transcribeAudio(fileInfo.url)
            .then(transcribedText => {
              // Qui potresti salvare il testo in un database associandolo all'URL del blob.
              console.log("Trascrizione completata per URL:", fileInfo.url);
              // In un sistema reale, dovresti notificare il client (es. tramite WebSocket)
            })
            .catch(error => {
              console.error("Errore durante la trascrizione:", error);
            });
          
          // Restituisci una risposta "in attesa" al client
          res.status(202).json({
            success: true,
            message: 'File caricato con successo. Trascrizione in corso...',
            data: fileInfo
          });
          
        } else {
          // Per file di testo (docx, pdf, ecc.)
          console.log("File di tipo documento caricato su Blob. Avvio l'estrazione...");
          // Qui puoi chiamare la tua logica di estrazione per i documenti
          // esempio: const text = await extractTextFromDocument(fileInfo.url);
          
          res.status(200).json({
            success: true,
            message: 'File caricato e processato con successo.',
            data: fileInfo
          });
        }

      } catch (uploadError) {
        console.error('Errore durante l\'upload o il processing:', uploadError);
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
