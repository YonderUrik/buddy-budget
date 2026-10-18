import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { SECTIONS } from './catalog.mjs';
import { readConfig, mergeConfig, validateConfig, saveConfig, readiness } from './config.mjs';
import { checkService } from './checks.mjs';

/** Domande da terminale con input dei segreti nascosto, senza argomenti di processo o history. */
export function terminalPrompts(input = process.stdin, output = process.stdout) {
  let hidden = false;
  const sink = new Writable({ write(chunk, encoding, done) { if (!hidden) output.write(chunk, encoding); done(); } });
  sink.isTTY = true;
  sink.columns = output.columns || 80;
  const rl = createInterface({ input, output: sink, terminal: true, historySize: 0 });
  return {
    async ask(prompt, secret = false) {
      output.write(prompt);
      hidden = secret;
      try { return await rl.question(''); }
      finally { if (secret) output.write('\n'); hidden = false; }
    },
    write(message) { output.write(`${message}\n`); },
    close() { rl.close(); },
  };
}

/** Percorso guidato riutilizzabile: leggere le chiavi non le invia finché non si sceglie la verifica. */
export async function runSetup({ path, template = '', prompts, check = checkService }) {
  const current = await readConfig(path);
  let values = mergeConfig(current.values, {});
  const patch = {}, checks = {};
  const set = (name, value) => { patch[name] = value; values = mergeConfig(current.values, patch); };
  const yes = async (question, defaultYes = true) => {
    while (true) {
      const answer = (await prompts.ask(`${question} ${defaultYes ? '[S/n]' : '[s/N]'} `)).trim().toLowerCase();
      if (!answer) return defaultYes;
      if (['s', 'si', 'sì', 'y', 'yes'].includes(answer)) return true;
      if (['n', 'no'].includes(answer)) return false;
      prompts.write('Rispondi s oppure n.');
    }
  };
  prompts.write('\nBuddyBudget — configurazione guidata\n');
  prompts.write('Le chiavi restano nel file .env. Invio conserva un valore già salvato; - lo rimuove.');
  prompts.write('Le chiavi API non vengono mostrate mentre le scrivi. Ctrl+C annulla senza salvare.\n');
  if (current.source) prompts.write('Installazione esistente: password del database e chiavi di cifratura saranno conservate.\n');

  for (const section of SECTIONS) {
    prompts.write(`\n${section.title} — ${section.level}\n${section.description}`);
    if (section.link) prompts.write(`${section.linkLabel}: ${section.link}`);
    if (section.id === 'yahoo') {
      if (await yes('Verificare Yahoo da questa macchina?')) {
        checks.yahoo = await check('yahoo', values);
        prompts.write(checks.yahoo.message);
      }
      continue;
    }
    if (section.id !== 'address') {
      const configured = section.fields.some(field => !field.default && values[field.name]);
      const use = await yes(`Configurare ${section.title}?`, configured || section.id === 'openrouter' || section.id === 'resend');
      if (!use) {
        if (configured && !await yes('Conservare la configurazione esistente?')) {
          for (const field of section.fields.filter(field => !field.default)) set(field.name, null);
        }
        continue;
      }
    }
    let sectionErrors;
    do {
      for (const field of section.fields) {
        if (field.help) prompts.write(field.help);
        if (field.link) prompts.write(`Ottieni la chiave: ${field.link}`);
        const previous = values[field.name] || '';
        const hint = previous ? field.secret ? ' [già salvata]' : ` [${previous}]` : ' [facoltativo]';
        while (true) {
          const answer = (await prompts.ask(`${field.label}${hint}: `, field.secret)).trim();
          if (!answer) break;
          try { set(field.name, answer === '-' ? null : answer); break; }
          catch { prompts.write('Valore non valido: non usare a capo, apostrofi o barre inverse. Riprova.'); }
        }
      }
      sectionErrors = validateConfig(values, section.fields.map(field => field.name));
      if (sectionErrors.length) {
        prompts.write(sectionErrors.join('\n'));
        if (!await yes('Correggere questi campi?')) { prompts.write('Annullato: nessuna modifica al file .env.'); return false; }
      }
    } while (sectionErrors.length);
    if (section.check && await yes('Verificare ora? Nessuna generazione AI o email verrà inviata.')) {
      checks[section.id] = await check(section.id, values);
      prompts.write(checks[section.id].message);
    }
  }

  const errors = validateConfig(values);
  if (errors.length) {
    prompts.write(`\nConfigurazione non salvata:\n${errors.join('\n')}\nRilancia l’installer per correggerla.`);
    return false;
  }
  prompts.write('\nRiepilogo:');
  // Il riepilogo usa solo nomi di funzioni e disponibilità, mai i valori delle chiavi.
  for (const item of readiness(values)) {
    prompts.write(`  ${item.configured ? 'Configurato' : 'Non configurato'}: ${item.label}`);
    if (checks[item.id]) prompts.write(`    ${checks[item.id].message}`);
    else if (['yahoo', 'openrouter', 'resend'].includes(item.id) && item.configured) prompts.write('    Non verificato con il fornitore.');
  }
  prompts.write('\nConfigurato non significa già provato: modelli AI, consegna email e collegamento bancario si confermano al primo utilizzo.');
  if (!await yes('Salvare la configurazione?')) { prompts.write('Annullato: nessuna modifica al file .env.'); return false; }
  await saveConfig(path, patch, current.source ? '' : template);
  prompts.write('\nConfigurazione salvata in .env (permessi privati). Conservane una copia insieme ai backup.');
  prompts.write('La chiave dei CSV personali è generata automaticamente con OpenRouter: non perderla né cambiarla.');
  if (!values.OPENROUTER_API_KEY) prompts.write('\nAI disattivata: ferma il worker eventualmente rimasto da una configurazione precedente:\n  docker compose --profile ai stop csv-worker');
  prompts.write('\nAvvia o aggiorna l’installazione:\n  docker compose up -d --remove-orphans');
  prompts.write('\nPer provare questa versione dal sorgente:\n  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build --remove-orphans');
  prompts.write(`\nApri ${values.APP_URL.replace(/\/+$/, '')}`);
  if (!values.RESEND_API_KEY || !values.RESEND_FROM) prompts.write('Senza email, richiedi il link nel login e leggilo con: docker compose logs app');
  prompts.write('\nIn Impostazioni ogni persona sceglie il consenso AI e le email da ricevere.');
  prompts.write('Per cambiare servizi e chiavi, rilancia ./scripts/selfhost-init.sh e poi aggiorna i container.');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.stdin.isTTY) { process.stderr.write('Serve un terminale interattivo. Per un file minimo usa ./scripts/selfhost-init.sh --defaults\n'); process.exitCode = 1; }
  else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const prompts = terminalPrompts();
    try {
      const template = await readFile(resolve(root, '.env.selfhost.example'), 'utf8');
      if (!await runSetup({ path: resolve(root, '.env'), template, prompts })) process.exitCode = 1;
    } catch { prompts.write('\nConfigurazione interrotta o non salvata. Controlla i permessi di .env e riprova.'); process.exitCode = 1; }
    finally { prompts.close(); }
  }
}
