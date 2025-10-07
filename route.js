// app/api/upload/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // evita Edge

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/upload", hint: "POST form-data con 'file'" });
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok:false, error:"Campo 'file' mancante" }, { status:400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const filename = file.name || "upload.bin";

    // Se vuoi usare Vercel Blob, scommenta il blocco sotto e imposta il token
    /*
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buf, {
        access: "public",
        contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return NextResponse.json({ ok:true, url: blob.url, size: buf.length, contentType, storage:"vercel-blob" });
    }
    */

    // Fallback sicuro: data URL (limite 5MB)
    if (buf.length > 5 * 1024 * 1024) {
      return NextResponse.json({ ok:false, error:"File >5MB: configura Vercel Blob per file grandi." }, { status:413 });
    }
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
    return NextResponse.json({ ok:true, url: dataUrl, size: buf.length, contentType, storage:"data-url" });
  } catch (e) {
    return NextResponse.json({ ok:false, error: e.message || "Errore upload" }, { status:500 });
  }
}
