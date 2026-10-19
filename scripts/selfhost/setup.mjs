import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { SECTIONS } from './catalog.mjs';
import { readConfig, mergeConfig, validateConfig, saveConfig, readiness } from './config.mjs';
import { checkService } from './checks.mjs';

/** Read visible questions through readline; suppress echo only while entering secrets. */
export function terminalPrompts(input = process.stdin, output = process.stdout) {
  let hidden = false;
  const sink = new Writable({ write(chunk, encoding, done) { if (!hidden) output.write(chunk, encoding); done(); } });
  sink.isTTY = true;
  sink.columns = output.columns || 80;
  const rl = createInterface({ input, output: sink, terminal: true, historySize: 0 });
  return {
    async ask(prompt, secret = false) {
      // An empty readline prompt erases text written directly to the terminal.
      if (!secret) return rl.question(prompt);
      output.write(prompt);
      hidden = true;
      try { return await rl.question(''); }
      finally { output.write('\n'); hidden = false; }
    },
    write(message) { output.write(`${message}\n`); },
    close() { rl.close(); },
  };
}

/** Guided setup with explicit add/skip/keep choices and no partial service credentials. */
export async function runSetup({ path, template = '', prompts, check = checkService }) {
  const current = await readConfig(path);
  let values = mergeConfig(current.values, {});
  const patch = {}, checks = {};
  const set = (name, value) => { patch[name] = value; values = mergeConfig(current.values, patch); };
  const restore = snapshot => {
    for (const name of Object.keys(patch)) delete patch[name];
    Object.assign(patch, snapshot);
    values = mergeConfig(current.values, patch);
  };
  const yes = async (question, defaultYes = true) => {
    while (true) {
      const answer = (await prompts.ask(`${question} ${defaultYes ? '[Y/n]' : '[y/N]'}: `)).trim().toLowerCase();
      if (!answer) return defaultYes;
      if (['y', 'yes'].includes(answer)) return true;
      if (['n', 'no'].includes(answer)) return false;
      prompts.write('Please enter y or n, or press Enter for the shown default.');
    }
  };
  const choice = async (question, options, fallback) => {
    for (const [number, label] of Object.entries(options)) prompts.write(`  ${number}) ${label}`);
    while (true) {
      const answer = (await prompts.ask(`${question} [${fallback}]: `)).trim() || fallback;
      if (Object.hasOwn(options, answer)) return answer;
      prompts.write(`Choose ${Object.keys(options).join(', ')} or press Enter for ${fallback}.`);
    }
  };
  const heading = (step, title) => prompts.write(`\n── Step ${step} of 6: ${title} ──`);
  const readField = async field => {
    if (field.help) prompts.write(field.help);
    if (field.link) prompts.write(`Get this key: ${field.link}`);
    const previous = values[field.name] || '';
    const hint = previous
      ? field.secret ? 'saved; Enter keeps it' : `Enter uses ${previous}`
      : field.required ? 'Enter skips this service' : 'optional; Enter skips this field';
    while (true) {
      const answer = (await prompts.ask(`${field.label}${field.secret ? ' (input hidden)' : ''} [${hint}]: `, field.secret)).trim();
      if (!answer) return Boolean(previous) || !field.required;
      if (answer === '-' && !field.required) { set(field.name, null); return true; }
      try { set(field.name, answer); return true; }
      catch { prompts.write('Use one line without apostrophes or backslashes. Please try again.'); }
    }
  };
  const configure = async section => {
    prompts.write(`\n${section.title} — ${section.level}\n${section.description}`);
    if (section.needed) prompts.write(`What you need: ${section.needed}`);
    const existing = section.fields.some(field => !field.default && values[field.name]);
    const action = await choice(`${section.title}: choose an option`, existing
      ? { 1: 'Keep existing settings', 2: 'Edit settings', 3: 'Disable this service' }
      : { 1: 'Set up this service now', 2: 'Skip for now' }, '1');
    if (existing && action === '1') { prompts.write('Keeping your existing settings.'); return; }
    if ((existing && action === '3') || (!existing && action === '2')) {
      if (existing) for (const field of section.fields.filter(field => !field.default)) set(field.name, null);
      prompts.write(`${existing ? 'Disabled' : 'Skipped'}. ${section.skip || 'You can configure this later by rerunning setup.'}`);
      return;
    }
    if (section.requiresEmail && !(values.RESEND_API_KEY && values.RESEND_FROM)) {
      prompts.write('Skipped: configure email delivery first. You can add a reports inbox when you rerun setup.');
      return;
    }
    if (section.link) prompts.write(`${section.linkLabel}: ${section.link}`);
    if (section.id === 'google') prompts.write(`Register this exact redirect URI in Google Cloud: ${values.APP_URL.replace(/\/+$/, '')}/api/auth/callback/google`);
    const snapshot = { ...patch };
    while (true) {
      for (const field of section.fields.filter(field => !field.advanced)) {
        if (!await readField(field)) {
          restore(snapshot);
          prompts.write(`Skipped ${section.title}: no partial credentials saved.${existing ? ' Your previous settings are unchanged.' : ''}`);
          return;
        }
      }
      const advanced = section.fields.filter(field => field.advanced);
      if (advanced.length) {
        prompts.write(existing ? 'Your saved AI model settings will be kept.' : 'Recommended AI models are selected for you.');
        if (await yes('Customize AI models? (Optional)', false)) for (const field of advanced) await readField(field);
      }
      const errors = validateConfig(values, section.fields.map(field => field.name));
      if (!errors.length) break;
      prompts.write(errors.join('\n'));
      if (!await yes('Correct this service now?')) { restore(snapshot); prompts.write(`Skipped ${section.title}; previous settings are unchanged.`); return; }
    }
    if (section.check && await yes(`Check ${section.id === 'openrouter' ? 'OpenRouter' : 'Resend'} credentials now? (No paid AI calls or test emails)`)) {
      prompts.write('Checking…');
      checks[section.id] = await check(section.id, values);
      prompts.write(checks[section.id].message);
      if (checks[section.id].status === 'error' && !await yes('Keep these unverified credentials anyway?', false)) {
        restore(snapshot); delete checks[section.id];
        prompts.write('Credentials not saved. You can rerun setup with a new key.');
      }
    }
    if (section.id === 'google' || section.id === 'gocardless') prompts.write('Credentials entered. Complete a sign-in or bank connection in the app to verify them.');
  };

  prompts.write('\nBuddyBudget — self-host setup\n');
  prompts.write('We will set up your address, AI, prices and email. Other integrations are optional.');
  prompts.write('Nothing is saved until you confirm the final summary. Ctrl+C cancels.');
  prompts.write('API keys are hidden while you type. Enter keeps a saved value or uses the suggested default.');
  if (current.source) prompts.write('Existing installation found. Database passwords and encryption keys will be preserved.');

  heading(1, 'Your address');
  const address = SECTIONS.find(section => section.id === 'address');
  prompts.write(address.description);
  for (const field of address.fields) {
    if (field.name === 'APP_PORT' && !current.values.APP_PORT) {
      try { const url = new URL(values.APP_URL); if (['localhost', '127.0.0.1'].includes(url.hostname) && url.port) set('APP_PORT', url.port); } catch { /* URL validation below. */ }
    }
    do {
      await readField(field);
      const errors = validateConfig(values, [field.name]);
      if (!errors.length) break;
      prompts.write(errors.join('\n'));
    } while (true);
  }
  heading(2, 'AI features');
  await configure(SECTIONS.find(section => section.id === 'openrouter'));
  heading(3, 'Market prices — no key needed');
  prompts.write('Yahoo Finance and other public sources are already included. There is nothing to enter here.');
  if (await yes('Check Yahoo connectivity now?')) {
    prompts.write('Checking prices…'); checks.yahoo = await check('yahoo', values); prompts.write(checks.yahoo.message);
  }
  heading(4, 'Sign-in emails and notifications');
  await configure(SECTIONS.find(section => section.id === 'resend'));
  heading(5, 'Optional integrations');
  const extras = SECTIONS.filter(section => !['address', 'openrouter', 'yahoo', 'resend'].includes(section.id));
  prompts.write('Choose only the services you want to configure. Press Enter to skip all; existing settings stay unchanged.');
  for (const [index, section] of extras.entries()) {
    const existing = section.fields.some(field => !field.default && values[field.name]);
    prompts.write(`  ${index + 1}) ${section.title}${existing ? ' (already configured)' : ''}`);
  }
  while (true) {
    const answer = (await prompts.ask('Optional services [Enter skips all; e.g. 1,2]: ')).trim();
    if (!answer) { prompts.write('Optional integrations skipped. You can add them later.'); break; }
    const selected = answer.split(',').map(value => value.trim());
    if (!selected.every(value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= extras.length)) { prompts.write('Enter service numbers separated by commas, or press Enter to skip all.'); continue; }
    for (const index of new Set(selected)) await configure(extras[Number(index) - 1]);
    break;
  }

  const errors = validateConfig(values);
  if (errors.length) { prompts.write(`\nNot saved:\n${errors.join('\n')}\nRun setup again to correct these settings.`); return false; }
  heading(6, 'Review and save');
  prompts.write(`Public URL: ${values.APP_URL}\nLocal port: ${values.APP_PORT}`);
  for (const item of readiness(values)) {
    const result = checks[item.id];
    const status = !item.configured ? 'Off' : ['core', 'yahoo'].includes(item.id) ? 'Included' : 'Configured';
    prompts.write(`  [${status}] ${item.label}`);
    if (result) prompts.write(`    ${result.message}`);
  }
  prompts.write('\nConfigured means credentials are present. Paid AI requests, email delivery and bank/Google connections are confirmed when you use them in the app.');
  if (!await yes('Save these settings to .env?')) { prompts.write('Cancelled. Your .env file has not changed.'); return false; }
  await saveConfig(path, patch, current.source ? '' : template);
  prompts.write('\nSaved to .env with private permissions. Keep a backup of this file, including its encryption keys.');
  if (!values.OPENROUTER_API_KEY && current.values.OPENROUTER_API_KEY) prompts.write('\nAI disabled. First stop the previous worker:\n  docker compose --profile ai stop csv-worker');
  prompts.write('\nNext: start or update BuddyBudget:\n  docker compose up -d --remove-orphans');
  prompts.write('\nTesting unreleased changes from this checkout? Build from source instead:\n  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build --remove-orphans');
  prompts.write(`\nThen open ${values.APP_URL.replace(/\/+$/, '')}`);
  if (!values.RESEND_API_KEY || !values.RESEND_FROM) prompts.write('To sign in without email: request a link on the login page, then find it with:\n  docker compose logs app');
  prompts.write('Each person can enable AI suggestions and email notifications in Settings.');
  prompts.write('To change services later, rerun ./scripts/selfhost-init.sh and restart the containers.');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdin.isTTY) { process.stderr.write('An interactive terminal is required. For a minimal unattended setup, run ./scripts/selfhost-init.sh --defaults\n'); process.exitCode = 1; }
  else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const prompts = terminalPrompts();
    try {
      const template = await readFile(resolve(root, '.env.selfhost.example'), 'utf8');
      if (!await runSetup({ path: resolve(root, '.env'), template, prompts })) process.exitCode = 1;
    } catch { prompts.write('\nSetup interrupted or not saved. Check the .env file permissions and try again.'); process.exitCode = 1; }
    finally { prompts.close(); }
  }
}
