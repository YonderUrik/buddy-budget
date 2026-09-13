/** Hook di boot Next.js: avvia gli scheduler (sync GoCardless, snapshot patrimonio) nel runtime Node.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGoCardlessScheduler } = await import("@/lib/gocardless/scheduler");
    startGoCardlessScheduler();
    const { startNetWorthScheduler } = await import("@/lib/net-worth/scheduler");
    startNetWorthScheduler();
  }
}
