package io.buddybudget.core.data

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.Cache
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

/**
 * Loads merchant/bank/instrument logos (`/api/merchant-logos/...`, `/api/instruments/{id}/logo`).
 * These routes need the session, so every request carries the same `Authorization` header as API calls
 * (spec: api/README.md §10, design/iconography-assets.md §3.3). Same name and behaviour as `LogoLoader` on iOS.
 *
 * - Memory cache of bytes and of misses (404 / failure), so a list never refetches a missing logo.
 * - Disk cache: OkHttp's [Cache] honors the server's `Cache-Control` (`private, max-age=86400` on 200,
 *   `3600` on 404); see [makeClient].
 */
class LogoLoader(
    baseUrl: String,
    private val http: OkHttpClient,
    private val capacity: Int = 300,
    private val token: suspend () -> String?,
) {
    private val base: HttpUrl = baseUrl.toHttpUrl()
    private val mutex = Mutex()
    private val cache = LinkedHashMap<String, ByteArray>(16, 0.75f, true)
    private val misses = HashSet<String>()
    private val inFlight = HashMap<String, CompletableDeferred<ByteArray?>>()

    /** Cached bytes if already loaded (no network). */
    suspend fun cached(logoPath: String): ByteArray? = mutex.withLock { cache[logoPath] }

    /** Image bytes, or null when there is no logo (404) or the request failed. Concurrent calls share one request. */
    suspend fun data(logoPath: String): ByteArray? {
        val (deferred, owner) = mutex.withLock {
            cache[logoPath]?.let { return it }
            if (logoPath in misses) return null
            inFlight[logoPath]?.let { return@withLock it to false }
            val d = CompletableDeferred<ByteArray?>()
            inFlight[logoPath] = d
            d to true
        }
        if (!owner) return deferred.await()
        val result = fetch(logoPath)
        mutex.withLock {
            inFlight.remove(logoPath)
            if (result != null) {
                cache[logoPath] = result
                while (cache.size > capacity) cache.remove(cache.keys.first())
            } else {
                misses += logoPath
            }
        }
        deferred.complete(result)
        return result
    }

    private suspend fun fetch(logoPath: String): ByteArray? {
        val url = url(logoPath, base) ?: return null
        val request = request(url, token())
        return withContext(Dispatchers.IO) {
            try {
                http.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) null else response.body.bytes().takeIf { it.isNotEmpty() }
                }
            } catch (_: java.io.IOException) {
                null
            }
        }
    }

    companion object {
        /**
         * `logoPath` as returned by the API (relative, possibly signed `?s=`) resolved against the base URL.
         * Never rebuild or re-encode the path: the HMAC covers it verbatim.
         */
        fun url(logoPath: String, base: HttpUrl): HttpUrl? = base.resolve(logoPath)

        fun request(url: HttpUrl, token: String?): Request = Request.Builder().url(url).get()
            .header("Accept", "image/*")
            .apply { if (!token.isNullOrEmpty()) header("Authorization", "Bearer $token") }
            .build()

        /** Client with a dedicated disk cache (50 MB) that follows HTTP caching headers. */
        fun makeClient(base: OkHttpClient, cacheDir: File): OkHttpClient =
            base.newBuilder().cache(Cache(cacheDir, 50L * 1024 * 1024)).build()
    }
}
