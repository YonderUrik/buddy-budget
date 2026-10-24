/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test tooling. */
/** Browser-to-database proof. Run against the isolated fixture prepared in the verification guide. */
const fs = require('node:fs');
const { createHmac, createDecipheriv } = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sql = require('postgres')(process.env.DATABASE_URL);
const origin = process.env.APP_URL;
if (new URL(origin).hostname !== 'localhost' || !new URL(process.env.DATABASE_URL).pathname.startsWith('/buddy_e2e_')) throw Error('Isolated local E2E environment required');
const out = 'docs/evidence/import-fallback';
const csv = 'Institution: Synthetic Bank\nDate,Amount,Currency,Description\n2026-10-01,1000.00,EUR,Synthetic deposit\n2026-10-02,-12.50,EUR,Synthetic purchase';
async function pageFor(browser, user) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const token = user + '-token';
  const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64');
  await page.context().addCookies([{ name: 'better-auth.session_token', value: encodeURIComponent(token + '.' + signature), domain: 'localhost', path: '/' }]);
  return page;
}
async function uploaded(page, action) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/personal-imports') && r.request().method() === 'POST');
  await action();
  const r = await response; assert.equal(r.status(), 202, await r.text());
  return (await r.json()).id;
}
async function completed(id) {
  for (let i = 0; i < 100; i++) {
    const [job] = await sql`select status,error,failure_report,encrypted_csv,encrypted_preview,support_notified_at from personal_import_jobs where id=${id}`;
    if (['failed','review_failed'].includes(job.status)) throw Error(JSON.stringify(job));
    if (job.status === 'imported' && job.support_notified_at) return job;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw Error('Import did not complete within five minutes');
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const personal = await pageFor(browser, 'e2e-personal');
    await personal.goto(origin + '/importazioni');
    await personal.getByRole('combobox').click();
    await personal.getByRole('option', { name: 'Synthetic Bank', exact: true }).click();
    await personal.getByRole('button', { name: 'Continua', exact: true }).click();
    await personal.locator('input[type=file]').setInputFiles({ name: 'synthetic-personal.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await personal.getByRole('button', { name: 'Continua', exact: true }).click();
    await personal.getByRole('checkbox').check();
    const personalId = await uploaded(personal, () => personal.getByRole('button', { name: 'Importa il file', exact: true }).click());
    console.log('Personal upload accepted:', personalId);
    const p = await completed(personalId);
    assert.equal(p.failure_report.reason, 'invalid_saved_parser');
    await personal.goto(origin + '/importazioni?job=' + personalId);
    await personal.getByText('Importato', { exact: true }).first().waitFor({ timeout: 30000 });
    await personal.screenshot({ path: out + '/personal-imported.png', fullPage: true });
    console.log('Personal fallback imported, support delivery captured');
    const broker = await pageFor(browser, 'e2e-broker');
    // The broker statement form opens from the app-wide «Aggiungi» link.
    await broker.goto(origin + '/investimenti/operazioni?aggiungi=rendiconto');
    await broker.getByRole('checkbox').check();
    const brokerId = await uploaded(broker, () => broker.locator('input[type=file]').setInputFiles({ name: 'synthetic-broker.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }));
    await broker.getByText("La lettura standard non è riuscita.", { exact: false }).waitFor();
    await broker.screenshot({ path: out + '/broker-fallback-started.png', fullPage: true });
    const b = await completed(brokerId);
    assert.equal(b.failure_report.reason, 'broker_parse_failed');
    await broker.goto(origin + '/importazioni?job=' + brokerId);
    await broker.getByText('Importato', { exact: true }).first().waitFor();
    await broker.screenshot({ path: out + '/broker-imported.png', fullPage: true });
    const rows = await sql`select user_id, count(*)::int as count, sum(amount)::text as total from transactions where user_id in ('e2e-personal','e2e-broker') group by user_id order by user_id`;
    assert.equal(rows.length, 2);
    for (const row of rows) { assert.equal(row.count, 2); assert.equal(Number(row.total), 987.5); }
    const profiles = await sql`select user_id,engine,metadata,observations from import_format_profiles order by user_id`;
    assert.equal(profiles.length, 2);
    for (const profile of profiles) {
      let text = profile.metadata;
      if (text.startsWith('enc:v1:')) {
        const data = Buffer.from(text.slice(7), 'base64');
        const decipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'base64'), data.subarray(0,12));
        decipher.setAuthTag(data.subarray(12,28));
        text = Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString();
      }
      profile.metadata = JSON.parse(text);
      assert.equal(profile.metadata.institution.name, 'Synthetic Bank');
      assert.equal(profile.metadata.institution.evidence, 'document');
      assert.ok(profile.metadata.parsedFields.includes('amount'));
      assert.ok(profile.metadata.columns.some(c => c.name === 'Amount' && c.mapsTo.includes('amount')));
      assert.ok(!text.includes('Synthetic purchase'));
    }
    const mails = fs.readFileSync(process.env.IMPORT_E2E_MAIL_LOG, 'utf8').trim().split('\n').map(JSON.parse);
    const reports = mails.filter(m => m.body.subject.startsWith('Importazione: report'));
    assert.equal(reports.length, 2);
    for (const report of reports) { assert.equal(report.body.to, 'support@buddybudget.io'); assert.ok(!JSON.stringify(report.body).includes('Synthetic purchase')); }
    for (const job of [p,b]) { assert.equal(job.encrypted_csv, null); assert.equal(job.encrypted_preview, null); assert.equal(job.failure_report.fallback, true); }
    const proof = { testedAt: new Date().toISOString(), ai: 'real OpenRouter request', email: 'Resend intercepted locally; no real delivery', personalId, brokerId, personal: p, broker: b, transactions: rows, profiles, supportReports: reports };
    fs.writeFileSync(out + '/result.json', JSON.stringify(proof, null, 2));
    console.log('PASS: both browser flows, real AI, database writes, raw payload cleanup, two support reports');
  } finally { await browser.close(); await sql.end(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
