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
          <h2>Scopri quanto vali.</h2>
          <div className="cta">
            <CtaLink className="btn main" href={APP_LINKS.signup} location="closing" target="signup">
              Prova gratis{ARROW_ICON}
            </CtaLink>
            <CtaLink className="btn ghost" href={APP_LINKS.login} location="closing" target="login">Accedi</CtaLink>
          </div>
          <p className="small">Accedi con un link via email o con Google. Per ora in italiano e in euro; altre lingue e valute arriveranno.</p>
        </Reveal>
        <footer>
          <span>© BuddyBudget · creato da Daniele</span>
          <span>Le schermate del sito usano dati di esempio inventati</span>
        </footer>
      </div>
    </TrackedSection>
  );
}
