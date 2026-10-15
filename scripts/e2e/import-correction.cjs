/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser verification. */
/** Real browser/API/worker/AI/database correction flow; synthetic data only. */
const fs = require('node:fs');
const { createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sql = require('postgres')(process.env.DATABASE_URL);
const origin = process.env.APP_URL;
if (new URL(origin).hostname !== 'localhost' || !new URL(process.env.DATABASE_URL).pathname.startsWith('/buddy_e2e_')) throw Error('Isolated local E2E environment required');
const out = 'docs/evidence/import-correction';
const csv = 'Institution: Synthetic Bank\nDate,Amount,Currency,Description\n2026-10-01,1000.00,EUR,Synthetic deposit\n2026-10-02,-12.50,EUR,Synthetic purchase';
async function completed(id, status) {
  for (let i = 0; i < 100; i++) {
    const [job] = await sql`select status,error from personal_import_jobs where id=${id}`;
    if (['failed','review_failed'].includes(job.status)) throw Error(JSON.stringify(job));
    if (job.status === status) return;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw Error('Timed out waiting for ' + status);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const token = 'e2e-personal-token';
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET).update(token).digest('base64');
    await page.context().addCookies([{ name: 'better-auth.session_token', value: encodeURIComponent(token + '.' + signature), domain: 'localhost', path: '/' }]);
    await page.goto(origin + '/importazioni');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Synthetic Bank', exact: true }).click();
    await page.getByRole('button', { name: 'Continua', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Continua', exact: true }).click();
    await page.getByRole('checkbox').check();
    let response = page.waitForResponse(r => r.url().endsWith('/api/personal-imports') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Importa il file', exact: true }).click();
    let r = await response; assert.equal(r.status(),202,await r.text());
    const original = (await r.json()).id;
    await completed(original,'imported');
    const [before] = await sql`select balance from accounts where user_id='e2e-personal'`;
    assert.equal(Number(before.balance),888.75);
    await page.goto(origin + '/importazioni?job=' + original);
    await page.getByRole('button', {name:'Il risultato è sbagliato',exact:true}).click();
    const panel = page.getByRole('region', {name:'Correggi importazione'});
    await panel.getByLabel('Che cosa è sbagliato?').fill('Gli importi sono ridotti del 10%. Usa esattamente la colonna Amount, senza sconti o conversioni.');
    await panel.locator('input[type=file]').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await panel.getByRole('checkbox').check();
    await page.screenshot({path:out+'/report.png',fullPage:true});
    response = page.waitForResponse(r => r.url().endsWith('/api/personal-imports') && r.request().method() === 'POST');
    await panel.getByRole('button',{name:'Analizza la correzione',exact:true}).click();
    r = await response; assert.equal(r.status(),202,await r.text());
    const candidate = (await r.json()).id;
    await completed(candidate,'correction_ready');
    const [unchanged] = await sql`select balance from accounts where user_id='e2e-personal'`;
    assert.equal(Number(unchanged.balance),888.75);
    const [parserCount] = await sql`select count(*)::int as n from personal_parsers`;
    assert.equal(parserCount.n,1);
    await page.goto(origin + '/importazioni?job=' + candidate);
    await panel.getByText('987,50', {exact:false}).waitFor();
    assert.equal(await panel.getByRole('button',{name:'Conferma e sostituisci'}).isEnabled(),false);
    await page.screenshot({path:out+'/comparison.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:out+'/comparison-mobile.png',fullPage:true});
    await panel.getByRole('checkbox').check();
    response = page.waitForResponse(r=>r.url().endsWith('/api/personal-imports/'+candidate)&&r.request().method()==='POST');
    await panel.getByRole('button',{name:'Conferma e sostituisci'}).click();
    r=await response; assert.equal(r.status(),200,await r.text());
    await page.getByRole('heading',{name:'Importazione completata'}).waitFor();
    const [after] = await sql`select balance from accounts where user_id='e2e-personal'`;
    assert.equal(Number(after.balance),987.5);
    const [counts] = await sql`select count(*)::int as n from transactions where user_id='e2e-personal'`;
    assert.equal(counts.n,2);
    const [job] = await sql`select status,encrypted_preview,encrypted_csv,encrypted_correction_feedback from personal_import_jobs where id=${candidate}`;
    assert.equal(job.status,'imported'); assert.equal(job.encrypted_preview,null); assert.equal(job.encrypted_csv,null); assert.equal(job.encrypted_correction_feedback,null);
    await page.screenshot({path:out+'/replaced.png',fullPage:true});
    fs.writeFileSync(out+'/result.json',JSON.stringify({testedAt:new Date().toISOString(),ai:'Real OpenRouter request; synthetic CSV and feedback',email:'Intercepted locally; no real delivery',balanceBefore:888.75,balanceBeforeConfirmation:Number(unchanged.balance),balanceAfter:Number(after.balance),movements:counts.n,reusableParsersBeforeConfirmation:parserCount.n,explicitConfirmation:true,mobileOverflow:false,rawPayloadsDeleted:true},null,2));
    console.log('PASS: browser upload, feedback, real AI, comparison, explicit replacement, balance and payload cleanup');
  } finally { await browser.close(); await sql.end(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
