import type { Metadata } from "next";
import { InvalidUnsubscribe, UnsubscribeCard } from "@/components/domain/notifications";
import { PRIVACY_EMAIL } from "@/lib/legal";
import { NOTIFICATION_SETTINGS_PATH, verifyUnsubscribeToken } from "@/lib/notifications/server";

export const metadata: Metadata = { title: "Disiscrizione · BuddyBudget", robots: { index: false, follow: false } };

/** Pagina aperta dal link «Disattiva queste email»: pubblica (il token firmato dice chi e cosa), ma non fa nulla finché non si preme il pulsante. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const payload = verifyUnsubscribeToken(t);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        {payload && t ? (
          <UnsubscribeCard token={t} scope={payload.scope} preferencesHref={NOTIFICATION_SETTINGS_PATH} privacyEmail={PRIVACY_EMAIL} />
        ) : (
          <InvalidUnsubscribe preferencesHref={NOTIFICATION_SETTINGS_PATH} privacyEmail={PRIVACY_EMAIL} />
        )}
      </div>
    </main>
  );
}
