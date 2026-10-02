import "./tools-section.css";
import Link from "next/link";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

const TOOLS = [
  { href: CONTENT_PATHS.zainetto, title: "Calcolatore zainetto fiscale", text: "Minusvalenze, scadenze a 4 anni e imposta su una plusvalenza.", tag: "Strumento" },
  { href: CONTENT_PATHS.ammortamento, title: "Piano di ammortamento", text: "Rata, interessi ed estinzione anticipata di un mutuo o di un finanziamento.", tag: "Strumento" },
  { href: CONTENT_PATHS.guidaZainetto, title: "Zainetto fiscale: la guida", text: "Cos'è e come recuperare le minusvalenze, con un esempio numerico.", tag: "Guida" },
  { href: CONTENT_PATHS.funzioneInvestimenti, title: "Investimenti con le tasse italiane", text: "Come BuddyBudget calcola rendimento, zaino fiscale e bollo.", tag: "Funzione" },
] as const;

/** Strumenti e guide gratuiti: ingresso dalla home verso le pagine di contenuto (utili anche senza account). */
export function ToolsSection() {
  return (
    <TrackedSection id="strumenti" section="strumenti" className="sec tools">
      <div className="wrap">
        <div className="kicker">Strumenti gratuiti</div>
        <h2 className="t">Fai due conti, anche senza account.</h2>
        <p className="lede">Calcolatori e guide per capire tasse e debiti. Sono stime a scopo informativo: non sostituiscono un consulente.</p>
        <Reveal>
          <div className="tools-grid">
            {TOOLS.map((t) => (
              <Link key={t.href} href={t.href} className="tools-card">
                <span className="tools-tag">{t.tag}</span>
                <b>{t.title}</b>
                <span>{t.text}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
