package io.buddybudget.core.domain.investments

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.BackfillState
import io.buddybudget.core.data.InspectPoint
import io.buddybudget.core.data.Instrument
import io.buddybudget.core.data.InstrumentCreateInput
import io.buddybudget.core.data.InstrumentSearchResult
import io.buddybudget.core.data.InstrumentSettingsInput
import io.buddybudget.core.data.InstrumentType
import io.buddybudget.core.data.InvestmentTransaction
import io.buddybudget.core.data.InvestmentsIncome
import io.buddybudget.core.data.InvestmentsPerformance
import io.buddybudget.core.data.InvestmentsTaxes
import io.buddybudget.core.data.InvestmentsView
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.OperationInput
import io.buddybudget.core.data.PriceOnDate
import io.buddybudget.core.data.SaleSimulation
import io.buddybudget.core.data.TitleAnalysis
import io.buddybudget.core.data.TitlesResponse
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.fixture
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.abs
import kotlin.math.pow
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Investimenti and Titoli (spec: features/07-investments.md, 08-securities-watchlist.md). View fixtures come from
// spec/api/fixtures (investments-*.json); instrument fixtures were captured from the dev server (demo user, 2026-10-19)
// into core/src/test/resources/fixtures/instruments-*.json. Twin: InvestmentsTests.swift.

private val json = ApiClient.DefaultJson
private fun <T> spec(s: DeserializationStrategy<T>, name: String): T = json.decodeFromString(s, fixture(name))
private fun <T> local(s: DeserializationStrategy<T>, name: String): T =
    json.decodeFromString(s, InvestmentsTest::class.java.getResource("/fixtures/$name")!!.readText())

private val italian = InvestmentsText(BBLocale.IT_IT) { it }
private val italianMasked = InvestmentsText(BBLocale.IT_IT, masked = true) { it }
private const val NBSP = " "

class InvestmentsTest {
    private val view by lazy { spec(InvestmentsView.serializer(), "investments-view.json") }

    // ---------------------------------------------------------------- View, query, tabs

    @Test fun INV005_decodesViewFixtures() {
        val v = view
        assertTrue(v.currency == "EUR" && v.period == "3mesi" && v.hasTransactions)
        assertEquals(13, v.summary.rows.size); assertEquals(93, v.series.size)
        assertEquals(InstrumentType.Etf, v.summary.rows[0].instrument.kind); assertEquals("yahoo", v.summary.rows[0].lastPrice?.origin)
        assertEquals(4, v.costScenarios.size); assertEquals(listOf(2026, 2025), v.operationYears)
        assertEquals("sotto", v.analysis.allocation?.rows?.first()?.status)
        assertTrue(v.operationMonths.first().operations.first().transaction.isReconciled)
        val excluded = spec(InvestmentsView.serializer(), "investments-view-ytd-excluded.json")
        assertEquals("ytd", excluded.period); assertEquals(InvestmentsView.DateRange("2026-01-01", "2026-10-18"), excluded.range)
        assertEquals(true, excluded.brokers.first { it.id == "manual" }.excluded)
    }

    @Test fun INV005_INV016_queryParameters() {
        val today = "2026-10-18"
        val custom = ChartRange("2026-03-01", "2026-06-30")
        assertEquals(mapOf("period" to "3mesi", "today" to today), InvestmentsQuery.make(InvestmentsPeriod.ThreeMonths, custom, today, emptySet()).parameters)
        val ytd = InvestmentsQuery.make(InvestmentsPeriod.Ytd, custom, today, setOf("manual", "degiro"))
        assertEquals(ChartRange("2026-01-01", today), ytd.range)
        assertEquals(mapOf("period" to "ytd", "today" to today, "excludeBrokers" to "degiro,manual"), ytd.parameters)
        val c = InvestmentsQuery.make(InvestmentsPeriod.Custom, custom, today, emptySet(), ChartRange("2026-04-01", "2026-05-01"))
        assertEquals(mapOf("period" to "custom", "from" to "2026-03-01", "to" to "2026-06-30", "today" to today, "selFrom" to "2026-04-01", "selTo" to "2026-05-01"),
            c.parameters)
        assertEquals(InvestmentsPeriod.ThreeMonths, InvestmentsQuery.make(InvestmentsPeriod.Custom, ChartRange("2026-12-01", "2026-01-01"), today, emptySet()).period)
        assertEquals(listOf("1M", "3M", "YTD", "1A", "Max", "Personalizzato"), InvestmentsPeriod.entries.map { it.label })
    }

    @Test fun INV017_customRangeValidation() {
        val today = "2026-10-18"
        assertTrue(InvestmentsRules.isValidRange(ChartRange("2026-01-01", today), today))
        assertFalse(InvestmentsRules.isValidRange(ChartRange("2026-02-30", today), today))
        assertFalse(InvestmentsRules.isValidRange(ChartRange("2026-05-01", "2026-04-01"), today))
        assertFalse(InvestmentsRules.isValidRange(ChartRange("2026-05-01", "2026-10-19"), today))
        assertEquals(ChartRange("2026-01-01", today), InvestmentsRules.defaultCustomRange(today))
    }

    @Test fun INV002_INV003_tabsAndCountryGating() {
        assertEquals(listOf("Portafoglio", "Performance", "Diversificazione", "Dividendi", "Tasse", "Operazioni"),
            InvestmentsTab.visible(MeBootstrap.Sections()).map { it.title })
        val off = MeBootstrap.Sections(investmentTaxes = false, investmentIncome = false)
        assertEquals(listOf(InvestmentsTab.Portfolio, InvestmentsTab.Performance, InvestmentsTab.Diversification, InvestmentsTab.Operations),
            InvestmentsTab.visible(off))
        assertEquals(InvestmentsCountryContent.Italian, InvestmentsCountryContent.of("IT"))
    }

    @Test fun INV091_germanUsersNeverGetTheItalianEngine() {
        assertEquals(InvestmentsCountryContent.GermanPlan, InvestmentsCountryContent.of("DE"))
    }

    @Test fun INV113_otherCountryGetsTheItalianScreensBeforeTaxWithoutTheTaxesTab() {
        // «Altro paese» (#465): Dividendi on the Italian engine, Tasse left out (server sections).
        assertEquals(InvestmentsCountryContent.Italian, InvestmentsCountryContent.of("OTHER"))
        val other = MeBootstrap.Sections(pension = false, investmentTaxes = false, financialPlanning = false)
        assertEquals(listOf(InvestmentsTab.Portfolio, InvestmentsTab.Performance, InvestmentsTab.Diversification, InvestmentsTab.Income, InvestmentsTab.Operations),
            InvestmentsTab.visible(other))
        assertFalse(InvestmentsCountryContent.Italian.blocksPath("/investimenti/proventi/x"))
    }

    @Test fun INV004_SEC001_legacyAndDeepLinks() {
        assertEquals(InvestmentsTab.Operations, InvestmentsTab.fromPath("/investimenti/rendiconti"))
        assertEquals(InvestmentsTab.Operations, InvestmentsTab.fromPath("/investimenti/rendiconti/importazioni"))
        assertEquals(InvestmentsTab.Portfolio, InvestmentsTab.fromPath("/investimenti/titoli"))
        assertEquals(InvestmentsTab.Taxes, InvestmentsTab.fromPath("/investimenti/tasse?x=1"))
        assertNull(InvestmentsTab.fromPath("/investimenti/titoli/abc"))
        assertEquals("abc", InvestmentsTab.instrumentId("/investimenti/titoli/abc"))
        assertNull(InvestmentsTab.instrumentId("/investimenti/titoli"))
    }

    @Test fun INV008_INV009_brokerSelector() {
        assertTrue(InvestmentsRules.showsBrokerSelector(view.brokers))
        var state = InvestmentsUiState.initial("2026-10-18")
        assertEquals("Tutti i broker", state.brokerChip(view.brokers).first)
        state = state.copy(excludedBrokers = setOf("manual"))
        assertEquals("Broker: {0} di {1}" to mapOf("0" to "1", "1" to "2"), state.brokerChip(view.brokers))
        assertEquals(listOf("manual"), state.portfolioQuery.excludedBrokers)
    }

    @Test fun INV010_gate() {
        assertEquals(InvestmentsGate.Loading, InvestmentsGate.of(false, false, false, false, true, false))
        assertEquals(InvestmentsGate.Failed, InvestmentsGate.of(false, true, false, false, true, false))
        assertEquals(InvestmentsGate.Content, InvestmentsGate.of(true, false, false, true, true, false))
        assertEquals(InvestmentsGate.Empty, InvestmentsGate.of(true, false, false, true, false, false))
        assertEquals(InvestmentsGate.EmptyFiltered, InvestmentsGate.of(true, false, false, false, false, true))
    }

    // ---------------------------------------------------------------- Portafoglio

    @Test fun INV011_INV012_INV014_heroSentences() {
        assertEquals("+41${NBSP}€ (+0,1%)", italian.dayChange(41.47, 0.000564, "EUR", false))
        assertEquals("Solo titoli. In più hai 1320$NBSP€ di liquidità sui broker (totale 74.939$NBSP€).", italian.cashLine(1320.0, 74938.97, "EUR", false))
        val gain = italian.periodGainSentence(view.periodGain!!, "EUR", false).joinToString("") { it.text }
        assertEquals("Da 18 lug 2026 il valore è passato da 77.486$NBSP€ a 73.619$NBSP€. Nel periodo hai ritirato 6588$NBSP€: quello non è guadagno. Il periodo ha reso +2886$NBSP€ (+3,8%), compresi 165$NBSP€ tra dividendi e cedole.", gain)
    }

    @Test fun INV013_maxSentenceAndBreakdown() {
        val runs = italian.gainSentence(view.breakdown, 0, "EUR", false)
        assertEquals("Per quello che possiedi hai pagato 66.394$NBSP€: il mercato ha aggiunto +7225$NBSP€ (+10,9%). Hai già incassato 2059$NBSP€ tra vendite, dividendi e cedole.",
            runs.joinToString("") { it.text })
        assertEquals(InvestmentsTextRun.Style.Pos, runs[3].style)
        val loss = InvestmentsView.Breakdown(1000.0, -100.0, 900.0, null, 0.0)
        assertEquals("Per quello che possiedi hai pagato 1000$NBSP€: il mercato ha tolto −100$NBSP€ (−10,0%). 2 strumenti non hanno ancora un prezzo e non è contato.",
            italian.gainSentence(loss, 2, "EUR", false).joinToString("") { it.text })
    }

    @Test fun INV018_INV019_costScenarios() {
        assertEquals(0.0, InvestmentsRules.costScenario(view.costScenarios, false, false)?.extra)
        val both = InvestmentsRules.costScenario(view.costScenarios, true, true)!!
        assertTrue(!both.includeFees && !both.includeTaxes)
        val hero = PortfolioHero.of(view, true, false)
        assertTrue(hero.simulating && !hero.showsDayChange && hero.registered?.size == 93)
        assertTrue(abs(hero.extra - 56.99) < 0.01)
        val off = PortfolioHero.of(view, false, false)
        assertTrue(!off.simulating && off.value == view.summary.totalValue && off.showsDayChange)
    }

    @Test fun INV021_positionTexts() {
        val row = view.summary.rows[0]
        assertEquals("191,16 quote", italian.quantityWithUnit(row))
        assertEquals("+2357,42$NBSP€ · +12,3%", italian.positionGain(row, "EUR", false))
        assertEquals("29%", InvestmentsRules.percent(row.weight ?: 0.0))
        assertEquals(false, view.priceNote(row.instrument.id)?.stale)
    }

    @Test fun INV030_instrumentIcons() {
        assertEquals("Ei", InstrumentIcons.initials("Energia Italia S.p.A."))
        assertEquals("Al", InstrumentIcons.initials("Alpenfood"))
        assertEquals(InstrumentIconSpec("iS", "blue"), InstrumentIcons.spec(InstrumentType.Etf, "iShares Core MSCI World"))
        assertEquals("violet", InstrumentIcons.spec(InstrumentType.Azione, "Nimbus Cloud Inc.").swatch)
        assertTrue(InstrumentIcons.wantsRemoteLogo(InstrumentType.Azione, "x") && !InstrumentIcons.wantsRemoteLogo(InstrumentType.Etf, "ETF Demo"))
    }

    // ---------------------------------------------------------------- Performance

    @Test fun INV031_INV033_decodesPerformance() {
        val p = spec(InvestmentsPerformance.serializer(), "investments-performance.json")
        assertEquals(94, p.returns?.series?.size); assertEquals("ok", p.returns?.values?.benchmarkStatus)
        assertTrue(p.benchmarkVerdict == "even" && p.risk?.level == 1 && p.risk?.sharpeLevel == "buono")
        assertTrue(p.heatmaps.mese?.grouping == "mese" && p.heatmaps.giorno != null)
        assertEquals("Bene", RiskCopy.sharpeWord(p.risk?.sharpeLevel))
        assertEquals("18 lug 2026 – 18 ott 2026", italian.rangeLabel(p.returns!!.values))
    }

    @Test fun INV034_inspectSnapsToNearestSampledPoint() {
        val p = spec(InvestmentsPerformance.serializer(), "investments-performance-max.json")
        assertEquals(160, p.inspect.size); assertEquals(427, p.returns?.series?.size)
        assertEquals(3, InvestmentsRules.nearestInspect(4, p.inspect)?.index)
        assertEquals(8, InvestmentsRules.nearestInspect(7, p.inspect)?.index)
        assertEquals(426, InvestmentsRules.nearestInspect(426, p.inspect)?.index)
        assertNull(InvestmentsRules.nearestInspect(0, emptyList<InspectPoint>()))
    }

    @Test fun INV038_INV039_benchmarkWait() {
        val running = BackfillState("b", "running", 10, 100, false)
        assertEquals(BenchmarkWait.Checking, BenchmarkRules.wait(BackfillRead.NotRead, null, "2026-01-01"))
        assertEquals(BenchmarkWait.Downloading(10, 100), BenchmarkRules.wait(BackfillRead.Read(running), null, "2026-01-01"))
        assertEquals(BenchmarkWait.Failed, BenchmarkRules.wait(BackfillRead.Read(null), null, "2026-01-01"))
        val done = BackfillState("b", "done", 1, 1, false)
        assertEquals(BenchmarkWait.NoHistory("2026-02-01"), BenchmarkRules.wait(BackfillRead.Read(done), "2026-02-01", "2026-01-01"))
        assertEquals(BenchmarkWait.Incomplete, BenchmarkRules.wait(BackfillRead.Read(null), "2025-01-01", "2026-01-01"))
        assertEquals(listOf("CSPX.L", "IWDA.AS", "VWCE.DE", "SXRV.DE"), BenchmarkRules.suggestions.map { it.yahooSymbol })
        assertEquals("even", BenchmarkRules.verdict(73618.97, 73287.87))
        assertEquals("better", BenchmarkRules.verdict(110.0, 100.0))
    }

    @Test fun INV041_SEC026_riskLevels() {
        assertEquals(listOf(1, 2, 2, 3, 3, 4), listOf(0.05, 0.08, 0.149, 0.15, 0.249, 0.3).map(TitleRules::riskLevel))
        assertEquals(1.0, TitleRules.riskScalePosition(0.7))
    }

    @Test fun INV042_drawdownText() {
        val recovered = InvestmentsPerformance.Drawdown(-0.012, "2026-07-23", "2026-07-27", "2026-07-31", 0.0)
        assertEquals("Dal 23 lug 2026 al 27 lug 2026; tornato al massimo in 4 giorni.", italian.drawdownText(recovered, 4))
        val open = InvestmentsPerformance.Drawdown(-0.1, "2026-07-23", "2026-07-27", null, -0.05)
        assertEquals("Dal 23 lug 2026 al 27 lug 2026; non è ancora tornato al massimo (a fine periodo −5,0%).", italian.drawdownText(open, null))
    }

    @Test fun INV044_heatmapSummary() {
        val p = spec(InvestmentsPerformance.serializer(), "investments-performance.json")
        assertEquals("4 mesi in guadagno e 0 in perdita.", italian.heatmapSummary(p.heatmaps.mese!!))
    }

    // ---------------------------------------------------------------- Diversificazione

    @Test fun INV053_INV054_allocationAndNextContribution() {
        val allocation = view.analysis.allocation!!
        assertEquals(mapOf("0" to "−6"), ExposureKeys.driftText(allocation.rows[0]).second)
        val suggestions = AllocationTargets.suggestContribution(allocation.analysis(), 100.0)
        assertTrue(suggestions.isNotEmpty() && abs(suggestions.sumOf { it.amount } - 100) < 0.01)
        assertTrue(AllocationTargets.suggestContribution(allocation.analysis(), 0.0).isEmpty())
    }

    @Test fun INV055_suggestedQuantityFloorsToFourDecimals() {
        assertEquals(0.8864, InvestmentsRules.suggestedQuantity(100.0, 112.804))
        assertNull(InvestmentsRules.suggestedQuantity(100.0, null))
    }

    @Test fun INV051_INV052_targetsEditor() {
        var rows = listOf(TargetDraft("a", "A", "60"), TargetDraft("b", "B", "30"))
        assertTrue(!TargetsEditor.canSave(rows) && TargetsEditor.missing(rows) == 10.0)
        rows = TargetsEditor.fillLast(rows)
        assertTrue(rows[1].percent == "40" && TargetsEditor.canSave(rows))
        assertEquals(listOf(0.6, 0.4), TargetsEditor.weights(rows).map { it.weight })
        assertFalse(TargetsEditor.canSave(rows + TargetDraft("a", "A", "0")))
        val initial = TargetsEditor.initial(emptyList(), listOf(InvestmentsView.Target("a", 0.27))) { it.uppercase() }
        assertEquals(listOf(TargetDraft("a", "A", "27")), initial)
    }

    @Test fun INV045_INV046_exposureLabels() {
        assertEquals("obbligazioni", view.analysis.sectors.slices.first().key)
        assertTrue(ExposureKeys.share(0.0453, BBLocale.IT_IT) == "4,5%" && ExposureKeys.share(0.23, BBLocale.IT_IT) == "23%")
        assertEquals("Stima dall'indice", ExposureKeys.sourceLabels["stima_indice"])
        assertTrue(PlainLabels.overlap(0.85).second == "alta" && PlainLabels.correlation(0.3).first == "Si muovono poco insieme")
        assertEquals(4, PlainLabels.decimal2(PlainLabels.averageCorrelation(view.analysis.correlationPairs) ?: 0.0, BBLocale.IT_IT).length)
    }

    // ---------------------------------------------------------------- Operazioni

    @Test fun INV056_INV057_INV058_operationsFilterAndTotals() {
        val v = view
        assertEquals(listOf(null, 2026, 2025), InvestmentsRules.yearOptions(v.operationYears))
        assertTrue(InvestmentsRules.yearOptions(listOf(2026)).isEmpty())
        assertEquals(3, InvestmentsRules.visibleMonths(v.operationMonths, null, false).size)
        assertEquals("2025-12", InvestmentsRules.visibleMonths(v.operationMonths, 2025, false).first().key)
        assertEquals(v.operationTotals, InvestmentsRules.totals(v.operationMonths, null, v.operationTotals))
        val y2025 = InvestmentsRules.totals(v.operationMonths, 2025, v.operationTotals)
        val months = v.operationMonths.filter { it.year == 2025 }
        assertEquals(months.sumOf { it.totals.count }, y2025.count)
        assertTrue(abs(y2025.bought - months.sumOf { it.totals.bought }) < 0.01)
        assertTrue(abs(y2025.gain - months.sumOf { it.totals.gain }) < 0.01)
    }

    @Test fun INV059_operationDetails() {
        val op = view.operationMonths.first().operations.first()
        assertEquals("28 set 2026 · 6,00${NBSP}USD lordi", italian.operationDetails(op, view.instrument(op.transaction.instrumentId)))
        assertEquals("Operazione sul capitale", operationTypeLabel("rettifica"))
    }

    @Test fun INV060_INV061_editableOperations() {
        assertTrue(InvestmentsRules.canEdit(InvestmentTransaction("1", "i", type = "acquisto", date = "2026-01-01")))
        assertFalse(InvestmentsRules.canEdit(InvestmentTransaction("1", "i", statementAccountKey = "U1", type = "acquisto", date = "2026-01-01")))
        assertFalse(InvestmentsRules.canEdit(InvestmentTransaction("1", "i", type = "rettifica", date = "2026-01-01")))
    }

    // ---------------------------------------------------------------- Register / edit operation

    private val etf = Instrument(id = "e", name = "ETF", type = "etf", currency = "USD")
    private val btp = Instrument(id = "b", name = "BTP", type = "obbligazione", priceUnit = "percentuale_nominale")

    @Test fun INV062_INV063_INV064_formShape() {
        assertEquals(listOf("acquisto", "vendita", "dividendo", "cedola", "rimborso", "split"), OperationType.entries.map { it.raw })
        var form = OperationForm(date = "2026-10-18")
        assertTrue(form.type == OperationType.Acquisto && form.stepCount == 3 && form.stepOneError == "Scegli uno strumento")
        form = form.copy(type = OperationType.Split)
        assertTrue(form.stepCount == 2 && !form.showsPrice && form.quantityLabel == "Quote nuove per ogni quota")
        form = form.copy(type = OperationType.Dividendo)
        assertTrue(form.showsGross && !form.showsQuantity)
    }

    @Test fun INV065_bondCountervalue() {
        val form = OperationForm(instrument = btp, date = "2026-10-18", quantity = "10000", price = "99,8")
        assertTrue(form.quantityLabel == "Valore nominale" && form.priceLabel == "Prezzo (% del nominale)")
        assertEquals(9980.0, form.countervalue!!, 1e-9)
    }

    @Test fun INV066_INV069_validation() {
        val today = "2026-10-18"
        assertEquals("La data non può essere nel futuro", OperationForm(instrument = etf, date = "2026-10-19", quantity = "1", price = "1").validate(today))
        assertEquals("Quantità non valida", OperationForm(instrument = etf, date = today, quantity = "0", price = "1").validate(today))
        assertEquals("Prezzo non valido", OperationForm(instrument = etf, date = today, quantity = "1", price = "").validate(today))
        assertEquals("Rapporto dello split non valido", OperationForm(OperationType.Split, etf, today).validate(today))
        assertEquals("Importo non valido", OperationForm(OperationType.Cedola, etf, today).validate(today))
        assertEquals("Cambio non valido", OperationForm(instrument = etf, date = today, quantity = "1", price = "1", fxRate = "0").validate(today))
        assertEquals("Importo non valido", OperationForm(instrument = etf, date = today, quantity = "2", price = "1", fees = "-1").validate(today))
        assertEquals("Non puoi vendere più quote di quelle che possiedi",
            OperationForm(OperationType.Vendita, etf, today, quantity = "5", price = "1", held = 4.0).validate(today))
        assertNull(OperationForm(OperationType.Vendita, etf, today, quantity = "4", price = "1", held = 4.0).validate(today))
    }

    @Test fun INV068_INV069_requestBody() {
        val form = OperationForm(instrument = etf, date = "2026-10-18", quantity = "1,5", price = "100", fees = "2,95", fxRate = "0,91")
        assertTrue(form.needsFx("EUR") && !form.needsFx("USD"))
        val input = form.input("2026-10-18")
        assertEquals(OperationInput("e", "acquisto", "2026-10-18", quantity = 1.5, price = 100.0, fxRate = 0.91, fees = 2.95), input)
        val body = input!!.toJson(forUpdate = true)
        assertTrue(body["instrumentId"] == null && body["type"]?.jsonPrimitive?.content == "acquisto")
        val split = OperationForm(OperationType.Split, etf, "2026-10-18", quantity = "2", fees = "5").input("2026-10-18")
        assertTrue(split?.fees == 0.0 && split.price == null && split.quantity == 2.0)
    }

    @Test fun INV067_priceSuggestionHint() {
        assertEquals(PriceSuggestionHint.Searching, PriceSuggestionHint.of(null, true, "2026-10-18"))
        assertEquals(PriceSuggestionHint.Downloading, PriceSuggestionHint.of(PriceOnDate(null, true), false, "2026-10-18"))
        assertEquals("Nessun prezzo per questa data: inseriscilo tu.", PriceSuggestionHint.of(PriceOnDate(null, false), false, "x")?.source)
        val close = PriceOnDate(PriceOnDate.Price("2026-10-16", 112.8, "yahoo"), false)
        assertEquals("Ultima chiusura prima di questa data, del {0}", PriceSuggestionHint.of(close, false, "2026-10-18")?.source)
        assertEquals("112,804123", OperationForm.priceText(112.80412345))
    }

    @Test fun INV071_editStartsFromSavedValues() {
        val t = InvestmentTransaction("t", "e", type = "vendita", date = "2026-09-18", quantity = "4.0833000000", price = "61.22400000", fxRate = "0.9",
            fees = "1.50", taxes = "0.00", note = "nota")
        val form = OperationForm.editing(t, etf, 10.0)
        assertTrue(form.type == OperationType.Vendita && form.quantity == "4,0833" && form.price == "61,224" && form.fees == "1,5" && form.taxes == "" &&
            form.fxRate == "")
        assertEquals("nota", form.input("2026-10-18")?.note)
    }

    // ---------------------------------------------------------------- Dividendi / Tasse

    @Test fun INV074_INV079_decodesIncome() {
        val i = spec(InvestmentsIncome.serializer(), "investments-income.json")
        assertTrue(i.byMonth.first().year == 2026 && i.byMonth.first().months.size == 12)
        assertTrue(i.forecast.events.first().basis == "storico" && IncomeRules.basisLabel("storico") == "dai tuoi incassi")
        assertTrue(i.pendingDividendHistory == 0 && i.history.count == 11)
        assertEquals("2025-10-28", IncomeRules.monthsAgo("2026-10-31", 12))
    }

    @Test fun INV083_INV087_decodesTaxes() {
        val t = spec(InvestmentsTaxes.serializer(), "investments-taxes.json")
        assertTrue(t.regime == "amministrato" && t.currentYear == 2026 && t.carryforwards.first().amountValue == 640.0)
        assertEquals(2026, TaxRules.recentYears(t.report.years).first().year)
        assertTrue(t.sellable.size == 13 && t.setting("8d725ad2-a8fb-4261-bbde-a1030171bc4c")?.couponFrequency == 2)
        val losses = listOf(
            InvestmentsTaxes.LossEntry(2024, 2028, 100.0, 80.0, "manuale", false), InvestmentsTaxes.LossEntry(2023, 2027, 50.0, 50.0, "calcolata", false),
            InvestmentsTaxes.LossEntry(2025, 2029, 30.0, 30.0, "calcolata", true),
        )
        assertEquals(listOf(2027, 2028), TaxRules.lossesByExpiry(losses).map { it.first })
        assertEquals(30.0, TaxRules.lossesByExpiry(losses, crypto = true).first().second)
    }

    @Test fun INV086_decodesSaleSimulation() {
        val s = spec(SaleSimulation.serializer(), "investments-simulate-sale.json")
        assertTrue(s.category == "capitale" && s.taxLineLabel == "Imposte trattenute" && s.quantity == 5.0)
    }

    @Test fun INV088_carryforwardValidation() {
        assertEquals("Anno non valido", TaxRules.carryforwardError(1999, 1.0, 2026))
        assertEquals("L'anno non può essere futuro", TaxRules.carryforwardError(2027, 1.0, 2026))
        assertEquals("Importo non valido", TaxRules.carryforwardError(2025, 0.0, 2026))
        assertNull(TaxRules.carryforwardError(2025, 640.0, 2026))
    }

    @Test fun INV082_SEC051_couponTermsAllOrNone() {
        assertNull(TaxRules.couponsError(null, null))
        assertEquals("Per le cedole servono tasso e scadenza", TaxRules.couponsError(3.1, null))
        assertEquals("Tasso non valido", TaxRules.couponsError(31.0, "2030-01-01"))
        val body = InstrumentSettingsInput(couponRate = 0.031, couponFrequency = 2, maturityDate = "2030-08-15").toJson()
        assertTrue(body["taxRate"] == JsonNull && body["couponFrequency"]?.jsonPrimitive?.content == "2")
    }

    // ---------------------------------------------------------------- Titoli

    @Test fun SEC002_SEC005_SEC006_searchGrouping() {
        val market = listOf(
            InstrumentSearchResult.MarketHit("BTC-EUR", "Bitcoin EUR", "CCC", "CCC", "crypto"),
            InstrumentSearchResult.MarketHit("VWCE.DE", "Vanguard FTSE All-World", "GER", "XETRA", "etf"),
            InstrumentSearchResult.MarketHit("AAPL", "Apple", "NMS", "NASDAQ", "azione"),
        )
        val coins = listOf(InstrumentSearchResult.CryptoHit("bitcoin", "Bitcoin", "btc"), InstrumentSearchResult.CryptoHit("btc2", "Bitcoin 2", "btc2"))
        val groups = InstrumentSearch.group(InstrumentSearchResult(market = market, crypto = coins), "btc")
        assertEquals(listOf(InstrumentType.Etf, InstrumentType.Azione, InstrumentType.Crypto), groups.map { it.type })
        assertEquals(listOf<MarketSearchItem>(MarketSearchItem.Coingecko(coins[0])), groups.last().items)
        assertEquals("VWCE.DE · XETRA", groups[0].items[0].detail("EUR"))
        assertEquals("BTC · in EUR", MarketSearchItem.Coingecko(coins[0]).detail("EUR"))
        val onlyCrypto = InstrumentSearch.group(InstrumentSearchResult(market = listOf(market[0]), crypto = coins), "btc")
        assertTrue(onlyCrypto.map { it.type } == listOf(InstrumentType.Crypto) && onlyCrypto[0].items.size == 2)
        assertTrue(!InstrumentSearch.isSearchable("a") && InstrumentSearch.isSearchable("ab"))
    }

    @Test fun SEC003_SEC004_knownRanking() {
        val a = Instrument(id = "a", name = "A"); val b = Instrument(id = "b", name = "B"); val c = Instrument(id = "c", name = "C")
        assertEquals(listOf("c", "b", "a"), InstrumentSearch.rankKnown(listOf(a, b, c), listOf(c, b)).map { it.id })
    }

    @Test fun SEC008_SEC009_createInputs() {
        assertEquals(InstrumentCreateInput.Yahoo("SWDA.MI", "W", "etf", "IE00B4L5Y983"),
            MarketSearchItem.Yahoo(InstrumentSearchResult.MarketHit("SWDA.MI", "W", type = "etf")).createInput("EUR", "IE00B4L5Y983"))
        assertTrue(InstrumentSearch.manualDefaultType("IT0005547408") == InstrumentType.Obbligazione && InstrumentSearch.manualDefaultType(null) == InstrumentType.Fondo)
        assertEquals(InstrumentCreateInput.Isin("IT0005547408", "BTP", "obbligazione", "EUR"),
            InstrumentSearch.manualInput(" BTP ", InstrumentType.Obbligazione, "EUR", "IT0005547408"))
        assertEquals(InstrumentCreateInput.Manual("Fondo", "fondo", "EUR", null), InstrumentSearch.manualInput("Fondo", InstrumentType.Fondo, "EUR", null))
        assertNull(InstrumentSearch.manualInput("", InstrumentType.Fondo, "EUR", null))
        assertNull(InstrumentSearch.manualInput("X", InstrumentType.Fondo, "eu", null))
        assertEquals("coingecko", InstrumentCreateInput.Coingecko("bitcoin", "Bitcoin", "EUR").toJson()["source"]?.jsonPrimitive?.content)
    }

    @Test fun SEC010_SEC011_watchlist() {
        val items = local(TitlesResponse.serializer(), "instruments-titles.json").items
        val watched = items.filter { it.watching && !it.held }
        assertEquals(15, items.size)
        assertEquals(listOf("ETF MSCI World Demo", "Vento Rinnovabili S.p.A."), watched.map { it.instrument.name })
        assertTrue(watched[1].activeAlerts == 1 && watched[1].spark.isNotEmpty())
        assertNull(items.first { it.instrument.name == "Fondo Bilanciato Demo" }.lastClose)
    }

    @Test fun SEC015_SEC017_decodesAnalysis() {
        val etf = local(TitleAnalysis.serializer(), "instruments-analysis-etf.json")
        assertTrue(etf.instrument.kind == InstrumentType.Etf && etf.series.size <= 240 && etf.position?.quantity == 191.16 && !etf.watching)
        assertTrue(etf.composition?.holdings?.first()?.symbol == "NMBS" && etf.fundamentalsStatus == "unavailable")
        val watched = local(TitleAnalysis.serializer(), "instruments-analysis-watched.json")
        assertTrue(watched.watching && watched.position == null && watched.alerts.first().isAbove == false && watched.alerts.first().target == 9.2)
        val bond = local(TitleAnalysis.serializer(), "instruments-analysis-bond.json")
        assertTrue(bond.instrument.isPercentOfNominal && bond.fundamentalsStatus == "unsupported")
    }

    @Test fun SEC019_keyFacts() {
        val etf = local(TitleAnalysis.serializer(), "instruments-analysis-etf.json")
        assertEquals(listOf("Volatilità", "Dal massimo"), TitleFormat.keyFacts(etf, BBLocale.IT_IT).map { it.label })
        val bond = local(TitleAnalysis.serializer(), "instruments-analysis-bond.json")
        val facts = TitleFormat.keyFacts(bond, BBLocale.IT_IT)
        assertEquals(listOf("1 anno", "Da inizio anno", "Volatilità", "Dal massimo"), facts.map { it.label })
        assertEquals("+1,5%", facts[0].value)
    }

    @Test fun SEC020_SEC021_chartMarkers() {
        val etf = local(TitleAnalysis.serializer(), "instruments-analysis-etf.json")
        val markers = TitleRules.purchaseMarkers(etf.series, etf.position!!.purchases)
        assertTrue(markers.isNotEmpty() && markers.all { it in etf.series.indices })
        assertTrue(TitleRules.isRising(etf.series))
        val series = listOf(TitleAnalysis.Point("2026-01-01", 2.0), TitleAnalysis.Point("2026-01-05", 1.0))
        assertEquals(listOf(1), TitleRules.purchaseMarkers(series, listOf(TitleAnalysis.Purchase("2026-01-03", 1.0), TitleAnalysis.Purchase("2025-01-01", 1.0))))
        assertFalse(TitleRules.isRising(series))
    }

    @Test fun SEC024_rangePosition() {
        assertEquals(0.5, TitleFormat.rangePosition(15.0, 10.0, 20.0))
        assertTrue(TitleRules.isAtHigh(-0.004) && !TitleRules.isAtHigh(-0.01))
    }

    @Test fun SEC030_alertLevelParsing() {
        assertEquals(12.5, TitleRules.parseAlertLevel("12,5"))
        assertEquals(12.5, TitleRules.parseAlertLevel("12.5"))
        assertEquals(1250.5, TitleRules.parseAlertLevel("1.250,5"))
        assertEquals(1250.5, TitleRules.parseAlertLevel("1,250.5"))
        assertTrue(TitleRules.parseAlertLevel("0") == null && TitleRules.parseAlertLevel("abc") == null && TitleRules.parseAlertLevel("") == null)
    }

    @Test fun SEC037_indicatorFormatting() {
        assertEquals("14,2", TitleFormat.indicator(14.23, "multiple", BBLocale.IT_IT))
        assertEquals("5,68", TitleFormat.indicator(5.678, "multiple", BBLocale.IT_IT))
        assertEquals("16,2%", TitleFormat.indicator(0.162, "pct", BBLocale.IT_IT))
        assertEquals("5,8×", TitleFormat.indicator(5.8, "times", BBLocale.IT_IT))
        assertEquals("0,0500 USD", TitleFormat.perShare(0.05, "USD", BBLocale.IT_IT))
        assertEquals(17, TitleFormat.indicatorMeta.size)
    }

    @Test fun SEC045_terCost() {
        assertTrue(abs(TitleRules.terCost(0.002, 10) - 10_000 * (1.05.pow(10) - (1.05 * 0.998).pow(10))) < 0.0001)
        assertEquals(0.0, TitleRules.terCost(0.0, 20))
    }

    @Suppress("unused") private fun unused() = assertNotNull(Unit)
}
