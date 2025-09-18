import OpenAI from "openai";
import Busboy from "busboy";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, only POST accepted' });
    return;
  }

  try {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileMime = null;
    let fileName = null;

    busboy.on('file', (fieldname, file, info) => {
      const buffers = [];
      fileName = info.filename;
      fileMime = info.mimeType;
      file.on('data', (data) => buffers.push(data));
      file.on('end', () => {
        fileBuffer = Buffer.concat(buffers);
      });
    });

    busboy.on('finish', async () => {
      if (!fileBuffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      try {
        const response = await openai.audio.transcriptions.create({
          file: { buffer: fileBuffer, name: fileName, type: fileMime },
          model: "whisper-1",
        });

        res.status(200).json({ text: response.text });
      } catch (error) {
        console.error('Errore nella trascrizione:', error);
        res.status(500).json({ error: 'Transcription error', details: error.message });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    console.error('Errore nel handler whisper:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
