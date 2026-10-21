import type { Metadata } from "next";
import { BankReturnCard } from "@/components/domain/accounts";
import { nativeReturnUrl, parseNativeReturnPage } from "@/lib/gocardless/redirect";
import { NATIVE_RETURN_MESSAGES } from "@/lib/gocardless/return-messages";
import { getTranslator } from "@/lib/localization/server";

export const metadata: Metadata = { title: "BuddyBudget", robots: { index: false, follow: false } };

/**
 * Public HTTPS return page for the native apps after bank consent: target for Universal/App Links, and a fallback
 * that opens `buddybudget://bank/return` with the same `ref`/`status` when the custom scheme was not followed.
 * Reads nothing and changes nothing: the app completes the link with `POST /api/gocardless/connections/{ref}/complete`.
 */
export default async function BankReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["ref", "status", "error"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  const outcome = parseNativeReturnPage(params);
  const t = await getTranslator();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <BankReturnCard
        href={nativeReturnUrl(outcome)}
        title={t("Torna a BuddyBudget")}
        message={t(NATIVE_RETURN_MESSAGES[outcome.status])}
        actionLabel={t("Apri l'app")}
      />
    </main>
  );
}
