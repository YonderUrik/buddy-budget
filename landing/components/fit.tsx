import "./fit.css";
import { Check, X } from "lucide-react";
import { FIT } from "@/content/home";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** "Per chi è, e per chi no": due colonne oneste. Chi cerca consulenza, un broker o un'altra valuta lo sa prima di registrarsi. */
export function Fit({ content = FIT }: { content?: typeof FIT }) {
  return (
    <TrackedSection id="per-chi" section="perchi" className="sec fit">
      <div className="wrap">
        <h2 className="t">{content.title}</h2>
        <Reveal stagger className="fit-cols">
          <div className="fit-col yes">
            <h3>{content.yesTitle}</h3>
            <ul>
              {content.yes.map((t) => (
                <li key={t}><Check aria-hidden="true" size={18} strokeWidth={2} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="fit-col no">
            <h3>{content.noTitle}</h3>
            <ul>
              {content.no.map((t) => (
                <li key={t}><X aria-hidden="true" size={18} strokeWidth={2} />{t}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
