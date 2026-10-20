package io.buddybudget.core

import io.buddybudget.core.designsystem.TrendGeometry
import io.buddybudget.core.domain.transactions.VoiceText
import kotlin.test.Test
import kotlin.test.assertEquals

class TrendGeometryTest {
    @Test fun TX054_trendLayoutPadsTwelvePercentAndSharesTheScaleWithTheReference() {
        val layout = TrendGeometry.layout(listOf(0.0, 50.0, 100.0), listOf(0.0, 100.0, 200.0, 300.0), 300.0, 100.0)
        assertEquals(4, layout.columns)
        assertEquals(100.0, layout.line[1].x)
        assertEquals(88.0, layout.line[0].y)
        assertEquals(12.0, layout.reference[3].y, 1e-9)
        assertEquals(2, TrendGeometry.index(190.0, 300.0, 4))
        assertEquals(88.0, TrendGeometry.layout(listOf(5.0, 5.0), null, 10.0, 100.0).line[1].y)
    }

    @Test fun TX008_voiceTextMasksNumbers() {
        assertEquals("Spesi •••• €, •••• € in più", VoiceText.masked("Spesi 2164 €, 808 € in più"))
    }
}
