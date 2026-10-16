/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test tooling. */
/** Creates and removes an isolated local database; needs local Postgres/Redis, Playwright and real OpenRouter credentials. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
require('dotenv').config({ path: '.env.local', quiet: true });
const postgres = require('postgres');
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== '127.0.0.1') throw Error('Local Postgres required');
  const admin = postgres(url.toString());
  const database = 'buddy_e2e_' + Date.now();
  const logs = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-import-e2e-'));
  const children = [];
  let sql;
  try {
    await admin.unsafe(`create database "${database}"`);
    url.pathname = '/' + database;
    const env = { ...process.env, DATABASE_URL: url.toString(), APP_URL: 'http://localhost:3317', BETTER_AUTH_URL: 'http://localhost:3317', BETTER_AUTH_SECRET: crypto.randomBytes(32).toString('hex'), PERSONAL_CSV_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'), RESEND_API_KEY: 'e2e-captured', RESEND_FROM: 'test@example.test', SUPPORT_EMAIL_TO: 'support@buddybudget.io', IMPORT_E2E_MAIL_LOG: path.join(logs, 'mail.jsonl') };
    fs.writeFileSync(env.IMPORT_E2E_MAIL_LOG, '');
    const migration = spawnSync(process.execPath, ['--import', 'tsx', 'lib/db/migrate.ts'], { env, stdio: 'inherit' });
    if (migration.status) throw Error('Migration failed');
    sql = postgres(env.DATABASE_URL);
    const legalVersion = fs.readFileSync('lib/legal/version.ts', 'utf8').match(/LEGAL_VERSION = "([^"]+)"/)[1];
    for (const id of ['e2e-personal', 'e2e-broker']) {
      await sql`insert into auth_user(id,name,email,onboarding_completed,legal_accepted_version) values(${id},'E2E Synthetic',${id + '@example.test'},true,${legalVersion})`;
      await sql`insert into auth_session(id,user_id,token,expires_at) values(${id},${id},${id + '-token'},now()+interval '1 day')`;
    }
    const [format] = await sql`insert into personal_formats(user_id,name) values('e2e-personal','Synthetic Bank') returning id`;
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(env.PERSONAL_CSV_ENCRYPTION_KEY, 'base64'), iv);
    cipher.setAAD(Buffer.from('e2e-personal'));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ kind: 'javascript', code: 'function(){throw Error("synthetic outdated parser")}' })), cipher.final()]);
    const sealed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
    await sql`insert into personal_parsers(format_id,signature,encrypted_parser,model) values(${format.id},'raw-csv-v1',${sealed},'e2e-broken-parser')`;
    for (const [label, args] of [['server', ['node_modules/next/dist/bin/next', 'dev', '-p', '3317']], ['worker', ['--require', path.resolve('scripts/e2e/capture-mail.cjs'), '--import', 'tsx', '--conditions=react-server', 'scripts/personal-csv-worker.ts']]]) {
      const fd = fs.openSync(path.join(logs, label + '.log'), 'w');
      const child = spawn(process.execPath, args, { env, stdio: ['ignore', fd, fd] });
      fs.closeSync(fd); children.push(child);
    }
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { ready = (await fetch(env.APP_URL + '/api/health')).ok; } catch { /* Startup still in progress. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw Error('Server did not start');
    const browser = spawnSync(process.execPath, ['scripts/e2e/import-fallback.cjs'], { env, stdio: 'inherit' });
    if (browser.status) throw Error('Browser verification failed; see ' + logs);
    console.log('Evidence: docs/evidence/import-fallback; local logs: ' + logs);
  } finally {
    for (const child of children) child.kill('SIGTERM');
    if (sql) await sql.end();
    await admin.unsafe(`drop database if exists "${database}" with (force)`);
    await admin.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
