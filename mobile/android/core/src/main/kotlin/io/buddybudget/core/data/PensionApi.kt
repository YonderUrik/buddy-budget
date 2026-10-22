package io.buddybudget.core.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Pensione (spec: api/endpoints/pension.md, features/09-pension.md). IT only: DE gets 403 `country_feature_unavailable`.
// Amounts are JSON numbers. Same names on iOS (`PensionAPI` and the models in `BuddyBudgetKit/Data/PensionAPI.swift`).

/** Everything the Pensione tabs show for one fund (gaps.md G10, PEN-002). */
@Serializable
data class PensionView(
    val currency: String = "EUR",
    val today: String,
    val funds: List<FundSummary> = emptyList(),
    val fund: Fund? = null,
    val last: PensionSnapshot? = null,
    val performance: Performance? = null,
    val contributions: List<Contribution> = emptyList(),
    val scenarios: List<Scenario> = emptyList(),
    val tfr: Tfr? = null,
    val assumedInflation: Double = 0.02,
    val quarterly: Double = 0.0,
    val yearly: List<Year> = emptyList(),
    val projection: Projection,
    val exitTax: ExitTax,
) {
    @Serializable data class FundSummary(val id: String, val name: String, val adhesionDate: String, val snapshotCount: Int = 0, val lastDate: String? = null)
    @Serializable data class Fund(val id: String, val name: String, val adhesionDate: String, val snapshots: List<PensionSnapshot> = emptyList())

    @Serializable
    data class Performance(
        val value: Double,
        val netContributions: Double,
        val gain: Double,
        val gainPct: Double? = null,
        val annualReturn: Double? = null,
        val approximate: Boolean = false,
        val firstDate: String,
        val lastDate: String,
    )

    @Serializable data class Contribution(val date: String, val amount: Double, val estimated: Boolean = false)

    /** `reason`: `pensionamento` | `sanitarie` | `altri`. */
    @Serializable data class Scenario(val reason: String, val rate: Double, val netLow: Double, val netHigh: Double)

    @Serializable data class Tfr(val gross: Double, val net: Double, val annualRate: Double)

    @Serializable
    data class Year(val year: Int, val contributions: Double, val gain: Double, val endValue: Double, val returnRate: Double? = null, val partial: Boolean = false)

    @Serializable data class Slider(val min: Double, val max: Double, val step: Double, val default: Double)

    @Serializable
    data class Projection(val preview: Preview? = null, val years: Int = 25, val rates: Rates, val sliders: Sliders) {
        @Serializable data class Preview(val year: Int, val prudent: Double, val base: Double, val optimistic: Double)
        @Serializable data class Rates(val prudent: Double, val base: Double, val optimistic: Double)
        @Serializable data class Sliders(val years: Slider, val quarterlyContribution: Slider)
    }

    @Serializable
    data class ExitTax(val realYears: Int, val rate: Double, val milestones: Milestones? = null, val maxYears: Int = 35, val timeline: List<Step> = emptyList()) {
        @Serializable data class Milestones(val reductionStartsOn: String, val minRateOn: String)

        /** Index = years of participation (0…35). */
        @Serializable data class Step(val years: Int, val rate: Double, val scenarios: List<Scenario> = emptyList())
    }
}

@Serializable
data class PensionSnapshot(val id: String, val date: String, val netContributions: Double, val value: Double)

/** One row of `POST /api/pension/funds/{id}/snapshots/import` (PEN-017). */
data class PensionImportRowInput(val line: Int, val date: String, val netContributions: Double, val value: Double)

/** `counts` of an import. */
@Serializable
data class PensionImportCounts(val new: Int = 0, val update: Int = 0, val unchanged: Int = 0, val error: Int = 0)

class PensionApi(private val client: ApiClient) {
    /** PEN-002 (`fundId` default: first fund). */
    suspend fun view(fundId: String?): PensionView =
        client.get("api/pension/view", PensionView.serializer(), fundId?.let { mapOf("fundId" to it) } ?: emptyMap())

    /** PEN-006 (201 `{ id }`). */
    suspend fun createFund(name: String, adhesionDate: String): String =
        DebtsApi.idOf(client.send("api/pension/funds", "POST", body = buildJsonObject { put("name", name); put("adhesionDate", adhesionDate) }.toString()).text)

    /** PEN-008 (204): only changed fields are sent. */
    suspend fun updateFund(id: String, name: String?, adhesionDate: String?) {
        val body = buildJsonObject { name?.let { put("name", it) }; adhesionDate?.let { put("adhesionDate", it) } }
        client.send("api/pension/funds/$id", "PATCH", body = body.toString())
    }

    /** PEN-009 (204). */
    suspend fun deleteFund(id: String) = client.sendNoContent("api/pension/funds/$id", "DELETE")

    /** PEN-010: upsert by date (201). */
    suspend fun saveSnapshot(fundId: String, date: String, netContributions: Double, value: Double) {
        val body = buildJsonObject { put("date", date); put("netContributions", netContributions); put("value", value) }
        client.send("api/pension/funds/$fundId/snapshots", "POST", body = body.toString())
    }

    /** PEN-012 (204). */
    suspend fun deleteSnapshot(fundId: String, snapshotId: String) = client.sendNoContent("api/pension/funds/$fundId/snapshots/$snapshotId", "DELETE")

    /** PEN-017: all-or-nothing import of rows parsed on the device (pasted text → `incollato`). */
    suspend fun importSnapshots(fundId: String, rows: List<PensionImportRowInput>, format: String = "incollato"): PensionImportCounts {
        val body: JsonObject = buildJsonObject {
            put("format", format)
            put("rows", buildJsonArray {
                rows.forEach { r ->
                    add(buildJsonObject { put("line", r.line); put("date", r.date); put("netContributions", r.netContributions); put("value", r.value) })
                }
            })
        }
        val response = client.send("api/pension/funds/$fundId/snapshots/import", "POST", body = body.toString())
        return try {
            client.json.decodeFromString(ImportResult.serializer(), response.text).counts
        } catch (e: Exception) {
            throw ApiError.Decoding(e.message ?: "invalid JSON")
        }
    }

    @Serializable
    private data class ImportResult(val counts: PensionImportCounts)
}
