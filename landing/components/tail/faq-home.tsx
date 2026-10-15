import { t as trLanding } from "@/lib/localization";
import { FAQ } from "@/content/site";
import { FAQ_HOME } from "@/content/story";
import { TrackedSection } from "../tracked-section";

/** «Prima di iscriverti»: le domande frequenti, aperte (niente tendine: si leggono e si indicizzano). Lo stesso `FAQ` alimenta il JSON-LD. */
export function FaqHome() {
  return (
    <TrackedSection id="domande" section="domande">
      <div className="wrap">
        <h2>{trLanding(FAQ_HOME.title)}</h2>
        <ul className="qa">
          {FAQ.map((item) => (
            <li key={item.question}>
              <h3>{trLanding(item.question)}</h3>
              <p>{trLanding(item.answer)}</p>
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
