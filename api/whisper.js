import { Readable } from 'stream';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const config = {
  api: {
    bodyParser: false, // perché riceviamo file binari (multipart/form-data)
  },
};

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {}; // _read is required but you can noop it
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, only POST accepted' });
    return;
  }

  try {
    // Lettura del body come buffer (esempio minimal, per ambienti senza multipart parser)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Qui potrebbe servire parsing multipart per estrarre il file se inviato in multipart/form-data.
    // Qui assumiamo che il buffer sia il file audio completo.

    // Invia il file audio a OpenAI Whisper API per trascrizione
    const response = await openai.createTranscription(
      bufferToStream(buffer),
      "whisper-1",
      undefined,
      "json",
      0,
      "en"
    );

    res.status(200).json({ text: response.data.text });
  } catch (error) {
    console.error("Errore nel handler whisper:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
