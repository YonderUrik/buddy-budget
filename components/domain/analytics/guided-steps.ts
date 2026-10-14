/**
 * Passi della «Guida passo passo» di ogni scheda di Analitiche. Funzioni pure: ricevono i numeri già calcolati
 * dell'utente e producono il testo, così la spiegazione parla dei suoi valori e non di un esempio generico.
 */

import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsBase } from "@/lib/analitiche/base";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import type { CostDragPoint, CostSummary } from "@/lib/calc/costs";
import type { GrowthSplit } from "@/lib/calc/growth-split";
import type { MonteCarloInput, MonteCarloResult, WithdrawalRule } from "@/lib/calc/monte-carlo";
import { localizedAnalyticsFormats } from "./analytics-format";

export interface ReadingStep {
  title: string;
  /** Paragrafi del passo, in parole semplici e con i numeri dell'utente. */
  text: string[];
}
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedGuidedSteps(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatYears, money, num, pct } = localizedAnalyticsFormats(language);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const RULE_NAMES: Record<WithdrawalRule, string> = {
  fissa: tr("spesa fissa"),
  percentuale: tr("percentuale del patrimonio"),
  "guyton-klinger": "Guyton-Klinger",
  vanguard: tr("Vanguard dinamica"),
};

/** Passi della scheda Obiettivo FIRE. `leanTarget` è il numero con le sole spese Dovute e Saltuarie, se noto. */
function fireSteps(plan: AnalyticsPlan, a: AnalyticsAssumptions, currency: string, leanTarget: number | null): ReadingStep[] {
  if (plan.target === null || plan.spending === null) return [];
  const savings = plan.savings ?? 0;
  const rate = pct(a.withdrawalRate);
  const first = plan.coast[0];
  const reached = plan.wealth >= plan.target;
  return [
    {
      title: tr("Parti da quanto spendi"),
      text: [
        tr("La base di tutto è la tua spesa annua: {0}. {1}", { 0: money(plan.spending, currency), 1: plan.spendingSource === "dati" ? tr("Viene dai tuoi movimenti del periodo scelto in alto, riportati a un anno.") : tr("È il valore che hai scritto nelle ipotesi.") }),
        tr("Conta più di qualunque altra ipotesi: ogni euro in meno di spesa abbassa il traguardo e, nello stesso tempo, ti lascia più risparmio."),
      ],
    },
    {
      title: tr("Il tasso di prelievo"),
      text: [
        tr("Hai scelto {0}: significa che ogni anno prelevi {1} del capitale. Su 100.000 € sono {2} l'anno.", { 0: rate, 1: rate, 2: money(100000 * a.withdrawalRate, currency) }),
        tr("Un tasso più basso è più prudente (serve più capitale), uno più alto richiede meno capitale ma dura meno nei periodi cattivi. Il 3,5% è un valore prudente; il classico 4% viene dagli studi americani."),
      ],
    },
    {
      title: tr("Il numero FIRE"),
      text: [
        tr("{0} ÷ {1} = {2}. Questo è il capitale che, prelevando {3} l'anno, copre la tua spesa.", { 0: money(plan.spending, currency), 1: rate, 2: money(plan.fireNumberGross ?? plan.target, currency), 3: rate }),
        plan.taxShare > 0
          ? tr("Poiché per prelevare devi vendere e sulle plusvalenze si pagano le imposte (circa {0} del tuo patrimonio oggi), il numero sale a {1}: è quello che devi avere lordo per ritrovarti in mano la cifra giusta dopo le tasse.", { 0: pct(plan.taxShare), 1: money(plan.target, currency) })
          : tr("Non risultano imposte sulle plusvalenze da considerare, quindi il numero non viene corretto."),
        leanTarget !== null ? tr("Se vivessi solo con le spese Dovute e Saltuarie, il numero scenderebbe a {0} (il «lean FIRE»).", { 0: money(leanTarget, currency) }) : "",
      ].filter(Boolean),
    },
    {
      title: tr("A che punto sei"),
      text: [
        tr("Il tuo patrimonio è {0}: il {1} del traguardo. La barra sotto i tre numeri mostra lo stesso dato.", { 0: money(plan.wealth, currency), 1: pct(plan.progress ?? 0, 0) }),
        reached ? tr("Hai già raggiunto il numero: con queste ipotesi potresti vivere del patrimonio. La scheda Simulazione mostra quanto reggerebbe.") : tr("Mancano {0}.", { 0: money(plan.target - plan.wealth, currency) }),
      ],
    },
    {
      title: tr("Quando ci arrivi"),
      text: [
        savings > 0
          ? tr("Con {0} di risparmio l'anno e un rendimento reale del {1}, il traguardo arriva {2}.", { 0: money(savings, currency), 1: pct(a.expectedReturn), 2: plan.yearsToFire === null ? tr("oltre gli 80 anni: con queste ipotesi in pratica non arriva") : tr("tra {0}", { 0: formatYears(plan.yearsToFire) }) })
          : tr("Con un risparmio nullo o negativo il patrimonio non cresce con i tuoi versamenti, quindi il traguardo non si avvicina da solo."),
        tr("«Rendimento reale» è già al netto dell'inflazione: tutti gli importi sono in euro di oggi, così sono confrontabili con la tua spesa."),
      ],
    },
    {
      title: tr("Coast FIRE"),
      text: [
        first
          ? tr("Il Coast FIRE è il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE. Per arrivarci fra {0} anni servono {1}{2}.", { 0: first.years, 1: money(first.number, currency), 2: plan.wealth >= first.number ? tr(": ce l'hai già") : "" })
          : tr("Il Coast FIRE è il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE."),
        tr("Se superi la cifra dell'orizzonte che ti interessa, puoi smettere di accantonare per il futuro e coprire solo le spese correnti."),
      ],
    },
    {
      title: tr("Quanto contano le ipotesi"),
      text: [
        tr("Le due tabelle di sensibilità mostrano gli anni al traguardo cambiando due ipotesi alla volta. La cella evidenziata è la tua."),
        tr("Muoviti di una riga o una colonna: se gli anni cambiano poco, quell'ipotesi pesa poco. Di solito spesa e risparmio contano molto più del rendimento, e sono anche le due che controlli tu."),
      ],
    },
  ];
}

/** Passi della scheda Simulazione. */
function simulationSteps(result: MonteCarloResult, input: MonteCarloInput, a: AnalyticsAssumptions, currency: string): ReadingStep[] {
  const retireIn = input.accumulationYears;
  const outOf100 = Math.round(result.successRate * 100);
  return [
    {
      title: tr("Perché non basta un calcolo solo"),
      text: [
        tr("Un calcolo con un rendimento «medio» ogni anno dà una linea liscia, ma i mercati non vanno così: un brutto inizio pensione pesa molto più di una brutta fine."),
        tr("La simulazione genera {0} futuri possibili, ognuno con rendimenti che oscillano a caso attorno al {1} annuo con una volatilità del {2}, e guarda come va il tuo patrimonio in ciascuno.", { 0: result.paths.toLocaleString(locale), 1: pct(a.expectedReturn), 2: pct(a.volatility, 0) }),
      ],
    },
    {
      title: tr("Il punto di partenza"),
      text: [
        tr("Parti da {0}. {1}", { 0: money(input.startingWealth, currency), 1: retireIn > 0 ? tr("Per {0} anni versi {1} l'anno, poi inizia la pensione.", { 0: retireIn, 1: money(input.annualSavings, currency) }) : tr("La pensione inizia subito: nessun versamento.") }),
        `Con l'interruttore in alto scegli se smettere oggi o quando raggiungi il traguardo FIRE.`,
      ],
    },
    {
      title: tr("La pensione"),
      text: [
        tr("Spendi {0} l'anno per {1} anni, prelevando con la regola «{2}» (la cambi nelle ipotesi, e la scheda Prelievi le confronta).", { 0: money(input.annualSpending, currency), 1: a.retirementYears, 2: RULE_NAMES[a.rule] }),
        tr("Tutto in euro di oggi: l'inflazione è già tolta, quindi la spesa non va rivalutata a mano."),
      ],
    },
    {
      title: tr("La probabilità di successo"),
      text: [
        tr("{0}: in {1} scenari su 100 il patrimonio dura fino alla fine, negli altri {2} si esaurisce prima.", { 0: pct(result.successRate, 0), 1: outOf100, 2: 100 - outOf100 }),
        tr("Non è una promessa: dice quanto margine hai. Sopra il 90% è solida, fra 75% e 90% regge ma con tagli nei casi sfortunati, sotto il 75% è fragile."),
      ],
    },
    {
      title: tr("Il grafico"),
      text: [
        `La linea è il caso tipico (la mediana: metà degli scenari sta sopra, metà sotto). La fascia chiara contiene l'80% dei casi, quella scura il 50%.`,
        tr("Alla fine il caso tipico lascia {0}, il caso sfortunato (10° percentile) {1}. Passa il mouse sul grafico per leggere i valori di ogni anno.", { 0: money(result.endingWealth.p50, currency), 1: money(result.endingWealth.p10, currency) }),
      ],
    },
    {
      title: tr("Cosa provare"),
      text: [
        tr("Cambia una ipotesi alla volta e guarda la probabilità: una spesa del 10% più bassa, qualche anno in più di accumulo, una volatilità diversa."),
        tr("Se il risultato cambia moltissimo spostando un'ipotesi di poco, fidati meno del numero: dipende troppo da quell'ipotesi."),
      ],
    },
  ];
}

/** Passi della scheda Prelievi. */
function withdrawalSteps(results: MonteCarloResult[], a: AnalyticsAssumptions, plan: AnalyticsPlan, currency: string): ReadingStep[] {
  const best = results.reduce((x, y) => (y.successRate > x.successRate ? y : x));
  const fissa = results.find((r) => r.rule === "fissa");
  const flexible = results.filter((r) => r.rule !== "fissa");
  return [
    {
      title: tr("Perché la regola conta"),
      text: [
        tr("Partendo da {0} e spendendo {1} l'anno per {2} anni, il modo in cui decidi quanto prelevare cambia le probabilità di durare quasi quanto il capitale stesso.", { 0: money(plan.wealth, currency), 1: money(plan.spending ?? 0, currency), 2: a.retirementYears }),
        tr("Le quattro regole sono provate sugli stessi scenari casuali, quindi la differenza non dipende dalla fortuna."),
      ],
    },
    {
      title: tr("Le quattro regole"),
      text: [
        tr("Fissa: la stessa spesa ogni anno, qualunque cosa faccia il mercato. È semplice ma fragile."),
        tr("Percentuale: ogni anno una quota del patrimonio. Non si esaurisce mai, ma la spesa sale e scende col mercato."),
        tr("Guyton-Klinger: spesa costante con due paracadute: si taglia del 10% se il prelievo pesa troppo, si aumenta del 10% se pesa poco."),
        tr("Vanguard dinamica: prelievo legato al patrimonio ma con variazioni limitate (da −2,5% a +5% l'anno), per non avere sbalzi."),
      ],
    },
    {
      title: tr("Le colonne della tabella"),
      text: [
        tr("Successo: in quanti scenari il patrimonio dura. Taglio massimo tipico: di quanto scende la spesa, nel punto peggiore, nel caso tipico. Taglio nel 10% dei casi peggiori: lo stesso, ma per gli scenari più sfortunati."),
        tr("Patrimonio finale tipico: cosa resta alla fine nel caso tipico. Un valore molto alto vuol dire che avresti potuto spendere di più."),
      ],
    },
    {
      title: tr("Cosa dicono i tuoi numeri"),
      text: [
        tr("La regola con più successo è «{0}» ({1}).{2}", { 0: RULE_NAMES[best.rule], 1: pct(best.successRate, 0), 2: fissa ? tr(" La fissa arriva a {0}.", { 0: pct(fissa.successRate, 0) }) : "" }),
        flexible.length > 0 ? tr("Il prezzo delle regole flessibili è nel taglio: nel 10% dei casi peggiori la spesa può scendere del {0} o più rispetto al primo anno.", { 0: pct(Math.max(...flexible.map((r) => r.maxCut.p90)), 0) }) : "",
        tr("Chiediti se sapresti ridurre le spese di quella misura: se no, la regola migliore sulla carta non è la tua."),
      ].filter(Boolean),
    },
    {
      title: tr("Il grafico della spesa"),
      text: [
        tr("Tocca una riga della tabella per vedere come cambierebbe la spesa anno dopo anno: la linea centrale è il caso tipico, quella rossa il caso sfortunato, quella verde il fortunato."),
        tr("Con la regola fissa le tre linee coincidono; con le altre si aprono a ventaglio."),
      ],
    },
  ];
}

/** Passi della scheda Crescita. */
function growthSteps(split: GrowthSplit, currency: string): ReadingStep[] {
  return [
    {
      title: tr("La domanda a cui risponde"),
      text: [
        tr("Il patrimonio è cresciuto perché hai risparmiato o perché il mercato è salito? La risposta cambia cosa puoi controllare."),
        tr("Si guardano liquidità e investimenti degli ultimi 12 mesi, mese per mese."),
      ],
    },
    {
      title: tr("I tre numeri"),
      text: [
        tr("In totale il patrimonio è variato di {0}.", { 0: money(split.totalDelta, currency) }),
        tr("Dal tuo risparmio (entrate meno uscite) arrivano {0}{1}.", { 0: money(split.totalFromSavings, currency), 1: split.savingsShare !== null ? tr(", cioè il {0} della crescita", { 0: pct(split.savingsShare, 0) }) : "" }),
        tr("Il resto, {0}, viene da mercato e altro: è calcolato per differenza.", { 0: money(split.totalFromMarket, currency) }),
      ],
    },
    {
      title: tr("Il grafico"),
      text: [
        tr("Ogni barra è un mese: in blu la parte dal risparmio, in verde acqua la parte da mercato e altro. Le barre possono andare sotto lo zero quando il mercato scende."),
        tr("Un mese in cui la parte di mercato è negativa non è una perdita tua: è il valore dei titoli che scende."),
      ],
    },
    {
      title: tr("Come usarlo"),
      text: [
        tr("Se domina il risparmio, la crescita dipende da te: è la leva più sicura. Se domina il mercato, stai beneficiando (o soffrendo) di qualcosa che non controlli."),
        tr("«Altro» include anche ciò che non passa dai movimenti (regali, rimborsi, trasferimenti non registrati): non leggerlo come rendimento puro."),
      ],
    },
  ];
}

/** Passi della scheda Rischio. */
function riskSteps(base: AnalyticsBase, assumedVolatility: number): ReadingStep[] {
  const { risk, riskContribution } = base;
  if (!risk) return [];
  const top = riskContribution ? [...riskContribution].sort((x, y) => y.riskShare - x.riskShare)[0] : null;
  return [
    {
      title: tr("Cosa misura"),
      text: [
        tr("Quanto il portafoglio oscilla e quanto può far male nei giorni e nei periodi peggiori. Si calcola sui prezzi giornalieri dei tuoi investimenti."),
        risk.fewData ? tr("Hai meno di un anno di dati: i numeri sono indicativi.") : "",
      ].filter(Boolean),
    },
    {
      title: tr("Volatilità e peggior calo"),
      text: [
        risk.volatility !== null ? tr("La volatilità è {0} annua: in un anno «normale» il portafoglio si muove di circa ± quella quota.", { 0: pct(risk.volatility) }) : tr("La volatilità non è calcolabile con i dati attuali."),
        risk.maxDrawdown !== null ? tr("Il peggior calo è −{0}: dal punto più alto a quello più basso successivo. È la domanda che conta: reggeresti di vedere il patrimonio scendere così?", { 0: pct(risk.maxDrawdown) }) : "",
        tr("Nelle ipotesi hai messo {0}: se è molto lontana dalla volatilità osservata, la simulazione rischia di essere troppo ottimista o troppo cupa.", { 0: pct(assumedVolatility, 0) }),
      ].filter(Boolean),
    },
    {
      title: tr("Sharpe, Sortino, Calmar"),
      text: [
        tr("Sharpe{0} dice quanto rendimento ottieni per ogni unità di rischio; sopra 1 è buono.", { 0: risk.sharpe !== null ? ` (${num(risk.sharpe)})` : "" }),
        tr("Sortino{0} è lo stesso ma conta solo le oscillazioni verso il basso, che sono quelle che temi.", { 0: risk.sortino !== null ? ` (${num(risk.sortino)})` : "" }),
        tr("Calmar{0} confronta il rendimento annuo con il peggior calo: più è alto, meno hai sofferto per ogni punto guadagnato.", { 0: risk.calmar !== null ? ` (${num(risk.calmar)})` : "" }),
      ],
    },
    {
      title: tr("VaR e CVaR"),
      text: [
        risk.tail ? tr("Nel 5% dei giorni peggiori il portafoglio perde almeno {0} in una sola giornata (VaR 95%). In quei giorni la perdita media è {1} (CVaR).", { 0: pct(risk.tail.var), 1: pct(risk.tail.cvar) }) : tr("Non ci sono abbastanza giorni per calcolare VaR e CVaR."),
        tr("Il VaR è la soglia, il CVaR guarda cosa succede oltre la soglia: è il più onesto sulle code cattive."),
      ],
    },
    {
      title: tr("Quanto pesa ogni posizione"),
      text: [
        top ? tr("La posizione che pesa di più sul rischio è «{0}»: {1} del rischio contro {2} del valore.", { 0: base.names[top.id] ?? top.id, 1: pct(top.riskShare, 0), 2: pct(top.weight, 0) }) : tr("Con almeno due posizioni e 60 giorni di prezzi in comune vedi il contributo di ciascuna."),
        risk.concentration ? tr("Le «posizioni effettive» sono {0}: un portafoglio con 10 titoli concentrati su 2 si comporta come 2.", { 0: num(risk.concentration.effectiveN, 1) }) : "",
        tr("Se la barra supera il trattino, quella posizione pesa sul rischio più di quanto pesi sul valore."),
      ].filter(Boolean),
    },
  ];
}

/** Passi della scheda Costi e tasse. */
function costsSteps(summary: CostSummary, drag: CostDragPoint[], liquidation: AnalyticsPlan["liquidation"], currency: string, dragYears: number): ReadingStep[] {
  const last = drag.at(-1);
  return [
    {
      title: tr("Perché i costi contano"),
      text: [
        tr("Sono piccoli ogni anno e non li vedi in nessun estratto conto, ma si accumulano sul capitale che cresce. Su orizzonti lunghi pesano più di molte scelte di investimento."),
      ],
    },
    {
      title: tr("Cosa inserire"),
      text: [
        tr("Nella tabella scrivi il costo annuo di ogni fondo (TER, in %): lo trovi nel KID o nella scheda del fondo. Per un ETF globale di solito è 0,1-0,4%. Poi premi «Salva costi»."),
        tr("A questo si aggiunge l'imposta di bollo (0,2% annuo sul valore) per i titoli in deposito; per le crypto non si applica."),
      ],
    },
    {
      title: tr("Il costo annuo"),
      text: [
        tr("Il portafoglio ti costa {0} l'anno{1}.", { 0: money(summary.annualCost, currency), 1: summary.annualPct !== null ? tr(", cioè {0} del valore", { 0: pct(summary.annualPct, 2) }) : "" }),
        summary.missingTerValue > 0 ? tr("Per posizioni da {0} non hai ancora inserito il costo: il totale è quindi più basso del reale.", { 0: money(summary.missingTerValue, currency) }) : "",
      ].filter(Boolean),
    },
    {
      title: tr("Il grafico dell'erosione"),
      text: [
        last ? tr("La linea tratteggiata è il portafoglio senza costi, quella piena è con i tuoi costi: dopo {0} anni hai {1} in meno, a parità di rendimento.", { 0: dragYears, 1: money(last.lost, currency) }) : tr("Inserisci i costi per vedere quanto erodono nel tempo."),
      ],
    },
    {
      title: tr("Se vendessi tutto oggi"),
      text: [
        tr("Il valore di mercato è {0}. Sulle plusvalenze non realizzate pagheresti circa {1}{2}, quindi ti resterebbero {3}.", { 0: money(liquidation.grossValue, currency), 1: money(liquidation.latentTax, currency), 2: liquidation.taxRatio !== null ? tr(" ({0} del valore)", { 0: pct(liquidation.taxRatio) }) : "", 3: money(liquidation.netValue, currency) }),
        tr("È l'imposta «nascosta» nel patrimonio: la stessa che il numero FIRE tiene in conto quando lo attivi nelle ipotesi."),
        tr("Stima semplificata con le aliquote standard: non considera compensazioni con minusvalenze pregresse né casi particolari."),
      ],
    },
  ];
}
  return { fireSteps, simulationSteps, withdrawalSteps, growthSteps, riskSteps, costsSteps };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { fireSteps, simulationSteps, withdrawalSteps, growthSteps, riskSteps, costsSteps } = localizedGuidedSteps("it");
