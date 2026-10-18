/** Catalogo del setup: priorità, istruzioni e campi segreti da nascondere nel terminale. */
export const SECTIONS = [
  { id: 'address', title: 'La tua installazione', level: 'Necessario', description: 'L’indirizzo con cui aprirai BuddyBudget. Serve anche ai link di accesso e alle connessioni bancarie.', fields: [
    { name: 'APP_URL', label: 'Indirizzo di BuddyBudget', default: 'http://localhost:3000', type: 'url', help: 'Su un server usa il tuo dominio con HTTPS. In locale va bene http://localhost:3000.' },
    { name: 'APP_PORT', label: 'Porta locale dell’app', default: '3000', help: 'Se apri http://localhost:8080, usa 8080 anche qui. Dietro un reverse proxy HTTPS puoi lasciare 3000. L’app resta raggiungibile solo da questa macchina; per la rete locale vedi APP_BIND nella guida.' },
  ] },
  { id: 'openrouter', title: 'Assistente AI', level: 'Fortemente consigliato', description: 'OpenRouter abilita le proposte di categoria e la lettura dei CSV di banche e broker non ancora supportati. Senza chiave restano regole, categorie manuali e import standard.', link: 'https://openrouter.ai/settings/keys', linkLabel: 'Crea una chiave OpenRouter', check: true, fields: [
    { name: 'OPENROUTER_API_KEY', label: 'Chiave API OpenRouter', secret: true, help: 'Aggiungi credito all’account e scegli un limite di spesa. Le chiamate AI possono avere un costo.' },
    { name: 'OPENROUTER_MODEL', label: 'Modello per i CSV', default: 'deepseek/deepseek-v4.1-flash', help: 'Deve supportare JSON e un provider con conservazione zero dei dati (ZDR). La verifica della chiave non esegue un import né consuma generazioni.' },
    { name: 'CATEGORIZATION_MODEL', label: 'Modello per le categorie', default: 'typesafe/jev-1.13', help: 'Le proposte AI richiedono anche il consenso di ogni persona nelle proprie Impostazioni.' },
  ] },
  { id: 'yahoo', title: 'Prezzi di mercato', level: 'Consigliato per gli investimenti', description: 'Yahoo Finance è già configurato: non richiede una chiave API. Verifichiamo che risponda da questa macchina. Le altre fonti gratuite e i cambi BCE restano disponibili.', check: true, fields: [] },
  { id: 'resend', title: 'Email', level: 'Consigliato', description: 'Resend invia i link di accesso, i riepiloghi e gli avvisi. Senza email il link di accesso si legge nei log dell’app; le notifiche non partono.', link: 'https://resend.com/api-keys', linkLabel: 'Configura Resend', check: true, fields: [
    { name: 'RESEND_API_KEY', label: 'Chiave API Resend', secret: true, help: 'Per controllare anche il dominio serve una chiave con accesso completo. Una chiave di solo invio si può salvare, ma va provata con un accesso reale.' },
    { name: 'RESEND_FROM', label: 'Mittente delle email', help: 'Per esempio BuddyBudget <budget@tuodominio.it>. Verifica prima il dominio in Resend.' },
  ] },
  { id: 'gocardless', title: 'Collegamento alle banche', level: 'Facoltativo', description: 'GoCardless Bank Account Data sincronizza i conti bancari. Senza, puoi usare conti manuali e CSV. Le credenziali vengono controllate come coppia; il collegamento reale si verifica dall’app.', link: 'https://bankaccountdata.gocardless.com/', linkLabel: 'Ottieni le credenziali GoCardless', fields: [
    { name: 'GOCARDLESS_SECRET_ID', label: 'Secret ID', secret: true },
    { name: 'GOCARDLESS_SECRET_KEY', label: 'Secret key', secret: true },
  ] },
  { id: 'google', title: 'Accesso con Google', level: 'Facoltativo', description: 'Un’alternativa al link di accesso. In Google Cloud registra <indirizzo di BuddyBudget>/api/auth/callback/google come URI di reindirizzamento. La coppia è controllata localmente; completa un accesso per verificare OAuth.', link: 'https://console.cloud.google.com/apis/credentials', linkLabel: 'Configura Google OAuth', fields: [
    { name: 'GOOGLE_CLIENT_ID', label: 'Client ID' },
    { name: 'GOOGLE_CLIENT_SECRET', label: 'Client secret', secret: true },
  ] },
  { id: 'logos', title: 'Loghi', level: 'Facoltativo', description: 'Logo.dev aggiunge i loghi degli strumenti e degli esercenti. Senza chiavi usiamo le icone locali.', link: 'https://www.logo.dev/', linkLabel: 'Configura Logo.dev', fields: [
    { name: 'LOGODEV_PUBLISHABLE_KEY', label: 'Chiave pubblica (pk_…)' },
    { name: 'LOGODEV_SECRET_KEY', label: 'Chiave segreta per la ricerca (sk_…)', secret: true },
  ] },
  { id: 'prices', title: 'Altre fonti finanziarie', level: 'Facoltativo', description: 'Fonti aggiuntive per la catena di riserva. Non servono per avviare gli investimenti. Le chiavi sono salvate senza effettuare chiamate che consumano quote.', fields: [
    { name: 'ALPHAVANTAGE_API_KEY', label: 'Alpha Vantage', secret: true, link: 'https://www.alphavantage.co/support/#api-key' },
    { name: 'TWELVEDATA_API_KEY', label: 'Twelve Data', secret: true, link: 'https://twelvedata.com/account/api-keys' },
    { name: 'STOOQ_API_KEY', label: 'Stooq', secret: true, link: 'https://stooq.com/' },
    { name: 'COINGECKO_API_KEY', label: 'CoinGecko', secret: true, link: 'https://www.coingecko.com/en/developers/dashboard' },
    { name: 'OPENFIGI_API_KEY', label: 'OpenFIGI', secret: true, link: 'https://www.openfigi.com/api' },
  ] },
  { id: 'ollama', title: 'Commenti agli investimenti', level: 'Facoltativo', description: 'Ollama genera commenti al portafoglio e può girare sulla tua macchina. Non sostituisce OpenRouter per categorie e CSV. L’indirizzo deve essere raggiungibile dal container dell’app, non solo dal terminale.', link: 'https://ollama.com/', linkLabel: 'Configura Ollama', fields: [
    { name: 'OLLAMA_BASE_URL', label: 'Indirizzo del server Ollama', type: 'url' },
    { name: 'OLLAMA_MODEL', label: 'Modello Ollama', default: 'llama3.2' },
  ] },
  { id: 'support', title: 'Segnalazioni dell’installazione', level: 'Facoltativo', description: 'Se vuoi ricevere segnalazioni e report tecnici dell’istanza, indica una casella email. Richiede Resend. Se la lasci vuota, nessun report viene inviato al supporto BuddyBudget.', fields: [
    { name: 'SUPPORT_EMAIL_TO', label: 'Destinatario delle segnalazioni' },
  ] },
];

export const FIELDS = SECTIONS.flatMap(section => section.fields);
export const DEFAULTS = Object.fromEntries(FIELDS.filter(field => field.default).map(field => [field.name, field.default]));
