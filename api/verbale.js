// /api/verbale.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Assicurati che sia configurata su Vercel
});

export default async function handler(req, res) {
  // Consenti solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { notes, metadati } = req.body || {};

    if (!notes || typeof notes !== "string" || notes.trim().length === 0) {
      return res.status(400).json({ message: "Appunti mancanti o non validi" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      // max_tokens opzionale; lascio libero così si adatta alla lunghezza degli appunti
      messages: [
        {
          role: "system",
          content: `Sei un assistente che trasforma appunti disordinati in un VERBALE PROFESSIONALE.

Regole:
- Elimina emoji, simboli decorativi e qualunque carattere non testuale (es. ⭐️, ✅, ✨, 🚀, ecc.).
- Correggi refusi evidenti e uniforma il tono a un linguaggio chiaro, formale e sintetico.
- Non inventare dati. Se una sezione non è presente, lasciala vuota con un trattino.
- Restituisci il risultato in Markdown con la seguente struttura, senza testo extra:

# Verbale della Riunione
**Data:** [inserisci se disponibile]
**Partecipanti:** [lista se presente]
**Oggetto:** [da metadati o desumibile dagli appunti]

## Sintesi
[Testo di 3–5 frasi che riassuma scopo e risultati principali]

## Punti Principali
- [punto 1]
- [punto 2]
- [punto 3]

## Decisioni Prese
- [decisione 1]
- [decisione 2]

## Azioni da Intraprendere
- [azione 1 — responsabile — scadenza]
- [azione 2 — responsabile — scadenza]

## Rischi/Blocchi
- [rischio o impedimento, se presente]

## Prossimi Passi
- [passo successivo 1]
- [passo successivo 2]

## Conclusioni
[Testo conclusivo breve]

Formato: **solo** Markdown valido, senza emoji e senza markup non standard.`,
        },
        {
          role: "user",
          content: `Appunti (testo grezzo):
${notes}

Metadati:
${JSON.stringify(metadati || {}, null, 2)}`,
        },
      ],
    });

    const verbale =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "Errore: nessun contenuto generato";

    return res.status(200).json({ verbale });
  } catch (error) {
    console.error("Errore API /api/verbale:", error);
    return res
      .status(error?.status || 500)
      .json({ message: "Errore interno", error: error?.message || "Unknown" });
  }
}
