import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { CONTENT_DRAFT, CONTENT_PATHS, TOOLS } from "@/content/seo-pages";

export const metadata: Metadata = {
  title: "Calcolatori gratuiti: risparmio, mutuo e tasse sugli investimenti",
  description: "Calcolatori gratuiti e senza registrazione: in quanto tempo metti da parte una cifra, il piano del mutuo con l'estinzione anticipata e lo zainetto fiscale.",
  alternates: { canonical: CONTENT_PATHS.strumenti },
  robots: CONTENT_DRAFT ? { index: false, follow: true } : undefined,
};

/** Indice dei calcolatori: la voce «Calcolatori» del menu porta qui, non a un calcolatore solo. */
export default function Page() {
  return (
    <ContentPage kicker="Gratis, senza account" current={CONTENT_PATHS.strumenti} crumbs={[{ href: "/", label: "BuddyBudget" }, { label: "Calcolatori" }]} ctaTitle="Gli stessi calcoli, con i tuoi dati." ctaText="In BuddyBudget questi conti partono dai tuoi movimenti, investimenti e finanziamenti e si aggiornano da soli." ctaLocation="strumenti">
      <h1>Calcolatori</h1>
      <p className="lead">Prova i calcoli di BuddyBudget con numeri tuoi o inventati. Non serve registrarsi e non salviamo niente.</p>
      <div className="related">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href}>{t.title}<span>{t.text}</span></Link>
        ))}
      </div>
    </ContentPage>
  );
}
