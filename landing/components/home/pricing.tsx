import "./pricing.css";
import type { PricingText } from "@/content/pricing";
import { LOCALE_APP_LINKS, SOURCE_URL } from "@/content/site";
import type { Locale } from "@/lib/i18n";
import { rise } from "@/lib/motion/rise";
import { needsAttr } from "@/lib/visitor-country";
import { CtaLink } from "../cta-link";
import { TrackedSection } from "../tracked-section";

function Lines({ lines }: { lines: PricingText["free"]["lines"] }) {
  return (
    <ul className="pr-lines">
      {lines.map((line) => (
        <li key={line.text} data-needs={needsAttr(line.needs)}>{line.text}</li>
      ))}
    </ul>
  );
}

/**
 * «Liquidità è gratis»: the two plans as two cells, Free on the page's field and Pro on navy with the yearly price at
 * display size, the monthly one and the trial under it, and the sign-up button. Below, the few facts that hold today
 * (everything open until Pro starts, the launch gift, self-hosting free). Lines built on rules the visitor's country
 * lacks are hidden (`data-needs`).
 */
export function Pricing({ text, locale }: { text: PricingText; locale: Locale }) {
  const app = LOCALE_APP_LINKS[locale];
  const notes = SOURCE_URL ? [...text.notes, text.selfHost] : text.notes;
  return (
    <TrackedSection id={text.id} section="prezzi" className="sec pricing" field="light" aria-labelledby="prezzi-t">
      <div className="wrap">
        <h2 id="prezzi-t" data-rise>{text.title}</h2>
        <div className="pr-plans">
          <article className="pr-plan" data-rise style={rise(1)} aria-labelledby="prezzi-free">
            <h3 id="prezzi-free">{text.free.name}</h3>
            <p className="pr-price">
              <span className="pr-amount">{text.free.price}</span> <span className="pr-per">{text.free.per}</span>
            </p>
            <Lines lines={text.free.lines} />
          </article>
          <article className="pr-plan pro" data-field="navy" data-rise style={rise(2)} aria-labelledby="prezzi-pro">
            <h3 id="prezzi-pro">{text.pro.name}</h3>
            <p className="pr-price">
              <span className="pr-amount">{text.pro.price}</span> <span className="pr-per">{text.pro.per}</span>
            </p>
            <p className="pr-alt">{text.pro.alt}</p>
            <Lines lines={text.pro.lines} />
            <CtaLink className="btn main sun big" href={app.signup} location="prezzi" target="signup" lang={locale} arrow>
              {text.cta}
            </CtaLink>
          </article>
        </div>
        <ul className="pr-notes" data-rise style={rise(3)}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
