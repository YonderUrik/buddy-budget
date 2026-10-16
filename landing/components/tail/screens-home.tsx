import { SCREENS_HOME } from "@/content/story";
import { ScreenGallery } from "../screen-gallery";

/** «Com'è fatta» ("How it looks"): every screen of the app, whole and grouped by area; on the phone the phone-size ones inside the frame. */
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
