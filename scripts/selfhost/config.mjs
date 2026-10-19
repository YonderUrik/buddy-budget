import { randomBytes } from 'node:crypto';
import { lstat, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { DEFAULTS, FIELDS } from './catalog.mjs';

/** Legge solo il file dell’istanza, mai .env.local dello sviluppatore. */
export async function readConfig(path) {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('The .env path must be a regular file, not a symbolic link.');
    const source = await readFile(path, 'utf8');
    return { source, values: parseEnv(source) };
  } catch (error) {
    if (error.code === 'ENOENT') return { source: '', values: {} };
    throw error;
  }
}

/** Un campo omesso conserva il valore; null rimuove esplicitamente una chiave. */
export function mergeConfig(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid configuration.');
  const next = { ...DEFAULTS, ...current };
  for (const [name, value] of Object.entries(DEFAULTS)) if (!next[name]) next[name] = value;
  for (const [name, value] of Object.entries(patch)) {
    if (!FIELDS.some(field => field.name === name)) throw new Error('Unknown configuration field.');
    // Le virgolette singole rendono letterali anche i dollari in Docker Compose.
    if (value !== null && (typeof value !== 'string' || value.length > 4096 || /[\r\n\0'\\]/.test(value))) {
      throw new Error('A field contains unsupported characters.');
    }
    next[name] = value === null ? '' : value.trim();
  }
  return next;
}

/** Controlli strutturali, indipendenti dalla disponibilità dei servizi esterni. */
export function validateConfig(values, only) {
  const errors = [];
  const add = (names, message) => { if (!only || names.some(name => only.includes(name))) errors.push(message); };
  try {
    const url = new URL(values.APP_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
  } catch { add(['APP_URL'], 'Public URL: enter an http:// or https:// address without a path, credentials or query parameters.'); }
  if (!/^\d+$/.test(values.APP_PORT ?? '') || Number(values.APP_PORT) < 1 || Number(values.APP_PORT) > 65535) add(['APP_PORT'], 'Local port: enter a number between 1 and 65535.');
  for (const [first, second, label] of [
    ['RESEND_API_KEY', 'RESEND_FROM', 'Email: provide both a Resend API key and a sender address.'],
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'Google: provide both a Client ID and Client secret.'],
    ['GOCARDLESS_SECRET_ID', 'GOCARDLESS_SECRET_KEY', 'GoCardless: provide both a Secret ID and Secret key.'],
  ]) if (Boolean(values[first]) !== Boolean(values[second])) add([first, second], label);
  if (values.RESEND_FROM && !/^(?:[^<>]+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(values.RESEND_FROM)) add(['RESEND_FROM'], 'Sender: enter a valid email address, e.g. BuddyBudget <budget@example.com>.');
  if (values.SUPPORT_EMAIL_TO && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(values.SUPPORT_EMAIL_TO)) add(['SUPPORT_EMAIL_TO'], 'Support reports: enter a valid recipient email address.');
  if (values.OLLAMA_BASE_URL) {
    try { if (!['http:', 'https:'].includes(new URL(values.OLLAMA_BASE_URL).protocol)) throw new Error(); }
    catch { add(['OLLAMA_BASE_URL'], 'Ollama: enter an http:// or https:// address.'); }
  }
  if (values.OPENROUTER_API_KEY) {
    for (const name of ['OPENROUTER_MODEL', 'CATEGORIZATION_MODEL']) {
      if (!/^[\w.-]+\/[\w.\/:+-]+$/.test(values[name] ?? '')) add([name, 'OPENROUTER_API_KEY'], `${name}: enter the complete provider/model name.`);
    }
  }
  return errors;
}

/** Riassume ciò che la configurazione abilita, senza confonderlo con una verifica del servizio. */
export function readiness(values) {
  return [
    { id: 'core', label: 'Manual accounts, transactions, budgets and standard imports', configured: true },
    { id: 'yahoo', label: 'Market prices and exchange rates (no Yahoo key needed)', configured: true },
    { id: 'openrouter', label: 'AI categories and custom CSV imports (worker included)', configured: Boolean(values.OPENROUTER_API_KEY) },
    { id: 'resend', label: 'Sign-in emails, summaries and alerts', configured: Boolean(values.RESEND_API_KEY && values.RESEND_FROM) },
    { id: 'gocardless', label: 'Bank sync', configured: Boolean(values.GOCARDLESS_SECRET_ID && values.GOCARDLESS_SECRET_KEY) },
    { id: 'google', label: 'Google sign-in', configured: Boolean(values.GOOGLE_CLIENT_ID && values.GOOGLE_CLIENT_SECRET) },
    { id: 'logos', label: 'Logo.dev logos', configured: Boolean(values.LOGODEV_PUBLISHABLE_KEY) },
    { id: 'prices', label: 'Additional financial data providers', configured: ['ALPHAVANTAGE_API_KEY', 'TWELVEDATA_API_KEY', 'STOOQ_API_KEY', 'COINGECKO_API_KEY', 'OPENFIGI_API_KEY'].some(name => Boolean(values[name])) },
    { id: 'ollama', label: 'Portfolio commentary with Ollama', configured: Boolean(values.OLLAMA_BASE_URL) },
    { id: 'support', label: 'Support reports to your own inbox', configured: Boolean(values.SUPPORT_EMAIL_TO && values.RESEND_API_KEY && values.RESEND_FROM) },
  ];
}

/** Genera una volta sola i segreti locali e collega worker e notifiche alle credenziali scelte. */
export function prepareConfig(values) {
  const next = { ...values, SELF_HOSTED: 'true', APP_URL: values.APP_URL.replace(/\/+$/, '') };
  for (const name of ['POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET', 'CRON_SECRET']) next[name] ||= randomBytes(32).toString('hex');
  // Va conservata anche quando si spegne l’AI: i file e i parser già salvati restano cifrati.
  if (next.OPENROUTER_API_KEY) next.PERSONAL_CSV_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
  const profiles = new Set((next.COMPOSE_PROFILES ?? '').split(',').filter(Boolean));
  if (next.OPENROUTER_API_KEY) profiles.add('ai'); else profiles.delete('ai');
  next.COMPOSE_PROFILES = [...profiles].join(',');
  next.NOTIFICATIONS_MODE = next.RESEND_API_KEY && next.RESEND_FROM ? 'execute' : 'off';
  return next;
}

/** Sostituisce solo i campi gestiti, conservando commenti e configurazioni avanzate. */
export function renderConfig(source, values) {
  const pending = new Map(Object.entries(values));
  const managed = new Set(pending.keys());
  const lines = source.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z_0-9]*)\s*=/);
    if (!match || !managed.has(match[1])) return [line];
    // Rimuove i duplicati gestiti: un valore vecchio in fondo non deve annullare l’aggiornamento.
    if (!pending.has(match[1])) return [];
    const name = match[1], value = pending.get(name);
    pending.delete(name);
    return [`${name}='${value}'`];
  });
  return [...lines, ...[...pending].map(([name, value]) => `${name}='${value}'`)].join('\n').trim() + '\n';
}

/** Scrittura atomica con permessi privati; non modifica mai il file su errore di validazione. */
export async function saveConfig(path, patch, template = '') {
  const { source, values } = await readConfig(path);
  const merged = mergeConfig(values, patch);
  const errors = validateConfig(merged);
  if (errors.length) throw new Error(errors.join('\n'));
  const prepared = prepareConfig(merged);
  // Le variabili avanzate non gestite dal wizard rimangono byte per byte nel file.
  const managedNames = new Set([...FIELDS.map(f => f.name), 'SELF_HOSTED', 'POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET', 'CRON_SECRET', 'PERSONAL_CSV_ENCRYPTION_KEY', 'COMPOSE_PROFILES', 'NOTIFICATIONS_MODE']);
  const managed = Object.fromEntries(Object.entries(prepared).filter(([name]) => managedNames.has(name)));
  if (Object.values(managed).some(value => /[\r\n\0'\\]/.test(value))) throw new Error('An existing value contains unsupported characters.');
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, renderConfig(source || template, managed), { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(() => {}); }
  return { readiness: readiness(prepared) };
}
