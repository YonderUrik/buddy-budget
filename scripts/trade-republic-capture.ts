/**
 * Capture the raw Trade Republic data the importer reads, to debug the parsers locally without a server round trip.
 *
 * Signs in like the app (phone, PIN, approval in the Trade Republic app or authenticator code), then saves to a JSON
 * file: cash, both timelines (English and German), the detail of every item that has one, and current positions.
 * Read-only: no order or transfer topic is used. Phone, PIN and codes are typed in this terminal, never stored, and
 * the session cookies are not written to the file. The file holds personal financial data: keep it outside the repo
 * and delete it when done.
 *
 *   pnpm exec tsx scripts/trade-republic-capture.ts /path/outside/the/repo/trade-republic-capture.json
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createTradeRepublicClient, type TradeRepublicSession } from "@/lib/trade-republic/client";
import { openTradeRepublicReader, type TradeRepublicReader, type TradeRepublicTopic } from "@/lib/trade-republic/socket";

const APPROVAL_TIMEOUT_MS = 180_000;
const POLL_MS = 2500;
const MAX_PAGES = 200;

/** Ask on the terminal; `hidden` stops the typed characters from being echoed (PIN, codes). */
function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(answer.trim()); }));
}

async function signIn(): Promise<TradeRepublicSession> {
  const session: TradeRepublicSession = { cookies: {}, deviceId: randomUUID() };
  const client = createTradeRepublicClient(session);
  const phone = (await ask("Trade Republic phone (international, e.g. +39…): ")).replace(/\s/g, "");
  const pin = await ask("PIN (hidden): ", true);
  await client.login(phone, pin);
  console.log("Approve the sign-in in the Trade Republic app…");
  const deadline = Date.now() + APPROVAL_TIMEOUT_MS;
  for (;;) {
    const state = await client.loginState();
    if (state.needsAuthenticator) { await client.verifyAuthenticator(await ask("Authenticator code (hidden): ", true)); continue; }
    if (state.status === "confirmed") break;
    if (Date.now() > deadline) throw new Error("Approval timed out");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  await client.refresh();
  return session;
}

async function readPages(reader: TradeRepublicReader, topic: TradeRepublicTopic): Promise<unknown[]> {
  const pages: unknown[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const raw = await reader.read(topic, after ? { after } : undefined) as { cursors?: { after?: string | null } };
    pages.push(raw);
    process.stdout.write(`\r${topic}: ${pages.length} pages`);
    after = raw?.cursors?.after ?? undefined;
    if (!after) break;
  }
  process.stdout.write("\n");
  return pages;
}

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: pnpm exec tsx scripts/trade-republic-capture.ts <output.json>");
  const session = await signIn();
  const account = await createTradeRepublicClient(session).account() as { securitiesAccountNumber?: string } | null;

  const english = await openTradeRepublicReader(session, "en");
  const cash = await english.read("cash");
  const enTransactions = await readPages(english, "timelineTransactions");
  english.close();

  const german = await openTradeRepublicReader(session, "de");
  const deTransactions = await readPages(german, "timelineTransactions");
  const deActivity = await readPages(german, "timelineActivityLog");
  // Details exactly where pytr requests them: items whose action points at their own detail.
  const items = [...deTransactions, ...deActivity].flatMap((page) => (page as { items?: { id: string; action?: { type?: string; payload?: unknown } | null }[] }).items ?? []);
  const details: Record<string, unknown> = {};
  const withDetail = items.filter((item) => item.action?.type === "timelineDetail" && item.action.payload === item.id);
  for (const [index, item] of withDetail.entries()) {
    if (details[item.id] !== undefined) continue;
    try { details[item.id] = await german.read("timelineDetailV2", { id: item.id }); }
    catch (error) { details[item.id] = { captureError: error instanceof Error ? error.message : String(error) }; }
    process.stdout.write(`\rdetails: ${index + 1}/${withDetail.length}`);
  }
  process.stdout.write("\n");
  let positions: unknown = null;
  if (account?.securitiesAccountNumber) {
    try { positions = await german.read("compactPortfolioByType", { secAccNo: account.securitiesAccountNumber }); }
    catch (error) { positions = { captureError: error instanceof Error ? error.message : String(error) }; }
  }
  german.close();

  writeFileSync(output, JSON.stringify({ capturedAt: new Date().toISOString(), cash, en: { timelineTransactions: enTransactions }, de: { timelineTransactions: deTransactions, timelineActivityLog: deActivity, details }, positions }, null, 1), { mode: 0o600 });
  console.log(`Saved ${items.length} items and ${Object.keys(details).length} details to ${output}`);
}

main().then(() => process.exit(0), (error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
