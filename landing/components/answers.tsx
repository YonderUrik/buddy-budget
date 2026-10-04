"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import "./answers.css";
import { QUESTIONS, type Question } from "@/content/questions";
import { track } from "@/lib/analytics";
import { groupThousands } from "@/lib/format";
import { AppShot } from "./app-shot";
import { TrackedSection } from "./tracked-section";

/** Durata del conteggio della cifra, in millisecondi. */
const FIGURE_COUNT_MS = 1100;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function figureText(q: NonNullable<Question["figure"]>, value: number): string {
  return q.unit === "eur" ? `${groupThousands(value)} €` : groupThousands(value);
}

/** Cifra della risposta: nel markup c'è già il valore finale, e quando la risposta si apre conta da zero (salvo movimento ridotto). */
function Figure({ figure, active }: { figure: NonNullable<Question["figure"]>; active: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active || prefersReducedMotion()) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / FIGURE_COUNT_MS);
      el.textContent = figureText(figure, Math.round(figure.value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, figure]);
  return (
    <p className="ans-fig">
      <strong ref={ref}>{figureText(figure, figure.value)}</strong>
      <span>{figure.note}</span>
    </p>
  );
}

/**
 * Le domande della home: a sinistra l'elenco, a destra la risposta con un caso concreto, la cifra e la schermata vera.
 * Sul telefono la risposta si apre sotto la domanda. Tutte le risposte stanno nell'HTML (le inattive sono solo nascoste).
 */
export function Answers({ questions = QUESTIONS }: { questions?: readonly Question[] }) {
  const [active, setActive] = useState(0);
  const select = (i: number) => {
    if (i === active) return;
    setActive(i);
    track("question_selected", { question: questions[i].id });
  };
  return (
    <TrackedSection id="risposte" section="risposte" className="sec answers">
      <div className="wrap">
        <h2 className="t">Cosa puoi chiederti, e cosa risponde.</h2>
        <ol className="qa" style={{ "--n": questions.length } as CSSProperties}>
          {questions.map((q, i) => {
            const on = i === active;
            return (
              <li key={q.id} className={on ? "on" : undefined}>
                <button type="button" aria-expanded={on} aria-controls={`ans-${q.id}`} onClick={() => select(i)}>
                  {q.question}
                </button>
                <div className="ans" id={`ans-${q.id}`} hidden={!on}>
                  <h3>{q.headline}</h3>
                  <p className="ans-text">{q.text}</p>
                  <div className="ans-case">
                    <span className="ans-label">Un caso</span>
                    <p>{q.situation}</p>
                    {q.figure ? <Figure figure={q.figure} active={on} /> : null}
                  </div>
                  <p className="ans-note">{q.note}</p>
                  {q.tool ? (
                    <Link className="ans-tool" href={q.tool.href} onClick={() => track("question_tool_click", { question: q.id })}>
                      {q.tool.label} →
                    </Link>
                  ) : null}
                  <AppShot id={q.screen} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </TrackedSection>
  );
}
