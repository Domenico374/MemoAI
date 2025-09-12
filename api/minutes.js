import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // Imposta headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestisci preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Accetta solo POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Solo richieste POST sono permesse' 
    });
  }

  try {
    const { notes } = req.body;

    // Validazione input
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Input non valido',
        message: 'Il campo notes è obbligatorio e deve contenere del testo' 
      });
    }

    // Verifica che la chiave API sia configurata
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY non configurata');
      return res.status(500).json({ 
        error: 'Configurazione mancante',
        message: 'Chiave API non configurata' 
      });
    }

    // Prompt per generare il verbale professionale
    const systemPrompt = `Sei un assistente specializzato nella creazione di verbali professionali.
Trasforma gli appunti forniti in un verbale formale e ben strutturato.

Struttura da seguire:
1. INTESTAZIONE (Data, Partecipanti, Oggetto)
2. DISCUSSIONE (Punti trattati in modo chiaro)
3. DECISIONI (Elenco delle decisioni prese)
4. AZIONI (Chi fa cosa e entro quando)
5. PROSSIMO INCONTRO (Se applicabile)

Usa un linguaggio professionale ma chiaro. Organizza le informazioni in modo logico e cronologico.`;

    const userPrompt = `Trasforma questi appunti in un verbale professionale:

${notes}

Genera un verbale completo, ben formattato e professionale.`;

    // Chiamata all'API OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Usa gpt-4 per risultati migliori, o "gpt-3.5-turbo" per risparmiare
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Bassa temperatura per output più consistente
    });

    const verbale = completion.choices[0]?.message?.content;

    if (!verbale) {
      throw new Error('Nessun contenuto ricevuto da OpenAI');
    }

    // Risposta di successo
    return res.status(200).json({
      success: true,
      verbale: verbale.trim(),
      timestamp: new Date().toISOString(),
      tokens_used: completion.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('Errore in minutes.js:', error);
    
    // Gestisci diversi tipi di errore
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({
        error: 'Quota OpenAI esaurita',
        message: 'Hai raggiunto il limite di utilizzo delle API OpenAI'
      });
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit superato',
        message: 'Troppe richieste. Riprova tra qualche minuto'
      });
    }

    if (error.code === 'invalid_api_key') {
      return res.status(401).json({
        error: 'Chiave API non valida',
        message: 'La chiave API OpenAI non è corretta'
      });
    }

    // Errore generico
    return res.status(500).json({
      error: 'Errore interno del server',
      message: error.message || 'Si è verificato un errore imprevisto',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
