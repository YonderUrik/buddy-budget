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
import { formatYears, money, num, pct } from "./analytics-format";

export interface ReadingStep {
  title: string;
  /** Paragrafi del passo, in parole semplici e con i numeri dell'utente. */
  text: string[];
}

const RULE_NAMES: Record<WithdrawalRule, string> = {
  fissa: "spesa fissa",
  percentuale: "percentuale del patrimonio",
  "guyton-klinger": "Guyton-Klinger",
  vanguard: "Vanguard dinamica",
};

/** Passi della scheda Obiettivo FIRE. `leanTarget` è il numero con le sole spese Dovute e Saltuarie, se noto. */
export function fireSteps(plan: AnalyticsPlan, a: AnalyticsAssumptions, currency: string, leanTarget: number | null): ReadingStep[] {
  if (plan.target === null || plan.spending === null) return [];
  const savings = plan.savings ?? 0;
  const rate = pct(a.withdrawalRate);
  const first = plan.coast[0];
  const reached = plan.wealth >= plan.target;
  return [
    {
      title: "Parti da quanto spendi",
      text: [
        `La base di tutto è la tua spesa annua: ${money(plan.spending, currency)}. ${plan.spendingSource === "dati" ? "Viene dai tuoi movimenti degli ultimi 12 mesi." : "È il valore che hai scritto nelle ipotesi."}`,
        "Conta più di qualunque altra ipotesi: ogni euro in meno di spesa abbassa il traguardo e, nello stesso tempo, ti lascia più risparmio.",
      ],
    },
    {
      title: "Il tasso di prelievo",
      text: [
        `Hai scelto ${rate}: significa che ogni anno prelevi ${rate} del capitale. Su 100.000 € sono ${money(100000 * a.withdrawalRate, currency)} l'anno.`,
        "Un tasso più basso è più prudente (serve più capitale), uno più alto richiede meno capitale ma dura meno nei periodi cattivi. Il 3,5% è un valore prudente; il classico 4% viene dagli studi americani.",
      ],
    },
    {
      title: "Il numero FIRE",
      text: [
        `${money(plan.spending, currency)} ÷ ${rate} = ${money(plan.fireNumberGross ?? plan.target, currency)}. Questo è il capitale che, prelevando ${rate} l'anno, copre la tua spesa.`,
        plan.taxShare > 0
          ? `Poiché per prelevare devi vendere e sulle plusvalenze si pagano le imposte (circa ${pct(plan.taxShare)} del tuo patrimonio oggi), il numero sale a ${money(plan.target, currency)}: è quello che devi avere lordo per ritrovarti in mano la cifra giusta dopo le tasse.`
          : "Non risultano imposte sulle plusvalenze da considerare, quindi il numero non viene corretto.",
        leanTarget !== null ? `Se vivessi solo con le spese Dovute e Saltuarie, il numero scenderebbe a ${money(leanTarget, currency)} (il «lean FIRE»).` : "",
      ].filter(Boolean),
    },
    {
      title: "A che punto sei",
      text: [
        `Il tuo patrimonio è ${money(plan.wealth, currency)}: il ${pct(plan.progress ?? 0, 0)} del traguardo. La barra sotto i tre numeri mostra lo stesso dato.`,
        reached ? "Hai già raggiunto il numero: secondo queste ipotesi potresti vivere del patrimonio. Controlla la scheda Simulazione per vedere quanto reggerebbe." : `Mancano ${money(plan.target - plan.wealth, currency)}.`,
      ],
    },
    {
      title: "Quando ci arrivi",
      text: [
        savings > 0
          ? `Con ${money(savings, currency)} di risparmio l'anno e un rendimento reale del ${pct(a.expectedReturn)}, il traguardo arriva ${plan.yearsToFire === null ? "oltre gli 80 anni: con queste ipotesi in pratica non arriva" : `tra ${formatYears(plan.yearsToFire)}`}.`
          : "Con un risparmio nullo o negativo il patrimonio non cresce con i tuoi versamenti, quindi il traguardo non si avvicina da solo.",
        "«Rendimento reale» è già al netto dell'inflazione: tutti gli importi sono in euro di oggi, così sono confrontabili con la tua spesa.",
      ],
    },
    {
      title: "Coast FIRE",
      text: [
        first
          ? `Il Coast FIRE è il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE. Per arrivarci fra ${first.years} anni servono ${money(first.number, currency)}${plan.wealth >= first.number ? ": ce l'hai già" : ""}.`
          : "Il Coast FIRE è il capitale che, lasciato crescere senza versare altro, arriva da solo al numero FIRE.",
        "Se superi la cifra dell'orizzonte che ti interessa, puoi smettere di accantonare per il futuro e coprire solo le spese correnti.",
      ],
    },
    {
      title: "Quanto contano le ipotesi",
      text: [
        "Le due tabelle di sensibilità mostrano gli anni al traguardo cambiando due ipotesi alla volta. La cella evidenziata è la tua.",
        "Muoviti di una riga o una colonna: se gli anni cambiano poco, quell'ipotesi pesa poco. Di solito spesa e risparmio contano molto più del rendimento, e sono anche le due che controlli tu.",
      ],
    },
  ];
}

/** Passi della scheda Simulazione. */
export function simulationSteps(result: MonteCarloResult, input: MonteCarloInput, a: AnalyticsAssumptions, currency: string): ReadingStep[] {
  const retireIn = input.accumulationYears;
  const outOf100 = Math.round(result.successRate * 100);
  return [
    {
      title: "Perché non basta un calcolo solo",
      text: [
        "Un calcolo con un rendimento «medio» ogni anno dà una linea liscia, ma i mercati non vanno così: un brutto inizio pensione pesa molto più di una brutta fine.",
        `La simulazione genera ${result.paths.toLocaleString("it-IT")} futuri possibili, ognuno con rendimenti che oscillano a caso attorno al ${pct(a.expectedReturn)} annuo con una volatilità del ${pct(a.volatility, 0)}, e guarda come va il tuo patrimonio in ciascuno.`,
      ],
    },
    {
      title: "Il punto di partenza",
      text: [
        `Parti da ${money(input.startingWealth, currency)}. ${retireIn > 0 ? `Per ${retireIn} anni versi ${money(input.annualSavings, currency)} l'anno, poi inizia la pensione.` : "La pensione inizia subito: nessun versamento."}`,
        `Con l'interruttore in alto scegli se smettere oggi o quando raggiungi il traguardo FIRE.`,
      ],
    },
    {
      title: "La pensione",
      text: [
        `Spendi ${money(input.annualSpending, currency)} l'anno per ${a.retirementYears} anni, prelevando con la regola «${RULE_NAMES[a.rule]}» (la cambi nelle ipotesi, e la scheda Prelievi le confronta).`,
        "Tutto in euro di oggi: l'inflazione è già tolta, quindi la spesa non va rivalutata a mano.",
      ],
    },
    {
      title: "La probabilità di successo",
      text: [
        `${pct(result.successRate, 0)}: in ${outOf100} scenari su 100 il patrimonio dura fino alla fine, negli altri ${100 - outOf100} si esaurisce prima.`,
        "Non è una promessa: dice quanto margine hai. Sopra il 90% è solida, fra 75% e 90% regge ma con tagli nei casi sfortunati, sotto il 75% è fragile.",
      ],
    },
    {
      title: "Il grafico",
      text: [
        `La linea è il caso tipico (la mediana: metà degli scenari sta sopra, metà sotto). La fascia chiara contiene l'80% dei casi, quella scura il 50%.`,
        `Alla fine il caso tipico lascia ${money(result.endingWealth.p50, currency)}, il caso sfortunato (10° percentile) ${money(result.endingWealth.p10, currency)}. Passa il mouse sul grafico per leggere i valori di ogni anno.`,
      ],
    },
    {
      title: "Cosa provare",
      text: [
        "Cambia una ipotesi alla volta e guarda la probabilità: una spesa del 10% più bassa, qualche anno in più di accumulo, una volatilità diversa.",
        "Se il risultato cambia moltissimo spostando un'ipotesi di poco, fidati meno del numero: dipende troppo da quell'ipotesi.",
      ],
    },
  ];
}

/** Passi della scheda Prelievi. */
export function withdrawalSteps(results: MonteCarloResult[], a: AnalyticsAssumptions, plan: AnalyticsPlan, currency: string): ReadingStep[] {
  const best = results.reduce((x, y) => (y.successRate > x.successRate ? y : x));
  const fissa = results.find((r) => r.rule === "fissa");
  const flexible = results.filter((r) => r.rule !== "fissa");
  return [
    {
      title: "Perché la regola conta",
      text: [
        `Partendo da ${money(plan.wealth, currency)} e spendendo ${money(plan.spending ?? 0, currency)} l'anno per ${a.retirementYears} anni, il modo in cui decidi quanto prelevare cambia le probabilità di durare quasi quanto il capitale stesso.`,
        "Le quattro regole sono provate sugli stessi scenari casuali, quindi la differenza non dipende dalla fortuna.",
      ],
    },
    {
      title: "Le quattro regole",
      text: [
        "Fissa: la stessa spesa ogni anno, qualunque cosa faccia il mercato. È semplice ma fragile.",
        "Percentuale: ogni anno una quota del patrimonio. Non si esaurisce mai, ma la spesa sale e scende col mercato.",
        "Guyton-Klinger: spesa costante con due paracadute: si taglia del 10% se il prelievo pesa troppo, si aumenta del 10% se pesa poco.",
        "Vanguard dinamica: prelievo legato al patrimonio ma con variazioni limitate (da −2,5% a +5% l'anno), per non avere sbalzi.",
      ],
    },
    {
      title: "Le colonne della tabella",
      text: [
        "Successo: in quanti scenari il patrimonio dura. Taglio massimo tipico: di quanto scende la spesa, nel punto peggiore, nel caso tipico. Taglio nel 10% dei casi peggiori: lo stesso, ma per gli scenari più sfortunati.",
        "Patrimonio finale tipico: cosa resta alla fine nel caso tipico. Un valore molto alto vuol dire che avresti potuto spendere di più.",
      ],
    },
    {
      title: "Cosa dicono i tuoi numeri",
      text: [
        `La regola con più successo è «${RULE_NAMES[best.rule]}» (${pct(best.successRate, 0)}).${fissa ? ` La fissa arriva a ${pct(fissa.successRate, 0)}.` : ""}`,
        flexible.length > 0 ? `Il prezzo delle regole flessibili è nel taglio: nel 10% dei casi peggiori la spesa può scendere del ${pct(Math.max(...flexible.map((r) => r.maxCut.p90)), 0)} o più rispetto al primo anno.` : "",
        "Chiediti se sapresti davvero ridurre le spese di quella misura: se no, la regola migliore sulla carta non è la tua.",
      ].filter(Boolean),
    },
    {
      title: "Il grafico della spesa",
      text: [
        "Tocca una riga della tabella per vedere come cambierebbe la spesa anno dopo anno: la linea centrale è il caso tipico, quella rossa il caso sfortunato, quella verde il fortunato.",
        "Con la regola fissa le tre linee coincidono; con le altre si aprono a ventaglio.",
      ],
    },
  ];
}

/** Passi della scheda Crescita. */
export function growthSteps(split: GrowthSplit, currency: string): ReadingStep[] {
  return [
    {
      title: "La domanda a cui risponde",
      text: [
        "Il patrimonio è cresciuto perché hai risparmiato o perché il mercato è salito? La risposta cambia cosa puoi controllare.",
        "Si guardano liquidità e investimenti degli ultimi 12 mesi, mese per mese.",
      ],
    },
    {
      title: "I tre numeri",
      text: [
        `In totale il patrimonio è variato di ${money(split.totalDelta, currency)}.`,
        `Dal tuo risparmio (entrate meno uscite) arrivano ${money(split.totalFromSavings, currency)}${split.savingsShare !== null ? `, cioè il ${pct(split.savingsShare, 0)} della crescita` : ""}.`,
        `Il resto, ${money(split.totalFromMarket, currency)}, viene da mercato e altro: è calcolato per differenza.`,
      ],
    },
    {
      title: "Il grafico",
      text: [
        "Ogni barra è un mese: in blu la parte dal risparmio, in verde acqua la parte da mercato e altro. Le barre possono andare sotto lo zero quando il mercato scende.",
        "Un mese in cui la parte di mercato è negativa non è una perdita tua: è il valore dei titoli che scende.",
      ],
    },
    {
      title: "Come usarlo",
      text: [
        "Se domina il risparmio, la crescita dipende da te: è la leva più sicura. Se domina il mercato, stai beneficiando (o soffrendo) di qualcosa che non controlli.",
        "«Altro» include anche ciò che non passa dai movimenti (regali, rimborsi, trasferimenti non registrati): non leggerlo come rendimento puro.",
      ],
    },
  ];
}

/** Passi della scheda Rischio. */
export function riskSteps(base: AnalyticsBase, assumedVolatility: number): ReadingStep[] {
  const { risk, riskContribution } = base;
  if (!risk) return [];
  const top = riskContribution ? [...riskContribution].sort((x, y) => y.riskShare - x.riskShare)[0] : null;
  return [
    {
      title: "Cosa misura",
      text: [
        "Quanto il portafoglio oscilla e quanto può far male nei giorni e nei periodi peggiori. Si calcola sui prezzi giornalieri dei tuoi investimenti.",
        risk.fewData ? "Hai meno di un anno di dati: i numeri sono indicativi." : "",
      ].filter(Boolean),
    },
    {
      title: "Volatilità e peggior calo",
      text: [
        risk.volatility !== null ? `La volatilità è ${pct(risk.volatility)} annua: in un anno «normale» il portafoglio si muove di circa ± quella quota.` : "La volatilità non è calcolabile con i dati attuali.",
        risk.maxDrawdown !== null ? `Il peggior calo è −${pct(risk.maxDrawdown)}: dal punto più alto a quello più basso successivo. È la domanda che conta: reggeresti di vedere il patrimonio scendere così?` : "",
        `Nelle ipotesi hai messo ${pct(assumedVolatility, 0)}: se è molto lontana dalla volatilità osservata, la simulazione rischia di essere troppo ottimista o troppo cupa.`,
      ].filter(Boolean),
    },
    {
      title: "Sharpe, Sortino, Calmar",
      text: [
        `Sharpe${risk.sharpe !== null ? ` (${num(risk.sharpe)})` : ""} dice quanto rendimento ottieni per ogni unità di rischio; sopra 1 è buono.`,
        `Sortino${risk.sortino !== null ? ` (${num(risk.sortino)})` : ""} è lo stesso ma conta solo le oscillazioni verso il basso, che sono quelle che temi.`,
        `Calmar${risk.calmar !== null ? ` (${num(risk.calmar)})` : ""} confronta il rendimento annuo con il peggior calo: più è alto, meno hai sofferto per ogni punto guadagnato.`,
      ],
    },
    {
      title: "VaR e CVaR",
      text: [
        risk.tail ? `Nel 5% dei giorni peggiori il portafoglio perde almeno ${pct(risk.tail.var)} in una sola giornata (VaR 95%). In quei giorni la perdita media è ${pct(risk.tail.cvar)} (CVaR).` : "Non ci sono abbastanza giorni per calcolare VaR e CVaR.",
        "Il VaR è la soglia, il CVaR guarda cosa succede oltre la soglia: è il più onesto sulle code cattive.",
      ],
    },
    {
      title: "Quanto pesa ogni posizione",
      text: [
        top ? `La posizione che pesa di più sul rischio è «${base.names[top.id] ?? top.id}»: ${pct(top.riskShare, 0)} del rischio contro ${pct(top.weight, 0)} del valore.` : "Con almeno due posizioni e 60 giorni di prezzi in comune vedi il contributo di ciascuna.",
        risk.concentration ? `Le «posizioni effettive» sono ${num(risk.concentration.effectiveN, 1)}: un portafoglio con 10 titoli concentrati su 2 si comporta come 2.` : "",
        "Se la barra supera il trattino, quella posizione pesa sul rischio più di quanto pesi sul valore.",
      ].filter(Boolean),
    },
  ];
}

/** Passi della scheda Costi e tasse. */
export function costsSteps(summary: CostSummary, drag: CostDragPoint[], liquidation: AnalyticsPlan["liquidation"], currency: string, dragYears: number): ReadingStep[] {
  const last = drag.at(-1);
  return [
    {
      title: "Perché i costi contano",
      text: [
        "Sono piccoli ogni anno e non li vedi in nessun estratto conto, ma si accumulano sul capitale che cresce. Su orizzonti lunghi pesano più di molte scelte di investimento.",
      ],
    },
    {
      title: "Cosa inserire",
      text: [
        "Nella tabella scrivi il costo annuo di ogni fondo (TER, in %): lo trovi nel KID o nella scheda del fondo. Per un ETF globale di solito è 0,1-0,4%. Poi premi «Salva costi».",
        "A questo si aggiunge l'imposta di bollo (0,2% annuo sul valore) per i titoli in deposito; per le crypto non si applica.",
      ],
    },
    {
      title: "Il costo annuo",
      text: [
        `Il portafoglio ti costa ${money(summary.annualCost, currency)} l'anno${summary.annualPct !== null ? `, cioè ${pct(summary.annualPct, 2)} del valore` : ""}.`,
        summary.missingTerValue > 0 ? `Per posizioni da ${money(summary.missingTerValue, currency)} non hai ancora inserito il costo: il totale è quindi più basso del reale.` : "",
      ].filter(Boolean),
    },
    {
      title: "Il grafico dell'erosione",
      text: [
        last ? `La linea tratteggiata è il portafoglio senza costi, quella piena è con i tuoi costi: dopo ${dragYears} anni hai ${money(last.lost, currency)} in meno, a parità di rendimento.` : "Inserisci i costi per vedere quanto erodono nel tempo.",
      ],
    },
    {
      title: "Se vendessi tutto oggi",
      text: [
        `Il valore di mercato è ${money(liquidation.grossValue, currency)}. Sulle plusvalenze non realizzate pagheresti circa ${money(liquidation.latentTax, currency)}${liquidation.taxRatio !== null ? ` (${pct(liquidation.taxRatio)} del valore)` : ""}, quindi ti resterebbero ${money(liquidation.netValue, currency)}.`,
        "È l'imposta «nascosta» nel patrimonio: la stessa che il numero FIRE tiene in conto quando lo attivi nelle ipotesi.",
        "Stima semplificata con le aliquote standard: non considera compensazioni con minusvalenze pregresse né casi particolari.",
      ],
    },
  ];
}
