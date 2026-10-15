import { SCREENS_HOME } from "@/content/story";
import { ScreenGallery } from "../screen-gallery";

/** «Com'è fatta»: tutte le schermate dell'app, intere e per area; sul telefono quelle a misura di telefono nella cornice. */
export function ScreensHome() {
  return (
    <section id="dentro" className="dentro">
      <div className="wrap">
        <h2>{SCREENS_HOME.title}</h2>
        <p className="intro">{SCREENS_HOME.intro}</p>
        <ScreenGallery phoneOnMobile />
      </div>
    </section>
  );
}
