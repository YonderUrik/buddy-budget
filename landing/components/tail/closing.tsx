import { t as trLanding } from "@/lib/localization";
import { CONTENT_PATHS } from "@/content/seo-pages";
import { APP_LINKS } from "@/content/site";
import { CLOSE } from "@/content/story";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

/** Chiusura su fondo navy: invito a creare l'account e rimando ai calcolatori. Il piè di pagina segue sullo stesso fondo. */
export function Closing() {
  return (
    <TrackedSection id="fine" section="fine" className="close">
      <div className="wrap">
        <h2>{trLanding(CLOSE.title)}</h2>
        <p>{trLanding(CLOSE.note)}</p>
        <div className="cta">
          <CtaLink className="btn ghost" href={APP_LINKS.signup} location="closing" target="signup" arrow>
            {trLanding(CLOSE.cta)}
          </CtaLink>
          <CtaLink className="btn plain" href={CONTENT_PATHS.strumenti} location="closing" target="calculator">
            {trLanding(CLOSE.tools)}
          </CtaLink>
        </div>
      </div>
    </TrackedSection>
  );
}
