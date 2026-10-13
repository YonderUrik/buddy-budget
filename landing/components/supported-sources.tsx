import "./supported-sources.css";
import { SUPPORTED } from "@/content/sheet";
import { APP_LINKS } from "@/content/site";
import { CtaLink } from "./cta-link";
import { HomeIcon } from "./home-icon";
import { SourceCardLink } from "./source-card-link";
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
                <li key={b.name}>
                  <SourceCardLink href={APP_LINKS.signup} kind="broker" className="cell ss-card" label={`Inizia con ${b.name}`}>
                    <span className="ss-logo">
                      {/* eslint-disable-next-line @next/next/no-img-element -- sito esportato in statico: niente ottimizzatore immagini */}
                      <img src={b.logo.src} alt="" width={b.logo.width} height={b.logo.height} loading="lazy" decoding="async" />
                    </span>
                    <span className="ss-name">{b.name}</span>
                    <span className="ss-detail">{b.detail}</span>
                  </SourceCardLink>
                </li>
              ))}
              <li>
                <SourceCardLink href={APP_LINKS.signup} kind="broker" className="cell ss-card ss-more" label={`${content.moreBrokers.name}: inizia caricando un CSV`}>
                  <span className="ss-logo" aria-hidden="true">
                    <HomeIcon name="file-text" size={22} className="ss-icon" />
                  </span>
                  <span className="ss-name">{content.moreBrokers.name}</span>
                  <span className="ss-more-detail">{content.moreBrokers.detail}</span>
                </SourceCardLink>
              </li>
            </ul>
          </div>
          <div className="ss-block">
            <h3>{content.banksLabel}</h3>
            <ul className="ss-tags">
              {content.countries.map((c) => (
                <li key={c.code}>
                  <SourceCardLink href={APP_LINKS.signup} kind="banca" className="cell ss-pill" label={`Collega una banca: ${c.name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- bandiera decorativa: il nome del paese è nel testo */}
                    <img className="ss-flag" src={`/flags/${c.code}.svg`} alt="" width={20} height={15} loading="lazy" decoding="async" />
                    {c.name}
                  </SourceCardLink>
                </li>
              ))}
            </ul>
            <p className="ss-connect">
              <CtaLink className="btn main" href={APP_LINKS.signup} location="fonti" target="signup" arrow>{content.connect.cta}</CtaLink>
              <a href="#come-si-collega">{content.connect.how} ↓</a>
            </p>
            <h3>{content.otherLabel}</h3>
            <ul className="ss-tags">
              {content.other.map((o) => (
                <li key={o.label} className="cell ss-pill">
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
