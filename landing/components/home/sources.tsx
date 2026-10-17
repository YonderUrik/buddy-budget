import type { PlacesText } from "@/content/home";
import { TrackedSection } from "../tracked-section";
import { BrokerLogo } from "./broker-logo";
import { SectionHead } from "./section-head";

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

/** Logos of the brokers whose files are read out of the box, plus the dashed tile for everyone else. */
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

/** «Da quattro posti, un numero»: how each place gets in, four numbered entries (two columns on desktop). Texts from `text`. */
export function Sources({ text }: { text: PlacesText }) {
  return (
    <TrackedSection id="come" section="come" className="sec" aria-labelledby="come-t">
      <div className="wrap">
        <SectionHead id="come-t" title={text.title} intro={text.intro} />
        <ol className="places">
          {text.items.map((item, i) => (
            <li key={item.name} className="place">
              <p className="idx place-n">
                {String(i + 1).padStart(2, "0")} · {item.name}
              </p>
              <div>
                <h3>{item.hook}</h3>
                <p>{item.text}</p>
                {item.art === "banks" ? <Banks text={text} /> : null}
                {item.art === "brokers" ? <Brokers text={text} /> : null}
                <p className="spec">{item.spec}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </TrackedSection>
  );
}
