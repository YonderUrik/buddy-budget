import "server-only";
import type { Language } from "@/lib/localization/config";
import { recordPublicDemoEvent, type Logger } from "@/lib/observability";
import { PUBLIC_DEMO_LANGUAGES, publicDemoUserId } from "./config";
import { seedDemoAccount } from "./seed";

export interface PublicDemoResetResult {
  rebuilt: Language[];
  failed: Language[];
}

/** Email of a demo account: unique per language and never a deliverable mailbox (RFC 2606 domain). */
export function publicDemoEmail(language: Language): string {
  return `${publicDemoUserId(language)}@example.com`;
}

/**
 * Rebuilds every public demo account from scratch, so its dates follow today and nothing a visitor could have changed
 * survives. One language failing does not stop the others. Open demo sessions end (the account is re-created).
 */
export async function resetPublicDemos({ log, now = new Date() }: { log: Logger; now?: Date }): Promise<PublicDemoResetResult> {
  const result: PublicDemoResetResult = { rebuilt: [], failed: [] };
  for (const language of PUBLIC_DEMO_LANGUAGES) {
    const startedAt = Date.now();
    try {
      const counts = await seedDemoAccount({ userId: publicDemoUserId(language), email: publicDemoEmail(language), language, now });
      result.rebuilt.push(language);
      recordPublicDemoEvent("reset", language);
      log.info("demo.reset.completed", { language, count: counts.transactions, durationMs: Date.now() - startedAt });
    } catch (error) {
      result.failed.push(language);
      log.error("demo.reset.failed", { language, durationMs: Date.now() - startedAt, error });
    }
  }
  return result;
}
