import { BASE_TAX_RATE, GOVERNMENT_BOND_TAX_RATE, isFund, type TaxInstrument } from "@/lib/calc/taxes";
import type { CouponFrequency, Instrument } from "@/lib/db/schema/investments";

/** Impostazioni per utente di uno strumento come arrivano dall'API (numeric come stringa, null = automatico). */
export interface InstrumentSettingInput {
  instrumentId: string;
  taxRate: string | null;
  taxHarmonized: boolean | null;
  couponRate: string | null;
  couponFrequency: CouponFrequency | null;
  maturityDate: string | null;
}

/** Nomi che indicano un titolo di Stato (o assimilato), tassato al 12,5%. */
const GOVERNMENT_BOND_PATTERN = /\b(BTP|BOT|CCT|CTZ|BTP\s?ITALIA|BTP\s?VALORE|BUND|BUNDESANLEIHE|OAT|BONOS?|TREASURY|T-?BILLS?|T-?NOTES?|GILTS?|REPUBLIC|REPUBBLICA|GOVERNMENT|GOVT)\b/i;

/** Un'obbligazione il cui nome indica un emittente pubblico: aliquota automatica 12,5%. */
export function looksLikeGovernmentBond(instrument: Pick<Instrument, "type" | "name">): boolean {
  return instrument.type === "obbligazione" && GOVERNMENT_BOND_PATTERN.test(instrument.name);
}

/** Da dove viene l'aliquota di uno strumento, per spiegarla nella UI. */
export type TaxRateSource = "manuale" | "titolo_di_stato" | "strumento";

/** Aliquota e armonizzazione effettive con la loro provenienza. */
export interface ResolvedTaxSettings {
  taxRate: number;
  taxRateSource: TaxRateSource;
  harmonized: boolean;
  harmonizedSource: "manuale" | "strumento" | "presunto";
}

/**
 * Aliquota: la correzione dell'utente, altrimenti 12,5% per un titolo di Stato riconosciuto dal nome, altrimenti
 * quella dello strumento (26% di default). Armonizzato: correzione, poi strumento, altrimenti sì (UCITS europeo).
 */
export function resolveTaxSettings(
  instrument: Pick<Instrument, "type" | "name" | "taxRate" | "taxHarmonized">,
  setting: Pick<InstrumentSettingInput, "taxRate" | "taxHarmonized"> | undefined
): ResolvedTaxSettings {
  let taxRate: number;
  let taxRateSource: TaxRateSource;
  if (setting?.taxRate != null) {
    taxRate = Number(setting.taxRate);
    taxRateSource = "manuale";
  } else if (looksLikeGovernmentBond(instrument)) {
    taxRate = GOVERNMENT_BOND_TAX_RATE;
    taxRateSource = "titolo_di_stato";
  } else {
    taxRate = Number(instrument.taxRate) || BASE_TAX_RATE;
    taxRateSource = "strumento";
  }
  let harmonized = true;
  let harmonizedSource: ResolvedTaxSettings["harmonizedSource"] = "presunto";
  if (setting?.taxHarmonized != null) {
    harmonized = setting.taxHarmonized;
    harmonizedSource = "manuale";
  } else if (instrument.taxHarmonized != null) {
    harmonized = instrument.taxHarmonized;
    harmonizedSource = "strumento";
  }
  return { taxRate, taxRateSource, harmonized: isFund(instrument.type) ? harmonized : true, harmonizedSource };
}

/** Strumenti con le impostazioni fiscali risolte, pronti per `computeTaxReport`. */
export function toTaxInstruments(instruments: Instrument[], settings: InstrumentSettingInput[]): TaxInstrument[] {
  const byId = new Map(settings.map((s) => [s.instrumentId, s]));
  return instruments.map((instrument) => {
    const resolved = resolveTaxSettings(instrument, byId.get(instrument.id));
    return {
      id: instrument.id,
      name: instrument.name,
      type: instrument.type,
      currency: instrument.currency,
      priceUnit: instrument.priceUnit,
      taxRate: resolved.taxRate,
      harmonized: resolved.harmonized,
    };
  });
}
