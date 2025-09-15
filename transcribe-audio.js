import { createReadStream } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';

// Assicurati che la tua API Key sia salvata come variabile d'ambiente su Vercel
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // L'endpoint accetta solo richieste POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Assicurati che la richiesta contenga un file audio
  // Questo esempio presuppone che il file sia inviato in un formato supportato (es. multipart/form-data)
  // Potrebbe essere necessario un parser come 'busboy' o 'formidable' se non usi fetch nel frontend
  if (!req.body || !req.body.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const audioFile = req.body.file; // Ottieni il file audio dalla richiesta

    // Invia il file all'API di OpenAI per la trascrizione
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    // Restituisci il testo trascritto al frontend
    res.status(200).json({
      success: true,
      text: transcription.text,
    });
  } catch (error) {
    console.error('Errore durante la trascrizione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante la trascrizione audio.',
    });
  }
}
