import "./before-after.css";
import { BEFORE_AFTER, type BeforeAfter as BeforeAfterItem } from "@/content/sheet";
import { Reveal } from "./reveal";
import { ShotCrop } from "./shot-crop";
import { TrackedSection } from "./tracked-section";

/** Una sezione «prima / ora»: la formula del foglio e quanto costava a mano, accanto alla schermata dell'app con la cifra d'esempio. */
function BeforeAfterSection({ item }: { item: BeforeAfterItem }) {
  return (
    <TrackedSection id={item.id} section={item.id} className="sec ba">
      <div className="wrap">
        <span className="ref">{item.ref}</span>
        <h2 className="t">{item.title}</h2>
        <Reveal className="ba-panel cell">
          <div className="ba-before">
            <span className="ba-lab">Prima</span>
            <code>{item.formula}</code>
            <p>{item.before}</p>
            <span className="ba-cost">{item.cost}</span>
          </div>
          <div className="ba-after">
            <span className="ba-lab ba-now">Ora</span>
            <ShotCrop id={item.shot} className="ba-shot" />
            <p className="ba-get">
              {item.after.lead} <strong>{item.after.strong}</strong> {item.after.tail}
            </p>
          </div>
        </Reveal>
      </div>
    </TrackedSection>
  );
}

/** Le cinque aree dell'app raccontate come confronto con il foglio di calcolo (testi in `content/sheet.ts`). */
export function BeforeAfterSections({ items = BEFORE_AFTER }: { items?: readonly BeforeAfterItem[] }) {
  return (
    <>
      {items.map((item) => <BeforeAfterSection key={item.id} item={item} />)}
    </>
  );
}
