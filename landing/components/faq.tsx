import "./faq.css";
import { FAQ } from "@/content/site";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Domande frequenti: `<details>` nativi (funzionano senza JS e il testo sta nell'HTML, indicizzabile). Lo stesso `FAQ` alimenta il JSON-LD. */
export function Faq() {
  return (
    <TrackedSection id="domande" section="domande" className="sec faq band">
      <div className="wrap">
        <h2 className="t">Domande frequenti.</h2>
        <Reveal>
          <div className="faq-list">
            {FAQ.map((item) => (
              <details key={item.question} className="faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
