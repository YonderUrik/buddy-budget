import Link from "next/link";
import type { TaxText } from "@/content/home";
import { rise } from "@/lib/motion/rise";

/**
 * «Il netto, prima di vendere»: the one section on the brand yellow field. Two figures set huge side by side, what
 * the sample ETF brings in today and what is left after the tax on the sale, each with its sentence under it, so
 * the difference reads in the digits, not in colour (taste-skill section «Two giant words compared»).
 */
export function TaxCompare({ text }: { text: TaxText }) {
  return (
    <section className="tax" aria-labelledby="tasse-t" data-field="sun">
      <div className="wrap">
        <div className="tax-head">
          <h2 id="tasse-t" data-rise>{text.title}</h2>
          <div data-rise style={rise(1)}>
            <p>{text.text}</p>
          </div>
        </div>
        <div className="tax-pair">
          {text.specimens.map((sp, i) => (
            <figure key={sp.caption} className="tax-sp" data-rise style={rise(2 + i)}>
              <p aria-label={`${sp.value}${sp.small}`}>
                {sp.value}
                <small>{sp.small}</small>
              </p>
              <figcaption>{sp.caption}</figcaption>
            </figure>
          ))}
        </div>
        <Link className="more tax-more" href={text.more.href}>{text.more.label}</Link>
      </div>
    </section>
  );
}
