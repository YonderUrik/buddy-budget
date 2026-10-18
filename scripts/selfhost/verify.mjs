import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readConfig, mergeConfig, validateConfig, saveConfig, prepareConfig } from './config.mjs';
import { checkService } from './checks.mjs';
import { runSetup } from './setup.mjs';

async function temporary(run) {
  const dir = await mkdtemp(join(tmpdir(), 'buddybudget-setup-'));
  try { await run(join(dir, '.env'), dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('configurazione nuova: segreti privati, AI condivisa, notifiche e dollari letterali', async () => temporary(async path => {
  const apiKey = 'sk-or-test-$literal';
  const result = await saveConfig(path, { OPENROUTER_API_KEY: apiKey, RESEND_API_KEY: 're_test', RESEND_FROM: 'BuddyBudget <budget@example.org>' });
  const { values } = await readConfig(path);
  assert.equal(values.OPENROUTER_API_KEY, apiKey);
  assert.equal(values.COMPOSE_PROFILES, 'ai');
  assert.equal(values.NOTIFICATIONS_MODE, 'execute');
  assert.equal(Buffer.from(values.PERSONAL_CSV_ENCRYPTION_KEY, 'base64').length, 32);
  assert.equal(values.BETTER_AUTH_SECRET.length, 64);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert(!JSON.stringify(result).includes(apiKey));
}));

test('riapertura: conserva segreti e opzioni avanzate, rimuove duplicati senza perdere la chiave CSV', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-old' });
  const original = (await readConfig(path)).values;
  await writeFile(path, (await readFile(path, 'utf8')) + "# opzione avanzata\nCUSTOM='a$b'\nOPENROUTER_API_KEY=duplicate\nCOMPOSE_PROFILES=ai,extra\n");
  await saveConfig(path, { OPENROUTER_API_KEY: null });
  const updated = (await readConfig(path)).values;
  for (const name of ['POSTGRES_PASSWORD', 'BETTER_AUTH_SECRET', 'CRON_SECRET', 'PERSONAL_CSV_ENCRYPTION_KEY']) assert.equal(updated[name], original[name]);
  assert.equal(updated.OPENROUTER_API_KEY, '');
  assert.equal(updated.COMPOSE_PROFILES, 'extra');
  assert.equal(updated.CUSTOM, 'a$b');
  assert.equal((await readFile(path, 'utf8')).match(/^OPENROUTER_API_KEY=/gm).length, 1);
}));

test('fallimenti di validazione e symlink non modificano i file', async () => temporary(async (path, dir) => {
  await saveConfig(path, {});
  const before = await readFile(path, 'utf8');
  await assert.rejects(saveConfig(path, { APP_URL: 'https://example.org/path' }));
  await assert.rejects(saveConfig(path, { RESEND_API_KEY: 're_incomplete' }));
  await assert.rejects(saveConfig(path, { OPENROUTER_API_KEY: "malicious\nAPP_URL=bad" }));
  await assert.rejects(saveConfig(path, { CRON_SECRET: 'not-editable' }));
  assert.equal(await readFile(path, 'utf8'), before);
  await symlink(path, join(dir, 'link'));
  await assert.rejects(saveConfig(join(dir, 'link'), {}));
}));

test('validazione URL, coppie credenziali e nomi modelli', () => {
  for (const APP_URL of ['localhost:3000', 'ftp://host', 'http://user:secret@host', 'https://host/?query=yes']) assert(validateConfig(mergeConfig({}, { APP_URL })).length);
  assert(validateConfig(mergeConfig({}, { GOOGLE_CLIENT_ID: 'id' })).length);
  assert(validateConfig(mergeConfig({}, { APP_PORT: '70000' })).length);
  assert(validateConfig(mergeConfig({}, { GOCARDLESS_SECRET_KEY: 'secret' })).length);
  assert(validateConfig(mergeConfig({}, { OPENROUTER_API_KEY: 'key', OPENROUTER_MODEL: 'missing-provider' })).length);
  assert.equal(prepareConfig(mergeConfig({}, {})).NOTIFICATIONS_MODE, 'off');
});

test('wizard completo: input nascosto, verifiche senza generazioni, riepilogo senza segreti', async () => temporary(async path => {
  const output = [], questions = [], requests = [];
  const secret = 'sk-or-wizard-test';
  const prompts = {
    write: text => output.push(text),
    async ask(question, hidden) {
      questions.push({ question, hidden });
      if (question.startsWith('Chiave API OpenRouter')) return secret;
      if (question.startsWith('Configurare ')) return question.includes('Assistente AI') ? 's' : 'n';
      return '';
    },
  };
  const result = await runSetup({ path, prompts, check: async id => { requests.push(id); return { status: 'ok', message: 'Verificato senza generazioni.' }; } });
  assert.equal(result, true);
  assert(questions.find(item => item.question.startsWith('Chiave API OpenRouter')).hidden);
  assert.deepEqual(requests, ['openrouter', 'yahoo']);
  assert(!output.join('\n').includes(secret));
  const values = (await readConfig(path)).values;
  assert.equal(values.OPENROUTER_API_KEY, secret);
  assert.equal(values.COMPOSE_PROFILES, 'ai');
  assert(output.join('\n').includes('docker compose up -d --remove-orphans'));
}));

test('annullare il riepilogo non crea .env', async () => temporary(async path => {
  const prompts = { write() {}, async ask(question) { return question.startsWith('Salvare') || question.startsWith('Configurare') || question.startsWith('Verificare Yahoo') ? 'n' : ''; } };
  assert.equal(await runSetup({ path, prompts }), false);
  assert.equal((await readConfig(path)).source, '');
}));

test('non cambiare un segreto conserva il valore senza mostrarlo nel prompt', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-preserve' });
  const original = (await readConfig(path)).values;
  const transcript = [];
  const prompts = {
    write: text => transcript.push(text),
    async ask(question) {
      transcript.push(question);
      if (question.startsWith('Configurare ')) return question.includes('Assistente AI') ? 's' : 'n';
      if (question.startsWith('Verificare')) return 'n';
      return '';
    },
  };
  await runSetup({ path, prompts });
  const updated = (await readConfig(path)).values;
  assert.equal(updated.OPENROUTER_API_KEY, original.OPENROUTER_API_KEY);
  assert.equal(updated.PERSONAL_CSV_ENCRYPTION_KEY, original.PERSONAL_CSV_ENCRYPTION_KEY);
  assert(!transcript.join('\n').includes('sk-or-preserve'));
}));

test('disabilitare AI dal wizard conserva la cifratura e indica come fermare il vecchio worker', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-old' });
  const original = (await readConfig(path)).values;
  const output = [];
  const prompts = {
    write: text => output.push(text),
    async ask(question) {
      if (question.startsWith('Configurare') || question.startsWith('Conservare') || question.startsWith('Verificare')) return 'n';
      return '';
    },
  };
  assert.equal(await runSetup({ path, prompts }), true);
  const updated = (await readConfig(path)).values;
  assert.equal(updated.OPENROUTER_API_KEY, '');
  assert.equal(updated.COMPOSE_PROFILES, '');
  assert.equal(updated.PERSONAL_CSV_ENCRYPTION_KEY, original.PERSONAL_CSV_ENCRYPTION_KEY);
  assert(output.join('\n').includes('docker compose --profile ai stop csv-worker'));
}));

test('verifiche distinguono autenticazione, credito esaurito e servizio indisponibile', async () => {
  const values = { OPENROUTER_API_KEY: 'secret' };
  assert.equal((await checkService('openrouter', values, async () => ({ status: 401 }))).status, 'error');
  assert.equal((await checkService('openrouter', values, async () => ({ status: 200, data: { data: { limit_remaining: 0 } } }))).status, 'warning');
  assert.equal((await checkService('openrouter', values, async () => ({ status: 200, data: { data: { limit_remaining: 5 } } }))).status, 'ok');
  const failure = await checkService('openrouter', values, async () => { throw new Error('secret'); });
  assert.equal(failure.status, 'warning');
  assert(!failure.message.includes('secret'));
  assert.equal((await checkService('openrouter', {})).status, 'missing');
});

test('Yahoo richiede prezzi validi e non una chiave', async () => {
  assert.equal((await checkService('yahoo', {}, async () => ({ status: 200, data: { chart: { result: [{ indicators: { quote: [{ close: [null, 123.45] }] } }] } } }))).status, 'ok');
  assert.equal((await checkService('yahoo', {}, async () => ({ status: 200, data: { chart: { result: [] } } }))).status, 'warning');
});

test('Resend distingue dominio verificato, chiave limitata e credenziali rifiutate', async () => {
  const values = { RESEND_API_KEY: 're_secret', RESEND_FROM: 'BuddyBudget <budget@example.org>' };
  assert.equal((await checkService('resend', values, async () => ({ status: 200, data: { data: [{ name: 'example.org', status: 'verified' }] } }))).status, 'ok');
  assert.equal((await checkService('resend', values, async () => ({ status: 403 }))).status, 'warning');
  assert.equal((await checkService('resend', values, async () => ({ status: 401 }))).status, 'error');
});

test('esempio env compatibile con i valori serializzati dal wizard', async () => {
  const example = parseEnv(await readFile(new URL('../../.env.selfhost.example', import.meta.url), 'utf8'));
  assert.equal(example.NOTIFICATIONS_MODE, 'off');
  assert.equal(example.COMPOSE_PROFILES, '');
});

test('Compose passa le stesse credenziali ad app e worker senza interpolare i dollari', { skip: spawnSync('docker', ['compose', 'version']).status !== 0 }, async () => temporary(async path => {
  const key = 'sk-or-compose-$literal';
  await saveConfig(path, { OPENROUTER_API_KEY: key, RESEND_API_KEY: 're_test', RESEND_FROM: 'budget@example.org' });
  const compose = fileURLToPath(new URL('../../docker-compose.yml', import.meta.url));
  const config = JSON.parse(execFileSync('docker', ['compose', '--env-file', path, '-f', compose, 'config', '--format', 'json'], { encoding: 'utf8', env: { ...process.env, COMPOSE_PROFILES: 'ai' } }));
  assert(config.services['csv-worker']);
  for (const name of ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'PERSONAL_CSV_ENCRYPTION_KEY']) assert.equal(config.services.app.environment[name], config.services['csv-worker'].environment[name]);
  // `config` raddoppia i dollari per rendere la sua uscita riutilizzabile come file Compose.
  assert.equal(config.services.app.environment.OPENROUTER_API_KEY.replaceAll('$$', '$'), key);
  assert.equal(config.services.app.environment.NOTIFICATIONS_MODE, 'execute');
  assert.equal(config.services.cron.environment.NOTIFICATIONS_MODE, 'execute');
}));
