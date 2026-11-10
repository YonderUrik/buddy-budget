package io.buddybudget.core

import io.buddybudget.core.data.ApiClient
import io.buddybudget.core.data.ApiError
import io.buddybudget.core.data.ApiErrorBody
import io.buddybudget.core.data.ApiErrorCode
import io.buddybudget.core.data.AccountGate
import io.buddybudget.core.data.AuthApi
import io.buddybudget.core.data.CategorySetupItem
import io.buddybudget.core.data.HealthApi
import io.buddybudget.core.data.InMemorySessionStore
import io.buddybudget.core.data.LegalAcceptance
import io.buddybudget.core.data.MeBootstrap
import io.buddybudget.core.data.NotificationPreferences
import io.buddybudget.core.data.OnboardingRequest
import io.buddybudget.core.data.UserApi
import io.buddybudget.core.domain.VectorSuite
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Fixture under `spec/api/fixtures/`. */
fun fixture(name: String): String = File(VectorSuite.specDir, "api/fixtures/$name").readText()

fun fixtureJson(name: String, vararg path: String): JsonElement {
    var value: JsonElement = Json.parseToJsonElement(fixture(name))
    for (key in path) value = value.jsonObject.getValue(key)
    return value
}

class ApiClientTest {
    private val server = MockWebServer()

    @BeforeTest fun setUp() = server.start()

    @AfterTest fun tearDown() = server.close()

    private fun client(token: String? = null) = ApiClient(
        server.url("/").toString(), OkHttpClient(), InMemorySessionStore(token),
        userAgent = "BuddyBudget-Android/test", acceptLanguage = { "it" },
    )

    @Test fun decodesHealthAndIgnoresUnknownKeys() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"status":"ok","uptime":12}""").build())
        assertEquals("ok", HealthApi(client()).check().status)
        assertEquals("/api/health", server.takeRequest().url.encodedPath)
    }

    @Test fun FOUNDATION_sendsBearerTokenVerbatimUserAgentAndLanguage() = runTest {
        val signed = "abc.def+gh/ij="
        server.enqueue(MockResponse.Builder().body("""{"status":"ok"}""").build())
        HealthApi(client(signed)).check()
        val request = server.takeRequest()
        assertEquals("Bearer $signed", request.headers["Authorization"])
        assertEquals("BuddyBudget-Android/test", request.headers["User-Agent"])
        assertEquals("it", request.headers["Accept-Language"])
        assertNull(request.headers["Cookie"])
    }

    @Test fun SHELL056_unauthorizedClearsTokenAndNotifies() = runTest {
        server.enqueue(MockResponse.Builder().code(401).build())
        val client = client("t")
        var fired = false
        client.events.set(onUnauthorized = { fired = true }, onGate = null)
        assertFailsWith<ApiError.Unauthorized> { HealthApi(client).check() }
        assertNull(client.session.readToken())
        assertTrue(fired)
    }

    @Test fun SHELL056_gate403NotifiesWithCode() = runTest {
        server.enqueue(MockResponse.Builder().code(403).body("""{"code":"legal_acceptance_required","version":"2026-10-12"}""").build())
        val client = client("t")
        var gate: ApiErrorBody? = null
        client.events.set(onUnauthorized = null, onGate = { gate = it })
        assertFailsWith<ApiError.Http> { HealthApi(client).check() }
        assertEquals(ApiErrorCode.LegalAcceptanceRequired, gate?.code)
        assertEquals("2026-10-12", gate?.version)
    }

    @Test fun mapsHttpErrors() = runTest {
        server.enqueue(MockResponse.Builder().code(503).body("down").build())
        val e = assertFailsWith<ApiError.Http> { HealthApi(client()).check() }
        assertEquals(503, e.status)
    }

    @Test fun decodesErrorCodesFromFixture() {
        val body = ApiErrorBody.parse(400, fixtureJson("errors.json", "validation_failed", "body").toString())
        assertEquals(ApiErrorCode.ValidationFailed, body.code)
        assertEquals("accountId", body.field)
        val notFound = ApiErrorBody.parse(404, fixtureJson("errors.json", "category_not_found", "body").toString())
        assertEquals(ApiErrorCode.Other("category_not_found"), notFound.code)
        assertEquals("Categoria non trovata", notFound.message)
        val otp = ApiErrorBody.parse(400, fixtureJson("auth-email-otp.json", "wrongCode", "body").toString())
        assertEquals(ApiErrorCode.InvalidOtp, otp.code)
        assertEquals(42, ApiErrorBody.parse(429, "", " 42").retryAfter)
    }

    @Test fun AUTH001_signInStoresSignedHeaderTokenVerbatim() = runTest {
        val header = "aaaaaaaa.bbb+cc/dd=="
        val body = fixtureJson("auth-email-otp.json", "signIn", "body").toString()
        server.enqueue(MockResponse.Builder().body(body).addHeader("set-auth-token", header).build())
        val client = client()
        assertEquals(header, AuthApi(client).verifyCode("a@b.it", "482913"))
        assertEquals(header, client.session.readToken())
        val request = server.takeRequest()
        assertEquals("/api/auth/sign-in/email-otp", request.url.encodedPath)
        val sent = Json.parseToJsonElement(request.body!!.utf8()).jsonObject
        assertEquals("a@b.it", sent["email"]!!.jsonPrimitive.content)
        assertEquals("482913", sent["otp"]!!.jsonPrimitive.content)
    }

    @Test fun AUTH001_signInFallsBackToBodyToken() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"token":"plain32","user":{}}""").build())
        assertEquals("plain32", AuthApi(client()).verifyCode("a@b.it", "123456"))
    }

    @Test fun AUTH001_sendCodeBody() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"success":true}""").build())
        AuthApi(client()).sendCode("a@b.it")
        val sent = Json.parseToJsonElement(server.takeRequest().body!!.utf8()).jsonObject
        assertEquals("sign-in", sent["type"]!!.jsonPrimitive.content)
        assertEquals("a@b.it", sent["email"]!!.jsonPrimitive.content)
    }

    @Test fun AUTH023_signOutClearsToken() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"success":true}""").build())
        val client = client("t")
        AuthApi(client).signOut()
        assertNull(client.session.readToken())
        assertEquals("/api/auth/sign-out", server.takeRequest().url.encodedPath)
    }

    @Test fun decodesBootstrapFixtures() {
        val json = ApiClient.DefaultJson
        val me = json.decodeFromString(MeBootstrap.serializer(), fixture("me-bootstrap.json"))
        assertNull(me.gate)
        assertEquals("/panoramica", me.profile.homePage)
        assertTrue(me.capabilities.sections.pension)
        val fresh = json.decodeFromJsonElement(MeBootstrap.serializer(), fixtureJson("auth-email-otp.json", "bootstrapAfterSignIn", "body"))
        assertEquals(AccountGate.OnboardingRequired, fresh.gate)
        assertEquals("", fresh.user.name)
    }

    @Test fun exportFileNameFromContentDisposition() {
        assertEquals("buddybudget-export-2026-10-18.zip", UserApi.fileName("attachment; filename=\"buddybudget-export-2026-10-18.zip\""))
        assertNull(UserApi.fileName(null))
    }

    @Test fun onboardingRequestOmitsUnsetFieldsAndKeepsNullKeys() {
        val request = OnboardingRequest(
            "EUR", "IT", "it", LegalAcceptance("2026-10-12"), NotificationPreferences.Defaults,
            listOf(CategorySetupItem(null, "Gatti", "dovuta", true)), null,
        )
        val json = Json.parseToJsonElement(request.toJson(client())).jsonObject
        assertNull(json["aiCategorization"])
        assertEquals(JsonNull, json["categories"]!!.jsonArray[0].jsonObject["key"])
        assertEquals("mensile", json["notifications"]!!.jsonObject["digestFrequency"]!!.jsonPrimitive.content)
    }
}
