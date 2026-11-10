import "server-only";
/**
 * What the model behind «Chiedi all'AI» may answer for an analysis (`AnalysisQuery`) and the part of its prompt that
 * teaches the shape; server only, `cleanAnalysis` turns an answer into a query the server can compute.
 */

import { z } from "zod";
import { EXPENSE_GROUP_KEYS } from "@/lib/categories/groups";
import { ANALYSIS_COMPARE, ANALYSIS_DAYS, ANALYSIS_DIRECTIONS, ANALYSIS_GROUP_BY, ANALYSIS_MEASURES, ANALYSIS_PER } from "./analysis";

/** What the model may answer for an analysis: every field optional, checked and filled in by `cleanAnalysis`. */
export const analysisSchema = z.object({
  measure: z.enum(ANALYSIS_MEASURES).nullable().optional(),
  per: z.enum(ANALYSIS_PER).nullable().optional(),
  direction: z.enum(ANALYSIS_DIRECTIONS).nullable().optional(),
  text: z.string().max(200).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  group: z.enum(EXPENSE_GROUP_KEYS).nullable().optional(),
  account: z.string().max(200).nullable().optional(),
  minAmount: z.number().nullable().optional(),
  maxAmount: z.number().nullable().optional(),
  days: z.enum(ANALYSIS_DAYS).nullable().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  all: z.boolean().nullable().optional(),
  groupBy: z.enum(ANALYSIS_GROUP_BY).nullable().optional(),
  order: z.enum(["desc", "asc"]).nullable().optional(),
  limit: z.number().int().nullable().optional(),
  compare: z.enum(ANALYSIS_COMPARE).nullable().optional(),
});

/** The part of the prompt that teaches the model this shape (kept here, next to the schema it must match). */
export const ANALYSIS_PROMPT = `analisi = any other question about their movements (money spent, received, saved; how much, how often, the biggest, by what): {"question":{"type":"analisi","measure":"somma"|"media"|"mediana"|"conteggio"|"massimo"|"minimo"|"elenco","per":"movimento"|"giorno"|"settimana"|"mese"|"anno"|null,"direction":"uscite"|"entrate"|"netto","text":string|null,"category":string|null,"group":"dovuta"|"voluta"|"futuro"|"saltuaria"|null,"account":string|null,"minAmount":number|null,"maxAmount":number|null,"days":"feriali"|"weekend"|null,"from":"YYYY-MM-DD"|null,"to":"YYYY-MM-DD"|null,"all":boolean|null,"groupBy":"categoria"|"gruppo"|"esercente"|"conto"|"mese"|"settimana"|"giorno_settimana"|"anno"|null,"order":"desc"|"asc"|null,"limit":1-10|null,"compare":"precedente"|"anno_prima"|null}}
measure: somma = total; media = average (per = what it is the average of: "movimento" for one purchase, "mese" for "al mese"/"per month"/"monatlich", and so on); mediana = median of one movement; conteggio = how many times; massimo/minimo = the biggest/smallest movements, or with groupBy the period, category or merchant with the most/least; elenco = show or list the movements. direction: uscite = spending (default), entrate = income, netto = income minus spending (saved, left over). text = merchant or payee words as written ("Esselunga", "McDonald's"); category = a spending or income category as written ("ristoranti", "spesa", "stipendio", "groceries"); never both for the same word: a shop or brand is text, a kind of thing is category. group: dovuta = needs/essentials, voluta = wants/leisure, futuro = savings and investing, saltuaria = occasional. account = a bank account named. minAmount/maxAmount = bounds on one movement ("sopra 100 euro", "under 20"). days: weekend or feriali (working days). Period: from/to resolved against today ("quest'anno" = 1 January to today, "ultimi 3 mesi" = from the 1st of the month 2 months ago, "a ottobre" = that month, the last October not ahead of today); all = true for "da sempre"/"ever"/"jemals"; none named: all null. groupBy: "per categoria", "per mese", "ogni mese", "which month", "where" (esercente), "which day of the week" (giorno_settimana). order asc only for "least"/"smallest"/"meno". limit = how many asked for ("le 5 spese più grandi"). compare: precedente = "rispetto al mese/anno prima", anno_prima = "rispetto all'anno scorso" for the same months.`;

export type RawAnalysis = z.infer<typeof analysisSchema>;
