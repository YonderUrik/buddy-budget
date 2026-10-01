/** Confronto tra una linea di credito e il portafoglio investimenti dato in garanzia (informativo, mai obbligatorio). */

/** Cali di mercato simulati sul portafoglio, in rapporto (0,1 = −10%). */
export const PORTFOLIO_DROP_SCENARIOS = [0.1, 0.2, 0.3] as const;

export interface PortfolioDropRow {
  drop: number;
  portfolioValue: number;
  /** Utilizzato / portafoglio dopo il calo, in rapporto. */
  ratio: number;
}

export interface CreditLinePortfolioView {
  /** Utilizzato / valore del portafoglio oggi, in rapporto (null se il portafoglio vale zero). */
  ratio: number | null;
  /** Rapporto dopo ciascun calo simulato del portafoglio. */
  drops: PortfolioDropRow[];
  /** Calo massimo del portafoglio prima che l'utilizzato lo eguagli (rapporto 0-1), null se non c'è utilizzo. */
  breakEvenDrop: number | null;
}

/** Rapporto tra utilizzo e portafoglio oggi e dopo i cali simulati. */
export function buildCreditLinePortfolioView(used: number, portfolioValue: number): CreditLinePortfolioView {
  if (portfolioValue <= 0) return { ratio: null, drops: [], breakEvenDrop: null };
  const drops = PORTFOLIO_DROP_SCENARIOS.map((drop) => {
    const value = portfolioValue * (1 - drop);
    return { drop, portfolioValue: value, ratio: value > 0 ? used / value : 0 };
  });
  return {
    ratio: used / portfolioValue,
    drops,
    breakEvenDrop: used > 0 ? Math.max(0, 1 - used / portfolioValue) : null,
  };
}
