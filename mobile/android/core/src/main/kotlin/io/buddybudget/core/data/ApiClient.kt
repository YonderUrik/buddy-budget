package io.buddybudget.core.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody

// ---------------------------------------------------------------------------------------------------------------------
// Errors (spec: api/README.md §5)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Stable machine codes of the backend (`API_ERROR_CODES`, plus better-auth's UPPER_CASE codes). Unknown codes are kept
 * in [Other] so an older app survives a new server value. Same cases as `APIErrorCode` on iOS.
 */
sealed class ApiErrorCode {
    data object AccountDeactivated : ApiErrorCode()
    data object LegalAcceptanceRequired : ApiErrorCode()
    data object ReauthRequired : ApiErrorCode()
    data object CountryFeatureUnavailable : ApiErrorCode()
    data object UnsupportedLocale : ApiErrorCode()
    data object DemoReadOnly : ApiErrorCode()
    data object DemoActive : ApiErrorCode()
    data object ValidationFailed : ApiErrorCode()
    data object NotFound : ApiErrorCode()
    data object TooManyRequests : ApiErrorCode()
    /** better-auth email OTP (api/auth.md §3.1). */
    data object InvalidOtp : ApiErrorCode()
    data object OtpExpired : ApiErrorCode()
    data object TooManyAttempts : ApiErrorCode()
    data class Other(val raw: String) : ApiErrorCode()

    companion object {
        fun of(raw: String): ApiErrorCode = when (raw) {
            "account_deactivated" -> AccountDeactivated
            "legal_acceptance_required" -> LegalAcceptanceRequired
            "reauth_required" -> ReauthRequired
            "country_feature_unavailable" -> CountryFeatureUnavailable
            "unsupported_locale" -> UnsupportedLocale
            "demo_read_only" -> DemoReadOnly
            "demo_active" -> DemoActive
            "validation_failed" -> ValidationFailed
            "not_found" -> NotFound
            "too_many_requests" -> TooManyRequests
            "INVALID_OTP" -> InvalidOtp
            "OTP_EXPIRED" -> OtpExpired
            "TOO_MANY_ATTEMPTS" -> TooManyAttempts
            else -> Other(raw)
        }
    }
}

/**
 * A non-2xx response other than 401, decoded from `{ error, code, field, version }` or better-auth's
 * `{ message, code }`. `message` is the server's human text (already translated when the catalog has it).
 */
data class ApiErrorBody(
    val status: Int,
    val code: ApiErrorCode? = null,
    val message: String? = null,
    val field: String? = null,
    /** `legal_acceptance_required` gate: the version to accept. */
    val version: String? = null,
    /** `X-Retry-After` seconds on 429. */
    val retryAfter: Int? = null,
    /** Raw body, for endpoints whose error responses carry a full result (`POST /api/investments/import`). */
    val raw: String? = null,
) {
    /** True for the two proxy gates that require refetching `GET /api/me/bootstrap` (api/README.md §5 rule 3). */
    val isGate: Boolean
        get() = status == 403 && (code == ApiErrorCode.AccountDeactivated || code == ApiErrorCode.LegalAcceptanceRequired)

    companion object {
        @Serializable
        private data class Raw(
            val error: String? = null,
            val message: String? = null,
            val code: String? = null,
            val field: String? = null,
            val version: String? = null,
        )

        private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

        /** Parses the body of an error response; tolerant of empty or non-JSON bodies. */
        fun parse(status: Int, body: String?, retryAfter: String? = null): ApiErrorBody {
            val raw = body?.takeIf { it.isNotBlank() }?.let { runCatching { json.decodeFromString(Raw.serializer(), it) }.getOrNull() }
            return ApiErrorBody(
                status = status,
                code = raw?.code?.let(ApiErrorCode::of),
                message = raw?.error ?: raw?.message,
                field = raw?.field,
                version = raw?.version,
                retryAfter = retryAfter?.trim()?.toIntOrNull(),
                raw = body,
            )
        }
    }
}

/** Errors surfaced to feature models. Mirrors `APIError` in the iOS app (spec: platform/architecture.md). */
sealed class ApiError(message: String) : Exception(message) {
    /** 401: no or expired session. The client has already signed out locally. */
    data object Unauthorized : ApiError("unauthorized")
    data class Http(val body: ApiErrorBody) : ApiError("http ${body.status}") {
        val status: Int get() = body.status
    }
    data class Decoding(val detail: String) : ApiError("decoding: $detail")
    /** Network failure (offline, timeout, DNS…). */
    data class Transport(val detail: String) : ApiError("transport: $detail")

    val errorBody: ApiErrorBody? get() = (this as? Http)?.body
    val code: ApiErrorCode? get() = errorBody?.code
}

/** Raw response for calls that need headers or bytes (sign-in token header, ZIP export). */
class ApiResponse(val status: Int, private val headers: Map<String, String>, val bytes: ByteArray) {
    /** Case-insensitive header lookup. */
    fun header(name: String): String? = headers.entries.firstOrNull { it.key.equals(name, ignoreCase = true) }?.value
    val text: String get() = bytes.decodeToString()
}

/** Callbacks the app installs once (sign out on 401, re-route on a gate 403). */
class ApiEvents {
    @Volatile private var unauthorized: (() -> Unit)? = null
    @Volatile private var gate: ((ApiErrorBody) -> Unit)? = null
    @Volatile private var decodingFailure: ((String) -> Unit)? = null

    fun set(onUnauthorized: (() -> Unit)?, onGate: ((ApiErrorBody) -> Unit)?) {
        unauthorized = onUnauthorized
        gate = onGate
    }

    internal fun fireUnauthorized() = unauthorized?.invoke()
    internal fun fireGate(body: ApiErrorBody) = gate?.invoke(body)

    /** SUP-024: called with the endpoint path when a response cannot be decoded (the native «screen failed to render»). */
    fun setOnDecodingFailure(handler: ((String) -> Unit)?) {
        decodingFailure = handler
    }

    internal fun fireDecodingFailure(path: String) = decodingFailure?.invoke(path)
}

/** Placeholder for endpoints without a body (204, `200` empty). */
@Serializable
class EmptyBody

// ---------------------------------------------------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------------------------------------------------

/**
 * JSON client for the BuddyBudget backend (spec: api/auth.md §2, §7). Sends `Authorization: Bearer <token>` from the
 * [SessionStore] (verbatim), never cookies (OkHttp without a `CookieJar`), a native User-Agent and the app language in
 * `Accept-Language`. A 401 clears the stored token and fires [ApiEvents] `onUnauthorized`; a gate 403 fires `onGate`.
 */
class ApiClient(
    baseUrl: String,
    private val http: OkHttpClient,
    val session: SessionStore = InMemorySessionStore(),
    val json: Json = DefaultJson,
    private val userAgent: String = "BuddyBudget-Android",
    val events: ApiEvents = ApiEvents(),
    private val acceptLanguage: () -> String? = { null },
) {
    val base: HttpUrl = baseUrl.toHttpUrl()

    suspend fun <T> get(path: String, decoder: DeserializationStrategy<T>, query: Map<String, String> = emptyMap()): T =
        decode(send(path, "GET", query = query), decoder, path)

    suspend fun <T> post(path: String, body: String, decoder: DeserializationStrategy<T>): T =
        decode(send(path, "POST", body = body), decoder, path)

    suspend fun <T> patch(path: String, body: String, decoder: DeserializationStrategy<T>): T =
        decode(send(path, "PATCH", body = body), decoder, path)

    suspend fun <T> put(path: String, body: String, decoder: DeserializationStrategy<T>): T =
        decode(send(path, "PUT", body = body), decoder, path)

    suspend fun <T> delete(path: String, decoder: DeserializationStrategy<T>): T =
        decode(send(path, "DELETE"), decoder, path)

    /** For 204 / empty-body endpoints. */
    suspend fun sendNoContent(path: String, method: String, body: String? = null) {
        send(path, method, body = body)
    }

    /** Lowest level: builds the request, maps 401/4xx/5xx and transport errors, returns status, headers and bytes. */
    suspend fun send(
        path: String,
        method: String,
        query: Map<String, String> = emptyMap(),
        body: String? = null,
        accept: String = "application/json",
        contentType: String = "application/json",
        timeoutSeconds: Long? = null,
    ): ApiResponse = withContext(Dispatchers.IO) {
        val request = makeRequest(path, method, query, body, accept, contentType)
        val client = timeoutSeconds?.let { http.newBuilder().readTimeout(it, TimeUnit.SECONDS).writeTimeout(it, TimeUnit.SECONDS).build() } ?: http
        val response = try {
            client.newCall(request).execute()
        } catch (e: java.io.IOException) {
            throw ApiError.Transport(e.message ?: e.javaClass.simpleName)
        }
        response.use {
            val bytes = it.body.bytes()
            val headers = it.headers.toMultimap().mapValues { (_, v) -> v.joinToString(",") }
            val result = ApiResponse(it.code, headers, bytes)
            if (it.code == 401) {
                // Session expired or revoked: wipe the token and let the app go back to login (auth.md §3.5).
                if (request.header("Authorization") != null) {
                    session.clear()
                    events.fireUnauthorized()
                }
                throw ApiError.Unauthorized
            }
            if (!it.isSuccessful) {
                val errorBody = ApiErrorBody.parse(it.code, bytes.decodeToString(), result.header("X-Retry-After"))
                if (errorBody.isGate) events.fireGate(errorBody)
                throw ApiError.Http(errorBody)
            }
            result
        }
    }

    internal fun makeRequest(
        path: String, method: String, query: Map<String, String>, body: String?, accept: String, contentType: String = "application/json",
    ): Request {
        val url = base.newBuilder().addPathSegments(path.trimStart('/')).apply {
            query.toSortedMap().forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()
        val requestBody: RequestBody? = when {
            body != null -> body.toRequestBody(contentType.toMediaType())
            method == "POST" || method == "PATCH" || method == "PUT" -> "".toRequestBody(JSON)
            else -> null
        }
        return Request.Builder().url(url).method(method, requestBody).apply {
            header("Accept", accept)
            header("User-Agent", userAgent)
            acceptLanguage()?.let { header("Accept-Language", it) }
            session.readToken()?.takeIf { it.isNotEmpty() }?.let { header("Authorization", "Bearer $it") }
        }.build()
    }

    private fun <T> decode(response: ApiResponse, decoder: DeserializationStrategy<T>, path: String): T = try {
        json.decodeFromString(decoder, response.text)
    } catch (e: kotlinx.serialization.SerializationException) {
        events.fireDecodingFailure(path)
        throw ApiError.Decoding(e.message ?: "invalid JSON")
    } catch (e: IllegalArgumentException) {
        events.fireDecodingFailure(path)
        throw ApiError.Decoding(e.message ?: "invalid JSON")
    }

    companion object {
        private val JSON = "application/json".toMediaType()
        val DefaultJson = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
            encodeDefaults = true
        }
    }
}
