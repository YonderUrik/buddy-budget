import type { SupportedSource } from "@/content/sheet";

/** Per-logo class: the marks have different proportions, each gets its own height in `home.css`. */
const LOGO_CLASS: Record<string, string> = { "Interactive Brokers": "ib", Fineco: "fin", "Trade Republic": "tr", "Yahoo Finance": "yh" };

/** A broker (or price source) on a light tile: its logo, with the name beside it when the mark alone is a symbol. */
export function BrokerLogo({ source }: { source: SupportedSource }) {
  const cls = LOGO_CLASS[source.name];
  if (!source.logo) return <span className="tile">{source.name}</span>;
  const symbolOnly = source.name === "Interactive Brokers";
  return (
    <span className={`tile${cls ? ` ${cls}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer */}
      <img src={source.logo.src} alt={symbolOnly ? "" : source.name} width={source.logo.width} height={source.logo.height} loading="lazy" decoding="async" />
      {symbolOnly ? <span>{source.name}</span> : null}
    </span>
  );
}
