import "./founder.css";
import { FOUNDER } from "@/content/site";
import { Mark } from "./brand";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Chi ha creato BuddyBudget. */
export function Founder() {
  return (
    <TrackedSection id="chi" section="chi" className="sec">
      <div className="wrap">
        <Reveal className="who" stagger>
          <div className="mono" aria-hidden="true">
            <Mark />
          </div>
          <div>
            <div className="kicker">Chi l&apos;ha creato</div>
            <h2 className="t" style={{ maxWidth: "10em" }}>Lo ha creato {FOUNDER.name}.</h2>
            <p className="lede">{FOUNDER.text}</p>
            <blockquote>«{FOUNDER.quote}»</blockquote>
            <div className="sig">
              <b>{FOUNDER.name}</b>
              <span>{FOUNDER.role}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
