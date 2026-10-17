import { PLACES } from "@/content/home";
import { HomeIcon } from "../home-icon";
import { TrackedSection } from "../tracked-section";
import { BrokerLogo } from "./broker-logo";
import { SectionHead } from "./section-head";

/** Flags of the countries whose banks can be linked. */
function Banks() {
  return (
    <ul className="place-art" aria-label="Paesi delle banche">
      {PLACES.banks.map((country) => (
        <li key={country.code} title={country.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer */}
          <img className="flag" src={`/flags/${country.code}.svg`} alt={country.name} width={28} height={21} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

/** Logos of the brokers whose files are read out of the box, plus the dashed tile for everyone else. */
function Brokers() {
  return (
    <div className="place-art">
      {PLACES.brokers.map((broker) => (
        <BrokerLogo key={broker.name} source={broker} />
      ))}
      <span className="tile csv">qualsiasi CSV</span>
    </div>
  );
}

/** «Da quattro posti, un numero»: how each place gets in, as four ledger rows closed by the sum line. */
export function Sources() {
  return (
    <TrackedSection id="come" section="come" className="sec" aria-labelledby="come-t">
      <div className="wrap">
        <SectionHead id="come-t" title={PLACES.title} intro={PLACES.intro} />
        <ol className="places">
          {PLACES.items.map((item) => (
            <li key={item.name} className="place">
              <div className="place-n">
                <span className="place-ic" aria-hidden="true"><HomeIcon name={item.icon} size={18} /></span>
                {item.name}
              </div>
              <div>
                <h3>{item.hook}</h3>
                <p>{item.text}</p>
                {item.art === "banks" ? <Banks /> : null}
                {item.art === "brokers" ? <Brokers /> : null}
                <p className="spec">{item.spec}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="places-eq">
          <span aria-hidden="true">=</span>
          {PLACES.result}
        </p>
      </div>
    </TrackedSection>
  );
}
