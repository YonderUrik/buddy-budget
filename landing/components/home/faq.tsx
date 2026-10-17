import "../faq.css";
import { FAQ_HOME } from "@/content/home";
import { FAQ } from "@/content/site";
import { TrackedSection } from "../tracked-section";
import { SectionHead } from "./section-head";

/** «Prima di iscriverti»: the questions as rows that open on tap (the first one already open), the same text as the FAQPage structured data. */
export function Faq() {
  return (
    <TrackedSection id="domande" section="domande" className="sec faq" aria-labelledby="domande-t">
      <div className="wrap">
        <SectionHead id="domande-t" title={FAQ_HOME.title} intro={FAQ_HOME.intro} />
        <div className="faq-list">
          {FAQ.map((item, i) => (
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
