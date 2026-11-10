package io.buddybudget.core.domain

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import org.junit.Assume
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

// Shared golden vectors (spec/domain/vectors/<file>.json) for BBFormat, Periods and the domain ports: one parameterized test per
// vector file, one case per vector (named by its id). Same adapters as the iOS `vector-check`.

internal fun checkVector(vector: Vector) {
    val outcome = VectorSuite.run(vector)
    when (outcome) {
        is VectorOutcome.Fail -> fail("[${vector.id}] ${vector.function}: ${outcome.message}")
        is VectorOutcome.Skip -> Assume.assumeTrue("deferred: ${outcome.reason}", false)
        VectorOutcome.Pass -> Unit
    }
}

class VectorFilesTest {
    @Test fun vectorFilesLoadAndLocaleDataIsCurrent() {
        for (file in VectorSuite.files) assertTrue(VectorSuite.load(file).isNotEmpty(), "$file has no vectors")
        assertNull(VectorSuite.localeDataMismatch())
    }

    /** Behaviour stated in formatting-localization.md but not pinned by the vectors. */
    @Test fun amountMaskAndHalfCentRounding() {
        assertEquals("\u2022\u2022\u2022\u2022", BBFormat.formatCurrency(1234.5, "EUR", BBLocale.IT_IT, masked = true))
        assertEquals("1,01\u00A0\u20AC", BBFormat.formatCurrency(1.005, "EUR", BBLocale.DE_DE))
        assertEquals(1.5, BBFormat.parseAmount("1,5"))
        assertEquals(12.5, BBFormat.parseAccountAmount("12,5"))
        assertEquals(-2.0, JSNumber.round(-2.5))
    }
}

@RunWith(Parameterized::class)
class FormattingVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("formatting.json")
    }
}

@RunWith(Parameterized::class)
class ExpensesVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("expenses.json")
    }
}

@RunWith(Parameterized::class)
class CashflowVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("cashflow.json")
    }
}

@RunWith(Parameterized::class)
class LiquidityVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("liquidity.json")
    }
}

@RunWith(Parameterized::class)
class NetWorthVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("net-worth.json")
    }
}

@RunWith(Parameterized::class)
class DebtsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("debts.json")
    }
}

@RunWith(Parameterized::class)
class GoalsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("goals.json")
    }
}

@RunWith(Parameterized::class)
class PensionVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("pension.json")
    }
}

@RunWith(Parameterized::class)
class ItalianTaxesVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("italian-taxes.json")
    }
}

@RunWith(Parameterized::class)
class FireAndSimulationsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("fire-and-simulations.json")
    }
}

@RunWith(Parameterized::class)
class ReturnsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("returns.json")
    }
}

@RunWith(Parameterized::class)
class CategoryColorsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("category-colors.json")
    }
}

@RunWith(Parameterized::class)
class CostsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("costs.json")
    }
}

@RunWith(Parameterized::class)
class ExposureVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("exposure.json")
    }
}

@RunWith(Parameterized::class)
class PlanningDEVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("financial-planning-de.json")
    }
}

@RunWith(Parameterized::class)
class FxVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("fx.json")
    }
}

@RunWith(Parameterized::class)
class InvestmentsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("investments.json")
    }
}

@RunWith(Parameterized::class)
class MonthPaceVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("month-pace.json")
    }
}

@RunWith(Parameterized::class)
class OverviewVoiceVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("overview-voice.json")
    }
}

@RunWith(Parameterized::class)
class RiskVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("risk.json")
    }
}

@RunWith(Parameterized::class)
class SubscriptionsVectorsTest(private val vector: Vector) {
    @Test fun vector() = checkVector(vector)

    companion object {
        @JvmStatic @Parameterized.Parameters(name = "{0}")
        fun vectors(): List<Vector> = VectorSuite.load("subscriptions.json")
    }
}
