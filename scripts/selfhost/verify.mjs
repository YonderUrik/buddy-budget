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
import { runSetup, terminalPrompts } from './setup.mjs';
import { PassThrough, Writable } from 'node:stream';

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
  assert.equal(mergeConfig({ OPENROUTER_MODEL: '' }, {}).OPENROUTER_MODEL, 'deepseek/deepseek-v4.1-flash');
});

function scriptedPrompts(answer) {
  const output = [], questions = [];
  return {
    output, questions,
    write: text => output.push(text),
    async ask(question, hidden) { questions.push({ question, hidden }); return answer(question, hidden); },
  };
}

const skipService = question => question.includes(': choose an option') ? '2' : '';

test('English setup: skip services without model prompts, credential checks or optional-service questions', async () => temporary(async path => {
  const calls = [];
  const prompts = scriptedPrompts(skipService);
  assert.equal(await runSetup({ path, prompts, check: async id => { calls.push(id); return { status: 'ok', message: 'Prices available.' }; } }), true);
  assert.deepEqual(calls, ['yahoo']);
  assert(!prompts.questions.some(item => /API key|model|Sender email|Secret ID/.test(item.question)));
  assert(!prompts.questions.some(item => item.question.startsWith('Bank sync:')));
  const transcript = prompts.output.join('\n');
  for (let step = 1; step <= 6; step++) assert(transcript.includes(`Step ${step} of 6`));
  assert(transcript.includes('Skip for now'));
  assert(transcript.includes('AI will be off'));
  assert(!/[àèìòù]/.test(transcript));
  assert.equal((await readConfig(path)).values.COMPOSE_PROFILES, '');
}));

test('entering no new AI key skips models and OpenRouter checks', async () => temporary(async path => {
  const prompts = scriptedPrompts(question => question.startsWith('Sign-in emails and notifications: choose') ? '2' : '');
  const checks = [];
  await runSetup({ path, prompts, check: async id => { checks.push(id); return { status: 'ok', message: 'Checked.' }; } });
  assert(!checks.includes('openrouter'));
  assert(!prompts.questions.some(item => item.question.startsWith('Customize AI models')));
  assert(!(await readConfig(path)).values.OPENROUTER_API_KEY);
}));

test('provide an AI key: hide input, keep recommended models, check the key and enable the worker', async () => temporary(async path => {
  const secret = 'sk-or-wizard-test';
  const prompts = scriptedPrompts(question => {
    if (question.startsWith('OpenRouter API key')) return secret;
    if (question.startsWith('Sign-in emails and notifications: choose')) return '2';
    return '';
  });
  const checks = [];
  await runSetup({ path, prompts, check: async id => { checks.push(id); return { status: 'ok', message: 'Verified without paid requests.' }; } });
  assert(prompts.questions.find(item => item.question.startsWith('OpenRouter API key')).hidden);
  assert.deepEqual(checks, ['openrouter', 'yahoo']);
  assert(!prompts.questions.some(item => item.question.startsWith('CSV import model')));
  assert(!prompts.output.join('\n').includes(secret));
  const values = (await readConfig(path)).values;
  assert.equal(values.OPENROUTER_API_KEY, secret);
  assert.equal(values.OPENROUTER_MODEL, 'deepseek/deepseek-v4.1-flash');
  assert.equal(values.COMPOSE_PROFILES, 'ai');
}));

test('blank sender cancels the email step without leaving a partial key', async () => temporary(async path => {
  const prompts = scriptedPrompts(question => {
    if (question.startsWith('AI features: choose')) return '2';
    if (question.startsWith('Resend API key')) return 're_partial';
    return '';
  });
  const checks = [];
  await runSetup({ path, prompts, check: async id => { checks.push(id); return { status: 'ok', message: 'Checked.' }; } });
  const values = (await readConfig(path)).values;
  assert(!values.RESEND_API_KEY);
  assert(!values.RESEND_FROM);
  assert.equal(values.NOTIFICATIONS_MODE, 'off');
  assert(!checks.includes('resend'));
}));

test('cancelling the final summary does not create .env', async () => temporary(async path => {
  const prompts = scriptedPrompts(question => question.startsWith('Save these settings') ? 'n' : skipService(question));
  assert.equal(await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) }), false);
  assert.equal((await readConfig(path)).source, '');
}));

test('rerunning setup keeps secrets and optional integrations without showing or requesting them', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-preserve', GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'saved-secret' });
  const original = (await readConfig(path)).values;
  const prompts = scriptedPrompts(question => question.startsWith('Sign-in emails and notifications: choose') ? '2' : '');
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const updated = (await readConfig(path)).values;
  for (const name of ['OPENROUTER_API_KEY', 'PERSONAL_CSV_ENCRYPTION_KEY', 'GOOGLE_CLIENT_SECRET']) assert.equal(updated[name], original[name]);
  assert(!prompts.questions.some(item => item.question.startsWith('OpenRouter API key')));
  assert(!prompts.output.join('\n').includes('sk-or-preserve'));
  assert(!prompts.output.join('\n').includes('saved-secret'));
}));

test('disabling AI keeps its encryption key and explains how to stop the old worker', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-old' });
  const original = (await readConfig(path)).values;
  const prompts = scriptedPrompts(question => question.startsWith('AI features: choose') ? '3' : question.startsWith('Sign-in emails and notifications: choose') ? '2' : '');
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const updated = (await readConfig(path)).values;
  assert.equal(updated.OPENROUTER_API_KEY, '');
  assert.equal(updated.COMPOSE_PROFILES, '');
  assert.equal(updated.PERSONAL_CSV_ENCRYPTION_KEY, original.PERSONAL_CSV_ENCRYPTION_KEY);
  assert(prompts.output.join('\n').includes('docker compose --profile ai stop csv-worker'));
}));

test('only selected optional services are requested, with a concrete Google callback URL', async () => temporary(async path => {
  const prompts = scriptedPrompts(question => {
    if (question.includes(': choose an option')) return question.startsWith('Google sign-in') ? '1' : '2';
    if (question.startsWith('Optional services')) return '2';
    if (question.startsWith('Google Client ID')) return 'google-client';
    if (question.startsWith('Google Client secret')) return 'google-secret';
    return '';
  });
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  assert.equal((await readConfig(path)).values.GOOGLE_CLIENT_SECRET, 'google-secret');
  assert(prompts.output.join('\n').includes('http://localhost:3000/api/auth/callback/google'));
  assert(!prompts.questions.some(item => item.question.startsWith('GoCardless Secret')));
}));

test('rejected credentials are discarded by default without losing other setup steps', async () => temporary(async path => {
  const prompts = scriptedPrompts(question => {
    if (question.startsWith('Public URL')) return 'http://localhost:8080';
    if (question.startsWith('OpenRouter API key')) return 'invalid-key';
    if (question.startsWith('Sign-in emails and notifications: choose')) return '2';
    return '';
  });
  await runSetup({ path, prompts, check: async id => id === 'openrouter' ? { status: 'error', message: 'Key rejected.' } : { status: 'ok', message: 'Checked.' } });
  const values = (await readConfig(path)).values;
  assert(!values.OPENROUTER_API_KEY);
  assert.equal(values.APP_URL, 'http://localhost:8080');
  assert.equal(values.APP_PORT, '8080');
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


test('terminal regression: visible questions survive redraws and secret input stays hidden', async () => {
  const input = new PassThrough();
  let rendered = '';
  const output = new Writable({ write(chunk, encoding, done) { rendered += chunk.toString(); done(); } });
  const prompts = terminalPrompts(input, output);
  try {
    const normal = prompts.ask('Public URL [Enter uses http://localhost:3000]: ');
    assert(rendered.lastIndexOf('Public URL') > rendered.lastIndexOf('\x1b[0J'), 'readline must redraw the question after clearing the line');
    input.write('http://localhost:8080\r');
    assert.equal(await normal, 'http://localhost:8080');
    rendered = '';
    const secret = prompts.ask('API key (input hidden): ', true);
    input.write('test-secret-value\r');
    assert.equal(await secret, 'test-secret-value');
    assert(rendered.includes('API key (input hidden)'));
    assert(!rendered.includes('test-secret-value'));
  } finally { prompts.close(); }
});
