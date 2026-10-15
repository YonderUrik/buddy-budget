import { HERO, INSTRUMENTS, WORKS_WITH, type InstrumentChip } from "@/content/story";
import { APP_LINKS, SOURCE_URL } from "@/content/site";
import type { SupportedSource } from "@/content/sheet";
import { CtaLink } from "../cta-link";
import { GithubMark } from "../github-mark";
import { SourceLink } from "../source-link";
import { HomeIcon } from "../home-icon";

/** Classe del logo per i marchi che hanno proporzioni particolari (vedi `story.css`). */
const LOGO_CLASS: Record<string, string> = { "Interactive Brokers": "ib", "Trade Republic": "tr", Fineco: "fin", "Yahoo Finance": "yh" };
/** Marchi mostrati accanto all'apertura: quelli con un lettore pronto nell'app, senza Yahoo (che è una fonte di prezzi, non un broker). */
const HERO_BROKERS = ["Interactive Brokers", "DEGIRO", "Trade Republic", "Fineco"];
/** Id del primo passo, dove porta «Scorri le domande». */
const FIRST_STEP_ANCHOR = "#storia-soldi";

/** Logo di un broker; Interactive Brokers ha solo il simbolo, quindi accanto va il nome. */
export function BrokerLogo({ source }: { source: SupportedSource }) {
  if (!source.logo) return <span className="lbl">{source.name}</span>;
  const cls = `logo${LOGO_CLASS[source.name] ? ` ${LOGO_CLASS[source.name]}` : ""}`;
  // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
  const img = <img className={cls} src={source.logo.src} alt={source.name === "Interactive Brokers" ? "" : source.name} width={source.logo.width} height={source.logo.height} loading="lazy" decoding="async" />;
  return source.name === "Interactive Brokers" ? (
    <span className="ibk">
      {img}
      <span>{source.name}</span>
    </span>
  ) : (
    img
  );
}

/** Bandiere dei paesi delle banche collegabili. */
export function CountryFlags({ size = 26 }: { size?: number }) {
  return (
    <span className="flags">
      {WORKS_WITH.countries.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini
        <img key={c.code} className="flag" src={`/flags/${c.code}.svg`} alt={c.name} width={size} height={Math.round((size * 20) / 26)} loading="lazy" decoding="async" />
      ))}
    </span>
  );
}

/** Chip di uno strumento (azione, ETF, BTP, cripto, fondo, mutuo) con la sua icona in un riquadro del suo colore. */
export function Chip({ chip }: { chip: InstrumentChip }) {
  return (
    <span className={`ichip ichip-${chip.color}`}>
      <i><HomeIcon name={chip.icon} size={14} /></i>
      {chip.name}
      {chip.kind ? <small>{chip.kind}</small> : null}
    </span>
  );
}

/** Apertura della storia: titolo, invito, fatti e «funziona con» (bandiere, loghi dei broker, strumenti). */
export function StoryHero({ on }: { on: boolean }) {
  return (
    <article className={`step hero-step${on ? " on" : ""}`} data-step="hero">
      <h1>{HERO.title}</h1>
      <p className="lede">{HERO.lede}</p>
      <div className="cta">
        <CtaLink className="btn main" href={APP_LINKS.signup} location="hero" target="signup" arrow>
          {HERO.cta}
        </CtaLink>
        <a className="btn ghost" href={FIRST_STEP_ANCHOR}>{HERO.scroll} ↓</a>
      </div>
      <ul className="facts">
        {HERO.facts.map((f) => <li key={f}>{f}</li>)}
        {SOURCE_URL ? (
          <li>
            <SourceLink href={SOURCE_URL} location="sezione">
              <GithubMark />
              Codice aperto
            </SourceLink>
          </li>
        ) : null}
      </ul>
      <div className="with">
        <p className="wl">{HERO.with.label}</p>
        <div className="row">
          <CountryFlags />
          <span className="lbl">{HERO.with.banks}</span>
        </div>
        <div className="row">
          {WORKS_WITH.brokerLogos.filter((b) => HERO_BROKERS.includes(b.name)).map((b) => <BrokerLogo key={b.name} source={b} />)}
          <span className="lbl">{HERO.with.brokers}</span>
        </div>
        <div className="row">
          {INSTRUMENTS.map((chip) => <Chip key={chip.name} chip={chip} />)}
        </div>
      </div>
    </article>
  );
}
