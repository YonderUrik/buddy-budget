package io.buddybudget.core.domain.overview

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.GoalView
import io.buddybudget.core.data.GoalsView
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.OverviewApi
import io.buddybudget.core.data.OverviewPeriod
import io.buddybudget.core.data.OverviewView
import io.buddybudget.core.data.SidebarDeadlines
import io.buddybudget.core.data.SidebarFire
import io.buddybudget.core.data.SidebarSummary
import io.buddybudget.core.data.StartApi
import io.buddybudget.core.data.StartStatus
import io.buddybudget.core.data.WhatsNew
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.designsystem.ChartPathCommand
import io.buddybudget.core.designsystem.ChartPoint
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.shell.AccountsLaunchIntent
import io.buddybudget.core.domain.shell.AppDestination
import io.buddybudget.core.fixture
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

private val json = ApiClient.DefaultJson

private fun overview(name: String = "overview.json"): OverviewView = json.decodeFromString(OverviewView.serializer(), fixture(name))

private val steps0 = StartStatus.Steps(conto = false, import = false, investimento = false, obiettivo = false)

private fun near(a: Double, b: Double) = abs(a - b) < 0.001

class OverviewTest {
    // ---------------------------------------------------------------- Decoding and request

    @Test fun OV008_decodesOverviewFixtures() {
        val v = overview()
        assertTrue(v.currency == "EUR" && v.period == "3mesi" && v.includePension && !v.isEmpty)
        assertEquals(93, v.series.size)
        assertEquals(-39937.23, v.series.last().byClass["debiti"])
        assertEquals(listOf("liquidita", "investimenti", "previdenza", "debiti"), v.composition.map { it.key })
        assertEquals("dal mercato", v.composition[1].highlight?.label)
        assertEquals(2, v.voice.first().segments.count { it.strong })
        assertEquals(3, v.debts?.nextDue?.size)
        assertEquals("Il collegamento con Banca Demo scade tra 6 giorni.", v.renewalAlerts.first().message)
        val noPension = overview("overview-1anno-no-pension.json")
        assertTrue(noPension.period == "1anno" && !noPension.includePension)
        assertEquals(false, noPension.pension?.included)
        assertEquals(0.0, noPension.composition.first { it.key == "previdenza" }.share)
    }

    @Test fun OV009_periodsAndQuery() {
        assertEquals(OverviewPeriod.ThreeMonths, OverviewPeriod.Default)
        assertEquals(listOf("1M", "3M", "1A", "Max"), OverviewPeriod.entries.map { it.label })
        assertEquals(listOf("1mese", "3mesi", "1anno", "max"), OverviewPeriod.entries.map { it.raw })
        assertEquals(
            mapOf("period" to "1anno", "includePension" to "0", "today" to "2026-10-18"),
            OverviewApi.query(OverviewPeriod.OneYear, false, "2026-10-18"),
        )
    }

    @Test fun flexibleNumbersAcceptStrings() {
        val inv = json.decodeFromString(OverviewView.Investments.serializer(), """{"value":"12.5","positions":2,"paid":"10","marketGain":2.5}""")
        assertTrue(inv.value == 12.5 && inv.paid == 10.0)
        val fire = json.decodeFromString(SidebarFire.serializer(), """{"currency":"EUR","wealth":"5","target":null}""")
        assertTrue(fire.wealth == 5.0 && fire.target == null && fire.progress == null)
    }

    // ---------------------------------------------------------------- Greeting

    @Test fun OV001_greetingByHourAndFirstName() {
        assertEquals("Buongiorno", Greeting.source(0))
        assertEquals("Buongiorno", Greeting.source(11))
        assertEquals("Buon pomeriggio", Greeting.source(12))
        assertEquals("Buon pomeriggio", Greeting.source(17))
        assertEquals("Buonasera", Greeting.source(18))
        assertEquals("Buonasera, Giulia", Greeting.title("Buonasera", "Giulia Rossi"))
        assertEquals("Buonasera", Greeting.title("Buonasera", ""))
        assertNull(Greeting.firstName(null))
    }

    @Test fun OV002_capitalizedLongDate() {
        assertEquals("Martedì 6 ottobre 2026", Greeting.dateLabel(CalendarDate(2026, 10, 6), BBLocale.IT_IT))
        assertTrue(Greeting.dateLabel(CalendarDate(2026, 10, 6), BBLocale.EN_GB).startsWith("Tuesday"))
    }

    // ---------------------------------------------------------------- Layout

    @Test fun OV005_OV006_OV007_contentStates() {
        assertEquals(OverviewContent.Loading, OverviewContent.resolve(null, false))
        assertEquals(OverviewContent.Failed, OverviewContent.resolve(null, true))
        val v = overview()
        assertEquals(OverviewContent.Loaded(v), OverviewContent.resolve(v, true))
        val root = Json.parseToJsonElement(fixture("overview.json")).jsonObject
        val empty = json.decodeFromJsonElement(OverviewView.serializer(), JsonObject(root + ("isEmpty" to JsonPrimitive(true))))
        assertEquals(OverviewContent.Empty(empty), OverviewContent.resolve(empty, false))
    }

    @Test fun OV021_voiceStrongSegmentsAreMasked() {
        val v = overview()
        assertTrue(OverviewVoice.segments(v.voice, false).joinToString("") { it.text }.contains("2164 €"))
        val masked = OverviewVoice.segments(v.voice, true)
        assertTrue(masked.filter { it.strong }.all { it.text == "••••" })
        assertFalse(masked.joinToString("") { it.text }.contains("€"))
    }

    // ---------------------------------------------------------------- Net worth chart

    @Test fun OV013_OV014_historyAndViewToggle() {
        val v = overview()
        val state = NetWorthChartState(v.series, v.change, NetWorthChartView.Total, emptySet(), true)
        assertTrue(state.hasHistory && state.showsViewToggle)
        assertEquals(listOf("liquidita", "investimenti", "previdenza"), state.allClasses)
        assertEquals(v.change.end, state.headline(null).first)
        val single = NetWorthChartState(
            listOf(OverviewView.SeriesPoint("2026-10-18", 10.0, mapOf("liquidita" to 10.0))),
            OverviewView.Change(10.0, 10.0, 0.0, null), NetWorthChartView.Total, emptySet(), true,
        )
        assertFalse(single.hasHistory || single.showsViewToggle)
        assertEquals(listOf("liquidita"), single.allClasses)
    }

    @Test fun OV015_stackOrderNetLineAndNotes() {
        val v = overview()
        val state = NetWorthChartState(v.series, v.change, NetWorthChartView.ByClass, emptySet(), true)
        assertTrue(state.showsDebts && state.showsNetLine)
        assertEquals(listOf("Linea scura: patrimonio netto", "Il patrimonio netto è già al netto dei debiti"), state.notes)
        val bands = NetWorthStack.bands(v.series, state.visibleClasses)
        assertEquals(listOf("liquidita", "investimenti", "previdenza"), bands.map { it.key })
        val last = v.series.size - 1
        assertTrue(near(bands[2].upper[last], 23915.34 + 71038.29324820726 + 11082.07))
        assertEquals(bands[0].upper[last], bands[1].lower[last])
        val domain = NetWorthStack.domain(bands, v.series.map { it.value })
        assertTrue(domain.start == 0.0 && domain.endInclusive >= bands[2].upper.max())
    }

    @Test fun OV015_bandPathClosesBackAlongTheLowerEdge() {
        val upper = listOf(ChartPoint(0.0, 0.0), ChartPoint(10.0, 5.0), ChartPoint(20.0, 2.0))
        val lower = listOf(ChartPoint(0.0, 10.0), ChartPoint(10.0, 12.0), ChartPoint(20.0, 11.0))
        val path = NetWorthStack.bandPath(upper, lower)
        assertEquals(ChartPathCommand.Move(upper[0]), path.first())
        assertEquals(ChartPathCommand.Close, path.last())
        assertEquals(ChartPathCommand.Line(lower[2]), path[path.size - 4])
        assertEquals(lower[0], (path[path.size - 2] as ChartPathCommand.Cubic).to)
        assertEquals(3 + 1 + 2 + 1, path.size)
    }

    @Test fun OV016_legendNeverHidesLastVisibleClass() {
        val all = listOf("liquidita", "investimenti")
        var hidden = NetWorthLegend.toggle(emptySet(), "liquidita", all)
        assertEquals(setOf("liquidita"), hidden)
        hidden = NetWorthLegend.toggle(hidden, "investimenti", all)
        assertEquals(setOf("liquidita"), hidden)
        hidden = NetWorthLegend.toggle(hidden, "liquidita", all)
        assertTrue(hidden.isEmpty())
    }

    @Test fun OV017_partialTotalAndTotaleClearsHidden() {
        val v = overview()
        val state = NetWorthChartState(v.series, v.change, NetWorthChartView.ByClass, setOf("investimenti"), true)
        assertTrue(state.isPartial && !state.showsDebts)
        assertEquals(listOf("investimenti"), state.hiddenClasses)
        assertEquals("Totale parziale", state.totalLabel)
        assertTrue(near(state.headline(null).first, 23915.34 + 11082.07))
        assertEquals(false, state.legend.first { it.key == "investimenti" }.visible)
        val total = NetWorthChartState(v.series, v.change, NetWorthChartView.Total, setOf("investimenti"), true)
        assertTrue(!total.isPartial && total.headline(null).first == v.change.end)
    }

    @Test fun OV018_OV019_pensionExcluded() {
        val v = overview("overview-1anno-no-pension.json")
        val state = NetWorthChartState(v.series, v.change, NetWorthChartView.ByClass, emptySet(), false)
        assertTrue(state.showsPensionSwitch && state.pensionExcluded)
        assertEquals("Totale senza previdenza", state.totalLabel)
        assertTrue("Area grigia: previdenza, non inclusa nel totale" in state.notes)
        val partial = NetWorthChartState(v.series, v.change, NetWorthChartView.ByClass, setOf("investimenti"), false)
        assertEquals(v.series.last().byClass["liquidita"], partial.headline(null).first)
        assertEquals("bb:net-worth-include-pension", OverviewPreferenceKeys.INCLUDE_PENSION)
    }

    @Test fun OV020_pointDetailRowsTopDown() {
        val v = overview()
        val state = NetWorthChartState(v.series, v.change, NetWorthChartView.Total, emptySet(), true)
        val detail = assertNotNull(state.detail(0))
        assertTrue(detail.date == "2026-07-18" && detail.isEstimated)
        assertEquals(listOf("debiti", "previdenza", "investimenti", "liquidita"), detail.rows.map { it.key })
        assertEquals("Debiti (già sottratti)", detail.rows.first().label)
        assertTrue(detail.totalLabel == "Totale" && detail.total == 69569.58)
        val scrub = state.headline(0)
        assertTrue(scrub.first == 69569.58 && scrub.second.delta == 0.0)
    }

    @Test fun OV009_axisLabelsAndThinning() {
        assertEquals("18 lug", NetWorthChartState.axisLabel("2026-07-18", OverviewPeriod.ThreeMonths, BBLocale.IT_IT))
        assertEquals("ott 25", NetWorthChartState.axisLabel("2025-10-31", OverviewPeriod.OneYear, BBLocale.IT_IT))
        val centers = (0 until 10).map { it * 30.0 + 20 }
        val kept = NetWorthStack.thinLabels(centers, List(10) { 40.0 }, plotWidth = 300.0)
        assertEquals(9, kept.last())
        assertTrue(kept.zipWithNext().all { (a, b) -> centers[b] - centers[a] >= 72 })
    }

    // ---------------------------------------------------------------- Composition, month, dues, investments

    @Test fun OV022_OV023_OV024_composition() {
        val v = overview()
        assertTrue(CompositionDisplay.showsDonut(v.composition))
        assertEquals(listOf("liquidita", "investimenti", "previdenza"), CompositionDisplay.donutItems(v.composition).map { it.key })
        assertEquals("67%", CompositionDisplay.percent(CompositionDisplay.investedShare(v.composition)!!))
        assertTrue(CompositionDisplay.showsShare(v.composition[0], v.composition))
        assertFalse(CompositionDisplay.showsShare(v.composition[3], v.composition))
        assertNull(CompositionDisplay.sentence(v.composition))
        assertTrue(AssetClass.path("previdenza") == "/pensione" && AssetClass.path("debiti") == "/debiti")
        val excluded = overview("overview-1anno-no-pension.json")
        assertFalse(CompositionDisplay.donutItems(excluded.composition).any { it.key == "previdenza" })
    }

    @Test fun OV026_monthPaceBudgetAndGeometry() {
        val pace = overview().monthPace
        val budget = assertNotNull(MonthPaceDisplay.budgetText(pace))
        assertEquals("restano {0}", budget.first)
        assertTrue(near(budget.second, 780 - 398.83))
        assertFalse(MonthPaceDisplay.isOverBudget(pace))
        val g = MonthPaceGeometry(pace, 358.0)
        assertEquals(listOf(1, 16, 31), g.ticks)
        assertTrue(g.x(1) == 8.0 && g.x(31) == 358.0 - 64)
        assertEquals(200.0 - 28, g.y(0.0))
        assertEquals(18, g.points(pace.current).size)
    }

    @Test fun OV027_upToThreeDues() {
        assertEquals(listOf("Cucina e lavatrice", "Mutuo casa", "Prestito auto"), UpcomingDues.shown(overview().debts).map { it.name })
        assertTrue(UpcomingDues.shown(null).isEmpty())
    }

    @Test fun OV025_OV028_investmentsPulse() {
        val pulse = InvestmentsPulse(assertNotNull(overview().investments))
        assertTrue(!pulse.isLoss && pulse.sign == "+")
        assertEquals(CatalogText("{0}{1}% sul versato", mapOf("0" to "+", "1" to "11,0")), pulse.ratioText(BBLocale.IT_IT))
        assertEquals("11.0", pulse.ratioText(BBLocale.EN_GB).values["1"])
        assertEquals(CatalogText("{0} posizioni", mapOf("0" to "13")), pulse.positionsText)
        assertTrue(pulse.paidShare > 0.9 && pulse.paidShare < 1)
    }

    // ---------------------------------------------------------------- Goals

    @Test fun OV030_goalsGatedBySections() {
        assertTrue(GoalsTile.isAvailable(MeBootstrap.Sections()))
        assertFalse(GoalsTile.isAvailable(MeBootstrap.Sections(pension = false, analytics = false, goals = false, fire = false)))
    }

    @Test fun OV031_inviteDismissal() {
        assertEquals(GoalsTile.Mode.Invite, GoalsTile.mode(GoalsView(currency = "EUR", goals = emptyList()), false))
        assertEquals(GoalsTile.Mode.Hidden, GoalsTile.mode(GoalsView(currency = "EUR", goals = emptyList()), true))
        assertEquals(GoalsTile.Mode.Hidden, GoalsTile.mode(null, false))
        assertEquals("bb-goals-invite-dismissed", OverviewPreferenceKeys.GOALS_INVITE_DISMISSED)
    }

    @Test fun OV032_goalsSortedByMonthsToGoThenProgress() {
        fun g(id: String, progress: Double, months: Int?, status: String) = GoalView(id = id, name = id, target = 1.0, progress = progress, monthsToGo = months, status = status)
        val goals = listOf(g("a", 0.2, null, "fermo"), g("b", 0.4, 14, "in_ritardo"), g("c", 0.8, 10, "senza_data"), g("d", 1.0, 0, "raggiunto"), g("e", 0.9, 14, "in_linea"))
        assertEquals(listOf("c", "e", "b"), GoalsTile.closest(goals).map { it.id })
        assertEquals(GoalsTile.Mode.Hidden, GoalsTile.mode(GoalsView(currency = "EUR", goals = listOf(goals[3])), false))
        val late = GoalView(
            id = "x", name = "X", target = 4500.0, targetDate = "2027-08-01", monthly = 200.0, current = 1800.0, progress = 0.4,
            funded = 200.0, required = 270.0, etaMonth = "2027-12", monthsToGo = 14, status = "in_ritardo",
        )
        val (parts, capitalize) = GoalsTile.statusSentence(late, { "${it.toInt()} €" }, { it })
        assertTrue(capitalize)
        assertEquals(listOf("al ritmo di {0} al mese ci arrivi a {1}", ", dopo {0}: servirebbero {1} al mese."), parts.map { it.source })
        assertEquals("In ritardo", GoalsTile.statusLabel("in_ritardo"))
    }

    // ---------------------------------------------------------------- Primi passi

    @Test fun OV033_OV037_stepsAndGermanReplacement() {
        val it = StartChecklist.steps(true)
        assertEquals(StartStepId.entries.toList(), it.map { s -> s.id })
        assertEquals("Aggiungi il tuo conto", it[0].title)
        assertEquals("Conto aggiunto", it[0].done)
        val goal = it.last()
        assertTrue(goal.path == "/analitiche?traguardo=1" && goal.cta == "Fissa il traguardo")
        val de = StartChecklist.steps(false).last()
        assertEquals("Imposta un budget", de.title)
        assertTrue(de.description == "Imposta un budget per categoria." && de.cta == "Vai alle categorie" && de.done == "Budget impostato")
        assertEquals("/liquidita/categorie", de.path)
    }

    @Test fun OV034_statusLine() {
        assertEquals(CatalogText("{0} su {1} fatti", mapOf("0" to "0", "1" to "4")), StartChecklist.statusLine(StartStatus(steps0)))
        val two = StartStatus(StartStatus.Steps(conto = true, investimento = true), stepIds = listOf("conto", "import", "investimento", "obiettivo"))
        assertEquals(CatalogText("{0} su {1} fatti", mapOf("0" to "2", "1" to "4")), StartChecklist.statusLine(two))
        // A skipped step not done leaves the count (OV-046).
        val skipped = two.copy(skipped = listOf("import"))
        assertEquals(CatalogText("{0} su {1} fatti", mapOf("0" to "2", "1" to "3")), StartChecklist.statusLine(skipped))
    }

    @Test fun OV035_visibility() {
        assertTrue(StartChecklist.isVisible(StartStatus(steps0), false))
        val dismissed = StartStatus(steps0, dismissed = true)
        assertFalse(StartChecklist.isVisible(dismissed, false))
        assertTrue(StartChecklist.isVisible(dismissed, true))
        assertFalse(StartChecklist.isVisible(StartStatus(steps0, demoActive = true), true))
        assertFalse(StartChecklist.isVisible(StartStatus(steps0, completed = true), true))
    }

    @Test fun OV036_OV039_OV042_startEndpoints() = runTest {
        val server = MockWebServer()
        server.start()
        try {
            server.enqueue(MockResponse.Builder().code(204).build())
            server.enqueue(MockResponse.Builder().code(201).body("""{"accounts":2,"transactions":120}""").build())
            server.enqueue(MockResponse.Builder().code(204).build())
            server.enqueue(MockResponse.Builder().code(409).body("""{"error":"Hai già dei conti: i dati d'esempio sono per chi parte da zero."}""").build())
            val api = StartApi(ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore(null)))
            api.setDismissed(true)
            assertEquals(2, api.startDemo().accounts)
            api.clearDemo()
            val r1 = server.takeRequest()
            assertEquals("PATCH", r1.method)
            assertEquals("""{"dismissed":true}""", r1.body?.utf8())
            val r2 = server.takeRequest()
            assertTrue(r2.method == "POST" && r2.url.encodedPath == "/api/start/demo")
            assertEquals("DELETE", server.takeRequest().method)
            // OV-040: the 409 message is shown inline.
            try {
                api.startDemo()
                fail("expected 409")
            } catch (e: ApiError.Http) {
                assertEquals(409, e.body.status)
                assertEquals("Hai già dei conti: i dati d'esempio sono per chi parte da zero.", e.body.message)
            }
        } finally {
            server.close()
        }
    }

    // ---------------------------------------------------------------- «Novità»

    @Test fun SHELL049_SHELL050_whatsNewPickAndDismiss() {
        val w = json.decodeFromString(WhatsNew.serializer(), fixture("whats-new.json"))
        assertEquals("obiettivi-di-risparmio", WhatsNewDismissals.pick(w, emptyList())?.id)
        assertEquals("categorizza-con-ai", WhatsNewDismissals.pick(w, listOf("obiettivi-di-risparmio"))?.id)
        assertNull(WhatsNewDismissals.pick(w, listOf("obiettivi-di-risparmio", "categorizza-con-ai")))
        val raw = WhatsNewDismissals.adding("a", WhatsNewDismissals.adding("b", null))
        assertEquals("b,a", raw)
        assertEquals(listOf("b", "a"), WhatsNewDismissals.parse(raw))
        assertEquals("b,a", WhatsNewDismissals.adding("a", raw))
        assertEquals("/analitiche/obiettivi?nuovo=1&da=novita", InAppLinks.nativePath("/analitiche/obiettivi?nuovo=1&da=novita"))
        assertEquals("/categorizza", InAppLinks.nativePath("/categorizza"))
        assertEquals("/panoramica", InAppLinks.nativePath("/sconosciuto/x"))
    }

    // ---------------------------------------------------------------- «Il tuo quadro»

    @Test fun SHELL028_SET020_SET021_moduleKeysAndOrder() {
        assertEquals(
            listOf("bb:sidebar:module:oggi", "bb:sidebar:module:portafoglio", "bb:sidebar:module:watchlist", "bb:sidebar:module:scadenze", "bb:sidebar:module:fire"),
            SidebarModuleId.entries.map { it.preferenceKey },
        )
        assertTrue(SidebarModuleId.ENABLED_BY_DEFAULT)
        assertEquals(SidebarModuleId.entries, SidebarModuleId.settingsOrder(true))
        assertEquals(SidebarModuleId.entries - SidebarModuleId.Fire, SidebarModuleId.settingsOrder(false))
        assertFalse(SidebarModuleId.needsSummary(listOf(SidebarModuleId.Scadenze, SidebarModuleId.Fire)))
        assertTrue(SidebarModuleId.needsSummary(listOf(SidebarModuleId.Watchlist)))
    }

    @Test fun SHELL029_renderOrderAndWatchlistCollapsed() {
        assertEquals(
            listOf(SidebarModuleId.Oggi, SidebarModuleId.Scadenze, SidebarModuleId.Fire, SidebarModuleId.Portafoglio, SidebarModuleId.Watchlist),
            SidebarModuleId.renderOrder({ true }, true),
        )
        assertEquals(
            listOf(SidebarModuleId.Scadenze, SidebarModuleId.Portafoglio, SidebarModuleId.Watchlist),
            SidebarModuleId.renderOrder({ it != SidebarModuleId.Oggi }, false),
        )
        assertTrue(!SidebarModuleId.Watchlist.openByDefault && SidebarModuleId.Oggi.openByDefault)
    }

    @Test fun SHELL030_todayWithoutPension() {
        val nw = json.decodeFromString(
            SidebarSummary.NetWorth.serializer(), """{"total":84520.33,"monthChange":1210.5,"pension":{"total":21430.12,"monthChange":100}}""",
        )
        assertEquals(84520.33 to 1210.5, SidebarInsights.today(nw, true))
        val excluded = SidebarInsights.today(nw, false)
        assertTrue(near(excluded.first, 63090.21) && excluded.second == 1110.5)
        val noChange = json.decodeFromString(SidebarSummary.NetWorth.serializer(), """{"total":10,"monthChange":null,"pension":null}""")
        assertNull(SidebarInsights.today(noChange, false).second)
    }

    @Test fun SHELL031_SHELL032_limitsAndWords() {
        assertTrue(SidebarInsights.MAX_HOLDINGS == 3 && SidebarInsights.MAX_WATCHLIST == 4)
        assertTrue(SidebarInsights.watchlistSummary(1) == "titolo" && SidebarInsights.watchlistSummary(2) == "titoli")
        assertEquals("avviso", SidebarInsights.alertsWord(1))
        assertEquals(AmountTone.Neutral, SidebarInsights.tone(null))
        assertEquals(AmountTone.Neutral, SidebarInsights.tone(0.00001))
        assertEquals(AmountTone.Neg, SidebarInsights.tone(-0.01))
        assertEquals("/investimenti/titoli/i1", InAppLinks.securityPath("i1"))
    }

    @Test fun SHELL034_SHELL035_deadlineLinksAndOverdue() {
        val d = json.decodeFromString(
            SidebarDeadlines.serializer(),
            """{"currency":"EUR","items":[
              {"id":"rinnovo:c1","kind":"rinnovo","label":"Rinnova Intesa","date":"2026-10-18","amount":null,"overdue":true,"href":"/liquidita/conti?rinnova=sidebar"},
              {"id":"rata:d1","kind":"rata","label":"Mutuo casa","date":"2026-11-01","amount":718.97,"overdue":false,"href":"/debiti/finanziamenti?id=d1"}]}""",
        )
        assertEquals("/liquidita/conti?rinnova=sidebar", InAppLinks.deadlinePath(d.items[0]))
        assertEquals("/debiti/finanziamenti?id=d1", InAppLinks.deadlinePath(d.items[1]))
        assertEquals(AppDestination.Debts, AppDestination.fromPath(InAppLinks.deadlinePath(d.items[1])))
        assertNotNull(AccountsLaunchIntent.fromPath(InAppLinks.deadlinePath(d.items[0])))
        assertTrue(SidebarInsights.overdueCount(d.items) == 1 && SidebarInsights.overdueBadge(1) == "scaduta")
        assertTrue(SidebarInsights.overdueBadge(2) == "scadute" && SidebarInsights.overdueBadge(0) == null)
        assertEquals("12" to "ott", SidebarInsights.deadlineDay("2026-10-12", BBLocale.IT_IT))
    }

    @Test fun SHELL036_fireStates() {
        assertEquals(SidebarInsights.FireState.Invite, SidebarInsights.fireState(SidebarFire("EUR", 1.0, null, null, null)))
        assertEquals(SidebarInsights.FireState.Reached(2.0), SidebarInsights.fireState(SidebarFire("EUR", 2.0, 1.0, 2.0, 0.0)))
        assertEquals(
            SidebarInsights.FireState.Progress(0.16, 630_000.0, CatalogText("tra {0} anni", mapOf("0" to "22"))),
            SidebarInsights.fireState(SidebarFire("EUR", 120_000.0, 750_000.0, 0.16, 21.5)),
        )
        assertEquals(CatalogText("tra meno di un anno"), SidebarInsights.yearsToFire(0.4))
        assertEquals(CatalogText("tra 1 anno"), SidebarInsights.yearsToFire(1.2))
        assertNull(SidebarInsights.yearsToFire(null))
        assertTrue(SidebarInsights.fireProgressText(1.4) == "100%" && SidebarInsights.fireProgressText(0.127) == "13%")
    }

    @Test fun SHELL037_freshnessWindows() {
        assertTrue(SidebarModuleId.Oggi.freshSeconds == 300L && SidebarModuleId.Scadenze.freshSeconds == 600L && SidebarModuleId.Fire.freshSeconds == 3600L)
        val clock = FreshnessClock()
        assertFalse(clock.isFresh(1_000_000, 300))
        clock.mark(1_000_000)
        assertTrue(clock.isFresh(1_000_000 + 299_000, 300))
        assertFalse(clock.isFresh(1_000_000 + 300_000, 300))
        assertIs<FreshnessClock>(clock)
    }
}
