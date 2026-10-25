package io.buddybudget.core

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.AutoCategorizedResponse
import io.buddybudget.core.data.CategorizationRule
import io.buddybudget.core.data.CategorizeApplyGroup
import io.buddybudget.core.data.CategorizeSuggestion
import io.buddybudget.core.data.CategorizeSuggestionsResponse
import io.buddybudget.core.data.CategorySource
import io.buddybudget.core.data.CategoryType
import io.buddybudget.core.data.MovementCategory
import io.buddybudget.core.data.RuleMatchType
import io.buddybudget.core.data.RuleSaveResult
import io.buddybudget.core.data.SuggestionGroup
import io.buddybudget.core.domain.categorization.CategorizationText
import io.buddybudget.core.domain.categorization.CategorizeDecision
import io.buddybudget.core.domain.categorization.CategorizeDeck
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import io.buddybudget.core.domain.transactions.CategoryBoard
import io.buddybudget.core.domain.transactions.CategoryPicker
import io.buddybudget.core.domain.transactions.CategoryRules
import kotlinx.serialization.builtins.ListSerializer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Categories, rules and Categorizza (features/05-categories-categorization.md), against spec/api/fixtures.

private val json = ApiClient.DefaultJson
private fun categories(name: String = "categories.json") = json.decodeFromString(ListSerializer(MovementCategory.serializer()), fixture(name))
private fun cat(id: String, name: String, type: CategoryType, fallback: Boolean = false) = MovementCategory(id, name, type = type, isFallback = fallback)

private fun group(key: String, count: Int, suggestion: CategorizeSuggestion? = null) = SuggestionGroup(
    groupKey = "$key::uscita", merchantKey = key, label = key.replaceFirstChar { it.uppercase() },
    transactionIds = (0 until count).map { "$key-$it" }, transactionDescriptions = List(count) { key },
    transactionDates = (0 until count).map { "2026-10-%02d".format(10 + it) }, transactionAmounts = List(count) { -10.0 },
    totalAmount = -10.0 * count, suggestion = suggestion,
)

class CategorizationTest {
    @Test fun CAT001_CAT003_decodesCategoriesAndFindsTheFallbackByFlag() {
        val all = categories()
        assertEquals(25, all.size)
        assertEquals(1, all.count { it.isFallback })
        assertTrue(categories("categories-en.json").any { it.isFallback })
    }

    @Test fun CAT004_directionCompatibility() {
        assertTrue(CategoryRules.isDirectionCompatible(CategoryType.entrata, true, false))
        assertFalse(CategoryRules.isDirectionCompatible(CategoryType.entrata, false, false))
        assertTrue(CategoryRules.isDirectionCompatible(CategoryType.dovuta, false, false))
        assertFalse(CategoryRules.isDirectionCompatible(CategoryType.dovuta, true, false))
        assertTrue(CategoryRules.isDirectionCompatible(CategoryType.trasferimento, true, false))
        assertTrue(CategoryRules.isDirectionCompatible(CategoryType.voluta, true, true))
    }

    @Test fun CAT006_CAT007_boardSectionsInOrderWithEmptyGroups() {
        val board = CategoryBoard.sections(categories())
        assertEquals(listOf("dovuta", "voluta", "futuro", "saltuaria", "entrata", "trasferimento", "fallback"), board.map { it.key })
        assertNull(board.last().addType)
        val minimal = CategoryBoard.sections(listOf(cat("1", "Stipendio", CategoryType.entrata)))
        assertEquals(listOf("dovuta", "voluta", "futuro", "saltuaria", "entrata", "trasferimento"), minimal.map { it.key })
        assertTrue(minimal[0].categories.isEmpty())
    }

    @Test fun CAT090_mostUsedOnlyWithEightCategoriesAndSomeUsage() {
        val all = categories()
        val spesa = all.first { it.name == "Spesa" }
        val sections = CategoryPicker.sections(all, mapOf(spesa.id to 3), "")
        assertEquals("most-used", sections.first().key)
        assertEquals(listOf(spesa), sections.first().categories)
        assertEquals("fallback", sections.last().key)
        val few = all.take(5)
        assertNotEquals("most-used", CategoryPicker.sections(few, mapOf(few[0].id to 3), "").first().key)
        assertNotEquals("most-used", CategoryPicker.sections(all, emptyMap(), "").first().key)
        val dovute = sections.first { it.key == "type-dovuta" }.categories.map { it.name }
        assertEquals(dovute.sortedWith { a, b -> CategoryPicker.localeCompareIt(a, b) }, dovute)
    }

    @Test fun CAT091_searchIsAccentInsensitiveAndRanked() {
        val categories = listOf(
            cat("1", "Caffè & Bar", CategoryType.voluta), cat("2", "Bar sport", CategoryType.voluta), cat("3", "Sport & Benessere", CategoryType.voluta),
            cat("4", "Stipendio", CategoryType.entrata), cat("5", "Da categorizzare", CategoryType.voluta, fallback = true),
        )
        assertEquals("caffe", CategoryPicker.normalizeForSearch(" Caffè "))
        assertEquals(listOf("1"), CategoryPicker.sections(categories, emptyMap(), "CAFFE").first().categories.map { it.id })
        assertEquals(listOf("2", "1"), CategoryPicker.sections(categories, emptyMap(), "bar").first().categories.map { it.id })
        assertEquals(listOf("2"), CategoryPicker.sections(categories, emptyMap(), "sport bar").first().categories.map { it.id })
        assertEquals(listOf("3", "2", "1"), CategoryPicker.sections(categories, mapOf("3" to 9), "volu").first().categories.map { it.id })
        assertTrue(CategoryPicker.sections(categories, emptyMap(), "zzz").isEmpty())
    }

    @Test fun CAT025_decodesRulesFixture() {
        val rules = json.decodeFromString(ListSerializer(CategorizationRule.serializer()), fixture("categorization-rules.json"))
        assertTrue(rules.isNotEmpty())
        assertEquals(RuleMatchType.merchant, rules[0].matchType)
        assertTrue(rules[0].isLearned)
        assertNotNull(rules[0].categoryName)
    }

    @Test fun CAT033_ruleSaveResultCarriesAppliedAndPastMatches() {
        val body = """{"id":"r","matchType":"contains","pattern":"amazon","categoryId":"c","splitPercentage":"0.5000","source":"manuale","hitCount":0,"applied":3,"pastMatches":12}"""
        val result = json.decodeFromString(RuleSaveResult.serializer(), body)
        assertEquals(3, result.applied)
        assertEquals(12, result.pastMatches)
        assertEquals(0.5, json.decodeFromString(CategorizationRule.serializer(), body).splitPercentage)
    }

    @Test fun CAT039_deckSortsGroupsByMovementCount() {
        val deck = CategorizeDeck.of(listOf(group("a", 1), group("b", 3), group("c", 1), group("d", 2)))
        assertEquals(listOf("b", "d", "a", "c"), deck.queue.map { it.merchantKey })
        assertEquals(7, deck.movementCount)
    }

    @Test fun CAT058_CAT066_confirmUsesTheProposalAndItsSplit() {
        val suggestion = CategorizeSuggestion("cat", CategorySource.storico, 0.8, suggestedSplitPercentage = 0.5)
        var deck = CategorizeDeck.of(listOf(group("a", 2, suggestion), group("b", 1)))
        deck = deck.confirm(true)!!
        val (saved, batch) = deck.beginSave()
        assertEquals(CategorizeApplyGroup(listOf("a-0", "a-1"), "cat", 0.5, true, "a"), batch!![0].applyGroup)
        assertNull(saved.confirm(false))
        deck = saved.choose("other", false)
        assertEquals(0.0, deck.pending.last().excludedPercentage)
        assertEquals(CategorizeDecision.Exit.Change, deck.pending.last().exit)
        assertTrue(deck.isEmpty)
    }

    @Test fun CAT060_skipMovesTheCardToTheEnd() {
        val deck = CategorizeDeck.of(listOf(group("a", 3), group("b", 2), group("c", 1))).skip()
        assertEquals(listOf("b", "c", "a"), deck.queue.map { it.merchantKey })
        assertTrue(deck.pending.isEmpty())
    }

    @Test fun CAT064_undoRestoresTheLastUnsavedDecision() {
        var deck = CategorizeDeck.of(listOf(group("a", 2), group("b", 1))).choose("x", false).choose("y", false)
        assertTrue(deck.isEmpty && deck.canUndo)
        val (undone, decision) = deck.undo()
        assertEquals("b", decision?.group?.merchantKey)
        assertEquals("b", undone.current?.merchantKey)
        deck = undone.beginSave().first
        assertFalse(deck.canUndo)
    }

    @Test fun CAT065_failedSaveReturnsCardsToTheDeck() {
        val (saving, batch) = CategorizeDeck.of(listOf(group("a", 2), group("b", 1))).choose("x", false).beginSave()
        val deck = saving.failSave(batch!!)
        assertEquals(listOf("a", "b"), deck.queue.map { it.merchantKey })
        assertTrue(deck.saving.isEmpty())
    }

    @Test fun CAT040_CAT042_readyGroupsHiddenAndRestored() {
        val groups = listOf(group("a", 2), group("b", 1))
        val deck = CategorizeDeck.of(groups).remove(setOf("a::uscita"))
        assertEquals(listOf("b"), deck.queue.map { it.merchantKey })
        assertEquals(listOf("b", "a"), deck.restore(listOf(groups[0])).queue.map { it.merchantKey })
    }

    @Test fun CAT047_originPhrases() {
        assertEquals("Proposta dall'AI", CategorizationText.suggestionOrigin(CategorizeSuggestion("c", CategorySource.assistente, 0.7)).key)
        assertEquals(
            CategorizationText.Phrase("Simile alla tua regola «{0}»", listOf("esselunga")),
            CategorizationText.suggestionOrigin(CategorizeSuggestion("c", CategorySource.regola, 0.7, rulePattern = "esselunga")),
        )
        fun history(a: Int, t: Int) = CategorizationText.suggestionOrigin(
            CategorizeSuggestion("c", CategorySource.storico, 0.7, history = CategorizeSuggestion.History(a, t)),
        )
        assertEquals("Come l'unico tuo movimento simile", history(1, 1).key)
        assertEquals(CategorizationText.Phrase("Come tutti i tuoi {0} movimenti simili", listOf("3")), history(3, 3))
        assertEquals(CategorizationText.Phrase("Come {0} dei tuoi {1} movimenti simili", listOf("2", "3")), history(2, 3))
        assertEquals(93, CategorizationText.confidencePercent(0.934))
    }

    @Test fun CAT055_dateRangeLabel() {
        val today = CalendarDate(2026, 10, 18)
        assertEquals("9 ott", CategorizationText.dateRangeLabel(listOf("2026-10-09"), today, BBLocale.IT_IT))
        assertEquals("2–9 ott", CategorizationText.dateRangeLabel(listOf("2026-10-09", "2026-10-02"), today, BBLocale.IT_IT))
        assertEquals("28 set – 9 ott", CategorizationText.dateRangeLabel(listOf("2026-09-28", "2026-10-09"), today, BBLocale.IT_IT))
        assertTrue(CategorizationText.dateRangeLabel(listOf("2025-12-28", "2026-01-09"), today, BBLocale.IT_IT).contains("2025"))
        assertEquals(listOf(1, 2), CategorizationText.recentIndices(listOf("2026-10-01", "2026-10-09", "2026-10-05"), 2))
    }

    @Test fun CAT037_decodesSuggestionsAndAutoCategorizedShapes() {
        val suggestions = """{"groups":[{"groupKey":"bar centrale::uscita","merchantKey":"bar centrale","label":"Bar Centrale","transactionIds":["t"],"transactionDescriptions":["Bar Centrale"],"transactionDates":["2026-10-16"],"transactionAmounts":[-4.6],"totalAmount":-4.6,"suggestion":{"transactionId":"t","merchantKey":"bar centrale","suggestedCategoryId":"c","source":"storico","confidence":0.67,"reason":"x","suggestedSplitPercentage":null,"history":{"agreeing":2,"total":2}},"hasDivergentSuggestions":false,"logoPath":null}],"autoApply":{"enabled":true,"ready":0,"readyKeys":[]}}"""
        val decoded = json.decodeFromString(CategorizeSuggestionsResponse.serializer(), suggestions)
        assertEquals(2, decoded.groups[0].suggestion?.history?.total)
        assertFalse(decoded.groups[0].isIncome)
        val auto = """{"groups":[{"groupKey":"k","merchantKey":"m","label":"M","categoryId":"c","source":"regola","confidence":null,"transactionIds":["t"],"transactionDescriptions":["M"],"transactionDates":["2026-10-05"],"transactionAmounts":[-742.18],"totalAmount":-742.18,"lastCategorizedAt":"2026-10-18T11:45:23.496Z","logoPath":null}],"total":1,"seenAt":"2026-01-01T00:00:00.000Z"}"""
        val response = json.decodeFromString(AutoCategorizedResponse.serializer(), auto)
        assertEquals(CategorySource.regola, response.groups[0].source)
        assertEquals(1, response.total)
    }

    @Test fun CAT052_refreshKeepsOrderAndAddsNewGroups() {
        var deck = CategorizeDeck.of(listOf(group("a", 2), group("b", 1), group("c", 1))).choose("x", false)
        val suggestion = CategorizeSuggestion("s", CategorySource.assistente, 0.7)
        assertEquals(2, deck.withoutProposal)
        deck = deck.refresh(listOf(group("a", 2), group("c", 1, suggestion), group("b", 1), group("d", 1)))
        assertEquals(listOf("b", "c", "d"), deck.queue.map { it.merchantKey })
        assertNotNull(deck.queue[1].suggestion)
        assertEquals(2, deck.withoutProposal)
    }
}
