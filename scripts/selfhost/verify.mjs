import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, symlink, rm, mkdir, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readConfig, mergeConfig, validateConfig, saveConfig, prepareConfig, readiness } from './config.mjs';
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

function scriptedPrompts(answer, mode = '2') {
  const output = [], questions = [];
  return {
    output, questions,
    write: text => output.push(text),
    async ask(question, hidden) { questions.push({ question, hidden }); return question.startsWith('Choose your use case') ? mode : answer(question, hidden); },
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
  for (let step = 1; step <= 7; step++) assert(transcript.includes(`Step ${step} of 7`));
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

test('disabling AI keeps its encryption key and points to the service-aware start command', async () => temporary(async path => {
  await saveConfig(path, { OPENROUTER_API_KEY: 'sk-or-old' });
  const original = (await readConfig(path)).values;
  const prompts = scriptedPrompts(question => question.startsWith('AI features: choose') ? '3' : question.startsWith('Sign-in emails and notifications: choose') ? '2' : '');
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const updated = (await readConfig(path)).values;
  assert.equal(updated.OPENROUTER_API_KEY, '');
  assert.equal(updated.COMPOSE_PROFILES, '');
  assert.equal(updated.PERSONAL_CSV_ENCRYPTION_KEY, original.PERSONAL_CSV_ENCRYPTION_KEY);
  assert(prompts.output.join('\n').includes('./scripts/selfhost-start.sh'));
}));

test('configuration-only completion clearly says the app has not been started and gives the next command', async () => temporary(async path => {
  const prompts = scriptedPrompts(skipService);
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const output = prompts.output.join('\n');
  assert(output.includes('has not started or restarted BuddyBudget'));
  assert(output.includes('NEXT STEP'));
  assert(output.includes('./scripts/selfhost-start.sh --build'));
  assert(!output.includes('BuddyBudget is ready.'));
}));

test('combined setup promises a readiness check rather than claiming the app is running', async () => temporary(async path => {
  const prompts = scriptedPrompts(skipService);
  await runSetup({ path, prompts, launch: 'build', check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const output = prompts.output.join('\n');
  assert(output.includes('Setup is not finished yet'));
  assert(output.includes('build this checkout and start'));
  assert(output.includes('next steps will appear once the app is ready'));
  assert(!output.includes('BuddyBudget is ready.'));
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

async function startFixture(dir, env = {}, args = []) {
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'bin'));
  const script = join(dir, 'scripts/selfhost-start.sh');
  await writeFile(script, await readFile(new URL('../selfhost-start.sh', import.meta.url)));
  await writeFile(join(dir, '.env'), '# isolated test configuration\n');
  const docker = join(dir, 'bin/docker');
  await writeFile(docker, `#!/usr/bin/env node
import {appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2);
appendFileSync(process.env.SETUP_TEST_CALLS,JSON.stringify(args)+'\\n');
if (process.env.SETUP_TEST_FAIL && args.includes(process.env.SETUP_TEST_FAIL)) process.exit(7);
if (args.includes('exec')) {
  const result=spawnSync(process.execPath,['-e',args[args.indexOf('-e')+1]],{env:process.env,encoding:'utf8'});
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exit(result.status);
}
`);
  await chmod(docker, 0o755);
  const log = join(dir, 'calls.jsonl');
  const result = spawnSync('sh', [script, ...args], { encoding: 'utf8', env: {
    ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH, SETUP_TEST_CALLS: log,
    APP_URL: 'http://localhost:8888', RESEND_API_KEY: '', RESEND_FROM: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', ...env,
  } });
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { ...result, calls };
}

test('source startup builds first, handles the previous worker, waits for readiness and explains local sign-in', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { AUTH_PASSWORD: 'false' }, ['--build']);
  assert.equal(result.status, 0, result.stderr);
  assert(result.calls[0].includes('build'));
  assert(result.calls[1].includes('stop'));
  assert(result.calls[2].includes('--wait'));
  assert(result.calls[3].includes('exec'));
  assert(result.stdout.includes('BuddyBudget is ready.'));
  assert(result.stdout.includes('http://localhost:8888'));
  assert(result.stdout.includes('docker compose logs --since=5m app'));
  assert(result.stdout.includes('You can close this terminal'));
}));

test('published startup shows email instructions when delivery is configured', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { AUTH_PASSWORD: 'false', RESEND_API_KEY: 're_test', RESEND_FROM: 'budget@example.test' });
  assert.equal(result.status, 0, result.stderr);
  assert(!result.calls.some(args => args.includes('build')));
  assert(result.stdout.includes('Open the email and click the link'));
  assert(!result.stdout.includes('docker compose logs --since'));
  assert(!result.stdout.includes('re_test'));
}));

test('failed startup never claims readiness and provides recovery commands', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { SETUP_TEST_FAIL: 'up' });
  assert.equal(result.status, 1);
  assert(!result.stdout.includes('BuddyBudget is ready.'));
  assert(!result.calls.some(args => args.includes('exec')));
  assert(result.stderr.includes('BuddyBudget is not ready'));
  assert(result.stderr.includes('docker compose logs --tail=50 app migrate postgres'));
}));

test('failed source build leaves the previous worker untouched', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { SETUP_TEST_FAIL: 'build' }, ['--build']);
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 1);
  assert(!result.stdout.includes('BuddyBudget is ready.'));
  assert(result.stderr.includes('Build failed'));
}));

test('cancelling the wizard prevents the combined command from starting Docker', async () => temporary(async (path, dir) => {
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'bin'));
  const init = join(dir, 'scripts/selfhost-init.sh');
  await writeFile(init, await readFile(new URL('../selfhost-init.sh', import.meta.url)));
  const node = join(dir, 'bin/node');
  await writeFile(node, '#!/bin/sh\nif [ "$1" = "-e" ]; then exit 0; fi\nexit 1\n');
  await chmod(node, 0o755);
  await writeFile(path, 'unchanged configuration\n');
  const result = spawnSync('sh', [init, '--build'], { encoding: 'utf8', env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH } });
  assert.equal(result.status, 1);
  assert(!result.stdout.includes('Building BuddyBudget'));
  assert.equal(await readFile(path, 'utf8'), 'unchanged configuration\n');
}));

async function uninstallFixture(dir, { args = [], input = '', fail = false, configured = true } = {}) {
  await mkdir(join(dir, 'scripts'));
  await mkdir(join(dir, 'bin'));
  const script = join(dir, 'scripts/selfhost-uninstall.sh');
  await writeFile(script, await readFile(new URL('../selfhost-uninstall.sh', import.meta.url)));
  if (configured) await writeFile(join(dir, '.env'), 'private configuration\n');
  await writeFile(join(dir, '.env.local'), 'developer configuration\n');
  const log = join(dir, 'calls.jsonl');
  const docker = join(dir, 'bin/docker');
  await writeFile(docker, `#!/usr/bin/env node
import {appendFileSync} from 'node:fs';
appendFileSync(process.env.SETUP_TEST_CALLS, JSON.stringify(process.argv.slice(2))+'\\n');
process.exit(Number(process.env.SETUP_TEST_EXIT));
`);
  await chmod(docker, 0o755);
  const result = spawnSync('sh', [script, ...args], { encoding: 'utf8', input, env: {
    ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH,
    SETUP_TEST_CALLS: log, SETUP_TEST_EXIT: fail ? '7' : '0',
  } });
  let calls = [];
  try { calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(await readFile(join(dir, '.env.local'), 'utf8'), 'developer configuration\n');
  return { ...result, calls };
}

test('uninstall keeps database and configuration by default and includes the AI worker', async () => temporary(async (path, dir) => {
  const result = await uninstallFixture(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [['compose', '-f', 'docker-compose.yml', '--profile', 'ai', 'down', '--remove-orphans']]);
  assert.equal(await readFile(path, 'utf8'), 'private configuration\n');
  assert(result.stdout.includes('To reinstall with the same data'));
}));

test('purge needs explicit confirmation and cancellation changes nothing', async () => temporary(async (path, dir) => {
  const result = await uninstallFixture(dir, { args: ['--purge'], input: '\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 0);
  assert.equal(await readFile(path, 'utf8'), 'private configuration\n');
  assert(result.stdout.includes('Cancelled. Nothing was changed.'));
}));

for (const unattended of [false, true]) {
  test(`confirmed purge deletes only setup configuration after volume removal (unattended=${unattended})`, async () => temporary(async (path, dir) => {
    const result = await uninstallFixture(dir, { args: unattended ? ['--purge', '--yes'] : ['--purge'], input: 'DELETE\n' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.calls.length, 1);
    assert(result.calls[0].includes('--volumes'));
    await assert.rejects(readFile(path), { code: 'ENOENT' });
    assert(result.stdout.includes('To start fresh'));
  }));
}

test('failed purge retains configuration and gives retry instructions', async () => temporary(async (path, dir) => {
  const result = await uninstallFixture(dir, { args: ['--purge', '--yes'], fail: true });
  assert.equal(result.status, 1);
  assert.equal(await readFile(path, 'utf8'), 'private configuration\n');
  assert(result.stderr.includes('Your .env was kept'));
  assert(!result.stdout.includes('BuddyBudget was removed'));
}));

test('cleanup remains possible after configuration was lost', async () => temporary(async (path, dir) => {
  const result = await uninstallFixture(dir, { configured: false, args: ['--purge', '--yes'] });
  assert.equal(result.status, 0, result.stderr);
  assert(result.calls[0].includes('--volumes'));
  await assert.rejects(readFile(path), { code: 'ENOENT' });
}));

test('cleanup rejects an ambiguous unattended invocation before touching Docker', async () => temporary(async (path, dir) => {
  const result = await uninstallFixture(dir, { args: ['--yes'] });
  assert.equal(result.status, 1);
  assert.equal(result.calls.length, 0);
  assert.equal(await readFile(path, 'utf8'), 'private configuration\n');
}));

test('new personal setup defaults to automatic local access and skips authentication credentials', async () => temporary(async path => {
  const prompts = scriptedPrompts(skipService, '');
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const { values } = await readConfig(path);
  assert.equal(values.SELFHOST_AUTH_MODE, 'local');
  assert.equal(values.APP_BIND, '127.0.0.1');
  assert.equal(values.APP_URL, 'http://localhost:3000');
  assert(!prompts.questions.some(({ question }) => /Resend API|Google Client|Sign-in emails/.test(question)));
  assert(!prompts.output.join('\n').includes('2) Google sign-in'));
  assert(prompts.output.join('\n').includes('no login needed'));
}));

test('local setup cannot save a public URL or a broad network binding', async () => temporary(async path => {
  await assert.rejects(saveConfig(path, { SELFHOST_AUTH_MODE: 'local', APP_URL: 'https://budget.example.com' }));
  await assert.rejects(saveConfig(path, { SELFHOST_AUTH_MODE: 'local', APP_BIND: '0.0.0.0' }));
  assert.equal((await readConfig(path)).source, '');
  const corrected = mergeConfig({}, { SELFHOST_AUTH_MODE: 'server', APP_BIND: '0.0.0.0', APP_URL: 'https://budget.example.com' });
  assert.deepEqual(validateConfig(corrected), []);
}));

test('switching a personal installation to server mode collects an owner email and preserves secrets', async () => temporary(async path => {
  await saveConfig(path, { SELFHOST_AUTH_MODE: 'local' });
  const original = (await readConfig(path)).values;
  const prompts = scriptedPrompts(question => question.startsWith('Your account email') ? 'owner@example.com' : skipService(question));
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const { values } = await readConfig(path);
  assert.equal(values.SELFHOST_AUTH_MODE, 'server');
  assert.equal(values.SELFHOST_OWNER_EMAIL, 'owner@example.com');
  assert.equal(values.POSTGRES_PASSWORD, original.POSTGRES_PASSWORD);
  assert(prompts.output.join('\n').includes('Automatic local sessions will be closed'));
}));

test('personal startup explains automatic access without suggesting login links', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { SELFHOST_AUTH_MODE: 'local' });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes('No sign-in is needed'));
  assert(!result.stdout.includes('docker compose logs --since'));
}));

test('personal setup derives its local address from the chosen port, including after an HTTPS configuration', async () => temporary(async path => {
  await saveConfig(path, { APP_URL: 'https://localhost:3000' });
  const prompts = scriptedPrompts(question => question.startsWith('Local port') ? '8088' : skipService(question), '1');
  await runSetup({ path, prompts, check: async () => ({ status: 'ok', message: 'Checked.' }) });
  const { values } = await readConfig(path);
  assert.equal(values.APP_URL, 'http://localhost:8088');
  assert.equal(values.APP_PORT, '8088');
  assert(!prompts.questions.some(({ question }) => question.startsWith('Public URL')));
}));

test('personal email delivery needs a recipient before enabling notification jobs', () => {
  const values = mergeConfig({}, { SELFHOST_AUTH_MODE: 'local', RESEND_API_KEY: 're_test', RESEND_FROM: 'budget@example.test' });
  assert.equal(prepareConfig(values).NOTIFICATIONS_MODE, 'off');
  assert.equal(prepareConfig({ ...values, SELFHOST_OWNER_EMAIL: 'owner@example.test' }).NOTIFICATIONS_MODE, 'execute');
});


test('server startup defaults to password login without requiring an email service', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { AUTH_PASSWORD: '' });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes('Create the first account with your email and a password'));
  assert(!result.stdout.includes('docker compose logs --since'));
}));

test('moving a personal account to password login explains how to set its password', async () => temporary(async (path, dir) => {
  const result = await startFixture(dir, { SELFHOST_AUTH_MODE: 'server', AUTH_PASSWORD: '', SELFHOST_OWNER_EMAIL: 'owner@example.test' });
  assert.equal(result.status, 0, result.stderr);
  assert(result.stdout.includes('auth:reset-password <your-email>'));
}));

test('rerunning setup preserves SMTP delivery and enables its notification jobs', () => {
  const configured = prepareConfig(mergeConfig({}, { APP_URL: 'http://localhost:3000' }));
  const smtp = prepareConfig({ ...configured, SMTP_URL: 'smtp://mail:25', EMAIL_FROM: 'budget@example.test', SELFHOST_AUTH_MODE: 'server' });
  assert.equal(smtp.NOTIFICATIONS_MODE, 'execute');
  assert(readiness(smtp).find(service => service.id === 'resend').configured);
});
