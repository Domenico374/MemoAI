export default async function handler(req, res) {
  console.log("HEADERS:", req.headers);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed, only POST accepted" });
  }
  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let fileMime = null;
    let fileName = null;

    busboy.on("file", (fieldname, file, info) => {
      console.log("RICEVUTO FILE:", info);
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
          const response = await openai.audio.transcriptions.create({
            file: { buffer: fileBuffer, name: fileName, type: fileMime },
            model: "whisper-1",
          });
          return res.status(200).json({ text: response.text });
        } else if (fileMime === "application/pdf") {
          const pdfData = await pdfParse(fileBuffer);
          return res.status(200).json({ text: pdfData.text });
        } else if (fileMime === "text/plain" || fileName.endsWith(".txt")) {
          return res.status(200).json({ text: fileBuffer.toString("utf-8") });
        } else if (
          fileName.endsWith(".docx") ||
          fileMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
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
}
