import "./tools-section.css";
import Link from "next/link";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ToolShot } from "./tool-shot";
import { YearsStrip } from "./viz/viz";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

const TOOLS = [
  { href: CONTENT_PATHS.zainetto, title: "Quanta imposta evito con le minusvalenze?", text: "Il calcolatore dello zainetto fiscale.", tag: "Strumento", viz: <ToolShot id="tasse" zoom={1.7} x={26} y={70} /> },
  { href: CONTENT_PATHS.ammortamento, title: "Quanto mi costa davvero un mutuo?", text: "Rata, interessi ed estinzione anticipata.", tag: "Strumento", viz: <ToolShot id="simulatore" zoom={1.9} x={27} y={57} /> },
  { href: CONTENT_PATHS.guidaZainetto, title: "Le perdite durano 4 anni", text: "La guida allo zainetto fiscale, con esempi.", tag: "Guida", viz: <YearsStrip from={2023} label="Una minusvalenza del 2023 si può usare fino al 2027" /> },
  { href: CONTENT_PATHS.funzioneInvestimenti, title: "Investimenti con le tasse italiane", text: "Rendimento vero, zaino fiscale e bollo.", tag: "Funzione", viz: <ToolShot id="investimenti" zoom={1.7} x={26} y={31} /> },
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
                <div className="tools-viz">{t.viz}</div>
                <span className="tools-tag">{t.tag}</span>
                <b>{t.title}</b>
                <span className="tools-sub">{t.text}<em aria-hidden="true">→</em></span>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
