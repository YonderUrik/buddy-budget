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
      if (status === 200 && prices?.some(price => typeof price === 'number' && price > 0)) return { status: 'ok', message: 'Yahoo returned valid prices. No API key needed.' };
      return { status: 'warning', message: 'Yahoo is unavailable right now (network issue, blocking or rate limit). You can continue and retry later; no API key is needed.' };
    }
    if (id === 'openrouter') {
      if (!values.OPENROUTER_API_KEY) return { status: 'missing', message: 'AI is off: manual categories and standard imports are still available.' };
      const { status, data } = await request('https://openrouter.ai/api/v1/key', { Authorization: `Bearer ${values.OPENROUTER_API_KEY}` });
      if ([401, 403].includes(status)) return { status: 'error', message: 'OpenRouter rejected this key. Check it or create a new key.' };
      if (status !== 200 || !data?.data) return { status: 'warning', message: 'OpenRouter cannot be checked right now. Try again later.' };
      if (typeof data.data.limit_remaining === 'number' && data.data.limit_remaining <= 0) return { status: 'warning', message: 'Key accepted, but its spending limit is exhausted. Increase the limit in your OpenRouter account.' };
      if (data.data.is_free_tier) return { status: 'warning', message: 'Key accepted on a free account. Add credit for the configured models. Model availability and zero data retention are checked on first use.' };
      return { status: 'ok', message: 'Key accepted. No paid AI requests were made. Model availability, account credit and zero data retention are checked on first use.' };
    }
    if (id === 'resend') {
      if (!values.RESEND_API_KEY || !values.RESEND_FROM) return { status: 'missing', message: 'Email is off. Provide both a Resend key and a sender address to enable it. Sign-in links remain available in the app logs.' };
      const { status, data } = await request('https://api.resend.com/domains', { Authorization: `Bearer ${values.RESEND_API_KEY}` });
      if (status === 401) return { status: 'error', message: 'Resend rejected this key.' };
      if (status === 403) return { status: 'warning', message: 'This key cannot list domains (it may be send-only). Try signing in after setup to verify delivery. No email was sent.' };
      if (status !== 200 || !Array.isArray(data?.data)) return { status: 'warning', message: 'Resend cannot be checked right now. No email was sent.' };
      const domain = values.RESEND_FROM.match(/@([^\s<>]+)>?$/)?.[1]?.toLowerCase();
      const verified = data.data.some(item => item.name?.toLowerCase() === domain && item.status === 'verified');
      return verified
        ? { status: 'ok', message: 'Key accepted and sender domain verified. Try signing in after setup to check delivery. No email was sent.' }
        : { status: 'warning', message: 'Key accepted, but the sender domain was not found among the verified domains returned. Check the domain in Resend before using email.' };
    }
    throw new Error('unknown_check');
  } catch {
    return { status: 'warning', message: 'Could not complete the check. Check your connection and try again. No credentials are included in error messages.' };
  }
}
