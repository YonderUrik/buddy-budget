import Link from "next/link";
import type { CSSProperties } from "react";
import { LEDGER, type StoryStep as StoryStepContent } from "@/content/story";
import { APP_LINKS } from "@/content/site";
import { CtaLink } from "../cta-link";

/** Un passo della storia: numero, domanda, risposta, la cifra in stile Panoramica e il rimando. L'ultimo mostra la somma del patrimonio. */
export function StoryStep({ step, on }: { step: StoryStepContent; on: boolean }) {
  const isTotal = step.id === "totale";
  return (
    <article id={`storia-${step.id}`} className={`step${step.n ? "" : " sub"}${on ? " on" : ""}`} data-step={step.id}>
      {step.n ? <p className="n">{step.n}</p> : null}
      <h2>{step.title}</h2>
      <p className="a">{step.text}</p>
      {isTotal ? (
        <ul className="ledger">
          {LEDGER.rows.map((row, i) => (
            <li key={row.label} style={{ "--i": i } as CSSProperties}>
              <span>{row.label}</span>
              <b className={"tone" in row ? row.tone : undefined}>{row.value}</b>
            </li>
          ))}
          <li className="tot" style={{ "--i": LEDGER.rows.length } as CSSProperties}>
            <span>{LEDGER.total.label}</span>
            <b>{LEDGER.total.value}</b>
          </li>
        </ul>
      ) : (
        <>
          <p className={`amt${step.amount.tone ? ` ${step.amount.tone}` : ""}`}>
            {step.amount.value}
            {step.amount.small ? <small>{step.amount.small}</small> : null}
          </p>
          <p className="cap">{step.caption}</p>
        </>
      )}
      {step.more ? <Link className="more" href={step.more.href}>{step.more.label}</Link> : null}
      {isTotal ? (
        <div className="cta">
          <CtaLink className="btn main" href={APP_LINKS.signup} location="story" target="signup" arrow>
            Crea un account gratis
          </CtaLink>
        </div>
      ) : null}
    </article>
  );
}
