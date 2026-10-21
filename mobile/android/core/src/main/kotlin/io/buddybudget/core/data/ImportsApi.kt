package io.buddybudget.core.data

import io.buddybudget.core.domain.imports.ActivityStatement
import io.buddybudget.core.domain.imports.BrokerStatementRecord
import io.buddybudget.core.domain.imports.ImportHistory
import io.buddybudget.core.domain.imports.ImportIdentity
import io.buddybudget.core.domain.imports.ImportMatch
import io.buddybudget.core.domain.imports.ImportRunResult
import io.buddybudget.core.domain.imports.InvestmentResetPreview
import io.buddybudget.core.domain.imports.PersonalImportCorrection
import io.buddybudget.core.domain.imports.PersonalImportDeletion
import io.buddybudget.core.domain.imports.PersonalImportListing
import io.buddybudget.core.domain.imports.PersonalImportPreview
import io.buddybudget.core.domain.imports.PersonalImportRules
import io.buddybudget.core.domain.imports.RunImportRequest
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Imports (14-imports, 07-investments §8–9): personal CSV/Excel jobs (`/api/personal-imports`) and broker-file imports
// (`/api/investments/import*`, `/api/investments/statements`). Bearer requests without cookies pass the Origin check
// (auth.md R8). Same names on iOS (`ImportsAPI.swift`).

/** Failure of an import call with the server's (Italian) message when there is one. */
data class ImportApiFailure(val message: String?, val status: Int? = null, val code: String? = null) {
    /** IMP-062: the same file was already imported (409 `already_imported`): a notice, not a fault. */
    val alreadyImported: Boolean get() = code == io.buddybudget.core.domain.imports.PersonalImportRules.ALREADY_IMPORTED_CODE

    companion object {
        fun of(error: Throwable): ImportApiFailure = when (error) {
            is ApiError.Http -> ImportApiFailure(error.body.message, error.body.status, (error.body.code as? ApiErrorCode.Other)?.raw)
            else -> ImportApiFailure(null, null)
        }
    }
}

class PersonalImportsApi(private val client: ApiClient) {
    @Serializable
    private data class JobId(val id: String)

    /** `GET /api/personal-imports` (IMP-002). */
    suspend fun list(): PersonalImportListing = client.get("api/personal-imports", PersonalImportListing.serializer())

    /** `POST /api/personal-imports` → job id (IMP-023, IMP-049, INV-104). */
    suspend fun enqueue(
        csv: String, name: String, formatId: String? = null, regenerate: Boolean = false, brokerFallback: Boolean = false,
        correctionOf: String? = null, feedback: String? = null,
    ): String {
        val body = linkedMapOf<String, JsonElement>(
            "csv" to JsonPrimitive(csv), "name" to JsonPrimitive(name), "consent" to JsonPrimitive(true),
            "consentVersion" to JsonPrimitive(PersonalImportRules.CONSENT_VERSION),
        )
        formatId?.let { body["formatId"] = JsonPrimitive(it) }
        if (regenerate) body["regenerate"] = JsonPrimitive(true)
        if (brokerFallback) body["brokerFallback"] = JsonPrimitive(true)
        correctionOf?.let { body["correctionOf"] = JsonPrimitive(it) }
        feedback?.let { body["feedback"] = JsonPrimitive(it) }
        val response = client.send("api/personal-imports", "POST", body = JsonObject(body).toString(), timeoutSeconds = 300)
        return decode(response, JobId.serializer()).id
    }

    suspend fun preview(id: String): PersonalImportPreview = client.get("api/personal-imports/$id", PersonalImportPreview.serializer())

    suspend fun correction(id: String): PersonalImportCorrection =
        client.get("api/personal-imports/$id", PersonalImportCorrection.serializer(), mapOf("correction" to "1"))

    suspend fun deletionSummary(id: String): PersonalImportDeletion =
        client.get("api/personal-imports/$id", PersonalImportDeletion.serializer(), mapOf("deletion" to "1"))

    /** `{action}`: `import_skipping_errors`, `replace_import`, `discard_correction`. */
    suspend fun act(id: String, action: String) {
        client.send("api/personal-imports/$id", "POST", body = JsonObject(mapOf("action" to JsonPrimitive(action))).toString(), timeoutSeconds = 120)
    }

    suspend fun reanalyze(id: String): String {
        val body = JsonObject(mapOf("action" to JsonPrimitive("reanalyze"), "consent" to JsonPrimitive(true),
            "consentVersion" to JsonPrimitive(PersonalImportRules.CONSENT_VERSION)))
        return decode(client.send("api/personal-imports/$id", "POST", body = body.toString()), JobId.serializer()).id
    }

    suspend fun delete(id: String, token: String) {
        client.send("api/personal-imports/$id", "DELETE", body = JsonObject(mapOf("token" to JsonPrimitive(token))).toString(), timeoutSeconds = 120)
    }

    private fun <T> decode(response: ApiResponse, decoder: DeserializationStrategy<T>): T = try {
        client.json.decodeFromString(decoder, response.text)
    } catch (e: Exception) {
        throw ApiError.Decoding(e.message ?: "invalid JSON")
    }
}

class BrokerImportApi(private val client: ApiClient) {
    @Serializable
    private data class StatementsResponse(val statements: List<BrokerStatementRecord> = emptyList())

    @Serializable
    private data class PortfoliosResponse(val portfolios: List<Portfolio> = emptyList())

    @Serializable
    data class Portfolio(val id: String, val name: String)

    /** `POST /api/investments/import/parse` with the raw CSV (INV-096). */
    suspend fun parse(csv: String): ActivityStatement {
        val response = client.send("api/investments/import/parse", "POST", body = csv, contentType = "text/csv; charset=utf-8", timeoutSeconds = 120)
        return decode(response, ActivityStatement.serializer())
    }

    /** `POST /api/investments/import/resolve` (INV-099). */
    suspend fun resolve(identities: List<ImportIdentity>): Map<String, ImportMatch> {
        val list = JsonArray(identities.map { i ->
            val o = linkedMapOf<String, JsonElement>(
                "key" to JsonPrimitive(i.key), "symbol" to (i.symbol?.let(::JsonPrimitive) ?: JsonNull), "isin" to (i.isin?.let(::JsonPrimitive) ?: JsonNull),
                "name" to (i.name?.let(::JsonPrimitive) ?: JsonNull), "currency" to (i.currency?.let(::JsonPrimitive) ?: JsonNull),
                "symbolIsYahoo" to JsonPrimitive(i.symbolIsYahoo),
            )
            i.type?.let { o["type"] = JsonPrimitive(it) }
            JsonObject(o)
        })
        val response = client.send("api/investments/import/resolve", "POST", body = JsonObject(mapOf("identities" to list)).toString(), timeoutSeconds = 150)
        return parseResolve(response.text)
    }

    /** `POST /api/investments/import` (INV-100/101): 400/422 bodies with `rows` are results. */
    suspend fun run(request: RunImportRequest): ImportRunResult = try {
        decode(client.send("api/investments/import", "POST", body = request.json().toString(), timeoutSeconds = 320), ImportRunResult.serializer())
    } catch (e: ApiError.Http) {
        val raw = e.body.raw
        if ((e.body.status == 400 || e.body.status == 422) && raw != null && raw.contains("\"rows\"")) {
            runCatching { client.json.decodeFromString(ImportRunResult.serializer(), raw) }.getOrNull() ?: throw e
        } else {
            throw e
        }
    }

    suspend fun statements(): List<BrokerStatementRecord> = client.get("api/investments/statements", StatementsResponse.serializer()).statements

    suspend fun deleteStatement(id: String, confirmedIds: List<String>) {
        client.send("api/investments/statements/$id", "DELETE",
            body = JsonObject(mapOf("confirmedIds" to JsonArray(confirmedIds.map(::JsonPrimitive)))).toString(), timeoutSeconds = 120)
    }

    suspend fun resetPreview(): InvestmentResetPreview = client.get("api/investments/import/reset", InvestmentResetPreview.serializer())

    suspend fun reset(revision: String) {
        client.send("api/investments/import/reset", "DELETE",
            body = JsonObject(mapOf("revision" to JsonPrimitive(revision), "confirmation" to JsonPrimitive(ImportHistory.RESET_CONFIRMATION))).toString(),
            timeoutSeconds = 120)
    }

    /** Portfolios for the DEGIRO destination (INV-097), from `GET /api/investments/overview?period=1mese`. */
    suspend fun portfolios(): List<Portfolio> =
        client.get("api/investments/overview", PortfoliosResponse.serializer(), mapOf("period" to "1mese")).portfolios

    private fun <T> decode(response: ApiResponse, decoder: DeserializationStrategy<T>): T = try {
        client.json.decodeFromString(decoder, response.text)
    } catch (e: Exception) {
        throw ApiError.Decoding(e.message ?: "invalid JSON")
    }

    companion object {
        /** Decodes `{ results: [{ key, match }] }`. */
        fun parseResolve(text: String): Map<String, ImportMatch> {
            val root = ApiClient.DefaultJson.parseToJsonElement(text).jsonObject
            val out = LinkedHashMap<String, ImportMatch>()
            for (result in (root["results"] as? JsonArray).orEmpty()) {
                val o = result.jsonObject
                val key = o["key"]?.jsonPrimitive?.content ?: continue
                val match = o["match"]?.jsonObject ?: continue
                fun str(name: String) = (match[name] as? JsonPrimitive)?.takeIf { it.isString }?.content
                out[key] = when (str("kind")) {
                    "known" -> ImportMatch.Known(ApiClient.DefaultJson.decodeFromJsonElement(Instrument.serializer(), match.getValue("instrument")))
                    "proposal" -> {
                        val input = match["input"] ?: JsonObject(emptyMap())
                        ImportMatch.Proposal(input, str("label") ?: "", str("detail") ?: "", str("type") ?: "etf", str("confidence") ?: "exact",
                            ((input as? JsonObject)?.get("source") as? JsonPrimitive)?.content ?: "")
                    }
                    else -> ImportMatch.None(str("reason") ?: "not_found")
                }
            }
            return out
        }
    }
}
