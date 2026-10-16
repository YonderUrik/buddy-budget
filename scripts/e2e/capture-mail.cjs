/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS test tooling. */
// Test-only preload: capture Resend deliveries while retaining real AI requests.
const fs = require('node:fs');
if (!process.env.IMPORT_E2E_MAIL_LOG) throw Error('Missing E2E mail log');
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  if (url.startsWith('https://api.resend.com/')) {
    fs.appendFileSync(process.env.IMPORT_E2E_MAIL_LOG, JSON.stringify({ body: JSON.parse(init.body), headers: Object.fromEntries(new Headers(init.headers)) }).replace(/"authorization":"[^"]*"/g, '"authorization":"redacted"') + '\n');
    return Response.json({ id: 'e2e-captured-delivery' });
  }
  return original(input, init);
};
