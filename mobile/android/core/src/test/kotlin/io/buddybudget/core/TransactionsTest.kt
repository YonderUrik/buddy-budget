package io.buddybudget.core

import io.buddybudget.core.data.Account
import io.buddybudget.core.data.AccountSource
import io.buddybudget.core.data.isManual
import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.LiquidityAnalysis
import io.buddybudget.core.data.LiquidityMonth
import io.buddybudget.core.data.Movement
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.MovementPage
import io.buddybudget.core.data.MovementType
import io.buddybudget.core.data.TransactionOrigin
import io.buddybudget.core.data.TransactionPatch
import io.buddybudget.core.data.TransactionQuery
import io.buddybudget.core.data.TransactionsApi
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.periods.ExpensePeriod
import io.buddybudget.core.domain.periods.Periods
import io.buddybudget.core.domain.liquidity.SplitShare
import io.buddybudget.core.domain.transactions.AddTransactionField
import io.buddybudget.core.domain.transactions.AddTransactionForm
import io.buddybudget.core.domain.transactions.CategoryRules
import io.buddybudget.core.domain.transactions.MovementEdit
import io.buddybudget.core.domain.transactions.MovementFeed
import io.buddybudget.core.domain.transactions.MovementKind
import io.buddybudget.core.domain.transactions.SplitForm
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.builtins.ListSerializer
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

// Movimenti, Analisi and the add/edit/split forms (features/03-transactions.md), against spec/api/fixtures.

private val json = ApiClient.DefaultJson
private val today = CalendarDate(2026, 10, 18)

private fun page(name: String) = json.decodeFromString(MovementPage.serializer(), fixture(name))
private fun categories() = json.decodeFromString(ListSerializer(MovementCategory.serializer()), fixture("categories.json"))

private fun movement(id: String, amount: Double, excluded: Double = 0.0, date: String = "2026-10-18", note: String? = null) =
    Movement(id = id, accountId = "a", categoryId = "c", description = "Spesa $id", note = note, amount = amount,
        excludedAmount = excluded, date = date)

class TransactionsTest {
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()

    @AfterTest fun tearDown() = server.close()

    @Test fun TX007_pagedRequestSendsLimitCursorAndFilters() = runTest {
        server.enqueue(MockResponse.Builder().body(fixture("transactions-page.json")).build())
        val api = TransactionsApi(ApiClient(server.url("/").toString(), OkHttpClient(), InMemorySessionStore("t")))
        val query = TransactionQuery(MovementType.uscita, "acc", "cat", "  super ", uncategorized = true, limit = 20)
        val result = api.page(query, "CUR")
        val url = server.takeRequest().url
        assertEquals("/api/transactions", url.encodedPath)
        assertEquals(
            mapOf("limit" to "20", "type" to "uscita", "accountId" to "acc", "categoryId" to "cat", "q" to "super", "uncategorized" to "1", "cursor" to "CUR"),
            url.queryParameterNames.associateWith { url.queryParameter(it)!! },
        )
        assertEquals(20, result.items.size)
        assertNotNull(result.nextCursor)
        val transfer = result.items[0]
        assertEquals(-250.0, transfer.amount)
        assertEquals(0.0, transfer.effectiveAmount)
        assertEquals(TransactionOrigin.auto, transfer.source)
    }

    @Test fun TX014_TX015_defaultQueryHasNoOptionalFilters() {
        val q = TransactionQuery()
        assertEquals(mapOf("limit" to "50", "type" to "tutte"), q.queryItems(null))
        assertFalse(q.hasFilters)
        assertNull(TransactionQuery(search = "   ").queryItems(null)["q"])
        assertTrue(TransactionQuery(type = MovementType.entrata).hasFilters)
    }

    @Test fun TX018_feedGroupsByDayAndHoldsBackTheIncompleteLastDay() {
        var feed = MovementFeed().reset(page("transactions-page.json"))
        val first = feed.groups(today, BBLocale.IT_IT)
        assertEquals("2026-10-18", first.first().date)
        assertEquals("Oggi", first.first().label)
        assertEquals("Ieri", first[1].label)
        assertEquals("2026-10-11", first.last().date)
        assertEquals(0.0, first.first().total)
        feed = feed.append(page("transactions-page-2.json"))
        assertTrue(feed.groups(today, BBLocale.IT_IT).any { it.date == "2026-10-10" })
        assertEquals(40, feed.items.size)
        feed = feed.append(page("transactions-page-2.json"))
        assertEquals(40, feed.items.size)
    }

    @Test fun TX019_lastPageShowsEveryDay() {
        val feed = MovementFeed().reset(page("transactions-page-uncategorized.json"))
        assertFalse(feed.hasMore)
        assertEquals(5, feed.groups(today, BBLocale.IT_IT).size)
    }

    @Test fun TX008_decodesLiquidityMonthFixtures() {
        val month = json.decodeFromString(LiquidityMonth.serializer(), fixture("liquidity-month.json"))
        assertEquals(4, month.accounts.count)
        assertEquals(listOf("dovuta", "voluta", "futuro", "saltuaria"), month.groups.map { it.key })
        assertTrue(month.voice.first().segments.any { it.strong })
        assertNotNull(month.budget)
        assertEquals(JSNumber.round2(month.income - month.spent), month.surplus)
        val empty = json.decodeFromString(LiquidityMonth.serializer(), fixture("liquidity-month-en-empty.json"))
        assertNull(empty.pace.typicalSoFar)
        assertNull(empty.budget)
        assertEquals(0, empty.toFix)
        json.decodeFromString(LiquidityMonth.serializer(), fixture("liquidity-month-account.json"))
    }

    @Test fun TX053_decodesAnalysisFixtures() {
        val current = json.decodeFromString(LiquidityAnalysis.serializer(), fixture("liquidity-analysis.json"))
        assertTrue(current.isCurrentMonth)
        assertNotNull(current.typical)
        assertEquals(current.range.from, current.curve.first().date)
        assertTrue(current.groups.all { it.categories.isNotEmpty() })
        val previous = json.decodeFromString(LiquidityAnalysis.serializer(), fixture("liquidity-analysis-previous-month.json"))
        assertFalse(previous.isCurrentMonth)
        assertNull(previous.typical)
        assertEquals(12, json.decodeFromString(LiquidityAnalysis.serializer(), fixture("liquidity-analysis-anno.json")).savings.size)
    }

    @Test fun TX007_decodesAccountsAsRefs() {
        val accounts = json.decodeFromString(io.buddybudget.core.data.AccountListSerializer, fixture("accounts.json"))
        assertTrue(accounts.isNotEmpty())
        assertTrue(accounts.any { it.isManual })
    }

    @Test fun TX042_addFormValidatesEachStep() {
        val cats = categories()
        val accounts = listOf(Account("bank", "Banca", "", 0.0, source = AccountSource.Auto), Account("cash", "Contanti", "", 0.0))
        var form = AddTransactionForm(today).next(cats, emptyMap(), accounts)
        assertEquals(0, form.step)
        assertEquals("Scrivi un importo maggiore di zero.", form.errors[AddTransactionField.Amount])
        form = form.copy(amountText = "0").next(cats, emptyMap(), accounts)
        assertEquals(0, form.step)
        form = form.copy(amountText = "12,50").next(cats, emptyMap(), accounts)
        assertEquals(1, form.step)
        val (withErrors, missing) = form.body(cats, emptyMap(), accounts)
        assertNull(missing)
        assertNotNull(withErrors.errors[AddTransactionField.Description])
        val (_, body) = withErrors.copy(description = "  Pane  ").body(cats, emptyMap(), accounts)
        assertNotNull(body)
        assertEquals(12.5, body.amount)
        assertEquals("Pane", body.description)
        assertEquals("uscita", body.direction)
        assertEquals("cash", body.accountId)
        assertEquals("2026-10-18", body.date)
    }

    @Test fun TX043_defaultCategoryIsTheMostUsedEligibleNeverTheFallback() {
        val cats = categories()
        val spesa = cats.first { it.name == "Spesa" }
        val fallback = cats.first { it.isFallback }
        var form = AddTransactionForm(today)
        assertEquals(spesa.id, form.categoryId(cats, mapOf(spesa.id to 5, fallback.id to 50)))
        form = form.withDirection(true)
        val stipendio = cats.first { it.name == "Stipendio" }
        assertEquals(stipendio.id, form.categoryId(cats, mapOf(stipendio.id to 1)))
        assertTrue(form.availableCategories(cats).all { it.type == CategoryType.entrata || it.type == CategoryType.trasferimento })
        form = form.copy(categoryOverride = stipendio.id).withDirection(false)
        assertNull(form.categoryOverride)
    }

    @Test fun TX044_noManualAccountBlocksSubmit() {
        val form = AddTransactionForm(today, amountText = "5", description = "Caffè")
        val (next, body) = form.body(categories(), emptyMap(), listOf(Account("b", "B", "", 0.0, source = AccountSource.Auto)))
        assertNull(body)
        assertEquals("Serve un conto manuale su cui registrare il movimento.", next.errors[AddTransactionField.Account])
    }

    @Test fun TX046_addAnotherKeepsDateAccountAndDirection() {
        val form = AddTransactionForm(CalendarDate(2026, 10, 17), step = 1, isIncome = true, amountText = "10", description = "x",
            accountOverride = "cash").didAddAndContinue()
        assertEquals(0, form.step)
        assertTrue(form.amountText.isEmpty() && form.description.isEmpty())
        assertTrue(form.isIncome && form.accountOverride == "cash" && form.date.day == 17)
        assertEquals(1, form.added)
    }

    @Test fun TX034_TX035_splitFormClampsAndMatchesPresets() {
        var split = SplitForm.of(movement("m", -90.0, -45.0))
        assertEquals(90.0, split.total)
        assertEquals(45.0, split.ownShare)
        assertEquals("meta", split.matchingPreset?.key)
        split = split.applyPreset(SplitShare.presets[2])
        assertEquals(30.0, split.ownShare)
        assertEquals(60.0, split.excluded)
        split = split.withOwnShare("200")
        assertEquals(90.0, split.ownShare)
        assertEquals(0.0, split.excluded)
        assertEquals(90.0, split.withOwnShare("abc").ownShare)
        split = split.withOwnShare(-3.0)
        assertEquals(0.0, split.ownShare)
        assertEquals(90.0, split.excluded)
        assertNull(split.matchingPreset)
    }

    @Test fun TX039_editSendsOnlyChangedValidFields() {
        val m = movement("m", -12.5, date = "2026-10-10")
        assertNull(MovementEdit.patch(m, "Spesa m", CalendarDate.parse("2026-10-10")!!, "12,50"))
        assertEquals(TransactionPatch(description = "Pane", date = "2026-10-11"), MovementEdit.patch(m, " Pane ", CalendarDate.parse("2026-10-11")!!, ""))
        assertEquals(TransactionPatch(amount = 13.0), MovementEdit.patch(m, "", CalendarDate.parse("2026-10-10")!!, "13"))
    }

    @Test fun TX038_noteSavesOnlyWhenChangedAndEmptyClears() {
        val m = movement("m", -1.0, note = "cena")
        assertNull(MovementEdit.notePatch(m, " cena "))
        assertEquals("", MovementEdit.notePatch(m, ""))
        assertEquals(500, MovementEdit.notePatch(m, "a".repeat(600))?.length)
    }

    @Test fun TX025_TX026_movementKind() {
        val cats = categories()
        val transfer = cats.first { it.type == CategoryType.trasferimento }
        val fallback = cats.first { it.isFallback }
        val spesa = cats.first { it.name == "Spesa" }
        assertEquals(MovementKind.Transfer, MovementKind.of(movement("a", -5.0, -5.0), transfer))
        assertEquals(MovementKind.Uncategorized, MovementKind.of(movement("a", -5.0), fallback))
        assertEquals(MovementKind.Split, MovementKind.of(movement("a", -5.0, -2.0), spesa))
        assertEquals(MovementKind.Plain, MovementKind.of(movement("a", -5.0), spesa))
    }

    @Test fun TX028_pickerOffersFallbackTransfersAndDirectionCategories() {
        val cats = categories()
        val forIncome = CategoryRules.pickerCategories(cats, 10.0)
        assertTrue(forIncome.any { it.isFallback })
        assertTrue(forIncome.all { it.isFallback || it.type == CategoryType.entrata || it.type == CategoryType.trasferimento })
        assertFalse(CategoryRules.pickerCategories(cats, -10.0).any { it.type == CategoryType.entrata })
    }

    @Test fun TX052_analysisPeriodNavigation() {
        assertEquals(9, Periods.shiftReferenceDate(ExpensePeriod.MESE, today, -1).month)
        val range = Periods.getPeriodRange(ExpensePeriod.TRE_MESI, today)
        assertEquals("2026-08-01", range.from.iso)
        assertEquals("2026-10-31", range.to.iso)
    }
}
