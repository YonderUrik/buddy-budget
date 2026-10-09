import "./hero.css";
import { HERO_FACTS, OPEN_SOURCE_FACT } from "@/content/home";
import { APP_LINKS, SOURCE_URL } from "@/content/site";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { AppShot } from "./app-shot";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { HeroShot } from "./hero-shot";
import { HomeIcon } from "./home-icon";
import { TrackedSection } from "./tracked-section";

/**
 * Apertura: cosa fa BuddyBudget in una frase, due azioni (account o calcolatore senza account), i fatti verificabili
 * subito sotto (gratis, banca in sola lettura, server, export) e la Panoramica vera, che si raddrizza scorrendo.
 */
export function Hero() {
  const facts = SOURCE_URL ? [...HERO_FACTS, OPEN_SOURCE_FACT] : HERO_FACTS;
  return (
    <TrackedSection id="top" section="hero" className="hero">
      <div className="wrap">
        <div className="hero-copy">
          <h1>Quanto hai, quanto paghi di tasse, quando puoi smettere di lavorare.</h1>
          <p className="hero-lede">
            Conti, spese, investimenti, fondo pensione e debiti in un&apos;app sola, con le tasse calcolate secondo le regole italiane.
          </p>
          <div className="cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup">
              Crea un account gratis{ARROW_ICON}
            </CtaLink>
            <CtaLink className="btn ghost" href={CONTENT_PATHS.zainetto} location="hero" target="calculator">
              Prova un calcolatore, senza account
            </CtaLink>
          </div>
          <ul className="hero-facts">
            {facts.map((f) => (
              <li key={f.label}>
                <HomeIcon name={f.icon} size={16} />
                {f.label}
              </li>
            ))}
          </ul>
        </div>
        <HeroShot>
          <AppShot id="panoramica" priority />
        </HeroShot>
      </div>
    </TrackedSection>
  );
}
