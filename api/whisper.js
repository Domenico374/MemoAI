import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false, // Necessario per leggere raw stream file
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, only POST accepted' });
    return;
  }

  try {
    // Ricevi il file audio come buffer dal body della richiesta
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Invia il buffer alla API di trascrizione Whisper
    // La funzione .audio.transcriptions.create usa il buffer raw e il modello whisper-1
    const response = await openai.audio.transcriptions.create({
      file: buffer,
      model: "whisper-1",
      response_format: "json",
      language: "en"
    });

    res.status(200).json({ text: response.text });
  } catch (error) {
    console.error("Errore nel handler whisper:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
