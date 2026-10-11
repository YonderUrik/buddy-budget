import "./sheet-hero.css";
import { HERO_FACTS, OPEN_SOURCE_FACT } from "@/content/home";
import { SHEET_HERO } from "@/content/sheet";
import { APP_LINKS, SOURCE_URL } from "@/content/site";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { SheetWorkbook } from "./sheet-workbook";
import { TrackedSection } from "./tracked-section";

/**
 * Apertura: il titolo con le parole finali evidenziate come una cella selezionata, cosa fa l'app in una frase, due azioni
 * (account o calcolatore senza account), i fatti verificabili e il foglio d'esempio che si trasforma nella Panoramica.
 */
export function SheetHero({ content = SHEET_HERO }: { content?: typeof SHEET_HERO }) {
  const facts = SOURCE_URL ? [...HERO_FACTS, OPEN_SOURCE_FACT] : HERO_FACTS;
  return (
    <TrackedSection id="top" section="hero" className="sh">
      <div className="wrap sh-grid">
        <div className="sh-copy">
          <h1>
            {content.title} <mark>{content.titleMark}</mark>.
          </h1>
          <p className="sh-lede">{content.lede}</p>
          <div className="cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup">
              Crea un account gratis{ARROW_ICON}
            </CtaLink>
            <CtaLink className="btn ghost" href={CONTENT_PATHS.zainetto} location="hero" target="calculator">
              Prova un calcolatore
            </CtaLink>
          </div>
          <ul className="sh-facts">
            {facts.map((f) => (
              <li key={f.label}>{f.label}</li>
            ))}
          </ul>
        </div>
        <SheetWorkbook content={content} />
      </div>
    </TrackedSection>
  );
}
