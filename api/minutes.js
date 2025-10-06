import OpenAI from "openai";

/* ---------- Local fallback generator (no AI) ---------- */
function generateLocalMinutes({ notes, meetingDate, participants, subject, format = "standard" }) {
  const lines = String(notes).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const bullets   = lines.filter(l => /^[-–•]/.test(l)).map(l => l.replace(/^[-–•]\s?/, ""));
  const decisions = lines.filter(l => /decision|delibera|approv|assegna/i.test(l));
  const kpi       = lines.filter(l => /\bKPI\b|obiettivo|target|metric/i.test(l));
  const next      = lines.find(l => /(prossim|riunion|scadenza|deadline|next)/i.test(l)) || "";

  const header = [
    subject ? `**Oggetto:** ${subject}` : null,
    meetingDate ? `**Data:** ${meetingDate}` : null,
    participants ? `**Partecipanti:** ${participants}` : null,
  ].filter(Boolean).join("\n");

  const body = [
    "### Sintesi",
    bullets.length ? bullets.map(b => `- ${b}`).join("\n") : "- (nessun punto elenco)",
    "",
    "### Decisioni",
    decisions.length ? decisions.map(d => `- ${d}`).join("\n") : "- (non specificate)",
    "",
    "### KPI / Azioni",
    kpi.length ? kpi.map(k => `- ${k}`).join("\n") : "- (non specificati)",
    "",
    "### Prossimi passi",
    next ? `- ${next}` : "- (non indicati)",
  ].join("\n");

  if (format === "markdown") {
    return ["# Verbale Riunione", header, "", body].filter(Boolean).join("\n");
  }
  return [
    "VERBALE RIUNIONE",
    header.replaceAll("**", ""),
    "",
    body.replace(/^### /gm, "").replaceAll("**", "")
  ].join("\n");
}

/* ---------- Parse JSON body manually ---------- */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/* ---------- Handler ---------- */
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET")   return res.status(200).json({ ok: true, route: "/api/minutes" });
  if (req.method !== "POST")  return res.status(405).json({ error: "Method not allowed", message: "Solo richieste POST sono permesse" });

  try {
    // Parse body manually
    const body = await parseBody(req);
    const { notes, meetingDate, participants, subject, formatoVerbale } = body || {};

    // Validazione
    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return res.status(400).json({ error: "Input non valido", message: "Il campo notes è obbligatorio e deve contenere del testo" });
    }
    if (notes.length > 8000) {
      return res.status(400).json({ error: "Input troppo lungo", message: "Gli appunti non possono superare i 8000 caratteri" });
    }

    const useOpenAI = !!process.env.OPENAI_API_KEY;
    let verbale = "";
    let source  = "local";
    let usage   = null;

    if (useOpenAI) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `Sei un assistente specializzato nella creazione di verbali professionali e meeting minutes.
Trasforma gli appunti forniti in un verbale formale e ben strutturato seguendo gli standard professionali italiani.

Struttura obbligatoria:
1. VERBALE DI RIUNIONE (Intestazione: data/ora, luogo se presente, partecipanti, oggetto)
2. ORDINE DEL GIORNO
3. DISCUSSIONE (per punti, chiaro e cronologico)
4. DECISIONI PRESE
5. AZIONI E RESPONSABILITÀ (owner, scadenze)
6. PROSSIMI PASSI (data prossimo incontro se presente)`;

        const info = [];
        if (meetingDate) info.push(`Data: ${meetingDate}`);
        if (participants) info.push(`Partecipanti: ${participants}`);
        if (subject) info.push(`Oggetto: ${subject}`);

        const contextInfo = info.length ? `\nInformazioni aggiuntive:\n${info.join("\n")}\n` : "";

        const userPrompt = `Trasforma questi appunti in un verbale professionale completo:${contextInfo}
APPUNTI:
${notes}

Formato desiderato: ${formatoVerbale || "standard"}.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.2,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        });

        verbale = completion.choices?.[0]?.message?.content?.trim();
        usage   = completion.usage || null;

        if (!verbale) throw new Error("Nessun contenuto ricevuto da OpenAI");
        source = "openai";
      } catch (aiErr) {
        // Fallback locale automatico
        verbale = generateLocalMinutes({
          notes,
          meetingDate,
          participants,
          subject,
          format: formatoVerbale
        });
        source = "local";
      }
    } else {
      // Nessuna chiave → direttamente fallback locale
      verbale = generateLocalMinutes({
        notes,
        meetingDate,
        participants,
        subject,
        format: formatoVerbale
      });
      source = "local";
    }

    return res.status(200).json({
      success: true,
      verbale,
      source,
      metadata: {
        timestamp: new Date().toISOString(),
        model_used: source === "openai" ? "gpt-4o-mini" : null,
        tokens_used: usage?.total_tokens ?? 0,
        characters_processed: notes.length
      }
    });
  } catch (error) {
    console.error("Errore in minutes.js:", error);
    return res.status(500).json({
      error: "Errore interno del server",
      message: error.message || "Si è verificato un errore imprevisto durante la generazione del verbale"
    });
  }
}
