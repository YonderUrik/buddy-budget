import "../faq.css";
import type { HomeContent } from "@/content/home";
import { TrackedSection } from "../tracked-section";
import { SectionHead } from "./section-head";

/** «Prima di iscriverti»: the questions as rows that open on tap (the first one already open), the same text as the FAQPage structured data. */
export function Faq({ text }: { text: HomeContent["faq"] }) {
  return (
    <TrackedSection id="domande" section="domande" className="sec faq" aria-labelledby="domande-t">
      <div className="wrap">
        <SectionHead id="domande-t" title={text.title} />
        <div className="faq-list">
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
