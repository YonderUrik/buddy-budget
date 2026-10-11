import "./supported-sources.css";
import { SUPPORTED } from "@/content/sheet";
import { HomeIcon } from "./home-icon";
import { TrackedSection } from "./tracked-section";

/**
 * «Funziona con»: i broker di cui si importano i file (con logo, su fondo sempre bianco perché alcuni marchi sono scuri),
 * i paesi delle banche collegabili (con bandiera) le alternative per tutto il resto e, in fondo ai broker, una card che ricorda che qualsiasi CSV si importa. Elenco verificato in `lib/investments/import/providers.ts`.
 */
export function SupportedSources({ content = SUPPORTED }: { content?: typeof SUPPORTED }) {
  return (
    <TrackedSection id="fonti" section="fonti" className="sec ss">
      <div className="wrap">
        <span className="ref">{content.kicker}</span>
        <h2 className="t">{content.title}</h2>
        <div className="ss-grid">
          <div className="ss-block ss-brokers">
            <h3>{content.brokersLabel}</h3>
            <ul>
              {content.brokers.map((b) => (
                <li key={b.name} className="cell">
                  <span className="ss-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini */}
                    <img src={b.logo.src} alt="" width={b.logo.width} height={b.logo.height} loading="lazy" decoding="async" />
                  </span>
                  <span className="ss-name">{b.name}</span>
                  <span className="ss-detail">{b.detail}</span>
                </li>
              ))}
              <li className="cell ss-more">
                <span className="ss-logo" aria-hidden="true">
                  <HomeIcon name="file-text" size={22} className="ss-icon" />
                </span>
                <span className="ss-name">{content.moreBrokers.name}</span>
                <span className="ss-more-detail">{content.moreBrokers.detail}</span>
              </li>
            </ul>
          </div>
          <div className="ss-block">
            <h3>{content.banksLabel}</h3>
            <ul className="ss-tags">
              {content.countries.map((c) => (
                <li key={c.code} className="cell">
                  {/* eslint-disable-next-line @next/next/no-img-element -- bandiera decorativa: il nome del paese è nel testo */}
                  <img className="ss-flag" src={`/flags/${c.code}.svg`} alt="" width={20} height={15} loading="lazy" decoding="async" />
                  {c.name}
                </li>
              ))}
            </ul>
            <h3>{content.otherLabel}</h3>
            <ul className="ss-tags">
              {content.other.map((o) => (
                <li key={o.label} className="cell">
                  <HomeIcon name={o.icon} size={16} className="ss-icon" />
                  {o.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </TrackedSection>
  );
}
