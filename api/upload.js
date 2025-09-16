// api/upload.js - UNICO ENDPOINT PER TUTTO
import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false, // Importante per gestire file upload
  },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      error: "Method not allowed" 
    });
  }

  try {
    // Estrai filename dalla query o crea uno di default
    const originalFilename = req.query.filename || `upload-${Date.now()}`;
    const cleanFilename = originalFilename.toString().replace(/[^a-zA-Z0-9.-]/g, "_");
    
    // Determina content type
    const contentType = req.headers["content-type"] || "application/octet-stream";
    
    // Log per debug
    console.log("📁 Upload started:", {
      filename: cleanFilename,
      contentType,
      headers: Object.keys(req.headers)
    });

    // Upload diretto a Vercel Blob usando lo stream della request
    const blob = await put(`uploads/${cleanFilename}`, req, {
      access: "public",
      contentType: contentType,
      addRandomSuffix: true, // Evita conflitti di nome
    });

    console.log("✅ Upload successful:", blob);

    // Risposta di successo
    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        url: blob.url,           // URL pubblico per accesso
        pathname: blob.pathname, // Path interno
        size: blob.size,         // Dimensione in bytes
        uploadedAt: blob.uploadedAt,
        filename: cleanFilename,
        contentType: contentType
      }
    });

  } catch (error) {
    console.error("❌ Upload error:", error);
    
    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
