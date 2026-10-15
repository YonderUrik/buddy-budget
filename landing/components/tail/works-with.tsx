import { t as trLanding, PROFILE } from "@/lib/localization";
import type { CSSProperties, ReactNode } from "react";
import type { HomeIcon as HomeIconName } from "@/content/home";
import { INSTRUMENTS, WORKS_WITH } from "@/content/story";
import { HomeIcon } from "../home-icon";
import { BrokerLogo, Chip } from "../story/story-hero";
import { TrackedSection } from "../tracked-section";

/** Strumenti mostrati nella scheda «Azioni, ETF, titoli di Stato, cripto»: i primi quattro chip dell'apertura. */
const MARKET_INSTRUMENTS = INSTRUMENTS.slice(0, 4);
/** Fonte dei prezzi mostrata sotto gli strumenti. */
const PRICE_SOURCE = "Yahoo Finance";

interface CellProps {
  /** Posto nel testo: sul telefono le schede stanno in colonna in quest'ordine, su desktop sono ripartite in due colonne. */
  order: number;
  icon: HomeIconName;
  title: string;
  text: string;
  children: ReactNode;
}

/** Scheda di «funziona con»: icona nel riquadro tinto, titolo, testo e, in fondo, i loghi o i chip. */
function Cell({ order, icon, title, text, children }: CellProps) {
  return (
    <div className="con-cell" style={{ "--n": order } as CSSProperties}>
      <div className="con-head">
        <span className="con-ic"><HomeIcon name={icon} size={20} /></span>
        <h3>{trLanding(title)}</h3>
      </div>
      <p>{trLanding(text)}</p>
      {children}
    </div>
  );
}

/** «Funziona con quello che hai già»: banche (bandiere e paesi), broker (loghi), strumenti e il resto, in quattro schede. */
export function WorksWith() {
  const c = WORKS_WITH;
  const yahoo = c.brokerLogos.find((b) => b.name === PRICE_SOURCE);
  return (
    <TrackedSection id="con" section="con" className="con">
      <div className="wrap">
        <h2>{trLanding(c.title)}</h2>
        <p className="intro">{trLanding(c.intro)}</p>
        <div className="con-grid">
          <div className="con-col">
            <Cell order={1} icon={c.banks.icon} title={trLanding(c.banks.title)} text={c.banks.text}>
              <ul className="con-art con-pills">
                {c.countries.map((k) => (
                  <li key={k.code} className="con-pill">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini */}
                    <img className="flag" src={`/flags/${k.code}.svg`} alt={trLanding("")} width={30} height={23} loading="lazy" decoding="async" />
                    {trLanding(k.name)}
                  </li>
                ))}
              </ul>
            </Cell>
            <Cell order={3} icon={c.instruments.icon} title={trLanding(c.instruments.title)} text={c.instruments.text}>
              <div className="con-art">
                <div className="con-chips">
                  {MARKET_INSTRUMENTS.map((chip) => <Chip key={chip.name} chip={chip} />)}
                </div>
                {yahoo ? (
                  <div className="con-src">
                    <span>{trLanding(c.instruments.source)}</span>
                    <span className="con-tile"><BrokerLogo source={yahoo} /></span>
                  </div>
                ) : null}
              </div>
            </Cell>
          </div>
          <div className="con-col">
            <Cell order={2} icon={c.brokers.icon} title={trLanding(c.brokers.title)} text={c.brokers.text}>
              <ul className="con-art con-tiles">
                {c.brokerLogos.filter((b) => b.name !== PRICE_SOURCE).map((b) => (
                  <li key={b.name} className="con-tile"><BrokerLogo source={b} /></li>
                ))}
                <li className="con-tile con-csv">
                  <HomeIcon name="spreadsheet" size={18} />
                  {trLanding(c.brokers.csv)}
                </li>
              </ul>
            </Cell>
            <Cell order={4} icon={c.rest.icon} title={trLanding(c.rest.title)} text={c.rest.text}>
              <div className="con-art con-chips">
                {c.rest.chips.filter(chip => PROFILE.country === "IT" || chip.icon !== "umbrella").map((chip) => <Chip key={chip.name} chip={chip} />)}
              </div>
            </Cell>
          </div>
        </div>
      </div>
    </TrackedSection>
  );
}
