import "./story.css";
import { STORY, STORY_POINTS } from "@/content/site";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Perché esiste BuddyBudget: il problema in due righe, poi tre situazioni concrete a cui risponde. */
export function Story() {
  return (
    <TrackedSection id="perche" section="perche" className="story band">
      <div className="wrap">
        <div className="kicker">Perché esiste</div>
        <div className="why">
          <h2 className="t">{STORY.title}</h2>
          <p className="lede">{STORY.text}</p>
        </div>
        <Reveal className="trio" stagger distance={24}>
          {STORY_POINTS.map((p) => (
            <div key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </TrackedSection>
  );
}
