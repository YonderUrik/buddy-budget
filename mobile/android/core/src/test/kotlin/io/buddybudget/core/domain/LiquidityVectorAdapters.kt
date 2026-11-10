package io.buddybudget.core.domain

import io.buddybudget.core.domain.format.JSNumber
import io.buddybudget.core.domain.liquidity.ConnectionHealth
import io.buddybudget.core.domain.liquidity.ConnectionStatus
import io.buddybudget.core.domain.liquidity.MovementFields
import io.buddybudget.core.domain.liquidity.MovementList
import io.buddybudget.core.domain.liquidity.SplitShare
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.io.File

/** A fixture transaction (`expenses.json → fixtures.transactions`) as a [MovementFields]. */
internal data class VectorMovement(
    val id: String,
    override val date: String,
    override val description: String,
    override val note: String?,
    override val categoryId: String?,
    override val accountId: String?,
    override val amount: Double,
    override val excludedAmount: Double,
) : MovementFields {
    companion object {
        /** `expenses.json → fixtures.transactions` (liquidity.json shares the expenses fixtures). */
        fun fixture(): List<VectorMovement> {
            val root = Json.parseToJsonElement(File(VectorSuite.specDir, "domain/vectors/expenses.json").readText()).jsonObject
            return root.getValue("fixtures")["transactions"].list.map { j ->
                VectorMovement(
                    id = j["id"].str,
                    date = j["date"].str,
                    description = j["description"].optStr ?: "",
                    note = j["note"].optStr,
                    categoryId = j["categoryId"].optStr,
                    accountId = j["accountId"].optStr,
                    amount = JSNumber.parse(j["amount"].str) ?: error("amount"),
                    excludedAmount = JSNumber.parse(j["excludedAmount"].str) ?: error("excludedAmount"),
                )
            }
        }
    }
}

/** JS `Number(x)` for a vector number that may be written as the string "NaN". */
private val JsonElement.jsNumber: Double get() = optStr?.let { JSNumber.parse(it) ?: Double.NaN } ?: num

internal object LiquidityVectorAdapters {
    val handlers: Map<String, Handler> = mapOf(
        "ownShareForPreset" to { i -> n(SplitShare.ownShareForPreset(i["total"].num, i["parts"].int)) },
        "clampOwnShare" to { i -> n(SplitShare.clampOwnShare(i["share"].jsNumber, i["total"].num)) },
        "excludedFromOwnShare" to { i -> n(SplitShare.excludedFromOwnShare(i["total"].num, i["ownShare"].jsNumber)) },
        "matchPreset" to { i -> SplitShare.matchPreset(i["total"].num, i["ownShare"].jsNumber)?.let { s(it.key) } ?: JsonNull },
        "groupByDay" to { i ->
            require(i["fixture"].str == "transactions (only 2026-10-*)") { "fixture ${i["fixture"]}" }
            val txs = VectorMovement.fixture().filter { it.date.startsWith("2026-10-") }
            arr(
                MovementList.groupByDay(txs, i["today"].date, i.locale).map { g ->
                    obj("date" to s(g.date), "label" to s(g.label), "total" to n(g.total), "itemIds" to arr(g.items.map { s(it.id) }))
                },
            )
        },
        "computeConnectionHealth" to { i ->
            val input = i["input"]
            val status = ConnectionStatus.fromKey(input["status"].str) ?: error("status")
            val expires = if (input["consentExpiresAt"].isNull) null else input["consentExpiresAt"].instant
            val h = ConnectionHealth.computeConnectionHealth(status, expires, i["now"].instant)
            obj("state" to s(h.state.key), "daysLeft" to (h.daysLeft?.let { n(it) } ?: JsonNull))
        },
    )
}
