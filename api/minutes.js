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
    const { notes, meetingDate, participants, subject } = req.body;
    
    // Validazione input migliorata
    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Input non valido',
        message: 'Il campo notes è obbligatorio e deve contenere del testo' 
      });
    }

    // Verifica lunghezza massima per evitare costi eccessivi
    if (notes.length > 8000) {
      return res.status(400).json({
        error: 'Input troppo lungo',
        message: 'Gli appunti non possono superare i 8000 caratteri'
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
    
    // Costruisci informazioni aggiuntive se fornite
    const additionalInfo = [];
    if (meetingDate) additionalInfo.push(`Data: ${meetingDate}`);
    if (participants) additionalInfo.push(`Partecipanti: ${participants}`);
    if (subject) additionalInfo.push(`Oggetto: ${subject}`);
    
    const contextInfo = additionalInfo.length > 0 
      ? `\nInformazioni aggiuntive:\n${additionalInfo.join('\n')}\n` 
      : '';

    // Prompt migliorato per generare il verbale professionale
    const systemPrompt = `Sei un assistente specializzato nella creazione di verbali professionali e meeting minutes.
Trasforma gli appunti forniti in un verbale formale e ben strutturato seguendo gli standard professionali italiani.

Struttura obbligatoria da seguire:
1. **VERBALE DI RIUNIONE** (Intestazione)
   - Data e ora
   - Luogo (se specificato)
   - Partecipanti
   - Oggetto della riunione

2. **ORDINE DEL GIORNO**
   - Elenca i punti trattati

3. **DISCUSSIONE**
   - Riassumi ogni punto in modo chiaro e cronologico
   - Riporta le principali posizioni emerse

4. **DECISIONI PRESE**
   - Elenca chiaramente ogni decisione
   - Indica eventuali votazioni o consensus

5. **AZIONI E RESPONSABILITÀ**
   - Chi deve fare cosa
   - Scadenze specifiche
   - Responsabili indicati

6. **PROSSIMI PASSI**
   - Data prossimo incontro (se applicabile)
   - Preparazioni necessarie

Usa un linguaggio professionale, formale ma chiaro. Mantieni la struttura logica e cronologica degli eventi.`;

    const userPrompt = `Trasforma questi appunti in un verbale professionale completo:${contextInfo}
APPUNTI:
${notes}

Genera un verbale dettagliato, ben formattato e professionale seguendo la struttura indicata.`;

    // Chiamata all'API OpenAI con parametri ottimizzati
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Modello più efficiente e recente
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
      temperature: 0.2, // Molto bassa per consistenza
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1
    });

    const verbale = completion.choices[0]?.message?.content;
    
    if (!verbale) {
      throw new Error('Nessun contenuto ricevuto da OpenAI');
    }

    // Log per monitoraggio (solo in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Tokens utilizzati: ${completion.usage?.total_tokens || 0}`);
    }

    // Risposta di successo con metadati utili
    return res.status(200).json({
      success: true,
      verbale: verbale.trim(),
      metadata: {
        timestamp: new Date().toISOString(),
        tokens_used: completion.usage?.total_tokens || 0,
        model_used: "gpt-4o-mini",
        characters_processed: notes.length
      }
    });

  } catch (error) {
    console.error('Errore in minutes.js:', error);
    
    // Gestisci diversi tipi di errore OpenAI
    if (error.type === 'insufficient_quota' || error.code === 'insufficient_quota') {
      return res.status(402).json({
        error: 'Quota OpenAI esaurita',
        message: 'Hai raggiunto il limite di utilizzo delle API OpenAI. Controlla il tuo piano di billing.'
      });
    }
    
    if (error.type === 'rate_limit_exceeded' || error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit superato',
        message: 'Troppe richieste. Riprova tra qualche minuto.',
        retry_after: error.headers?.['retry-after'] || 60
      });
    }
    
    if (error.type === 'invalid_request_error' && error.code === 'context_length_exceeded') {
      return res.status(400).json({
        error: 'Testo troppo lungo',
        message: 'Gli appunti sono troppo lunghi per essere elaborati. Riduci la lunghezza del testo.'
      });
    }
    
    if (error.code === 'invalid_api_key' || error.type === 'authentication_error') {
      return res.status(401).json({
        error: 'Chiave API non valida',
        message: 'La chiave API OpenAI non è corretta o è scaduta'
      });
    }

    // Errore di rete o timeout
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'Servizio temporaneamente non disponibile',
        message: 'Errore di connessione con OpenAI. Riprova tra qualche minuto.'
      });
    }
    
    // Errore generico
    return res.status(500).json({
      error: 'Errore interno del server',
      message: 'Si è verificato un errore imprevisto durante la generazione del verbale',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        type: error.type,
        code: error.code
      } : undefined
    });
  }
}
