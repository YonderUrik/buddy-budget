package io.buddybudget.core.designsystem

import io.buddybudget.core.data.LogoLoader
import io.buddybudget.core.domain.format.BBLocale
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okio.Buffer
import kotlin.math.abs
import kotlin.math.roundToLong
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

// Design system v1 logic (spec: design/components.md §3.1–3.2, §3.7, §3.10; design/charts.md §1, §4).
// The same cases run on iOS in BuddyBudgetKit/Tests/BuddyBudgetKitTests/DesignSystemLogicTests.swift.
class DesignSystemLogicTest {
    private val nbsp = " "

    // AmountText color and privacy rules

    @Test fun DS_amountToneRoles() {
        assertEquals(AmountColorRole.Foreground, AmountDisplay.role(-1.0, AmountTone.Neutral))
        assertEquals(AmountColorRole.Neg, AmountDisplay.role(-1.0, AmountTone.Auto))
        assertEquals(AmountColorRole.Pos, AmountDisplay.role(0.0, AmountTone.Auto))
        assertEquals(AmountColorRole.Pos, AmountDisplay.role(5.0, AmountTone.Auto))
        assertEquals(AmountColorRole.Pos, AmountDisplay.role(5.0, AmountTone.Signed))
        assertEquals(AmountColorRole.Foreground, AmountDisplay.role(0.0, AmountTone.Signed))
        assertEquals(AmountColorRole.Neg, AmountDisplay.role(-5.0, AmountTone.Signed))
        assertEquals(AmountColorRole.Pos, AmountDisplay.role(5.0, AmountTone.Income))
        assertEquals(AmountColorRole.Foreground, AmountDisplay.role(-5.0, AmountTone.Income))
        assertEquals(AmountColorRole.Pos, AmountDisplay.role(-5.0, AmountTone.Pos))
        assertEquals(AmountColorRole.Neg, AmountDisplay.role(5.0, AmountTone.Neg))
    }

    @Test fun DS_amountTextFormats() {
        val plain = AmountDisplay.make(-1234.5, "EUR", BBLocale.IT_IT)
        assertEquals("-1234,50$nbsp€", plain.text)
        assertEquals("", plain.tail)
        val signed = AmountDisplay.make(-1234.5, "EUR", BBLocale.IT_IT, AmountTone.Signed, signed = true)
        assertEquals("−1234,50$nbsp€", signed.text)
        assertEquals(AmountColorRole.Neg, signed.role)
        val income = AmountDisplay.make(20.0, "EUR", BBLocale.EN_GB, AmountTone.Income, signed = true)
        assertEquals("+€20.00", income.text)
        val whole = AmountDisplay.make(30673.12, "EUR", BBLocale.IT_IT, maximumFractionDigits = 0)
        assertEquals("30.673$nbsp€", whole.text)
    }

    @Test fun DS_amountTextHeroSplit() {
        val it = AmountDisplay.make(30673.12, "EUR", BBLocale.IT_IT, split = true)
        assertEquals("30.673", it.main)
        assertEquals(",12$nbsp€", it.tail)
        val en = AmountDisplay.make(30673.12, "EUR", BBLocale.EN_GB, split = true)
        assertEquals("€30,673", en.main)
        assertEquals(".12", en.tail)
        val signed = AmountDisplay.make(-120.5, "EUR", BBLocale.IT_IT, AmountTone.Signed, signed = true, split = true)
        assertEquals("−120", signed.main)
        assertEquals(",50$nbsp€", signed.tail)
    }

    @Test fun DS_amountTextPrivacyMaskKeepsColor() {
        val masked = AmountDisplay.make(-50.0, "EUR", BBLocale.IT_IT, AmountTone.Auto, signed = true, split = true, masked = true)
        assertEquals("••••", masked.text)
        assertEquals("", masked.tail)
        assertTrue(masked.isMasked)
        assertEquals(AmountColorRole.Neg, masked.role)
    }

    @Test fun DS_merchantInitial() {
        assertEquals("N", MerchantInitial.of("netflix"))
        assertEquals("3", MerchantInitial.of("  3bee"))
        assertEquals("É", MerchantInitial.of("«élite»"))
        assertEquals("·", MerchantInitial.of("—"))
        assertEquals("·", MerchantInitial.of(""))
    }

    @Test fun DS_amountInputNormalization() {
        assertEquals("12,5", AmountInput.normalize("12.5", BBLocale.IT_IT))
        assertEquals("12.5", AmountInput.normalize("12,5", BBLocale.EN_GB))
        assertEquals("1,23456", AmountInput.normalize("1.234,56", BBLocale.DE_DE))
        assertEquals("-7", AmountInput.normalize("\u22127a", BBLocale.IT_IT))
        assertEquals("7", AmountInput.normalize("7-", BBLocale.IT_IT))
    }

    // Chart scaling (charts.md §4.4 golden vectors, recharts 3.8.1)

    @Test fun DS_chartNiceTicks() {
        val cases = listOf(
            listOf(0.0, 1234.0) to listOf(0.0, 350.0, 700.0, 1050.0, 1400.0),
            listOf(0.0, 87.5) to listOf(0.0, 25.0, 50.0, 75.0, 100.0),
            listOf(-3200.0, 5400.0) to listOf(-6000.0, -3000.0, 0.0, 3000.0, 6000.0),
            listOf(0.012, 0.087) to listOf(0.0, 0.025, 0.05, 0.075, 0.1),
            listOf(-0.153, 0.0) to listOf(-0.16, -0.12, -0.08, -0.04, 0.0),
            listOf(100.0, 100.0) to listOf(98.0, 99.0, 100.0, 101.0, 102.0),
            listOf(0.0, 0.0) to listOf(0.0, 1.0, 2.0, 3.0, 4.0),
            listOf(1520.3, 2210.9) to listOf(1500.0, 1750.0, 2000.0, 2250.0, 2500.0),
            listOf(-50.0, -10.0) to listOf(-50.0, -40.0, -30.0, -20.0, -10.0),
            listOf(0.0, 1.0) to listOf(0.0, 0.25, 0.5, 0.75, 1.0),
        )
        for ((domain, expected) in cases) {
            assertEquals(expected, ChartScale.niceTicks(domain[0], domain[1]), "domain $domain")
        }
    }

    @Test fun DS_chartHeroDomainAndProjection() {
        assertEquals(90.0..202.0, ChartScale.heroDomain(listOf(100.0, 200.0)))
        assertEquals(-100.0..50.5, ChartScale.heroDomain(listOf(-100.0, 50.0)))
        assertEquals(-1.0..1.0, ChartScale.heroDomain(listOf(0.0, 0.0)))
        val d = 0.0..100.0
        assertEquals(8.0, ChartScale.y(100.0, d, top = 8.0, height = 200.0))
        assertEquals(208.0, ChartScale.y(0.0, d, top = 8.0, height = 200.0))
        assertEquals(200.0, ChartScale.x(index = 2, count = 5, width = 400.0))
        assertEquals(200.0, ChartScale.x(index = 0, count = 1, width = 400.0))
    }

    @Test fun DS_chartScrubIndexAndTooltipClamp() {
        assertEquals(0, ChartScale.scrubIndex(-20.0, 300.0, 31))
        assertEquals(16, ChartScale.scrubIndex(155.0, 300.0, 31))
        assertEquals(30, ChartScale.scrubIndex(400.0, 300.0, 31))
        assertEquals(0, ChartScale.scrubIndex(10.0, 300.0, 1))
        assertTrue(abs(ChartScale.tooltipCenterX(5.0, 100.0) - 14) < 1e-9)
        assertEquals(50.0, ChartScale.tooltipCenterX(50.0, 100.0))
        assertTrue(abs(ChartScale.tooltipCenterX(99.0, 100.0) - 86) < 1e-9)
    }

    // Curves (d3-shape 3.2 curveMonotoneX output; smoothPath; stepAfter)

    private fun rounded(commands: List<ChartPathCommand>): List<List<Double>> {
        fun r(v: Double) = (v * 1000).roundToLong() / 1000.0
        return commands.map {
            when (it) {
                is ChartPathCommand.Move -> listOf(0.0, r(it.p.x), r(it.p.y))
                is ChartPathCommand.Line -> listOf(1.0, r(it.p.x), r(it.p.y))
                is ChartPathCommand.Cubic -> listOf(2.0, r(it.c1.x), r(it.c1.y), r(it.c2.x), r(it.c2.y), r(it.to.x), r(it.to.y))
                is ChartPathCommand.Arc -> listOf(3.0, r(it.center.x), r(it.center.y), r(it.radius), r(it.startDegrees), r(it.sweepDegrees))
                ChartPathCommand.Close -> listOf(4.0)
            }
        }
    }

    private fun pts(vararg xy: Double) = xy.toList().chunked(2).map { ChartPoint(it[0], it[1]) }

    @Test fun DS_chartMonotoneMatchesD3() {
        // M0,10C0.333,20,0.667,30,1,30C1.333,30,1.667,20,2,20C2.333,20,2.667,25,3,25C3.333,25,3.667,15,4,5
        assertEquals(
            listOf(
                listOf(0.0, 0.0, 10.0),
                listOf(2.0, 0.333, 20.0, 0.667, 30.0, 1.0, 30.0),
                listOf(2.0, 1.333, 30.0, 1.667, 20.0, 2.0, 20.0),
                listOf(2.0, 2.333, 20.0, 2.667, 25.0, 3.0, 25.0),
                listOf(2.0, 3.333, 25.0, 3.667, 15.0, 4.0, 5.0),
            ),
            rounded(ChartPaths.line(pts(0.0, 10.0, 1.0, 30.0, 2.0, 20.0, 3.0, 25.0, 4.0, 5.0), ChartCurve.Monotone)),
        )
        // M0,5C0.667,5,1.333,5,2,5C3,5,4,6.5,5,8
        assertEquals(
            listOf(listOf(0.0, 0.0, 5.0), listOf(2.0, 0.667, 5.0, 1.333, 5.0, 2.0, 5.0), listOf(2.0, 3.0, 5.0, 4.0, 6.5, 5.0, 8.0)),
            rounded(ChartPaths.line(pts(0.0, 5.0, 2.0, 5.0, 5.0, 8.0), ChartCurve.Monotone)),
        )
        assertEquals(
            listOf(listOf(0.0, 0.0, 0.0), listOf(1.0, 10.0, 10.0)),
            rounded(ChartPaths.line(pts(0.0, 0.0, 10.0, 10.0), ChartCurve.Monotone)),
        )
    }

    @Test fun DS_chartSmoothStepAndArea() {
        val p = pts(0.0, 10.0, 10.0, 0.0)
        assertEquals(listOf(listOf(0.0, 0.0, 10.0), listOf(2.0, 5.0, 10.0, 5.0, 0.0, 10.0, 0.0)), rounded(ChartPaths.line(p, ChartCurve.Smooth)))
        assertEquals(listOf(listOf(0.0, 0.0, 10.0), listOf(1.0, 10.0, 10.0), listOf(1.0, 10.0, 0.0)), rounded(ChartPaths.line(p, ChartCurve.StepAfter)))
        assertEquals(
            listOf(listOf(0.0, 0.0, 10.0), listOf(1.0, 10.0, 0.0), listOf(1.0, 10.0, 20.0), listOf(1.0, 0.0, 20.0), listOf(4.0)),
            rounded(ChartPaths.area(p, ChartCurve.Linear, baselineY = 20.0)),
        )
    }

    @Test fun DS_sparklineGeometry() {
        assertEquals(
            listOf(ChartPoint(0.0, 28.0), ChartPoint(42.0, 2.0), ChartPoint(84.0, 15.0)),
            SparklineGeometry.points(listOf(10.0, 20.0, 15.0), 84.0, 30.0),
        )
        assertEquals(listOf(28.0, 28.0), SparklineGeometry.points(listOf(5.0, 5.0), 84.0, 30.0).map { it.y })
        assertTrue(SparklineGeometry.points(listOf(1.0), 84.0, 30.0).isEmpty())
    }

    // Donut (Recharts Pie angles: 3 o'clock, counter-clockwise, paddingAngle)

    @Test fun DS_donutSliceAngles() {
        assertEquals(
            listOf(DonutGeometry.Slice(0.0, 178.0), DonutGeometry.Slice(180.0, 358.0)),
            DonutGeometry.slices(listOf(1.0, 1.0), paddingAngle = 2.0),
        )
        val withZero = DonutGeometry.slices(listOf(3.0, 0.0, 1.0), paddingAngle = 2.0)
        assertEquals(listOf(267.0, 267.0, 358.0), withZero.map { (it.endAngle * 1000).roundToLong() / 1000.0 })
        assertEquals(267.0, withZero[1].startAngle)
        assertEquals(listOf(DonutGeometry.Slice(0.0, 360.0)), DonutGeometry.slices(listOf(5.0), paddingAngle = 2.0))
        assertTrue(DonutGeometry.slices(listOf(0.0, 0.0)).all { it.startAngle == it.endAngle })
    }

    @Test fun DS_donutHitTestAndSector() {
        val slices = DonutGeometry.slices(listOf(1.0, 1.0), paddingAngle = 2.0)
        assertEquals(0, DonutGeometry.hitTest(180.0, 85.0, 100.0, 100.0, 62.0, 90.0, slices))
        assertEquals(1, DonutGeometry.hitTest(100.0, 180.0, 100.0, 100.0, 62.0, 90.0, slices))
        assertNull(DonutGeometry.hitTest(100.0, 100.0, 100.0, 100.0, 62.0, 90.0, slices))
        val path = DonutGeometry.sectorPath(100.0, 100.0, 62.0, 90.0, 0.0, 90.0, 4.0)
        assertEquals(9, path.size)
        val start = (path[0] as? ChartPathCommand.Move)?.p ?: fail("expected move")
        assertTrue(abs(start.y - 100) < 1e-9)
        assertTrue(start.x > 185 && start.x < 190)
        val outer = path[2] as? ChartPathCommand.Arc ?: fail("expected outer arc")
        assertEquals(90.0, outer.radius)
        assertTrue(outer.sweepDegrees < 0 && outer.sweepDegrees > -90)
    }

    // Logo loader

    @Test fun DS_logoUrlKeepsSignature() {
        val url = LogoLoader.url("/api/merchant-logos/name/Caff%C3%A8?s=abc123", "http://localhost:3001/".toHttpUrl())
        assertEquals("http://localhost:3001/api/merchant-logos/name/Caff%C3%A8?s=abc123", url.toString())
    }

    @Test fun DS_logoLoaderSendsAuthorizationAndCaches() = runTest {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse.Builder().body(Buffer().write(byteArrayOf(1, 2, 3))).build())
            val loader = LogoLoader(server.url("/").toString(), OkHttpClient()) { "tok" }
            val first = loader.data("/api/merchant-logos/netflix.com?s=1")
            val second = loader.data("/api/merchant-logos/netflix.com?s=1")
            assertContentEquals(byteArrayOf(1, 2, 3), first)
            assertContentEquals(first, second)
            assertEquals(1, server.requestCount)
            assertEquals("Bearer tok", server.takeRequest().headers["Authorization"])
        }
    }

    @Test fun DS_logoLoaderRemembersMisses() = runTest {
        MockWebServer().use { server ->
            server.start()
            server.enqueue(MockResponse.Builder().code(404).build())
            val loader = LogoLoader(server.url("/").toString(), OkHttpClient()) { null }
            assertNull(loader.data("/api/merchant-logos/none.com"))
            assertNull(loader.data("/api/merchant-logos/none.com"))
            assertEquals(1, server.requestCount)
            assertNull(server.takeRequest().headers["Authorization"])
        }
    }
}
