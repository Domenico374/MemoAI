<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memo AI - Sistema di Trascrizione</title>
    <style>
        :root {
            --ocean: #0077be;
            --sunset: #ff885e;
            --mint: #37c3a8;
            --aqua: #00c0e4;
            --light: #f8f9fa;
            --dark: #343a40;
            --error: #ff5252;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, var(--light) 0%, #e0f7fa 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--dark);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        header {
            background: linear-gradient(90deg, var(--ocean) 0%, var(--aqua) 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            font-size: 24px;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        
        .logo::before {
            content: "🎙️";
            margin-right: 10px;
            font-size: 28px;
        }
        
        .status {
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 14px;
        }
        
        .status::before {
            content: "";
            width: 10px;
            height: 10px;
            background: #4caf50;
            border-radius: 50%;
            margin-right: 8px;
        }
        
        .workflow {
            display: flex;
            justify-content: center;
            padding: 15px;
            background: #f1fcff;
            border-bottom: 1px solid #e0f7fa;
        }
        
        .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 0 20px;
        }
        
        .step-icon {
            width: 50px;
            height: 50px;
            background: white;
            border: 2px solid var(--mint);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 20px;
            margin-bottom: 8px;
        }
        
        .step-text {
            font-size: 14px;
            color: var(--dark);
        }
        
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            padding: 20px;
        }
        
        .panel {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            padding: 20px;
            border: 1px solid #e0f7fa;
        }
        
        .panel-title {
            font-size: 18px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--mint);
            color: var(--ocean);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .file-upload {
            border: 2px dashed var(--aqua);
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin-bottom: 20px;
            background: #f8fdff;
            transition: all 0.3s;
        }
        
        .file-upload:hover {
            background: #e0f7fa;
            border-color: var(--ocean);
        }
        
        .file-upload p {
            margin: 15px 0;
            color: #666;
        }
        
        .btn {
            background: linear-gradient(90deg, var(--ocean) 0%, var(--aqua) 100%);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 30px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 119, 190, 0.3);
        }
        
        .btn-upload::before {
            content: "↑";
            margin-right: 8px;
            font-size: 16px;
        }
        
        .queue {
            margin-top: 20px;
        }
        
        .queue-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: #f8fdff;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid var(--mint);
        }
        
        .error-item {
            border-left: 4px solid var(--error);
            background: #fff5f5;
        }
        
        .file-info {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        
        .file-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .file-details {
            font-size: 12px;
            color: #666;
        }
        
        .error-text {
            color: var(--error);
            font-size: 12px;
            margin-top: 5px;
        }
        
        .preview {
            min-height: 200px;
            max-height: 300px;
            overflow-y: auto;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin: 15px 0;
            border: 1px solid #e9ecef;
        }
        
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        
        .btn-secondary {
            background: white;
            color: var(--ocean);
            border: 1px solid var(--aqua);
        }
        
        .btn-secondary::before {
            content: "↻";
            margin-right: 8px;
        }
        
        .btn-danger {
            background: linear-gradient(90deg, var(--error) 0%, #ff7b7b 100%);
        }
        
        .btn-danger::before {
            content: "×";
            margin-right: 8px;
        }
        
        .analysis {
            margin-top: 20px;
        }
        
        .analysis-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }
        
        .analysis-box {
            background: #f8fdff;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e0f7fa;
        }
        
        .analysis-title {
            font-size: 14px;
            font-weight: bold;
            color: var(--ocean);
            margin-bottom: 10px;
        }
        
        .analysis-content {
            font-size: 14px;
            color: #666;
            min-height: 50px;
        }
        
        textarea {
            width: 100%;
            min-height: 150px;
            padding: 15px;
            border: 1px solid #e0f7fa;
            border-radius: 8px;
            resize: vertical;
            margin: 15px 0;
            font-family: inherit;
        }
        
        .char-count {
            text-align: right;
            font-size: 12px;
            color: #666;
            margin-bottom: 15px;
        }
        
        .tag {
            display: inline-block;
            background: #e0f7fa;
            color: var(--ocean);
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 12px;
            margin: 5px 5px 5px 0;
        }
        
        .error-tag {
            background: #ffebee;
            color: var(--error);
        }
        
        .debug-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
        }
        
        .debug-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--ocean);
        }
        
        footer {
            background: #f1fcff;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e0f7fa;
            color: #666;
            font-size: 14px;
        }
        
        .solution-box {
            background: #e8f5e9;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #4caf50;
        }
        
        .solution-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #2e7d32;
        }
        
        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
            
            .analysis-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">Memo AI</div>
            <div class="status">API ok</div>
        </header>
        
        <div class="workflow">
            <div class="step">
                <div class="step-icon">📤</div>
                <div class="step-text">Upload file</div>
            </div>
            <div class="step">
                <div class="step-icon">🔍</div>
                <div class="step-text">Trascrizione / Estrazione</div>
            </div>
            <div class="step">
                <div class="step-icon">📝</div>
                <div class="step-text">Formattazione</div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="panel">
                <div class="panel-title">
                    <span>Caricamento File</span>
                    <span>File elaborati: 0</span>
                </div>
                
                <div class="file-upload" id="dropZone">
                    <h3>Trascina il file qui oppure</h3>
                    <p>Supporta TXT, PDF, DOCX, MP3, WAV e altri formati</p>
                    <input type="file" id="fileInput" hidden accept=".txt,.pdf,.docx,.mp3,.wav,.m4a">
                    <button class="btn btn-upload" id="uploadBtn">Seleziona file</button>
                    <p class="help-text">Suggerimento: per file > 4.5 MB usare versioni ridotte. I PDF scansionati richiederanno OCR.</p>
                </div>
                
                <div class="queue">
                    <div class="queue-item error-item">
                        <div class="file-info">
                            <div class="file-name">LLM4EU 2025-07-09 15-04-51.mp3</div>
                            <div class="file-details">audio/mpeg • 50671.0 KB</div>
                            <div class="error-text">ERRORE: Formato audio non supportato o file troppo grande (limite Whisper: 25MB)</div>
                        </div>
                        <button class="btn-danger">Rimuovi</button>
                    </div>
                </div>
                
                <div class="actions">
                    <button class="btn btn-upload" id="processBtn">Elabora file</button>
                    <button class="btn-secondary" id="compressBtn">Comprimi audio</button>
                    <button class="btn-secondary">Pulisci coda</button>
                </div>

                <div class="solution-box">
                    <div class="solution-title">Soluzione per file audio grandi:</div>
                    <ol>
                        <li>Il file supera il limite di 25MB di Whisper</li>
                        <li>Usa il pulsante "Comprimi audio" per ridurre le dimensioni</li>
                        <li>Oppure dividi l'audio in segmenti più piccoli</li>
                        <li>Converti in formato MP3 a 128kbps per una compressione ottimale</li>
                    </ol>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-title">Anteprima</div>
                <div class="preview">
                    <strong>Errore di elaborazione:</strong> Il file audio non può essere elaborato a causa delle sue dimensioni o del codec non supportato.<br><br>
                    
                    <strong>Dettaglio errore:</strong> Il file "LLM4EU 2025-07-09 15-04-51.mp3" (50.67 MB) supera il limite massimo di 25MB imposto dall'API Whisper di OpenAI.<br><br>
                    
                    <strong>Soluzioni possibili:</strong>
                    <ul>
                        <li>Ridurre le dimensioni del file a meno di 25MB</li>
                        <li>Convertire il file in formato MP3 a 128kbps</li>
                        <li>Dividere il file in parti più piccole (es. 10-15 minuti ciascuna)</li>
                        <li>Utilizzare un tool di compressione audio online</li>
                    </ul>
                </div>
                
                <div class="actions">
                    <button class="btn-secondary">Schema intero</button>
                    <button class="btn-secondary">Pulisci anteprima</button>
                </div>
                
                <div class="panel-title">Appunti</div>
                <textarea placeholder="Appunti trascritti o estratti..."></textarea>
                <div class="char-count">0 caratteri</div>
                
                <div class="actions">
                    <button class="btn">Pulizia Verbale</button>
                    <button class="btn">Trascrizione</button>
                    <button class="btn">Genera verbale</button>
                    <button class="btn-secondary">Resettare</button>
                </div>
            </div>
        </div>
        
        <div class="analysis">
            <div class="panel-title">Analisi intelligente</div>
            <div class="analysis-grid">
                <div class="analysis-box">
                    <div class="analysis-title">Riassunto</div>
                    <div class="analysis-content">—</div>
                </div>
                <div class="analysis-box">
                    <div class="analysis-title">To-Do</div>
                    <div class="analysis-content">
                        <li>Comprimere il file audio</li>
                        <li>Verificare il formato del file</li>
                        <li>Dividere in segmenti se necessario</li>
                    </div>
                </div>
                <div class="analysis-box">
                    <div class="analysis-title">Punti salienti</div>
                    <div class="analysis-content">—</div>
                </div>
                <div class="analysis-box">
                    <div class="analysis-title">Tag suggeriti</div>
                    <div class="analysis-content">
                        <span class="tag error-tag">audio-error</span>
                        <span class="tag error-tag">large-file</span>
                        <span class="tag">conversion-needed</span>
                        <span class="tag">whisper-api</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="debug-info">
            <div class="debug-title">Informazioni di Debug:</div>
            <div>File: LLM4EU 2025-07-09 15-04-51.mp3</div>
            <div>Dimensione: 50.67 MB (50671.0 KB)</div>
            <div>Limite Whisper: 25 MB</div>
            <div>Eccesso: 25.67 MB (102.68% oltre il limite)</div>
            <div>Endpoint API: /api/whisper.js</div>
            <div>Timestamp: 2025-07-09 15:04:51</div>
        </div>
        
        <div class="panel" style="margin: 20px;">
            <div class="panel-title">Verbale</div>
            <div class="preview">
                Il verbale comparirà qui...<br><br>
                <strong>Impossibile generare il verbale a causa dell'errore di trascrizione.</strong> Si prega di comprimere il file audio e riprovare.
            </div>
            
            <div class="actions" style="margin-top: 15px;">
                <button class="btn">Copiare</button>
                <button class="btn">Scarica.md</button>
                <button class="btn">PDF</button>
            </div>
        </div>
        
        <footer>
            <p>Memo AI - Sistema di trascrizione avanzato | Ocean Sunset Mint Aqua</p>
            <p>Powered by Whisper API</p>
        </footer>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const uploadBtn = document.getElementById('uploadBtn');
            const fileInput = document.getElementById('fileInput');
            const dropZone = document.getElementById('dropZone');
            const processBtn = document.getElementById('processBtn');
            const compressBtn = document.getElementById('compressBtn');
            
            // Gestione click sul pulsante di upload
            uploadBtn.addEventListener('click', function() {
                fileInput.click();
            });
            
            // Gestione selezione file
            fileInput.addEventListener('change', function(e) {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                }
            });
            
            // Gestione drag and drop
            dropZone.addEventListener('dragover', function(e) {
                e.preventDefault();
                dropZone.style.background = '#e0f7fa';
                dropZone.style.borderColor = 'var(--ocean)';
            });
            
            dropZone.addEventListener('dragleave', function() {
                dropZone.style.background = '#f8fdff';
                dropZone.style.borderColor = 'var(--aqua)';
            });
            
            dropZone.addEventListener('drop', function(e) {
                e.preventDefault();
                dropZone.style.background = '#f8fdff';
                dropZone.style.borderColor = 'var(--aqua)';
                
                if (e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                }
            });
            
            // Gestione pulsante comprimi
            compressBtn.addEventListener('click', function() {
                alert('Funzionalità di compressione audio attivata. Il file verrà compresso a 128kbps per ridurre le dimensioni.');
                // Qui andrebbe la logica per comprimere l'audio
            });
            
            // Gestione pulsante elabora
            processBtn.addEventListener('click', function() {
                alert('Elaborazione file in corso...');
                // Qui andrebbe la logica per elaborare il file
            });
            
            // Funzione per gestire l'upload del file
            function handleFileUpload(file) {
                console.log('File selezionato:', file.name, 'Dimensione:', file.size, 'Tipo:', file.type);
                
                // Controllo dimensioni file per audio
                if (file.type.includes('audio') && file.size > 25 * 1024 * 1024) {
                    alert('Il file audio è troppo grande per Whisper (limite: 25MB). Si prega di comprimerlo o utilizzare un file più piccolo.');
                    return;
                }
                
                // Controllo dimensioni file generico
                if (file.size > 4.5 * 1024 * 1024) {
                    alert('Il file è piuttosto grande. Potrebbe richiedere più tempo per l\'elaborazione.');
                }
                
                // Qui andrebbe la logica per l'upload effettivo
                alert('File ' + file.name + ' pronto per l\'elaborazione!');
            }
        });
    </script>
</body>
</html>
