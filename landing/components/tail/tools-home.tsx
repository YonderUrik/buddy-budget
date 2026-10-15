import { t as trLanding } from "@/lib/localization";
import { TOOLS_HOME } from "@/content/story";
import { TOOLS } from "@/content/tools";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

/** «Prova senza account»: i tre calcolatori, una riga ciascuno. */
export function ToolsHome() {
  return (
    <TrackedSection id="strumenti" section="strumenti">
      <div className="wrap">
        <h2>{trLanding(TOOLS_HOME.title)}</h2>
        <p className="intro">{trLanding(TOOLS_HOME.intro)}</p>
        <ul className="tools">
          {TOOLS.map((t) => (
            <li key={t.id}>
              <div>
                <b>{trLanding(t.name)}</b>
                <p>{trLanding(t.text)}</p>
              </div>
              <CtaLink href={t.href} location="strumenti" target="calculator">{trLanding(TOOLS_HOME.open)}</CtaLink>
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
