package io.buddybudget.core.domain.analytics

import io.buddybudget.core.domain.fire.MonteCarloInput
import io.buddybudget.core.data.AnalyticsApi
import io.buddybudget.core.data.AnalyticsAssumptionsPatch
import io.buddybudget.core.data.AnalyticsView
import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsApi
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.domain.costs.CostSummary
import io.buddybudget.core.domain.fire.FireAssumptions
import io.buddybudget.core.domain.fire.FireCalc
import io.buddybudget.core.domain.fire.FireExpectedReturnInfo
import io.buddybudget.core.domain.fire.FireGrowthInput
import io.buddybudget.core.domain.fire.FirePlanBase
import io.buddybudget.core.domain.fire.FirePlanning
import io.buddybudget.core.domain.fire.FireReturnSource
import io.buddybudget.core.domain.fire.FireRetireAt
import io.buddybudget.core.domain.fire.FireScenarioField
import io.buddybudget.core.domain.fire.FireScenarioOverrides
import io.buddybudget.core.domain.fire.FireSensitivityCell
import io.buddybudget.core.domain.fire.FireFigureSource
import io.buddybudget.core.domain.fire.MonteCarlo
import io.buddybudget.core.domain.fire.MonteCarloPublicPension
import io.buddybudget.core.domain.fire.WithdrawalRule
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.goals.GoalConstants
import io.buddybudget.core.domain.goals.GoalDraft
import io.buddybudget.core.domain.goals.GoalDraftSource
import io.buddybudget.core.domain.goals.GoalFormStep
import io.buddybudget.core.domain.goals.GoalKind
import io.buddybudget.core.domain.goals.GoalWizard
import io.buddybudget.core.domain.goals.GoalsFormCapacity
import io.buddybudget.core.domain.goals.GoalsGate
import io.buddybudget.core.domain.goals.GoalsLaunchIntent
import io.buddybudget.core.domain.goals.GoalsRules
import io.buddybudget.core.domain.goals.GoalsText
import io.buddybudget.core.domain.goals.GoalsUiState
import io.buddybudget.core.domain.goals.label
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.DataPeriod
import io.buddybudget.core.fixture
import io.buddybudget.core.fixtureJson
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.boolean
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

// Analitiche and Obiettivi (spec: features/11-analytics.md, 12-goals.md). `analytics-base.json` comes from
// spec/api/fixtures (2026-10-18, demo user); `goals.json` is the same capture of `GET /api/goals` (2026-10-19), copied
// into test resources until the spec submodule is bumped. Twin: AnalyticsGoalsTests.swift.
private const val NB = "\u00A0"

class AnalyticsGoalsTest {
    private val ait = AnalyticsText(BBLocale.IT_IT) { it }
    private val git = GoalsText(BBLocale.IT_IT, "EUR") { it }

    private fun analyticsView(): AnalyticsView = AnalyticsApi.decodeView(fixture("analytics-base.json"))
    private fun goalsView(): GoalsView =
        ApiClient.DefaultJson.decodeFromString(GoalsView.serializer(), AnalyticsGoalsTest::class.java.getResource("/fixtures/goals.json")!!.readText())
    private fun planJson(): JsonObject = fixtureJson("analytics-base.json", "plan").jsonObject
    private fun state() = AnalyticsUiState(view = analyticsView())
    private fun near(a: Double, b: Double, eps: Double = 1e-9) = assertTrue(abs(a - b) < eps, "$a != $b")

    // MARK: - Analitiche

    @Test fun ANA002_decodesTheBaseAndRecomputesTheServerPlan() {
        val view = analyticsView()
        assertEquals("EUR", view.currency)
        assertTrue(view.walkthroughSeen)
        assertEquals(0.04, view.storedAssumptions.expectedReturn)
        assertEquals(0.16, view.assumptions.expectedReturn)
        assertEquals(FireReturnSource.STORICO, view.returnInfo.source)
        assertEquals(13, view.base.positions.size)
        assertEquals(12, view.base.cashflow.months.size)
        assertEquals(316, view.base.risk?.observations)
        val plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
        val server = planJson()
        near(plan.target!!, server.getValue("target").jsonPrimitive.double, 1e-6)
        near(plan.yearsToFire!!, server.getValue("yearsToFire").jsonPrimitive.double)
        near(plan.wealth, server.getValue("wealth").jsonPrimitive.double, 1e-6)
        assertEquals(FireFigureSource.DATI, plan.spendingSource)
        assertEquals(5, plan.coast.size)
    }

    @Test fun ANA001_aCountryErrorShowsTheUnavailableState() {
        var s = AnalyticsUiState()
        assertEquals(AnalyticsGate.LOADING, s.gate)
        s = s.copy(failed = true)
        assertEquals(AnalyticsGate.FAILED, s.gate)
        s = s.copy(unavailable = true)
        assertEquals(AnalyticsGate.UNAVAILABLE, s.gate)
    }

    @Test fun ANA009_headlineSaysTheYearAndTheTimeLeft() {
        val plan = state().savedPlan!!
        val h = ait.headline(plan, plan, 2026)
        assertEquals("Puoi smettere di lavorare intorno al", h.lead)
        assertEquals("2039", h.big)
        assertEquals("tra 12,3 anni", h.sub)
        assertNull(h.comparison)
        val missing = FirePlanning.resolvePlan(
            FirePlanBase(FirePlanBase.Wealth(1000.0, 0.0, 0.0, 0.0), FirePlanBase.Cashflow(0.0, 0.0, 1), emptyList()), FireAssumptions.defaults,
        )
        val m = ait.headline(missing, missing, 2026)
        assertTrue(m.missing && m.big == "Mi serve la tua spesa annua")
    }

    @Test fun ANA010_sliderScenarioIsComparedWithTheSavedPlan() {
        var s = state()
        val saved = s.savedPlan!!
        s = s.moving(FireScenarioField.ANNUAL_SAVINGS, (saved.savings ?: 0.0) + 6000)
        assertTrue(s.hasScenario)
        val plan = s.scenarioPlan!!
        assertTrue(plan.yearsToFire!! < saved.yearsToFire!!)
        val h = ait.headline(plan, saved, 2026)
        assertTrue(h.positive)
        assertTrue(h.comparison!!.endsWith("prima delle ipotesi salvate"))
    }

    @Test fun ANA011_periodChoiceFollowsTheSavedPeriodAndPersistsWithAPatch() {
        var s = state()
        assertEquals(AnalyticsPeriodChoice.TWELVE, s.shownPeriodChoice)
        assertEquals(AnalyticsPeriodChoice.TWENTY_FOUR, AnalyticsPeriodChoice.of(DataPeriod.Ultimi(24)))
        s = s.choosingCustomPeriod()
        assertEquals("2025-10" to "2026-09", s.customFrom to s.customTo)
        val json = AnalyticsAssumptionsPatch.period(DataPeriod.Personalizzato("2025-01", "2025-12")).toJson()
        assertEquals("personalizzato", json.getValue("dataPeriod").jsonObject.getValue("kind").jsonPrimitive.content)
    }

    @Test fun ANA012_customPeriodIsValidated() {
        val today = CalendarDate(2026, 10, 18)
        assertEquals("Il mese in corso non è finito: fermati al mese scorso.", AnalyticsRules.customPeriodError("2025-10", "2026-10", today)?.source)
        assertEquals("Scegli almeno {0} mesi.", AnalyticsRules.customPeriodError("2026-08", "2026-09", today)?.source)
        assertEquals("Scegli al massimo 10 anni.", AnalyticsRules.customPeriodError("2015-01", "2026-09", today)?.source)
        assertNull(AnalyticsRules.customPeriodError("2024-01", "2026-09", today))
        assertEquals(2026, AnalyticsRules.pickerYears(today).first())
        assertEquals(11, AnalyticsRules.pickerYears(today).size)
    }

    @Test fun ANA013_showsTheActualRangeUsed() {
        val view = analyticsView()
        assertEquals("ott 2025 – set 2026", ait.rangeText(view.base.cashflow.fromKey, view.base.cashflow.toKey))
        assertEquals("negli ultimi 12 mesi", ait.periodPhrase(DataPeriod.Ultimi(12), "", ""))
        assertEquals("da gen 2024 a dic 2025", ait.periodPhrase(DataPeriod.Personalizzato("2024-01", "2025-12"), "2024-01-01", "2025-12-31"))
    }

    @Test fun ANA013_monthCalendarRangeAndBounds() {
        // No data yet: today falls back to 2026-01-01 and the period is the last 12 months.
        val s = AnalyticsUiState()
        assertEquals(io.buddybudget.core.domain.periods.DateKeyRange("2025-01", "2025-12"), s.customPeriodRange)
        assertEquals("2016-01", s.customPeriodMin)
        assertEquals("2025-12", s.customPeriodMax)
    }

    @Test fun ANA014_movingBackOntoTheBaselineClearsTheOverride() {
        var s = state()
        val saved = s.savedPlan!!
        s = s.moving(FireScenarioField.WITHDRAWAL_RATE, 0.04)
        assertEquals(0.04, s.overrides.withdrawalRate)
        s = s.moving(FireScenarioField.WITHDRAWAL_RATE, 0.0352)
        assertNull(s.overrides.withdrawalRate)
        s = s.moving(FireScenarioField.ANNUAL_SPENDING, (saved.spending ?: 0.0) + 30)
        assertNull(s.overrides.annualSpending)
        assertFalse(s.hasScenario)
    }

    @Test fun ANA015_deltaUnderAMovedSlider() {
        assertEquals("2 anni prima", ait.deltaText(12.3, 10.3))
        assertEquals("1,5 anni dopo", ait.deltaText(12.3, 13.8))
        assertNull(ait.deltaText(12.3, 12.32))
        assertEquals("il traguardo supera gli 80 anni", ait.deltaText(12.3, null))
    }

    @Test fun ANA016_sourcesOfTheFiguresAndTheWayBack() {
        val view = analyticsView()
        assertEquals("Dai tuoi dati", ait.returnSourceLabel(view.returnInfo))
        assertEquals(
            "Il tuo portafoglio negli ultimi 12 mesi ha reso 18,3% l'anno, 16,0% tolta l'inflazione.",
            ait.returnSourceText(view.returnInfo, "EUR", DataPeriod.Ultimi(12)),
        )
        assertNull(AnalyticsRules.historyOffer(view.returnInfo))
        val manual = FireExpectedReturnInfo(0.05, FireReturnSource.MANUALE, view.returnInfo.history, 0.6, false, false)
        assertEquals(0.5, AnalyticsRules.historyOffer(manual))
        assertEquals(JsonNull, AnalyticsAssumptionsPatch.useData(FireScenarioField.ANNUAL_SAVINGS).toJson()["annualSavings"])
        assertTrue(AnalyticsAssumptionsPatch.useHistoryReturn.toJson().getValue("expectedReturnAuto").jsonPrimitive.boolean)
        assertEquals(
            "Media mensile dei movimenti negli ultimi 12 mesi, moltiplicata per 12. I giroconti tra i tuoi conti non contano.",
            ait.cashflowAverageText("negli ultimi 12 mesi", 12, 12),
        )
    }

    @Test fun ANA017_optimisticReturnWarning() {
        assertTrue(analyticsView().returnInfo.high)
        assertEquals(0.08, FirePlanning.highReturnWarning)
        assertTrue(ait.highReturnText.startsWith("Sopra 8% reale"))
    }

    @Test fun ANA018_sliderIsReplacedWhenTheBaselineIsUnknown() {
        assertNull(FirePlanning.scenarioSlider(FireScenarioField.ANNUAL_SPENDING, null))
        assertNull(FirePlanning.scenarioSlider(FireScenarioField.ANNUAL_SAVINGS, null))
        assertNotNull(FirePlanning.scenarioSlider(FireScenarioField.EXPECTED_RETURN, null))
        assertEquals("Per calcolarla servono almeno 3 mesi di movimenti nel periodo scelto. Puoi scriverla in «Tutte le ipotesi».", ait.notKnownHint)
    }

    @Test fun ANA019_savingTheSlidersSendsOnlyTheMovedFields() {
        val patch = AnalyticsAssumptionsPatch.scenario(FireScenarioOverrides(annualSavings = 9000.0, withdrawalRate = 0.04))
        assertEquals(listOf("annualSavings", "withdrawalRate"), patch.keys)
        assertEquals(9000.0, patch.toJson().getValue("annualSavings").jsonPrimitive.double)
    }

    @Test fun ANA020_fourAnswerTilesDefaultingToArrivo() {
        val s = state()
        assertEquals(AnalyticsQuestion.QUANDO, s.selected)
        val costs = AnalyticsRules.costs(s.view!!.base, emptyMap(), "IT")
        val tiles = ait.tiles(s.savedPlan!!, false, 2026, null, 40.0, costs, "EUR")
        assertEquals(AnalyticsQuestion.entries.toList(), tiles.map { it.question })
        assertEquals("13%", tiles[0].value)
        assertEquals("97.534$NB€ su 768.307$NB€", tiles[0].note)
        assertEquals("2039", tiles[1].value)
        assertEquals("ai ritmi attuali", tiles[1].note)
        assertEquals("—", tiles[2].value)
        assertEquals("serve la spesa annua", tiles[2].note)
        assertEquals("0,20% l'anno", tiles[3].note)
        assertFalse(tiles[2].loading)
        // While the Monte Carlo runs the tile is loading, not «serve la spesa annua» (that is only for a missing spending).
        val computing = ait.tiles(s.savedPlan!!, false, 2026, null, 40.0, costs, "EUR", simulating = true)[2]
        assertTrue(computing.loading)
        assertEquals("", computing.value)
    }

    @Test fun ANA023_cancelledMonteCarloStopsEarly() {
        val input = MonteCarloInput(500_000.0, 0.0, 0.0, 40.0, 20_000.0, 0.05, 0.15, rule = WithdrawalRule.FISSA)
        var polls = 0
        MonteCarlo.runMonteCarlo(input) { ++polls > 10 }
        assertEquals(11, polls)
        assertEquals(MonteCarlo.runMonteCarlo(input), MonteCarlo.runMonteCarlo(input) { false })
    }

    @Test fun ANA021_journeySentencesMatchTheServer() {
        val view = analyticsView()
        val plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
        val split = FireCalc.splitGrowth(view.base.splitPoints)
        val sentences = ait.journeySentences(plan, split, "EUR", view.assumptions.withdrawalRate)
        val server = fixtureJson("analytics-base.json", "growth", "journey").jsonArray.map { it.jsonPrimitive.content }
        assertEquals(server, sentences)
    }

    @Test fun ANA022_timelineSeriesMatchesTheServer() {
        val s = state()
        val series = AnalyticsRules.timelineSeries(s.savedPlan!!, s.view!!.assumptions)
        val server = fixtureJson("analytics-base.json", "timeline", "series").jsonArray
        assertEquals(server.size, series.size)
        series.zip(server).forEach { (a, b) -> near(a.wealth, b.jsonObject.getValue("wealth").jsonPrimitive.double, 1e-6) }
    }

    @Test fun ANA023_monteCarloIsDeterministicAndComparesTheFourRules() {
        val input = state().simulationInput!!
        assertEquals(0.0, input.accumulationYears)
        val a = MonteCarlo.compareRules(input)
        val b = MonteCarlo.compareRules(input)
        assertEquals(a, b)
        assertEquals(WithdrawalRule.entries.toList(), a.map { it.rule })
        val answer = ait.lastingAnswer(a, WithdrawalRule.FISSA, 40.0)!!
        assertEquals(4, answer.rules.size)
        assertTrue(answer.headline.startsWith("Se smettessi oggi, il patrimonio dura 40 anni nel "))
        assertTrue(answer.headline.endsWith("(regola: spesa fissa)."))
    }

    @Test fun ANA024_costsAnswerCountsStampDutyAndLatentTax() {
        val s = state()
        val view = s.view!!
        val summary = AnalyticsRules.costs(view.base, mapOf("160469f4-e5ab-47c0-ae0b-e98b9272a5a9" to 0.002), "IT")
        assertTrue(summary.annualCost > 0)
        val drag = AnalyticsRules.drag(summary, view.assumptions.expectedReturn)
        assertEquals(31, drag.size)
        val sentences = ait.costsSentences(summary, drag.last().lost, 30, s.savedPlan!!.liquidation, "EUR")
        assertTrue(sentences.first().startsWith("Costi dei fondi e bollo: "))
        assertTrue(sentences.any { it.startsWith("Per posizioni da ") })
        assertEquals("Vendendo tutto oggi pagheresti circa 2223$NB€ di imposte sulle plusvalenze.", sentences.last())
    }

    @Test fun ANA025_guidanceWhenSpendingOrPositionsAreMissing() {
        val empty = CostSummary(emptyList(), 0.0, 0.0, null, 0.0)
        assertEquals(
            listOf("Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano."),
            ait.costsSentences(empty, null, 30, FireCalc.computeLiquidation(emptyList()), "EUR"),
        )
        val s = AnalyticsUiState()
        assertNull(s.simulationInput)
        assertNull(s.scenarioPlan)
    }

    @Test fun ANA026_expertPanelsStartCollapsed() = assertTrue(AnalyticsUiState().expertOpen.isEmpty())

    @Test fun ANA027_growthSplitNeedsTwoMonths() {
        assertEquals(12, FireCalc.splitGrowth(analyticsView().base.splitPoints).rows.size)
        assertEquals("nov 25", ait.shortMonth("2025-11"))
    }

    @Test fun ANA028_sensitivityTablesCentreOnTheUsersCell() {
        val s = state()
        val plan = s.savedPlan!!
        val a = s.view!!.assumptions
        val rate = AnalyticsRules.rateSensitivity(plan, a, ait)!!
        assertEquals(listOf("2,5%", "3,0%", "3,5%", "4,0%", "4,5%"), rate.rows)
        assertEquals(listOf("14,0%", "15,0%", "16,0%", "17,0%", "18,0%"), rate.columns)
        // The tables use the gross FIRE number (no latent tax), like the web.
        val gross = FireCalc.yearsToTarget(FireGrowthInput(plan.wealth, plan.savings!!, a.expectedReturn), plan.fireNumberGross!!)
        assertEquals(gross, rate.cells[2][2].years)
        val spend = AnalyticsRules.spendingSensitivity(plan, a, ait)!!
        assertEquals(listOf("−20%", "−10%", "0%", "+10%", "+20%"), spend.rows)
        assertEquals("12,3 a", AnalyticsRules.cellText(FireSensitivityCell(0.0, 0.0, 12.27), ait))
        assertEquals("ok", AnalyticsRules.cellText(FireSensitivityCell(0.0, 0.0, 0.0), ait))
        assertNotNull(AnalyticsRules.leanNumber(s.view!!.base, a))
    }

    @Test fun ANA029_simulationCanRetireAtTheFireTarget() {
        val input = state().copy(retireAt = FireRetireAt.FIRE).expertSimulationInput!!
        assertEquals(13.0, input.accumulationYears)
    }

    @Test fun ANA031_terIsValidatedBetweenZeroAndFive() {
        val positions = analyticsView().base.positions
        val id = positions[0].id
        assertEquals(AnalyticsValidation.Ok(mapOf(id to 0.002)), AnalyticsRules.validateTers(mapOf(id to "0,20"), positions))
        val error = AnalyticsRules.validateTers(mapOf(id to "7"), positions)
        if (error is AnalyticsValidation.Error<*>) {
            assertEquals("ETF Azionario Globale Demo", (error.error as io.buddybudget.core.domain.overview.CatalogText).values["0"])
        } else {
            fail("expected an error")
        }
        assertEquals(mapOf(id to "0,22"), AnalyticsRules.terDrafts(mapOf(id to 0.0022)))
        assertEquals(0.002, AnalyticsAssumptionsPatch.ters(mapOf(id to 0.002)).toJson().getValue("terByInstrument").jsonObject.getValue(id).jsonPrimitive.double)
    }

    @Test fun ANA032_glossaryTermsAreUnderlinedOnce() {
        val parts = ait.glossed("Il numero FIRE è la tua spesa annua divisa per il tasso di prelievo; il numero FIRE resta.")
        assertEquals(
            listOf(
                AnalyticsTextPart.Text("Il "), AnalyticsTextPart.Term("numero-fire", "numero FIRE"),
                AnalyticsTextPart.Text(" è la tua spesa annua divisa per il "), AnalyticsTextPart.Term("tasso-prelievo", "tasso di prelievo"),
                AnalyticsTextPart.Text("; il numero FIRE resta."),
            ),
            parts,
        )
        assertEquals("VaR 95%", AnalyticsContent.term("var")?.title)
        assertEquals(9, AnalyticsContent.explainers.size)
    }

    @Test fun ANA033_allAssumptionsAreValidatedIntoAPartialUpdate() {
        val view = analyticsView()
        var draft = AnalyticsAssumptionsDraft.of(view.storedAssumptions)
        assertEquals("3,5", draft.percents[AnalyticsAssumptionsDraft.PercentField.WITHDRAWAL_RATE])
        assertEquals("40", draft.years)
        var patch = (draft.submit(ait) as AnalyticsValidation.Ok).value
        assertNull(patch["expectedReturn"])
        assertEquals(AnalyticsAssumptionsPatch.Value.Number(0.035), patch["withdrawalRate"])
        assertEquals(AnalyticsAssumptionsPatch.Value.Null, patch["annualSpending"])
        assertEquals(AnalyticsAssumptionsPatch.Value.Pension(null), patch["publicPension"])
        draft = draft.set(AnalyticsAssumptionsDraft.PercentField.WITHDRAWAL_RATE, "12")
        assertEquals(
            AnalyticsValidation.Error(AnalyticsMessage("Tasso di prelievo: inserisci un valore tra 1,0% e 10,0%.")),
            draft.submit(ait),
        )
        draft = draft.set(AnalyticsAssumptionsDraft.PercentField.WITHDRAWAL_RATE, "4").copy(years = "40,5")
        assertEquals(AnalyticsValidation.Error(AnalyticsMessage("Anni di pensione: inserisci un numero intero tra 5 e 70.")), draft.submit(ait))
        draft = draft.copy(years = "35").set(AnalyticsAssumptionsDraft.PercentField.EXPECTED_RETURN, "5").copy(pensionAnnual = "12.000", pensionAfter = "10")
        patch = (draft.submit(ait) as AnalyticsValidation.Ok).value
        assertEquals(AnalyticsAssumptionsPatch.Value.Number(0.05), patch["expectedReturn"])
        assertEquals(AnalyticsAssumptionsPatch.Value.Pension(MonteCarloPublicPension(12000.0, 10.0)), patch["publicPension"])
    }

    @Test fun ANA034_resetRestoresTheRecommendedValues() {
        val view = analyticsView()
        var draft = AnalyticsAssumptionsDraft.of(view.storedAssumptions)
            .set(AnalyticsAssumptionsDraft.PercentField.VOLATILITY, "30").copy(rule = WithdrawalRule.VANGUARD, includeTax = false)
        draft = draft.resetToDefaults(view.returnInfo)
        assertEquals("12", draft.percents[AnalyticsAssumptionsDraft.PercentField.VOLATILITY])
        assertTrue(draft.rule == WithdrawalRule.FISSA && draft.includeTax && !draft.includePension)
        assertEquals("40", draft.years)
        assertFalse(draft.returnAuto)
    }

    @Test fun ANA035_legacyRoutesSelectTheirQuestion() {
        assertEquals(AnalyticsQuestion.COSTI, AnalyticsQuestion.fromPath("/analitiche/costi"))
        assertEquals(AnalyticsQuestion.DOVE_SONO, AnalyticsQuestion.fromPath("/analitiche/crescita"))
        assertEquals(AnalyticsQuestion.REGGERA, AnalyticsQuestion.fromPath("/analitiche/simulazione"))
        assertEquals(AnalyticsQuestion.REGGERA, AnalyticsQuestion.fromPath("/analitiche#reggera"))
        assertNull(AnalyticsQuestion.fromPath("/analitiche"))
    }

    @Test fun ANA005_walkthroughHasSixSteps() {
        assertEquals(6, AnalyticsContent.walkthrough.size)
        assertEquals("Quattro domande, una risposta ciascuna", AnalyticsContent.walkthrough[0].title)
    }

    @Test fun ANA008_goalDialogPreviewsAndLinksToTheData() {
        val view = analyticsView()
        val plan = FirePlanning.resolvePlan(view.base.planBase, view.assumptions)
        var draft = AnalyticsGoalDraft.of(plan)
        assertEquals("26.278", draft.text)
        assertTrue(draft.followsData)
        assertEquals(JsonNull, draft.patch!!.toJson()["annualSpending"])
        draft = draft.copy(text = "30.000")
        assertFalse(draft.followsData)
        assertEquals(30000.0, draft.patch!!.toJson().getValue("annualSpending").jsonPrimitive.double)
        val preview = draft.preview(view.base, view.assumptions)!!
        near(preview.fireNumberGross!!, 30000 / 0.035, 1e-6)
        assertTrue(ait.goalPreviewWhen(preview, 2026).startsWith("Ai ritmi di oggi ci arrivi intorno al "))
        assertNull(draft.copy(text = "0").patch)
    }

    @Test fun ANA_parseNumberReadsItalianNumbers() {
        assertEquals(3.5, AnalyticsRules.parseNumber("3,5"))
        assertEquals(1250.5, AnalyticsRules.parseNumber("1.250,5"))
        assertEquals(24000.0, AnalyticsRules.parseNumber("24.000"))
        assertNull(AnalyticsRules.parseNumber(" "))
        assertNull(AnalyticsRules.parseNumber("abc"))
        assertEquals("3,5", AnalyticsRules.toFieldText(0.035, percent = true))
        assertEquals("26278", AnalyticsRules.toFieldText(26277.89, percent = false))
    }

    // MARK: - Obiettivi

    @Test fun GOAL004_decodesTheGoalsViewAndReusesItForFiveMinutes() {
        val view = goalsView()
        assertEquals(3, view.goals.size)
        assertEquals(17, view.sources.size)
        assertEquals(2039, view.fire?.baseYear)
        assertEquals(1428.0, view.essentialMonthly)
        assertEquals("instrument", view.goals[2].sources[0].kind)
        val s = GoalsUiState(view = view, loadedAt = 1_000L)
        assertTrue(s.isFresh(1_000L + 299_000))
        assertFalse(s.isFresh(1_000L + 301_000))
        assertEquals(GoalsGate.CONTENT, s.gate)
    }

    @Test fun GOAL002_countryErrorShowsUnavailable() = assertEquals(GoalsGate.UNAVAILABLE, GoalsUiState(unavailable = true).gate)

    @Test fun GOAL003_deepLinksOpenTheFormWithThePresetKind() {
        assertEquals(GoalsLaunchIntent.New(GoalKind.VIAGGIO), GoalsLaunchIntent.parse("/analitiche/obiettivi?nuovo=1&tipo=viaggio&da=novita"))
        assertEquals(GoalsLaunchIntent.New(null), GoalsLaunchIntent.parse("/analitiche/obiettivi?nuovo=1&tipo=boh"))
        assertEquals(GoalsLaunchIntent.List, GoalsLaunchIntent.parse("/analitiche/obiettivi"))
        assertEquals(GoalsLaunchIntent.Detail("abc"), GoalsLaunchIntent.parse("/analitiche/obiettivi/abc"))
        assertNull(GoalsLaunchIntent.parse("/analitiche"))
    }

    @Test fun GOAL005_GOAL006_emptyStateSuggestsAnEmergencyFund() {
        val view = goalsView()
        val empty = GoalsView(currency = "EUR", sources = view.sources, essentialMonthly = 1428.0)
        assertEquals(GoalsGate.EMPTY, GoalsUiState(view = empty).gate)
        val (target, free) = GoalsRules.emergencySuggestion(empty)!!
        assertEquals(8600.0, target)
        near(free, 8100 + 145 + 5050.34 + 1320)
        assertNull(GoalsRules.emergencySuggestion(GoalsView(currency = "EUR")))
    }

    @Test fun GOAL007_capacityHeaderStatesAndBar() {
        val view = goalsView()
        val header = git.capacityHeader(view)
        assertEquals("Metti da parte 426$NB€ al mese.", header.title)
        assertEquals("I tuoi obiettivi ne chiedono 600$NB€.", header.requested)
        assertEquals("Il risparmio va agli obiettivi nell'ordine che scegli. Ne mancano 174$NB€ al mese: Anticipo casa resta indietro.", header.explanation)
        assertEquals(listOf(view.goals[0].id, view.goals[1].id, view.goals[2].id, "gap"), header.segments.map { it.key })
        assertTrue(header.segments.last().dashed)
        assertEquals("−174$NB€", git.segmentText(header.segments.last()))
        near(header.scaleMax, 600.0)
        assertEquals("Non sappiamo ancora quanto risparmi al mese.", git.capacityHeader(GoalsView(currency = "EUR", goals = view.goals)).title)
        assertEquals(
            "In questo periodo hai speso più di quanto hai incassato.",
            git.capacityHeader(GoalsView(currency = "EUR", capacity = -10.0, goals = view.goals)).title,
        )
    }

    @Test fun GOAL008_rowsSayStatusPaceAndFireShift() {
        val view = goalsView()
        assertEquals("Al ritmo di 150$NB€ al mese ci arrivi a agosto 2027.", git.statusSentence(view.goals[0]))
        assertEquals(
            "Al ritmo di 200$NB€ al mese ci arrivi a dicembre 2027, dopo agosto 2027: servirebbero 270$NB€ al mese.",
            git.statusSentence(view.goals[1]),
        )
        assertTrue(git.statusSentence(view.goals[2]).contains(" (ricevi 76$NB€ dei 250$NB€ che hai scelto)"))
        assertNull(git.statusLabel(view.goals[0]))
        assertEquals("In ritardo", git.statusLabel(view.goals[1]))
        assertEquals("non sposta il traguardo", git.fireShift(view.goals[0]))
        assertEquals("sposta il traguardo di 2 mesi", git.fireShift(view.goals[1]))
        assertEquals(3, GoalsRules.openGoals(view).size)
    }

    @Test fun GOAL009_reorderSwapsOpenNeighboursAndSendsTheFullOrder() {
        val view = goalsView()
        val ids = view.goals.map { it.id }
        assertEquals(listOf(ids[1], ids[0], ids[2]), GoalsRules.reorder(view, 1, -1))
        assertNull(GoalsRules.reorder(view, 0, -1))
        assertEquals(listOf(ids[2], ids[0], ids[1]), GoalsRules.applying(listOf(ids[2], ids[0], ids[1]), view).goals.map { it.id })
    }

    @Test fun GOAL011_fireRowSentence() {
        val view = goalsView()
        assertEquals("Il traguardo delle Analitiche: ci arrivi nel 2039.", git.fireSentence(view.fire!!))
        assertEquals(
            "Il traguardo delle Analitiche: ci arrivi nel 2041 con i tuoi obiettivi, nel 2039 senza.",
            git.fireSentence(GoalsView.Fire(1.0, 0.0, 0.0, 2039, 2041)),
        )
        assertEquals("Il traguardo delle Analitiche: al ritmo di oggi non ci arrivi entro 50 anni.", git.fireSentence(GoalsView.Fire(1.0, 0.0, 0.0, null, null)))
    }

    @Test fun GOAL012_theRoadIsSortedByDate() {
        val stops = git.road(goalsView())
        assertEquals(listOf("agosto 2027", "dicembre 2027", "2039", "novembre 2057"), stops.map { it.`when` })
        assertEquals("Smetti di lavorare", stops[2].label)
    }

    @Test fun GOAL013_achievedGoalsAreListedApart() {
        val view = goalsView()
        val g = view.goals[0]
        val done = GoalView(id = g.id, name = g.name, kind = g.kind, target = g.target, achievedAt = "2026-10-01T00:00:00.000Z", current = g.target,
            progress = 1.0, monthsToGo = null, status = "raggiunto")
        val v = GoalsView(currency = "EUR", goals = listOf(done, view.goals[1]))
        assertEquals(listOf(g.id), GoalsRules.doneGoals(v).map { it.id })
        assertEquals(listOf(view.goals[1].id), GoalsRules.openGoals(v).map { it.id })
        assertEquals("Segnato come raggiunto: non prende più niente dal risparmio del mese.", git.statusSentence(done))
    }

    @Test fun GOAL014_GOAL015_formStepsValidate() {
        var draft = GoalDraft()
        assertFalse(GoalWizard.canAdvance(GoalFormStep.TIPO, draft, "2026-10-19"))
        draft = GoalWizard.withKind(draft, GoalKind.VIAGGIO, null)
        assertEquals("Viaggio", draft.name)
        assertTrue(GoalWizard.canAdvance(GoalFormStep.TIPO, draft, "2026-10-19"))
        assertEquals("Qualcos'altro", GoalKind.ALTRO.label)
    }

    @Test fun GOAL016_GOAL017_amountStepNotes() {
        val draft = GoalWizard.withKind(GoalDraft(), GoalKind.EMERGENZA, 1428.0).copy(targetMonth = "2027-10")
        assertEquals(8600.0, draft.target)
        assertEquals(GoalConstants.DEFAULT_EMERGENCY_MONTHS, draft.emergencyMonths)
        assertEquals(
            "Per arrivare a ottobre 2027 servono 717$NB€ al mese. Metti da parte 426$NB€ al mese, di cui 350$NB€ già presi dagli altri obiettivi.",
            git.requiredNote(draft, "2026-10-19", GoalsFormCapacity(426.0, 350.0)),
        )
    }

    @Test fun GOAL018_GOAL019_sourcesProposeTheMissingAmount() {
        val view = goalsView()
        val sources = GoalsRules.formSources(view, null)
        assertEquals(17, sources.size)
        var draft = GoalDraft(kind = GoalKind.VIAGGIO, name = "Viaggio", target = 1000.0)
        val deposito = sources.first { it.name == "Conto deposito" }
        draft = GoalsRules.toggleSource(draft, deposito)
        assertEquals(1000.0, draft.sources.first().amount)
        draft = GoalsRules.toggleSource(draft, deposito)
        assertTrue(draft.sources.isEmpty())
        draft = GoalsRules.toggleSource(draft.copy(target = 0.0), deposito)
        assertEquals(8100.0, draft.sources.first().amount)
        near(GoalsRules.formSources(view, view.goals[0]).first { it.name == "Conto deposito" }.free, 15600.0)
    }

    @Test fun GOAL020_GOAL021_paceShortcutsAndPosition() {
        val view = goalsView()
        val capacity = GoalsRules.formCapacity(view, null)!!
        near(capacity.taken, view.allocated)
        assertEquals(0.0, GoalsRules.freeCapacity(capacity))
        assertEquals(3, GoalsRules.positionChoices(view, null).size)
        assertTrue(GoalsRules.positionChoices(view, view.goals[0]).isEmpty())
        assertEquals(3, GoalsRules.initialDraft(view, null, null).priority)
    }

    @Test fun GOAL022_summaryRows() {
        var draft = GoalDraft(kind = GoalKind.VIAGGIO, name = "Viaggio", target = 4500.0, targetMonth = "2027-08", monthly = 200.0)
        assertEquals(listOf("4500$NB€", "agosto 2027", "Niente, parti da zero", "200$NB€"), git.summaryRows(draft).map { it.second })
        draft = draft.copy(sources = listOf(GoalDraftSource("account:a", 1800.0)))
        assertEquals("Da: Conto deposito 1800$NB€", git.summarySources(draft, mapOf("account:a" to "Conto deposito")))
    }

    @Test fun GOAL024_GOAL025_createSendsThePriorityEditDoesNot() {
        val payload = GoalWizard.toPayload(
            GoalDraft(GoalKind.CASA, " Casa ", 40000.0, null, "2031-10", 250.0, listOf(GoalDraftSource("instrument:x", 12000.0)), 2),
        )
        val create = GoalsApi.json(payload, includePriority = true)
        assertEquals(2, create.getValue("priority").jsonPrimitive.int)
        assertEquals("Casa", create.getValue("name").jsonPrimitive.content)
        assertEquals("2031-10-01", create.getValue("targetDate").jsonPrimitive.content)
        assertEquals("x", create.getValue("sources").jsonArray[0].jsonObject.getValue("instrumentId").jsonPrimitive.content)
        assertNull(GoalsApi.json(payload, includePriority = false)["priority"])
        val noDate = GoalsApi.json(GoalWizard.toPayload(GoalDraft(kind = GoalKind.ALTRO, name = "X", target = 1.0)), includePriority = false)
        assertEquals(JsonNull, noDate["targetDate"])
    }

    @Test fun GOAL027_GOAL028_detailSourcesAndWhatChanges() {
        val view = goalsView()
        assertEquals("7500$NB€ dei 17.400$NB€ sul conto", git.sourceDetail(view.goals[0].sources[0]))
        assertTrue(git.sourceDetail(view.goals[2].sources[0]).startsWith("12.000$NB€ dei 21.564$NB€ della posizione · imposta stimata "))
        assertEquals("di 4500$NB€ · entro agosto 2027", git.targetLine(view.goals[1]))
        assertEquals("0$NB€" to "i soldi restano tuoi, da parte", git.wealthImpact(view.goals[0]))
        assertEquals("−4500$NB€" to "escono a dicembre 2027", git.wealthImpact(view.goals[1]))
    }

    @Test fun GOAL034_amountsAreMaskedWhenHidden() {
        assertEquals(BBFormat.AMOUNT_MASK, GoalsText(BBLocale.IT_IT, "EUR", masked = true) { it }.money(1234.0))
    }
}
