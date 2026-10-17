import "../faq.css";
import type { HomeContent } from "@/content/home";
import { TrackedSection } from "../tracked-section";

/**
 * «Prima di iscriverti»: a wide heading alone on the left, the questions indented under it as rows that open on tap
 * (the first one already open), the same text as the FAQPage structured data.
 */
export function Faq({ text }: { text: HomeContent["faq"] }) {
  return (
    <TrackedSection id="domande" section="domande" className="sec faq" field="alt" aria-labelledby="domande-t">
      <div className="wrap">
        <h2 id="domande-t" data-rise>{text.title}</h2>
        <div className="faq-list" data-rise>
          {text.items.map((item, i) => (
            <details key={item.question} className="faq-item" open={i === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </TrackedSection>
  );
}
