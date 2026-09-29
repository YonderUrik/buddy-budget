import type { AreaKey, SectorKey } from "@/lib/investments/exposure-keys";

/** Colore di ogni settore (palette `--swatch-*`): il "non classificato" è sempre grigio chiaro. */
export const SECTOR_COLOR: Record<SectorKey, string> = {
  tecnologia: "var(--swatch-blue)",
  finanza: "var(--swatch-indigo)",
  salute: "var(--swatch-emerald)",
  industria: "var(--swatch-slate-dark)",
  consumi_ciclici: "var(--swatch-rose)",
  consumi_difensivi: "var(--swatch-lime)",
  comunicazioni: "var(--swatch-violet)",
  energia: "var(--swatch-orange)",
  materiali: "var(--swatch-amber-dark)",
  servizi_pubblici: "var(--swatch-cyan)",
  immobiliare: "var(--swatch-pink)",
  obbligazioni: "var(--swatch-teal)",
  liquidita: "var(--swatch-green-light)",
  materie_prime: "var(--swatch-yellow)",
  crypto: "var(--swatch-orange-dark)",
  altro: "var(--swatch-purple-light)",
  non_classificato: "var(--swatch-slate-light)",
};

/** Colore di ogni area geografica. */
export const AREA_COLOR: Record<AreaKey, string> = {
  nord_america: "var(--swatch-blue)",
  europa: "var(--swatch-indigo)",
  italia: "var(--swatch-emerald)",
  giappone: "var(--swatch-rose)",
  pacifico: "var(--swatch-cyan)",
  emergenti: "var(--swatch-amber)",
  nessuna: "var(--swatch-orange)",
  non_classificato: "var(--swatch-slate-light)",
};
