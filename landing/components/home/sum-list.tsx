"use client";

import { useState } from "react";
import type { PlacesText, SumText } from "@/content/home";
import { track } from "@/lib/analytics";
import { groupThousandsIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { rise } from "@/lib/motion/rise";
import { hiddenIn, needsAttr, RULES_VARIANTS, type RulesVariant } from "@/lib/visitor-country";
import { RULES_NOTES } from "@/content/rules-needs";
import { ByRulesText, RulesNote } from "../by-rules";
import { TrackedSection } from "../tracked-section";
import { BrokerLogo } from "./broker-logo";

/** Reads an amount typed in the page language («22.595,40» or "22,595.40"); empty or unreadable counts as zero. */
export function parseAmount(raw: string, locale: Locale): number {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const normalised = locale === "en" ? cleaned.replace(/,/g, "") : cleaned.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalised);
  return Number.isFinite(n) ? n : 0;
}

/** The total split into its integer part (grouped) and its decimals, as the Panoramica writes it. */
function splitTotal(total: number, locale: Locale): { sign: string; whole: string; cents: string } {
  const abs = Math.round(Math.abs(total) * 100);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return { sign: total < 0 ? "−" : "", whole: groupThousandsIn(whole, locale), cents: `${locale === "en" ? "." : ","}${String(cents).padStart(2, "0")}` };
}

/** Flags of the countries whose banks can be linked. */
function Banks({ text }: { text: PlacesText }) {
  return (
    <ul className="place-art" aria-label={text.banksLabel}>
      {text.banks.map((country) => (
        <li key={country.code} title={country.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer */}
          <img className="flag" src={`/flags/${country.code}.svg`} alt={country.name} width={28} height={21} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

/** Logos of the brokers whose files are read out of the box, plus a plain tile for any other CSV. */
function Brokers({ text }: { text: PlacesText }) {
  return (
    <div className="place-art">
      {text.brokers.map((broker) => (
        <BrokerLogo key={broker.name} source={broker} />
      ))}
      <span className="tile csv">{text.anyCsv}</span>
    </div>
  );
}

export interface SumListProps {
  places: PlacesText;
  sum: SumText;
  locale: Locale;
}

/**
 * «Da quattro posti, un numero», the page's live thing: the four places set as a list at display size, each with its
 * amount, closed by a thick bar and the net worth. The amounts are fields prefilled with sample figures: a
 * visitor types their own and the total redoes itself on the spot (nothing is sent anywhere; `sum_edited` counts the
 * first edit). A tap on a place opens how it gets into the app. Without script the list reads as the sample sum.
 * A place on rules the visitor's country lacks (the pension fund) is hidden and left out of the total: one total is
 * rendered per rules variant and the CSS shows the visitor's one, so the sum always adds up to the rows on screen.
 */
export function SumList({ places, sum, locale }: SumListProps) {
  const sample = sum.rows.map((row) => groupThousandsIn(Math.abs(row.value), locale));
  const [values, setValues] = useState<string[]>(sample);
  const [open, setOpen] = useState(0);
  const [edited, setEdited] = useState(false);

  const isSample = values.every((v, i) => v === sample[i]);
  // One total per rules variant; variants that show the same rows share one rendering.
  const totals: { key: string; variants: RulesVariant[]; sign: string; whole: string; cents: string }[] = [];
  for (const variant of RULES_VARIANTS) {
    const kept = sum.rows.map((row, i) => ({ row, i })).filter(({ row }) => !hiddenIn(row.needs, variant));
    const key = kept.map(({ i }) => i).join();
    const same = totals.find((t) => t.key === key);
    if (same) {
      same.variants.push(variant);
      continue;
    }
    const total = kept.reduce((acc, { row, i }) => acc + Math.sign(row.value) * parseAmount(values[i], locale), 0);
    const split = splitTotal(total, locale);
    // The sample rows are rounded: with every sample row the total keeps the screenshot's decimals.
    const shown = isSample && kept.length === sum.rows.length ? { sign: "", whole: groupThousandsIn(total, locale), cents: sum.cents } : { ...split, cents: `${split.cents}${sum.suffix ?? ""}` };
    totals.push({ key, variants: [variant], ...shown });
  }

  const onChange = (index: number, raw: string) => {
    setValues((prev) => prev.map((v, i) => (i === index ? raw : v)));
    if (!edited) {
      setEdited(true);
      track("sum_edited");
    }
  };
  const reset = () => {
    setValues(sample);
    track("sum_reset");
  };

  return (
    <TrackedSection id="come" section="come" className="sec sums" field="light" aria-labelledby="come-t">
      <div className="wrap">
        <h2 id="come-t" data-rise><ByRulesText text={places.title} /></h2>
        <div className="sum-list" data-ui>
          <ul>
            {places.items.map((item, i) => {
              const row = sum.rows[i];
              const isOpen = open === i;
              const fieldId = `somma-${i}`;
              return (
                <li key={item.name} className={`sum-row${isOpen ? " open" : ""}${row.tone === "neg" ? " neg" : ""}`} data-rise style={rise(i + 1)} data-needs={needsAttr(row.needs)}>
                  <div className="sum-line">
                    <button type="button" className="sum-name" aria-expanded={isOpen} aria-controls={`${fieldId}-d`} onClick={() => setOpen(isOpen ? -1 : i)}>
                      {row.label}
                    </button>
                    <label className="sum-amt" htmlFor={fieldId}>
                      <span className="sr">{sum.fieldLabel.replace("{place}", row.label)}</span>
                      {row.tone === "neg" ? <span aria-hidden="true">−</span> : null}
                      {sum.prefix ? <span aria-hidden="true">{sum.prefix}</span> : null}
                      <input
                        id={fieldId}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={values[i]}
                        onChange={(e) => onChange(i, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        size={Math.max(4, values[i].length)}
                      />
                      {sum.suffix ? <span aria-hidden="true">{sum.suffix.trim()}</span> : null}
                    </label>
                  </div>
                  <div className="sum-detail" id={`${fieldId}-d`} hidden={!isOpen}>
                    <h3>{item.hook}</h3>
                    <p>{item.text}</p>
                    {item.art === "banks" ? <Banks text={places} /> : null}
                    {item.art === "brokers" ? <Brokers text={places} /> : null}
                    <p className="spec">{item.spec}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="sum-total" aria-live="polite" data-rise style={rise(5)}>
            <span className="sum-total-t">{sum.title}</span>
            {totals.map((t) => (
              <span key={t.key} className="sum-total-v" data-variant={totals.length > 1 ? t.variants.join(" ") : undefined}>
                {t.sign}
                {sum.prefix}
                {t.whole}
                <small>{t.cents}</small>
              </span>
            ))}
          </p>
        </div>
        <p className="sum-foot">
          {sum.hint}{" "}
          {isSample ? null : (
            <button type="button" className="text-btn" onClick={reset}>
              {sum.reset}
            </button>
          )}
        </p>
        <RulesNote text={RULES_NOTES[locale].home} />
      </div>
    </TrackedSection>
  );
}
