import { INSTRUMENTS, WORKS_WITH } from "@/content/story";
import { BrokerLogo, Chip, CountryFlags } from "../story/story-hero";
import { TrackedSection } from "../tracked-section";

/** Strumenti mostrati nella cella «Azioni, ETF, titoli di Stato, cripto»: i primi quattro chip dell'apertura. */
const MARKET_INSTRUMENTS = INSTRUMENTS.slice(0, 4);
/** Fonte dei prezzi mostrata accanto agli strumenti. */
const PRICE_SOURCE = "Yahoo Finance";

/** «Funziona con quello che hai già»: banche (bandiere), broker (loghi), strumenti e il resto, in quattro celle. */
export function WorksWith() {
  const c = WORKS_WITH;
  const yahoo = c.brokerLogos.find((b) => b.name === PRICE_SOURCE);
  return (
    <TrackedSection id="con" section="con" className="con">
      <div className="wrap">
        <h2>{c.title}</h2>
        <p className="intro">{c.intro}</p>
        <div className="band">
          <div className="con-cell">
            <h3>{c.banks.title}</h3>
            <p>{c.banks.text}</p>
            <div className="art"><CountryFlags size={44} /></div>
          </div>
          <div className="con-cell">
            <h3>{c.brokers.title}</h3>
            <p>{c.brokers.text}</p>
            <div className="art">
              {c.brokerLogos.filter((b) => b.name !== PRICE_SOURCE).map((b) => <BrokerLogo key={b.name} source={b} />)}
              <span className="csv">{c.brokers.csv}</span>
            </div>
          </div>
          <div className="con-cell">
            <h3>{c.instruments.title}</h3>
            <p>{c.instruments.text}</p>
            <div className="art">
              {MARKET_INSTRUMENTS.map((chip) => <Chip key={chip.name} chip={chip} />)}
              {yahoo ? <BrokerLogo source={yahoo} /> : null}
            </div>
          </div>
          <div className="con-cell">
            <h3>{c.rest.title}</h3>
            <p>{c.rest.text}</p>
            <div className="art">
              {c.rest.chips.map((chip) => <Chip key={chip.name} chip={chip} />)}
            </div>
          </div>
        </div>
      </div>
    </TrackedSection>
  );
}
