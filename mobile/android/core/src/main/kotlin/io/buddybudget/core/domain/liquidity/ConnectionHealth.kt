package io.buddybudget.core.domain.liquidity

import java.time.Instant

/** Stored status of a bank connection. */
enum class ConnectionStatus(val key: String) {
    PENDING("pending"), LINKED("linked"), EXPIRED("expired"), ERROR("error");

    companion object {
        fun fromKey(key: String): ConnectionStatus? = entries.firstOrNull { it.key == key }
    }
}

/** `pending`: not completed yet; `expiring`: works but expires soon; `expired`/`error`: renew now. */
enum class ConnectionHealthState(val key: String) {
    OK("ok"), EXPIRING("expiring"), EXPIRED("expired"), ERROR("error"), PENDING("pending"),
}

data class ConnectionHealthResult(
    val state: ConnectionHealthState,
    /** Days to the consent end, rounded up (only `ok` / `expiring` with a known date). */
    val daysLeft: Int?,
)

/** Bank-connection health (`lib/gocardless/connection-health.ts`). Same as Swift `ConnectionHealth`. */
object ConnectionHealth {
    const val CONSENT_VALID_DAYS = 90
    const val CONSENT_EXPIRY_WARNING_DAYS = 7
    private const val DAY_MS = 24.0 * 60 * 60 * 1000

    fun computeConnectionHealth(status: ConnectionStatus, consentExpiresAt: Instant?, now: Instant): ConnectionHealthResult {
        when (status) {
            ConnectionStatus.ERROR -> return ConnectionHealthResult(ConnectionHealthState.ERROR, null)
            ConnectionStatus.PENDING -> return ConnectionHealthResult(ConnectionHealthState.PENDING, null)
            ConnectionStatus.EXPIRED -> return ConnectionHealthResult(ConnectionHealthState.EXPIRED, null)
            ConnectionStatus.LINKED -> Unit
        }
        if (consentExpiresAt == null) return ConnectionHealthResult(ConnectionHealthState.OK, null)
        val remainingMs = (consentExpiresAt.toEpochMilli() - now.toEpochMilli()).toDouble()
        if (remainingMs <= 0) return ConnectionHealthResult(ConnectionHealthState.EXPIRED, null)
        val daysLeft = Math.ceil(remainingMs / DAY_MS).toInt()
        return ConnectionHealthResult(
            if (daysLeft <= CONSENT_EXPIRY_WARNING_DAYS) ConnectionHealthState.EXPIRING else ConnectionHealthState.OK,
            daysLeft,
        )
    }

    /** True when "Rinnova" should be offered (also while the connection still works). */
    fun needsRenewal(state: ConnectionHealthState): Boolean =
        state == ConnectionHealthState.EXPIRING || state == ConnectionHealthState.EXPIRED || state == ConnectionHealthState.ERROR

    /** Consent expiry for a connection completed `now`. */
    fun consentExpiryFrom(now: Instant): Instant = Instant.ofEpochMilli(now.toEpochMilli() + CONSENT_VALID_DAYS * 86_400_000L)
}
