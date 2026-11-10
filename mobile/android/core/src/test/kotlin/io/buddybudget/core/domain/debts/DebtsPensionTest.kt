package io.buddybudget.core.domain.debts

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.DebtEventInput
import io.buddybudget.core.data.DebtEventView
import io.buddybudget.core.data.DebtPlanRow
import io.buddybudget.core.data.DebtsApi
import io.buddybudget.core.data.DebtsViewData
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.PensionApi
import io.buddybudget.core.data.PensionImportCounts
import io.buddybudget.core.data.PensionImportRowInput
import io.buddybudget.core.data.PensionSnapshot
import io.buddybudget.core.data.PensionView
import io.buddybudget.core.data.toJson
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.imports.ImportCsv
import io.buddybudget.core.domain.imports.ImportDateOrder
import io.buddybudget.core.domain.imports.ImportDecimalSeparator
import io.buddybudget.core.domain.imports.ImportValues
import io.buddybudget.core.domain.pension.PensionGate
import io.buddybudget.core.domain.pension.PensionImport
import io.buddybudget.core.domain.pension.PensionImportField
import io.buddybudget.core.domain.pension.PensionImportRow
import io.buddybudget.core.domain.pension.PensionImportState
import io.buddybudget.core.domain.pension.PensionImportedSnapshot
import io.buddybudget.core.domain.pension.PensionPlannedRow
import io.buddybudget.core.domain.pension.PensionRules
import io.buddybudget.core.domain.pension.PensionTab
import io.buddybudget.core.domain.pension.PensionText
import io.buddybudget.core.domain.pension.PensionUiState
import io.buddybudget.core.fixture
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Debiti and Pensione (spec: features/10-debts.md, 09-pension.md). Same cases as DebtsPensionTests.swift.
private const val TODAY = "2026-10-18"
private const val NB = " "

class DebtsPensionTest {
    private val it = DebtsText(BBLocale.IT_IT) { s -> s }
    private val pit = PensionText(BBLocale.IT_IT) { s -> s }
    private val json = ApiClient.DefaultJson
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()
    @AfterTest fun tearDown() = server.close()

    private fun client() = ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore(null))
    private fun debtsView() = json.decodeFromString(DebtsViewData.serializer(), fixture("debts-insights.json"))
    private fun pensionView() = json.decodeFromString(PensionView.serializer(), fixture("pension-view.json"))
    private fun mortgage() = debtsView().debts.first { d -> d.name == "Mutuo casa" }

    @Test fun DEBT001_decodesTheDebtsViewWithInsights() {
        val view = debtsView()
        assertEquals(3, view.debts.size)
        assertEquals(39937.23, view.overview.totalDebt)
        assertEquals(21, view.insights!!.exit.extras.size)
        assertEquals(DebtStartMode.ORIGINE, mortgage().startMode)
        assertEquals(DebtInstallmentStatus.DA_CONFERMARE, mortgage().plan.rows[0].status)
    }

    @Test fun DEBT002_heroSaysOpenLoansAndTheDebtFreeMonth() {
        val view = debtsView()
        val free = DebtsRules.freeDate(view.debts)
        assertEquals("2033-09-05", free)
        assertEquals("3 finanziamenti · liberi da debiti a settembre 2033", it.heroSubtitle(DebtsRules.openCount(view.debts), free))
        assertEquals("un finanziamento · liberi da debiti a settembre 2033", it.heroSubtitle(1, free))
        assertEquals("Nessun finanziamento aperto", it.heroSubtitle(0, null))
    }

    @Test fun DEBT003_relativeDueTexts() {
        assertEquals("oggi", it.dueText(0))
        assertEquals("domani", it.dueText(1))
        assertEquals("tra 12 giorni", it.dueText(12))
        assertEquals("scaduta ieri", it.dueText(-1))
        assertEquals("scaduta da 3 giorni", it.dueText(-3))
    }

    @Test fun DEBT004_overviewDueFindsItsUnsettledPlanRow() {
        val view = debtsView()
        val due = view.overview.nextDue.first()
        val row = assertNotNull(DebtsRules.dueRow(view.debt(due.debtId), due.date))
        assertEquals(due.date, row.dueDate)
    }

    @Test fun DEBT005_listRowDetailAndRepaidShare() {
        val view = debtsView()
        assertEquals("finisce a settembre 2033 · 2,94% TAEG", it.listDetail(mortgage()))
        assertEquals(0.2780636842105263, DebtsRules.repaidShare(mortgage(), view.insights), 1e-9)
        assertEquals(1 - 27433.58 / 38000, DebtsRules.repaidShare(mortgage(), null), 1e-9)
    }

    @Test fun DEBT006_exitSliderIndexesTheServerPlans() {
        val state = DebtsUiState(data = debtsView(), today = TODAY)
        val plan = assertNotNull(state.exitPlan)
        assertEquals(1708.25, plan.interestSaved)
        assertEquals(listOf("Cucina e lavatrice", "Prestito auto", "Mutuo casa"), plan.steps.map { s -> s.name })
        assertEquals("Chiuso a aprile 2027 invece di febbraio 2028", it.exitStep(plan.steps[0]))
        assertTrue(state.copy(exitExtra = 0.0).exitPlan!!.interestSaved < plan.interestSaved)
    }

    @Test fun DEBT008_gateStates() {
        assertEquals(DebtsGate.Loading, DebtsGate.of(false, false, 0))
        assertEquals(DebtsGate.Failed, DebtsGate.of(false, true, 0))
        assertEquals(DebtsGate.Empty, DebtsGate.of(true, false, 0))
        assertEquals(DebtsGate.Content, DebtsGate.of(true, false, 2))
    }

    @Test fun DEBT011_DEBT015_addFormComputesTheMissingFigure() {
        val form = DebtCalc.emptyAddDebtForm(DebtStartMode.NUOVO)
            .copy(name = "Prestito auto", firstInstallmentDate = "2026-11-15", principal = "15000", installments = "60", annualRate = "6,9")
        val resolved = (DebtCalc.resolveAddForm(form) as DebtAddFormResolution.Ok).value
        assertEquals(DebtLoanInputKey.INSTALLMENT, resolved.calculated)
        assertEquals("Abbiamo calcolato la rata: 296,31$NB€. Può differire di poco da quello della banca, per gli arrotondamenti.",
            it.calculated(DebtLoanInputKey.INSTALLMENT, resolved.inputs.installment, "EUR").joinToString("") { r -> r.text })
        assertEquals("296,31", it.calculatedPlaceholder(DebtLoanInputKey.INSTALLMENT, resolved))
        assertEquals("2031-10-15", DebtCalc.previewAddForm(form, resolved)!!.endDate.iso)
    }

    @Test fun DEBT017_createBodySendsInstallmentOnlyWhenTypedAndAnchorForSnapshots() {
        val form = DebtCalc.emptyAddDebtForm(DebtStartMode.FOTOGRAFIA)
            .copy(name = "Mutuo", firstInstallmentDate = "2026-11-01", principal = "100000", installments = "240", annualRate = "3")
        val resolved = (DebtCalc.resolveAddForm(form) as DebtAddFormResolution.Ok).value
        val body = DebtCalc.buildCreateDebtInput(form, resolved, TODAY).toJson()
        assertEquals(TODAY, body["anchorDate"]!!.jsonPrimitive.content)
        assertNull(body["installment"])
        assertEquals("fotografia", body["startMode"]!!.jsonPrimitive.content)
    }

    @Test fun DEBT016_createPostsAndReturnsTheId() = runTest {
        server.enqueue(MockResponse.Builder().code(201).body("""{"id":"d-1"}""").build())
        val form = DebtCalc.emptyAddDebtForm(DebtStartMode.NUOVO)
            .copy(name = "Auto", firstInstallmentDate = "2026-11-15", principal = "1000", installments = "10", annualRate = "0")
        val resolved = (DebtCalc.resolveAddForm(form) as DebtAddFormResolution.Ok).value
        assertEquals("d-1", DebtsApi(client()).create(DebtCalc.buildCreateDebtInput(form, resolved, TODAY)))
        assertEquals("/api/debts", server.takeRequest().url.encodedPath)
    }

    @Test fun DEBT018_factsTexts() {
        assertEquals("2,90% · 2,94%", it.rates(mortgage()))
        assertEquals("ancora da restituire · finisce a settembre 2033", it.residualCaption(mortgage()))
        assertEquals("In corso · dall'origine", it.startMode(mortgage().startMode))
    }

    @Test fun DEBT020_pendingBannerAndBulkPay() = runTest {
        val debt = mortgage()
        assertEquals("Il piano conta 37 rate già passate: se le hai pagate, confermale.", it.pending(debt))
        assertEquals(37, DebtsRules.unsettled(debt).last().number)
        assertEquals("Una rata segnata come pagata", it.bulkDone(1))
        assertEquals("4 rate segnate come pagate", it.bulkDone(4))
        server.enqueue(MockResponse.Builder().code(201).body("""{"count":37}""").build())
        assertEquals(37, DebtsApi(client()).bulkPay(debt.id, 37))
        val request = server.takeRequest()
        assertEquals("/api/debts/${debt.id}/payments/bulk", request.url.encodedPath)
        assertEquals("""{"upToInstallment":37}""", request.body!!.utf8())
    }

    @Test fun DEBT021_planShowsTwoPastAndEightNextRows() {
        val debt = mortgage()
        val range = DebtsRules.visibleRange(debt.plan.rows, TODAY)
        assertEquals(10, range.count())
        assertTrue(debt.plan.rows[range.first].dueDate < TODAY)
        assertTrue(debt.plan.rows[range.first + 2].dueDate >= TODAY)
        assertEquals("Mostra tutte le 120 rate (altre 110)", it.planToggle(false, 120, 110))
    }

    @Test fun DEBT022_rowBreakdownAndStatusLabels() {
        assertEquals("Capitale 273,35$NB€ · interessi 91,83$NB€ · residuo 37.726,65$NB€", it.rowBreakdown(mortgage().plan.rows[0], "EUR"))
        assertEquals("Da confermare", it.status(DebtInstallmentStatus.DA_CONFERMARE))
    }

    @Test fun DEBT023_paymentDefaultsAndValidation() = runTest {
        val past = DebtPlanRow(3, "2026-09-05", 365.18, 1.0, 1.0, 1.0, DebtInstallmentStatus.SCADUTA)
        val future = DebtPlanRow(4, "2026-11-05", 365.18, 1.0, 1.0, 1.0, DebtInstallmentStatus.DA_PAGARE)
        assertEquals("2026-09-05", DebtsRules.defaultPaymentDate(past, TODAY))
        assertEquals(TODAY, DebtsRules.defaultPaymentDate(future, TODAY))
        assertEquals(DebtsMessage("Inserisci l'importo pagato"), DebtsRules.paymentInput(past, TODAY, "0", null).second)
        val input = DebtsRules.paymentInput(past, "2026-09-05", "365,18", "t-1").first!!
        server.enqueue(MockResponse.Builder().code(201).body("""{"id":"e-1"}""").build())
        DebtsApi(client()).addEvent("d-1", input)
        val sent = Json.parseToJsonElement(server.takeRequest().body!!.utf8()).jsonObject
        assertEquals("payment", sent["type"]!!.jsonPrimitive.content)
        assertEquals("3", sent["installmentNumber"]!!.jsonPrimitive.content)
        assertEquals("365.18", sent["amount"]!!.jsonPrimitive.content)
        assertEquals("t-1", sent["transactionId"]!!.jsonPrimitive.content)
    }

    @Test fun DEBT024_candidatesQueryTheWindowAroundTheDueDate() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"items":[],"nextCursor":null}""").build())
        DebtsApi(client()).candidates("2026-11-05")
        val url = server.takeRequest().url
        assertEquals("2026-10-16", url.queryParameter("from"))
        assertEquals("2026-11-25", url.queryParameter("to"))
        assertEquals("uscita", url.queryParameter("type"))
    }

    @Test fun DEBT025_DEBT026_simpleEventsValidation() {
        assertEquals(DebtEventInput.RateChange(TODAY, 0.0), DebtEventDialogKind.RateChange.input(TODAY, "0").first)
        assertEquals(DebtsMessage("Inserisci un valore valido"), DebtEventDialogKind.BalanceCorrection.input(TODAY, "0").second)
        assertEquals(DebtEventInput.BalanceCorrection(TODAY, 12000.5), DebtEventDialogKind.BalanceCorrection.input(TODAY, "12.000,5").first)
        assertEquals(DebtsMessage("Inserisci un valore valido"), DebtEventDialogKind.RateChange.input(TODAY, "abc").second)
    }

    @Test fun DEBT027_eventsNewestFirstWithDescriptions() {
        val ordered = DebtsRules.orderedEvents(mortgage())
        assertTrue(ordered.first().date >= ordered.last().date)
        assertEquals("Rata 4 pagata", it.event(DebtEventView("1", "payment", "2026-01-05", installmentNumber = 4), "EUR"))
        assertEquals("Rata 4 pagata · 365,18$NB€", it.event(DebtEventView("1", "payment", "2026-01-05", amount = 365.18, installmentNumber = 4), "EUR"))
        assertEquals("Tasso portato al 3,25%", it.event(DebtEventView("2", "rate_change", "2026-01-05", rate = 3.25), "EUR"))
        assertEquals("Estinzione anticipata di 5000,00$NB€ · durata ridotta · penale 50,00$NB€",
            it.event(DebtEventView("3", "early_repayment", "2026-01-05", amount = 5000.0, penalty = 50.0, effect = "reduce_duration"), "EUR"))
        assertEquals("Residuo corretto a 20.000,00$NB€", it.event(DebtEventView("4", "balance_correction", "2026-01-05", amount = 20000.0), "EUR"))
    }

    @Test fun DEBT030_extraPerMonthSimulation() {
        val sim = assertNotNull(DebtsRules.extraSimulation(mortgage(), 200.0, TODAY))
        assertTrue(sim.monthsSaved > 0 && sim.interestSaved > 0 && sim.showsGain(200.0))
        val none = assertNotNull(DebtsRules.extraSimulation(mortgage(), 0.0, TODAY))
        assertEquals(0, none.monthsSaved)
        assertEquals("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi.", it.extraSentence(none, 0.0, "EUR").joinToString("") { r -> r.text })
        assertEquals("Finisci ", it.extraSentence(sim, 200.0, "EUR").first().text)
    }

    @Test fun DEBT031_refinanceNeedsRateAndWholeInstallments() {
        val debt = mortgage()
        assertNull(DebtsRules.refinance(debt, "", "83", "", "", TODAY))
        assertNull(DebtsRules.refinance(debt, "2", "8,5", "", "", TODAY))
        val good = assertNotNull(DebtsRules.refinance(debt, "1", "83", "100", "", TODAY))
        assertEquals(100.0, good.switchCosts)
        val verdict = it.refinanceVerdict(good, "EUR")
        assertTrue(verdict.second)
        assertTrue(verdict.first.startsWith("Conviene: risparmi "))
        assertFalse(it.refinanceVerdict(DebtsRules.refinance(debt, "9", "83", "0", "0", TODAY)!!, "EUR").second)
    }

    @Test fun DEBT030_DEBT031_simulationResultTexts() {
        val debt = mortgage()
        val sim = assertNotNull(DebtsRules.extraSimulation(debt, 200.0, TODAY))
        val extra = assertNotNull(it.extraResult(sim, 200.0, "EUR"))
        assertEquals("Finisci prima di", extra.label)
        assertEquals(it.duration(sim.monthsSaved), extra.value)
        assertTrue(extra.caption.endsWith(" di interessi."))
        assertNull(it.extraResult(assertNotNull(DebtsRules.extraSimulation(debt, 0.0, TODAY)), 0.0, "EUR"))
        val pos = it.refinanceResult(assertNotNull(DebtsRules.refinance(debt, "1", "83", "100", "", TODAY)), "EUR")
        assertTrue(pos.positive && pos.label == "Conviene: risparmi" && pos.caption.startsWith("Al netto delle spese"))
        val neg = it.refinanceResult(DebtsRules.refinance(debt, "9", "83", "0", "0", TODAY)!!, "EUR")
        assertFalse(neg.positive)
        assertEquals("Tra interessi e spese.", neg.caption)
    }

    @Test fun DEBT032_DEBT033_earlyRepaymentPreview() {
        val debt = mortgage()
        val values = DebtEarlyRepaymentFormValues(DebtEarlyRepaymentMode.ONCE, TODAY, "", "", DebtPenaltyUnit.EUR)
        assertEquals(DebtEarlyRepaymentPreview.Empty, DebtsRules.earlyRepayment(debt, TODAY, values))
        val once = DebtsRules.earlyRepayment(debt, TODAY, values.copy(amount = "5000")) as DebtEarlyRepaymentPreview.Once
        assertEquals(0.0, once.penalty)
        assertTrue(once.comparison.reduceDuration.monthsSaved > 0)
        assertTrue(once.comparison.reduceInstallment.nextInstallment < once.comparison.baselineInstallment)
        assertEquals(DebtEarlyRepaymentPreview.Error("La data è dopo l'ultima rata del piano"),
            DebtsRules.earlyRepayment(debt, TODAY, values.copy(amount = "5000", date = "2040-01-01")))
        assertEquals(DebtEarlyRepaymentPreview.Error("La penale non è valida"), DebtsRules.earlyRepayment(debt, TODAY, values.copy(amount = "5000", penalty = "-1")))
        assertEquals("stessa scadenza", it.monthsEarlier(0))
        assertEquals("1 mese prima", it.monthsEarlier(1))
        assertEquals("5 mesi prima", it.monthsEarlier(5))
    }

    @Test fun DEBT035_monthlyModeIsSimulationOnly() {
        val values = DebtEarlyRepaymentFormValues(DebtEarlyRepaymentMode.MONTHLY, "", "100", "", DebtPenaltyUnit.EUR)
        val monthly = DebtsRules.earlyRepayment(mortgage(), TODAY, values) as DebtEarlyRepaymentPreview.Monthly
        assertEquals(100.0, monthly.amount)
        assertTrue(monthly.result.monthsSaved > 0)
    }

    @Test fun DEBT038_deepLinksOpenTheDetail() {
        assertNull(DebtsRoutes.detailId("/debiti"))
        assertEquals("abc", DebtsRoutes.detailId("/debiti/finanziamenti?id=abc"))
        assertEquals("", DebtsRoutes.detailId("/debiti/finanziamenti"))
        assertEquals("", DebtsRoutes.detailId("/debiti/simulatore"))
        assertEquals(PensionTab.Scenarios, PensionTab.fromPath("/pensione/scenari"))
        assertEquals(PensionTab.Overview, PensionTab.fromPath("/pensione"))
    }

    // ---- Pensione

    @Test fun PEN001_DE_isUnavailable() = assertEquals(PensionGate.Unavailable, PensionUiState(unavailable = true).gate)

    @Test fun PEN002_decodesTheView() {
        val view = pensionView()
        assertEquals(1, view.funds.size)
        assertEquals(16, view.fund!!.snapshots.size)
        assertEquals(36, view.exitTax.timeline.size)
        assertEquals(620.0, view.projection.sliders.quarterlyContribution.default)
        val state = PensionUiState(view = view)
        assertEquals(PensionGate.Content, state.gate)
        assertTrue(state.hasSnapshots)
    }

    @Test fun PEN011_snapshotsNewestFirstWithContributionDelta() {
        val rows = PensionRules.snapshotRows(pensionView().fund!!.snapshots)
        assertEquals("2026-10-01", rows.first().snapshot.date)
        assertNull(rows.last().delta)
        assertEquals(620.0, rows.first().delta)
        val flat = PensionRules.snapshotRows(listOf(PensionSnapshot("a", "2026-01-01", 100.0, 100.0), PensionSnapshot("b", "2026-04-01", 100.0, 110.0)))
        assertNull(flat.first().delta)
    }

    @Test fun PEN010_snapshotAmountsAndDates() {
        assertEquals(10880.5, PensionRules.parseAmount("10880,5"))
        assertNull(PensionRules.parseAmount("-1"))
        assertNull(PensionRules.parseAmount(""))
        assertTrue(PensionRules.isPlausibleDate("2026-10-19", TODAY))
        assertFalse(PensionRules.isPlausibleDate("2026-10-20", TODAY))
        assertFalse(PensionRules.isPlausibleDate("1949-12-31", TODAY))
        assertFalse(PensionRules.isPlausibleDate("2026-02-30", TODAY))
    }

    @Test fun PEN008_profileSaveOnlyWhenChangedAndValid() {
        assertFalse(PensionRules.canSaveProfile("Fondo", "2020-01-01", "Fondo", "2020-01-01"))
        assertTrue(PensionRules.canSaveProfile("Fondo 2", "2020-01-01", "Fondo", "2020-01-01"))
        assertFalse(PensionRules.canSaveProfile("  ", "2020-01-01", "Fondo", "2020-01-01"))
    }

    @Test fun PEN019_heroTexts() {
        val perf = pensionView().performance!!
        assertEquals("Piano pensione · aggiornato al 1 ottobre 2026", pit.heroEyebrow("Piano pensione", perf.lastDate))
        assertEquals("+1162$NB€", pit.signedMoney(perf.gain, "EUR"))
        assertEquals("di guadagno sui contributi versati", pit.gainCaption(perf.gain))
        assertEquals("Rendimento annuo (stima)", pit.annualReturnLabel(perf.approximate))
        assertEquals("+6,0%", pit.signedPercent(perf.annualReturn!!))
    }

    @Test fun PEN021_insights() {
        val view = pensionView()
        assertTrue(PensionRules.beatsTfr(view))
        assertEquals(98209, view.projection.preview!!.base.toInt())
    }

    @Test fun PEN022_bestAndWorstYear() {
        val view = pensionView()
        val pair = assertNotNull(PensionRules.bestAndWorst(view.yearly))
        assertTrue(pair.first.gain >= pair.second.gain)
        assertNull(PensionRules.bestAndWorst(view.yearly.take(1)))
    }

    @Test fun PEN023_PEN025_PEN026_rateSimulationIndexesTheTimeline() {
        var state = PensionUiState(view = pensionView())
        assertEquals(4, state.shownYears)
        assertFalse(state.isSimulating)
        assertEquals(0.15, state.scenarios.first().rate)
        state = state.copy(simulatedYears = 20)
        assertTrue(state.isSimulating)
        assertEquals(0.135, state.scenarios.first().rate)
        assertEquals(9585.99055, state.scenarios.first().netLow)
        assertEquals("Simulazione: dopo 20 anni di adesione (nel 2042) l'aliquota sarebbe 13,5%, e alla pensione ti resterebbero almeno 9586$NB€ (+166$NB€ rispetto a oggi).",
            pit.taxSimulation(state, "2022-10-15", "EUR").joinToString("") { r -> r.text })
        assertFalse(state.copy(simulatedYears = 4).isSimulating)
        assertEquals(35, state.copy(simulatedYears = 99).shownYears)
    }

    @Test fun PEN024_tfrConclusion() {
        val view = pensionView()
        val runs = pit.tfrConclusion(view.last!!.value, view.tfr!!, view.assumedInflation, "EUR")
        assertEquals("Finora il fondo ha reso ", runs[0].text)
        assertEquals("687$NB€", runs[1].text)
    }

    @Test fun PEN027_PEN028_projectionMatchesTheServerPreview() {
        val view = pensionView()
        val state = PensionUiState(view = view)
        assertEquals(25, state.years)
        assertEquals(620.0, state.quarterly)
        val points = PensionRules.projection(view.last!!.value, state.quarterly, state.years, view.projection.rates)
        assertEquals(view.projection.preview!!.base, points.last().base, 0.01)
        assertEquals("tra 25 anni, di cui 1234$NB€ di rendimento", pit.projectionCaption(25, 1234.4, "EUR"))
    }

    @Test fun PEN014_PEN015_pasteIsReadWithDetectedMapping() {
        var wizard = PensionImportState(TODAY, emptyList(),
            text = "Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40\n30/06/2026;11.420,00;11.890,15\n31/13/2026;1;1").read()
        assertEquals(PensionImportState.Step.Columns, wizard.step)
        assertEquals(mapOf(PensionImportField.Date to 0, PensionImportField.NetContributions to 1, PensionImportField.Value to 2), wizard.mapping!!.columns)
        assertEquals(ImportDecimalSeparator.COMMA, wizard.mapping!!.decimal)
        assertEquals(ImportDateOrder.DMY, wizard.mapping!!.dateOrder)
        assertEquals(listOf("2026-03-31", "2026-06-30"), wizard.snapshots.map { s -> s.date })
        assertEquals(11890.15, wizard.snapshots[1].value)
        assertEquals(listOf(PensionImportRow.Error(4, "Data non valida")), wizard.problems)
        assertTrue(wizard.canContinue)
        wizard = wizard.copy(mapping = wizard.mapping!!.copy(columns = wizard.mapping!!.columns - PensionImportField.Value))
        assertEquals(listOf("Controvalore"), wizard.missing)
        assertFalse(wizard.canContinue)
    }

    @Test fun PEN016_planAgainstSavedSnapshots() {
        val existing = listOf(PensionSnapshot("s", "2026-03-31", 10880.0, 11000.0))
        val incoming = listOf(
            PensionImportedSnapshot(2, "2026-03-31", 10880.0, 11250.4),
            PensionImportedSnapshot(3, "2026-06-30", 11420.0, 11890.15),
            PensionImportedSnapshot(4, "2026-06-30", 11420.0, 11890.15),
            PensionImportedSnapshot(5, "2026-06-30", 1.0, 1.0),
        )
        val plan = PensionImport.plan(incoming, existing, TODAY)
        assertEquals(listOf(PensionPlannedRow.Status.Update, PensionPlannedRow.Status.New, PensionPlannedRow.Status.Unchanged, PensionPlannedRow.Status.Error),
            plan.rows.map { r -> r.status })
        assertEquals("Uguale alla riga {0}", plan.rows[2].message)
        assertEquals(mapOf("0" to "3"), plan.rows[3].messageValues)
        assertEquals(PensionImportCounts(1, 1, 1, 1), plan.counts)
        assertTrue(plan.blocked)
        assertEquals("Il fondo avrebbe più di {0} fotografie", PensionImport.plan(incoming, existing, TODAY, maxSnapshots = 1).error)
    }

    @Test fun PEN017_importSendsRowsAndReadsCounts() = runTest {
        server.enqueue(MockResponse.Builder().code(201).body("""{"counts":{"new":2,"update":0,"unchanged":1,"error":0}}""").build())
        val counts = PensionApi(client()).importSnapshots("f-1", listOf(PensionImportRowInput(2, "2026-03-31", 10880.0, 11250.4)))
        assertEquals(2, counts.new)
        val request = server.takeRequest()
        assertEquals("/api/pension/funds/f-1/snapshots/import", request.url.encodedPath)
        assertEquals("incollato", Json.parseToJsonElement(request.body!!.utf8()).jsonObject["format"]!!.jsonPrimitive.content)
    }

    @Test fun IMPORT_valueParsers() {
        assertEquals(1234.56, ImportValues.parseNumber("1.234,56$NB€", ImportDecimalSeparator.COMMA))
        assertEquals(1234.56, ImportValues.parseNumber("EUR 1,234.56", ImportDecimalSeparator.DOT))
        assertEquals(-12.5, ImportValues.parseNumber("(12,5)", ImportDecimalSeparator.COMMA))
        assertEquals(0.0003, ImportValues.parseNumber("3.0E-4", ImportDecimalSeparator.DOT))
        assertNull(ImportValues.parseNumber("abc", ImportDecimalSeparator.DOT))
        assertEquals(ImportDecimalSeparator.COMMA, ImportValues.detectDecimalSeparator(listOf("1.000"), ImportDecimalSeparator.COMMA))
        assertEquals(ImportDecimalSeparator.COMMA, ImportValues.detectDecimalSeparator(listOf("12,5", "1.234,56")))
        assertEquals("2026-01-05", ImportValues.parseDate("20260105", ImportDateOrder.YMD))
        assertEquals("2026-01-05", ImportValues.parseDate("05/01/26 10:00", ImportDateOrder.DMY))
        assertEquals(ImportDateOrder.MDY, ImportValues.detectDateOrder(listOf("12/31/2026")))
        assertEquals("quantitan", ImportValues.normalizeHeader("Quantità (n.)"))
        assertEquals(listOf(listOf("x, y", "2")), ImportCsv.parse("a,b\r\n\"x, y\",2\r\n").rows)
    }
}
