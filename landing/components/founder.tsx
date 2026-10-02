import "./founder.css";
import { FOUNDER } from "@/content/site";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Chi sviluppa BuddyBudget, in poche righe. */
export function Founder() {
  return (
    <TrackedSection id="chi" section="chi" className="sec">
      <div className="wrap">
        <Reveal className="who">
          <div className="kicker">Chi c&apos;è dietro</div>
          <p className="lede">{FOUNDER.text}</p>
          <div className="sig">
            <b>{FOUNDER.name}</b>
            <span>{FOUNDER.role}</span>
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
