import "./closing.css";
import { APP_LINKS } from "@/content/site";
import { ARROW_ICON, CtaLink } from "./cta-link";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Chiusura: invito a creare l'account e piè di pagina. */
export function Closing() {
  return (
    <TrackedSection id="fine" section="fine" className="end" navDark>
      <div className="wrap">
        <Reveal stagger distance={50}>
          <h2>Smetti di indovinare. Guardalo.</h2>
          <div className="cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="closing" target="signup">
              Crea il tuo account{ARROW_ICON}
            </CtaLink>
            <CtaLink className="btn ghost" href={APP_LINKS.login} location="closing" target="login">Accedi</CtaLink>
          </div>
          <p className="small">Accesso con link via email o con Google. Italiano ed EUR di default, altre lingue e valute in arrivo.</p>
        </Reveal>
        <footer>
          <span>© BuddyBudget · creato da Daniele</span>
          <span>Landing in sviluppo: testi, storia e confronto da validare</span>
        </footer>
      </div>
    </TrackedSection>
  );
}
