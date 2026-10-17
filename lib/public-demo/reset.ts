import "server-only";
import type { LocaleProfile } from "@/lib/localization/config";
import { recordPublicDemoEvent, type Logger } from "@/lib/observability";
import { PUBLIC_DEMO_PROFILES, publicDemoUserId } from "./config";
import { seedDemoAccount } from "./seed";

export interface PublicDemoResetResult {
  /** Accounts rebuilt, as `IT-en` (country, language). */
  rebuilt: string[];
  failed: string[];
}

/** Email of a demo account: unique per country and language and never a deliverable mailbox (RFC 2606 domain). */
export function publicDemoEmail(profile: LocaleProfile): string {
  return `${publicDemoUserId(profile)}@example.com`;
}

/**
 * Rebuilds every public demo account from scratch, so its dates follow today and nothing a visitor could have changed
 * survives. One account failing does not stop the others. Open demo sessions end (the account is re-created).
 */
export async function resetPublicDemos({ log, now = new Date() }: { log: Logger; now?: Date }): Promise<PublicDemoResetResult> {
  const result: PublicDemoResetResult = { rebuilt: [], failed: [] };
  for (const profile of PUBLIC_DEMO_PROFILES) {
    const { language, productCountry } = profile;
    const startedAt = Date.now();
    try {
      const counts = await seedDemoAccount({ userId: publicDemoUserId(profile), email: publicDemoEmail(profile), language, productCountry, now });
      result.rebuilt.push(`${productCountry}-${language}`);
      recordPublicDemoEvent("reset", language, productCountry);
      log.info("demo.reset.completed", { language, country: productCountry, count: counts.transactions, durationMs: Date.now() - startedAt });
    } catch (error) {
      result.failed.push(`${productCountry}-${language}`);
      log.error("demo.reset.failed", { language, country: productCountry, durationMs: Date.now() - startedAt, error });
    }
  }
  return result;
}
