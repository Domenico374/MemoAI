import fs from 'fs';
import axios from 'axios';

// Assicurati che le tue chiavi API siano variabili d'ambiente
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript";

/**
 * Funzione per caricare un buffer audio su AssemblyAI.
 * @param {Buffer} fileBuffer - Il buffer del file audio da caricare.
 * @returns {Promise<string>} L'URL del file caricato.
 */
async function uploadFileBufferToAssemblyAI(fileBuffer) {
    console.log("Caricamento del buffer su AssemblyAI...");
    const headers = {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream',
    };
    try {
        const uploadRes = await axios.post(ASSEMBLYAI_UPLOAD_URL, fileBuffer, { headers });
        console.log("Buffer caricato con successo!");
        return uploadRes.data.upload_url;
    } catch (error) {
        console.error("Errore durante il caricamento del buffer:", error.response?.data || error.message);
        throw new Error("Errore nel caricamento del buffer su AssemblyAI.");
    }
}

/**
 * Funzione per avviare la trascrizione e ottenere l'ID del lavoro.
 * @param {string} audioUrl - L'URL del file audio caricato.
 * @returns {Promise<string>} L'ID della trascrizione.
 */
async function startTranscription(audioUrl) {
    console.log("Avvio della trascrizione...");
    const headers = {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
    };
    const body = {
        audio_url: audioUrl,
        // Puoi aggiungere altre opzioni qui, come 'language_code'
    };
    try {
        const transcriptRes = await axios.post(ASSEMBLYAI_TRANSCRIPT_URL, body, { headers });
        console.log("Trascrizione avviata con ID:", transcriptRes.data.id);
        return transcriptRes.data.id;
    } catch (error) {
        console.error("Errore nell'avvio della trascrizione:", error.response?.data || error.message);
        throw new Error("Errore nell'avvio della trascrizione.");
    }
}

/**
 * Funzione di polling per controllare lo stato della trascrizione.
 * @param {string} transcriptId - L'ID della trascrizione.
 * @returns {Promise<object>} L'oggetto trascrizione completo.
 */
async function pollForTranscriptionStatus(transcriptId) {
    const pollUrl = `${ASSEMBLYAI_TRANSCRIPT_URL}/${transcriptId}`;
    const headers = {
        'authorization': ASSEMBLYAI_API_KEY,
    };
    while (true) {
        console.log("Controllo stato trascrizione...");
        try {
            const pollRes = await axios.get(pollUrl, { headers });
            const status = pollRes.data.status;
            if (status === 'completed') {
                console.log("Trascrizione completata!");
                return pollRes.data;
            } else if (status === 'error') {
                console.error("Errore di trascrizione dall'API:", pollRes.data.error);
                throw new Error("Trascrizione fallita con errore.");
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Attende 5 secondi
            }
        } catch (error) {
            console.error("Errore nel polling dello stato:", error.response?.data || error.message);
            throw new Error("Errore nel recupero dello stato della trascrizione.");
        }
    }
}

/**
 * Funzione principale aggiornata che gestisce l'intero processo di trascrizione da URL.
 * @param {string} fileUrl - L'URL pubblico del file audio da trascrivere.
 * @returns {Promise<string>} Il testo trascritto.
 */
export async function transcribeAudio(fileUrl) {
    if (!fileUrl) {
        throw new Error("URL del file non valido o mancante.");
    }
    try {
        // Scarica i dati binari dal URL in un buffer
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data, 'binary');
        
        // Carica il buffer su AssemblyAI
        const audioUrl = await uploadFileBufferToAssemblyAI(fileBuffer);
        
        // Avvia la trascrizione
        const transcriptId = await startTranscription(audioUrl);
        
        // Polling per lo stato
        const transcriptionResult = await pollForTranscriptionStatus(transcriptId);
        
        // Restituisce il testo finale
        return transcriptionResult.text;
    } catch (error) {
        console.error("Errore completo nel processo di trascrizione:", error.message);
        throw error;
    }
}
