package io.buddybudget.core.data

/**
 * Where the bearer session token lives (spec: api/auth.md §2, §3.5). The token is stored **verbatim** as received in
 * the `set-auth-token` header (signed `<token>.<base64 signature>`, may contain `+ / =`).
 *
 * The interface lives here; the persistent adapter is in the app (Android: `KeystoreSessionStore`, iOS:
 * `KeychainSessionStore`). Same name and methods as `SessionStore` on iOS.
 */
interface SessionStore {
    fun readToken(): String?
    fun saveToken(token: String)
    fun clear()
}

/** In-memory store for tests and previews. */
class InMemorySessionStore(token: String? = null) : SessionStore {
    @Volatile private var token: String? = token

    override fun readToken(): String? = token
    override fun saveToken(token: String) { this.token = token }
    override fun clear() { token = null }
}
