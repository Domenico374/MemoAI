// api/whisper.js
import { withRateLimit, RATE_LIMITS } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    logger.logRequest(req, "CORS preflight request");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    logger.logRequest(req, `Invalid method: ${req.method}`);
    return res.status(405).json({ 
      ok: false, 
      message: "Method not allowed. Use POST." 
    });
  }

  // Rate limiting
  const rateLimitResult = withRateLimit(RATE_LIMITS.transcription)(req, res, () => {});
  if (rateLimitResult !== true) return;

  try {
    const { url, file } = req.body || {};
    
    logger.logRequest(req, "Transcription request started", {
      hasUrl: !!url,
      hasFile: !!file
    });

    if (!url && !file) {
      logger.logRequest(req, "Request rejected: missing url or file");
      return res.status(400).json({ 
        ok: false, 
        message: "Missing 'url' or 'file' parameter" 
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      logger.error("OpenAI API key missing", null, { endpoint: req.url });
      return res.status(500).json({ 
        ok: false, 
        message: "OpenAI API key not configured" 
      });
    }

    // Usa l'URL se fornito, altrimenti fallback al file
    const audioSource = url || file;
    
    logger.logRequest(req, "Starting OpenAI Whisper transcription", {
      audioSource: audioSource.substring(0, 100) + '...' // Log solo i primi 100 caratteri per sicurezza
    });

    // Scarica il file dall'URL del blob
    logger.logRequest(req, "Downloading audio file from blob URL");
    const response = await fetch(audioSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: ${response.status}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

    logger.logRequest(req, "Downloaded audio file, starting transcription", {
      fileSize: audioBuffer.byteLength
    });

    // Chiamata a OpenAI Whisper
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "it", // Italiano
      response_format: "text"
    });

    const processingTime = Date.now() - startTime;

    logger.logAPIUsage(req, "OpenAI Whisper", null, processingTime);
    logger.logRequest(req, "Transcription completed successfully", {
      processingTime,
      transcriptionLength: transcription.length
    });

    return res.status(200).json({
      ok: true,
      text: transcription,
      processingTime,
      language: "it"
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log errore dettagliato
    logger.error("Whisper transcription failed", error, {
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      endpoint: req.url,
      processingTime,
      errorType: error.name,
      errorCode: error.code
    });

    // Errori specifici OpenAI
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({
        ok: false,
        message: "Invalid OpenAI API key"
      });
    }

    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        ok: false,
        message: "OpenAI quota exceeded"
      });
    }

    if (error.message && error.message.includes('file')) {
      return res.status(400).json({
        ok: false,
        message: "Invalid audio file or URL",
        details: error.message
      });
    }

    // Errore generico
    return res.status(500).json({
      ok: false,
      message: "Transcription failed",
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
