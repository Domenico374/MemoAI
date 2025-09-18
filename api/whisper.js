import OpenAI from "openai";
import Busboy from "busboy";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: { bodyParser: false }, // Disabilita body parser di Next.js
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed, only POST accepted" });
  }

  try {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileMime = null;
    let fileName = null;

    busboy.on("file", (fieldname, file, info) => {
      const buffers = [];
      fileName = info.filename;
      fileMime = info.mimeType;

      file.on("data", (data) => buffers.push(data));
      file.on("end", () => {
        fileBuffer = Buffer.concat(buffers);
      });
    });

    busboy.on("finish", async () => {
      if (!fileBuffer) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      try {
        if (fileMime.startsWith("audio/")) {
          // Processa con Whisper API
          const response = await openai.audio.transcriptions.create({
            file: { buffer: fileBuffer, name: fileName, type: fileMime },
            model: "whisper-1",
          });
          return res.status(200).json({ text: response.text });
        } else if (fileMime === "application/pdf") {
          // Estrai testo da pdf con pdf-parse
          const pdfData = await pdfParse(fileBuffer);
          return res.status(200).json({ text: pdfData.text });
        } else if (fileMime === "text/plain" || fileName.endsWith(".txt")) {
          // Testo semplice
          return res.status(200).json({ text: fileBuffer.toString("utf-8") });
        } else if (
          fileName.endsWith(".docx") ||
          fileMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          // Scrivi mammoth per estrarre testo da docx
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          return res.status(200).json({ text: result.value });
        } else {
          return res.status(415).json({ error: "File type not supported" });
        }
      } catch (error) {
        console.error("Error processing file:", error);
        return res.status(500).json({ error: error.message });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message });
  }
};
