/** Messaggio della pagina di disiscrizione quando il link non è valido (manomesso o incompleto). */

export function InvalidUnsubscribe({ preferencesHref, privacyEmail }: { preferencesHref: string; privacyEmail: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-medium text-foreground">Questo link non funziona</h1>
      <p className="text-sm text-muted-foreground">
        Il link è incompleto o non è più valido. Puoi disattivare le email da{" "}
        <a href={preferencesHref} className="underline underline-offset-2 hover:text-foreground">
          Impostazioni → Notifiche
        </a>{" "}
        (serve accedere) oppure scrivere a {privacyEmail}.
      </p>
    </div>
  );
}
