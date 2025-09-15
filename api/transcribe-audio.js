import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import OpenAI from 'openai';
import axios from 'axios';

// Assicurati che le tue chiavi siano variabili d'ambiente
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const ASSEMBLYAI_TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const file = req.body.file; // Il file inviato dal frontend
    
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Step 1: Upload del file ad AssemblyAI
    const uploadRes = await axios.post(ASSEMBLYAI_UPLOAD_URL, file, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
    });

    const audioUrl = uploadRes.data.upload_url;

    // Step 2: Invia l'URL ad AssemblyAI per la trascrizione
    const transcriptRes = await axios.post(ASSEMBLYAI_TRANSCRIPT_URL, {
      audio_url: audioUrl,
    }, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const transcriptId = transcriptRes.data.id;

    // Restituisci l'ID della trascrizione al frontend
    res.status(200).json({
      success: true,
      transcriptId: transcriptId,
    });
  } catch (error) {
    console.error('Errore durante la trascrizione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la trascrizione audio.',
    });
  }
}
