import "./hero.css";
import { APP_LINKS } from "@/content/site";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { TrackedSection } from "./tracked-section";

/** Apertura: una frase che dice cosa fa BuddyBudget, due azioni (creare l'account o provare un calcolatore senza account). */
export function Hero() {
  return (
    <TrackedSection id="top" section="hero" className="hero">
      <div className="wrap">
        <h1>Le domande sui tuoi soldi, senza aprire Excel.</h1>
        <p className="hero-lede">
          BuddyBudget tiene insieme conti, investimenti, fondo pensione e debiti, e calcola le tasse con le regole italiane. Per ora è gratuito.
        </p>
        <div className="cta">
          <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup">
            Crea un account{ARROW_ICON}
          </CtaLink>
          <CtaLink className="btn ghost" href={CONTENT_PATHS.zainetto} location="hero" target="calculator">
            Prova il calcolatore, senza account
          </CtaLink>
        </div>
      </div>
    </TrackedSection>
  );
}
