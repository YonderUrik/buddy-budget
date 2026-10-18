import https from 'node:https';

const TIMEOUT_MS = 8000;
// Stesso ordine delle cipher suite iniziali usato dal client prezzi dell’app.
const YAHOO_CIPHERS = 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA';

/** Richieste solo verso endpoint fissi, senza redirect né risposte del provider nei log. */
export function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 BuddyBudget-Setup', ...headers }, ciphers: YAHOO_CIPHERS, signal: AbortSignal.timeout(TIMEOUT_MS) }, response => {
      let body = '';
      response.on('data', chunk => {
        body += chunk;
        if (Buffer.byteLength(body) > 262144) request.destroy(new Error('response_too_large'));
      });
      response.on('end', () => {
        let data = null;
        try { data = JSON.parse(body); } catch { /* HTML da WAF o errori del provider. */ }
        resolve({ status: response.statusCode, data });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

/** Verifiche senza generazioni AI o invio di email: nessun dato finanziario viene trasmesso. */
export async function checkService(id, values, request = requestJson) {
  try {
    if (id === 'yahoo') {
      const { status, data } = await request('https://query2.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d');
      const prices = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (status === 200 && prices?.some(price => typeof price === 'number' && price > 0)) return { status: 'ok', message: 'Yahoo risponde con prezzi validi. Nessuna chiave necessaria.' };
      return { status: 'warning', message: 'Yahoo non restituisce prezzi adesso (rete, blocco o limite del servizio). Puoi continuare e riprovare; non serve una chiave Yahoo.' };
    }
    if (id === 'openrouter') {
      if (!values.OPENROUTER_API_KEY) return { status: 'missing', message: 'Senza chiave: categorie manuali e import standard disponibili, AI disattivata.' };
      const { status, data } = await request('https://openrouter.ai/api/v1/key', { Authorization: `Bearer ${values.OPENROUTER_API_KEY}` });
      if ([401, 403].includes(status)) return { status: 'error', message: 'Chiave OpenRouter rifiutata. Controllala o creane una nuova.' };
      if (status !== 200 || !data?.data) return { status: 'warning', message: 'OpenRouter non è verificabile adesso. Riprova tra poco.' };
      if (typeof data.data.limit_remaining === 'number' && data.data.limit_remaining <= 0) return { status: 'warning', message: 'Chiave riconosciuta, ma il limite di spesa è esaurito. Aumentalo nel tuo account OpenRouter.' };
      if (data.data.is_free_tier) return { status: 'warning', message: 'Chiave riconosciuta su un account gratuito. Aggiungi credito per i modelli configurati. Modelli e compatibilità ZDR si verificano al primo utilizzo.' };
      return { status: 'ok', message: 'Chiave riconosciuta. Non abbiamo eseguito generazioni a pagamento. Modelli, credito disponibile e compatibilità ZDR si verificano al primo utilizzo.' };
    }
    if (id === 'resend') {
      if (!values.RESEND_API_KEY || !values.RESEND_FROM) return { status: 'missing', message: 'Configura chiave e mittente. Senza, i link di accesso vanno nei log e le notifiche non partono.' };
      const { status, data } = await request('https://api.resend.com/domains', { Authorization: `Bearer ${values.RESEND_API_KEY}` });
      if (status === 401) return { status: 'error', message: 'Chiave Resend rifiutata.' };
      if (status === 403) return { status: 'warning', message: 'Questa chiave non permette di controllare i domini (può essere di solo invio). Salvala e prova un accesso reale; nessuna email è stata inviata.' };
      if (status !== 200 || !Array.isArray(data?.data)) return { status: 'warning', message: 'Resend non è verificabile adesso. Nessuna email è stata inviata.' };
      const domain = values.RESEND_FROM.match(/@([^\s<>]+)>?$/)?.[1]?.toLowerCase();
      const verified = data.data.some(item => item.name?.toLowerCase() === domain && item.status === 'verified');
      return verified
        ? { status: 'ok', message: 'Chiave riconosciuta e dominio del mittente verificato. La consegna si prova con il primo accesso; nessuna email è stata inviata.' }
        : { status: 'warning', message: 'Chiave riconosciuta, ma il dominio del mittente non risulta verificato in questa pagina di risultati. Controllalo in Resend prima di usare le email.' };
    }
    throw new Error('unknown_check');
  } catch {
    return { status: 'warning', message: 'Verifica non riuscita: controlla la connessione e riprova. Nessun segreto viene mostrato nei messaggi di errore.' };
  }
}
