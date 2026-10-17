"use client";
import { useLocalization } from "@/lib/localization/provider";
import { PAGE_TITLE } from "@/components/domain/shared";
/** Messaggio della pagina di disiscrizione quando il link non è valido (manomesso o incompleto). */

export function InvalidUnsubscribe({ preferencesHref, privacyEmail }: { preferencesHref: string; privacyEmail: string }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col gap-4">
      <h1 className={PAGE_TITLE}>{tr("Questo link non funziona")}</h1>
      <p className="text-sm text-muted-foreground">{tr("Il link è incompleto o non è più valido. Puoi disattivare le email da")}{" "}
        <a href={preferencesHref} className="underline underline-offset-2 hover:text-foreground">{tr("Impostazioni → Notifiche")}</a>{" "}{tr("(serve accedere) oppure scrivere a")}{" "}{privacyEmail}{"."}</p>
    </div>
  );
}
