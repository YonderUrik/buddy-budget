import "./deep-links.css";
import Link from "next/link";
import { DEEP_LINKS } from "@/content/home";
import { HomeIcon } from "./home-icon";
import { TrackedSection } from "./tracked-section";

/** Rimandi alle pagine di approfondimento: tengono corta la home senza perdere i dettagli. */
export function DeepLinks({ content = DEEP_LINKS }: { content?: typeof DEEP_LINKS }) {
  return (
    <TrackedSection id="approfondisci" section="approfondisci" className="sec deep">
      <div className="wrap">
        <span className="ref">{content.kicker}</span>
        <h2 className="t">{content.title}</h2>
        <ul className="deep-grid">
          {content.links.map((l) => (
            <li key={l.href}>
              <Link className="deep-card cell" href={l.href}>
                <span className="deep-ic" aria-hidden="true"><HomeIcon name={l.icon} size={20} /></span>
                <b>{l.title} →</b>
                <span>{l.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </TrackedSection>
  );
}
