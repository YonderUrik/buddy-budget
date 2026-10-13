import "./faq.css";
import { type FaqItem, HOME_FAQ } from "@/content/site";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

/** Domande frequenti: `<details>` nativi (funzionano senza JS e il testo sta nell'HTML, indicizzabile). Le stesse domande (`HOME_FAQ`) alimentano il JSON-LD della home. */
export function Faq({ items = HOME_FAQ }: { items?: readonly FaqItem[] }) {
  return (
    <TrackedSection id="domande" section="domande" className="sec faq">
      <div className="wrap">
        <div className="faq-grid">
        <div>
          <span className="ref">Domande frequenti</span>
          <h2 className="t">Domande frequenti.</h2>
        </div>
        <Reveal>
          <div className="faq-list">
            {items.map((item) => (
              <details key={item.question} className="faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </Reveal>
        </div>
      </div>
    </TrackedSection>
  );
}
