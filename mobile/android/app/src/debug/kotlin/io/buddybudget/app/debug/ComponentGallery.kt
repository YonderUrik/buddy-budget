package io.buddybudget.app.debug

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.AmountText
import io.buddybudget.app.designsystem.components.AutoOrigin
import io.buddybudget.app.designsystem.components.AutoOriginBadge
import io.buddybudget.app.designsystem.components.BBAlertSheet
import io.buddybudget.app.designsystem.components.BBAvatar
import io.buddybudget.app.designsystem.components.BBBadge
import io.buddybudget.app.designsystem.components.BBBadgeVariant
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBCard
import io.buddybudget.app.designsystem.components.BBCardHeader
import io.buddybudget.app.designsystem.components.BBChartPoint
import io.buddybudget.app.designsystem.components.BBChip
import io.buddybudget.app.designsystem.components.BBDonut
import io.buddybudget.app.designsystem.components.BBDonutSlice
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBLineChart
import io.buddybudget.app.designsystem.components.BBListRow
import io.buddybudget.app.designsystem.components.BBProgressState
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSection
import io.buddybudget.app.designsystem.components.BBSeparator
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeletonRows
import io.buddybudget.app.designsystem.components.BBSlider
import io.buddybudget.app.designsystem.components.BBStateAction
import io.buddybudget.app.designsystem.components.BBStateAlign
import io.buddybudget.app.designsystem.components.BBStyles
import io.buddybudget.app.designsystem.components.BBSwipeToDelete
import io.buddybudget.app.designsystem.components.BBSwitch
import io.buddybudget.app.designsystem.components.BBSwitchSize
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.BBToast
import io.buddybudget.app.designsystem.components.BBToastHost
import io.buddybudget.app.designsystem.components.BBToastKind
import io.buddybudget.app.designsystem.components.BBToastView
import io.buddybudget.app.designsystem.components.EmptyState
import io.buddybudget.app.designsystem.components.LoadError
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalHideAmounts
import io.buddybudget.app.designsystem.components.LocalLogoLoader
import io.buddybudget.app.designsystem.components.LogoCredit
import io.buddybudget.app.designsystem.components.ManualBadge
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.MoneyHero
import io.buddybudget.app.designsystem.components.PrivacyStore
import io.buddybudget.app.designsystem.components.ProgressBar
import io.buddybudget.app.designsystem.components.SegmentedControl
import io.buddybudget.app.designsystem.components.Sparkline
import io.buddybudget.app.designsystem.components.StatCard
import io.buddybudget.app.designsystem.components.ToastCenter
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.generated.L10n
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.data.LogoLoader
import io.buddybudget.core.designsystem.AmountTone
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import io.buddybudget.core.domain.periods.CalendarDate
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.io.ByteArrayOutputStream

// DEBUG-only component gallery (src/debug: never in release builds): every design-system component in its states,
// page by page, for the parity screenshots. Launch with
//   adb shell am start -n io.buddybudget.app.debug/io.buddybudget.app.MainActivity --ei bbGallery 3
// Same pages, order and fixtures as ComponentGallery.swift on iOS. Page titles are component family names
// (developer-facing identifiers, never shipped); every user-facing string comes from the generated strings.

enum class GalleryPage(val title: String) {
    Surfaces("Surfaces · Text"),
    Controls("Controls"),
    Lists("Lists · States"),
    DataViz("Data viz"),
    Sheet("BBSheet"),
    Confirm("BBAlertSheet"),
    Toasts("Toasts"),
    Icons("Icons"),
    Refresh("4R · Sections · Period"),
}

object GalleryFixtures {
    const val CURRENCY = "EUR"
    val netWorth = listOf(
        30000.0, 30486.88, 30955.31, 30937.97, 31319.77, 31638.78, 31436.99, 31610.78, 31711.16, 31293.69,
        31268.17, 31197.99, 30649.34, 30540.17, 30439.06, 29914.13, 29881.84, 29906.01, 29546.96, 29710.85,
        29949.29, 29809.28, 30183.35, 30610.07, 30624.7, 31110.18, 31598.14, 31620.05, 32058.38, 32447.7,
    )
    val sparkline = listOf(1200.0, 1180.0, 1310.0, 1290.0, 1405.0, 1370.0, 1460.0)

    fun chartPoints(locale: BBLocale): List<BBChartPoint> {
        val start = java.time.LocalDate.of(2026, 9, 19)
        return netWorth.mapIndexed { i, v ->
            val d = start.plusDays(i.toLong())
            BBChartPoint(i, BBFormat.formatLongDate(CalendarDate(d.year, d.monthValue, d.dayOfMonth), locale), v)
        }
    }
}

/** Image fixture for the "logo loaded" state: any path containing "demo" returns a PNG, everything else 404. */
private val galleryLogoClient: OkHttpClient by lazy {
    OkHttpClient.Builder().addInterceptor(Interceptor { chain ->
        val request = chain.request()
        val ok = request.url.toString().contains("demo")
        Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(if (ok) 200 else 404).message("")
            .body((if (ok) galleryPng() else ByteArray(0)).toResponseBody("image/png".toMediaType())).build()
    }).build()
}

private fun galleryPng(): ByteArray {
    val bmp = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.rgb(227, 10, 20) }
    canvas.drawRoundRect(RectF(8f, 8f, 88f, 88f), 18f, 18f, paint)
    paint.color = android.graphics.Color.WHITE
    canvas.drawOval(RectF(30f, 30f, 66f, 66f), paint)
    return ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
}

@Composable
fun ComponentGallery(initial: GalleryPage) {
    var page by remember { mutableStateOf(initial) }
    val privacy = remember { PrivacyStore() }
    val toasts = remember { ToastCenter() }
    val logoLoader = remember { LogoLoader("http://gallery.test/", galleryLogoClient) { "gallery" } }
    fun step(delta: Int) {
        val all = GalleryPage.entries
        page = all[(page.ordinal + delta + all.size) % all.size]
    }
    CompositionLocalProvider(LocalHideAmounts provides privacy.hideAmounts, LocalLogoLoader provides logoLoader) {
        BBToastHost(toasts) {
            key(page) {
                BBScreen(
                    title = page.title,
                    eyebrow = "BuddyBudget DS v1",
                    actions = {
                        BBIconButton(
                            if (privacy.hideAmounts) BBIcon.EyeOff else BBIcon.Eye,
                            l10n(if (privacy.hideAmounts) R.string.show_amounts_a3b67a else R.string.hide_amounts_874f22),
                        ) { privacy.hideAmounts = !privacy.hideAmounts }
                        BBIconButton(BBIcon.ChevronLeft, l10n(R.string.back_83c968)) { step(-1) }
                        BBIconButton(BBIcon.ChevronRight, l10n(R.string.show_all_d72ef3)) { step(1) }
                    },
                ) {
                    when (page) {
                        GalleryPage.Surfaces -> SurfacesPage()
                        GalleryPage.Controls -> ControlsPage()
                        GalleryPage.Lists -> ListsPage(toasts)
                        GalleryPage.DataViz -> DataVizPage()
                        GalleryPage.Sheet -> SheetPage()
                        GalleryPage.Confirm -> ConfirmPage()
                        GalleryPage.Toasts -> ToastsPage(toasts)
                        GalleryPage.Icons -> IconsPage()
                        GalleryPage.Refresh -> RefreshPage()
                    }
                }
            }
        }
    }
}

/**
 * Phase 4R components: section views heading, sections without icons, soft rows, the period selector with the
 * calendar sheet, `SimulationResult` and the flags.
 */
@Composable
private fun RefreshPage() {
    var view by remember { mutableStateOf(0) }
    var period by remember { mutableStateOf(io.buddybudget.core.data.OverviewPeriod.entries[1]) }
    var investments by remember { mutableStateOf(io.buddybudget.core.domain.investments.InvestmentsPeriod.entries[1]) }
    var range by remember { mutableStateOf(io.buddybudget.core.domain.periods.DateKeyRange("2026-09-01", "2026-10-12")) }
    androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space6)) {
        GalleryLabel("SectionViewsHeading · BBSunIconButton")
        io.buddybudget.app.designsystem.components.SectionViewsHeading(
            l10n(R.string.cash_84f6d5),
            io.buddybudget.core.domain.shell.LiquiditySegment.entries.mapIndexed { i, v ->
                io.buddybudget.app.designsystem.components.SectionViewItem(v.name, io.buddybudget.app.tr(v.title), io.buddybudget.app.tr(v.viewDescription),
                    BBIcon.forKey(v.iconKey), i == view) { view = i }
            },
        ) { io.buddybudget.app.designsystem.components.BBSunIconButton(l10n(R.string.add_83f510)) {} }
        GalleryLabel("BBSection · BBSoftRow")
        io.buddybudget.app.designsystem.components.BBSection(l10n(R.string.the_month_7a4f03), actionLabel = l10n(R.string.analysis_aa653b), onAction = {}) {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                io.buddybudget.app.designsystem.components.BBSoftRow(l10n(R.string.income_5a21be)) {
                    io.buddybudget.app.designsystem.components.AmountText(1820.0, "EUR", tone = io.buddybudget.core.designsystem.AmountTone.Pos, signed = true)
                }
                io.buddybudget.app.designsystem.components.BBSoftRow(l10n(R.string.surplus_so_far_13cbb8), hint = l10n(R.string.income_minus_spending_month_by_month_ove_812adc)) {
                    io.buddybudget.app.designsystem.components.AmountText(-343.83, "EUR", tone = io.buddybudget.core.designsystem.AmountTone.Signed, signed = true)
                }
            }
        }
        GalleryLabel("PeriodSelector")
        io.buddybudget.app.designsystem.components.PeriodSelector(
            io.buddybudget.core.data.OverviewPeriod.entries.map { it to io.buddybudget.app.tr(it.label) }, period, { period = it },
            accessibilityLabel = io.buddybudget.app.tr("Periodo del grafico"),
        )
        io.buddybudget.app.designsystem.components.PeriodSelector(
            io.buddybudget.core.domain.investments.InvestmentsPeriod.entries.filter { it != io.buddybudget.core.domain.investments.InvestmentsPeriod.Custom }
                .map { it to io.buddybudget.app.tr(it.label) }, investments, { investments = it },
            accessibilityLabel = io.buddybudget.app.tr("Periodo del grafico"),
            custom = io.buddybudget.app.designsystem.components.PeriodCustom(io.buddybudget.core.domain.investments.InvestmentsPeriod.Custom, range,
                max = "2026-10-20", onApply = { range = it }),
        )
        GalleryLabel("SimulationResult")
        io.buddybudget.app.designsystem.components.SimulationResult(
            io.buddybudget.app.tr("Finisci prima di"), io.buddybudget.core.domain.format.BBFormat.formatDuration(28, io.buddybudget.core.domain.format.BBLanguage.IT),
            tone = io.buddybudget.app.designsystem.components.SimulationResultTone.Pos, caption = io.buddybudget.app.tr("Periodo del grafico"),
        )
        io.buddybudget.app.designsystem.components.SimulationResult(
            l10n(R.string.amount_da6661),
            io.buddybudget.core.domain.format.BBFormat.formatCurrency(-1240.0, "EUR", io.buddybudget.core.domain.format.BBLocale.IT_IT, maximumFractionDigits = 0),
            tone = io.buddybudget.app.designsystem.components.SimulationResultTone.Neg,
        )
        GalleryLabel("BBFlag")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            for (code in listOf(io.buddybudget.app.designsystem.components.BBFlagCode.IT, io.buddybudget.app.designsystem.components.BBFlagCode.GB, io.buddybudget.app.designsystem.components.BBFlagCode.DE)) {
                for (size in io.buddybudget.app.designsystem.components.BBFlagSize.entries) io.buddybudget.app.designsystem.components.BBFlag(code, size)
            }
        }
    }
}

@Composable
private fun GalleryLabel(text: String) =
    BBText(text, BBTextStyle.Overline, Modifier.padding(top = BBSpacing.space2), color = BuddyBudgetTheme.colors.text3)

@Composable
private fun SurfacesPage() {
    val c = BuddyBudgetTheme.colors
    var period by remember { mutableStateOf(1) }
    var type by remember { mutableStateOf(0) }
    var chip by remember { mutableStateOf(true) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        BBCard {
            BBCardHeader(l10n(R.string.net_worth_d2c5b8), l10n(R.string.composition_bec159))
            MoneyHero(30673.12, GalleryFixtures.CURRENCY)
        }
        BBSection(l10n(R.string.accounts_80c9ff), icon = BBIcon.Wallet, color = c.swatchTeal, actionLabel = l10n(R.string.show_all_d72ef3), onAction = {}) {
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BBText(l10n(R.string.income_5a21be), Modifier.weight(1f), color = c.text2)
                    AmountText(2480.0, GalleryFixtures.CURRENCY, tone = AmountTone.Signed, signed = true)
                }
                BBSeparator()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BBText(l10n(R.string.expenses_6db1a3), Modifier.weight(1f), color = c.text2)
                    AmountText(-1234.5, GalleryFixtures.CURRENCY, tone = AmountTone.Signed, signed = true)
                }
                BBSeparator()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BBText(l10n(R.string.balance_8b0fcd), Modifier.weight(1f), color = c.text2)
                    AmountText(1245.5, GalleryFixtures.CURRENCY)
                }
                BBSeparator()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BBText(l10n(R.string.hide_amounts_874f22), Modifier.weight(1f), color = c.text2)
                    CompositionLocalProvider(LocalHideAmounts provides true) {
                        AmountText(-1234.5, GalleryFixtures.CURRENCY, tone = AmountTone.Signed, signed = true)
                    }
                }
            }
        }
        GalleryLabel("BBBadge · AutoOriginBadge")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBBadge(l10n(R.string.total_82c634))
            BBBadge(l10n(R.string.total_82c634), variant = BBBadgeVariant.Secondary)
            BBBadge(l10n(R.string.delete_6b177b), variant = BBBadgeVariant.Destructive)
            ManualBadge()
            BBBadge(l10n(R.string.ai_560040), variant = BBBadgeVariant.Ghost, icon = BBIcon.Sparkles)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            AutoOriginBadge(AutoOrigin.Regola)
            AutoOriginBadge(AutoOrigin.Storico)
            AutoOriginBadge(AutoOrigin.Assistente)
            AutoOriginBadge(AutoOrigin.Regola, compact = true)
        }
        GalleryLabel("BBChip · SegmentedControl")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBChip(l10n(R.string.all_f89ce8), isSelected = chip) { chip = !chip }
            BBChip(l10n(R.string.income_5a21be), icon = BBIcon.TrendingUp, isSelected = !chip) { chip = !chip }
        }
        SegmentedControl(
            listOf(0 to l10n(R.string.week_7195e9), 1 to l10n(R.string.month_b333e2), 2 to l10n(R.string.s_3_months_f38291), 3 to l10n(R.string.year_191852)),
            period, { period = it },
        )
        SegmentedControl(
            listOf(0 to l10n(R.string.all_f89ce8), 1 to l10n(R.string.expenses_6db1a3), 2 to l10n(R.string.income_5a21be)),
            type, { type = it }, stretch = true,
        )
    }
}

@Composable
private fun ControlsPage() {
    var name by remember { mutableStateOf("") }
    var filled by remember { mutableStateOf("Esselunga") }
    var amount by remember { mutableStateOf("12,50") }
    var on by remember { mutableStateOf(true) }
    var off by remember { mutableStateOf(false) }
    var slider by remember { mutableStateOf(0.4) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        GalleryLabel("BBButton")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(l10n(R.string.add_83f510), {}, icon = BBIcon.Plus, variant = BBButtonVariant.Sun)
            io.buddybudget.app.designsystem.components.BBSunIconButton(l10n(R.string.add_83f510)) {}
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(l10n(R.string.save_c5965d), {})
            BBButton(l10n(L10n.cancel), {}, variant = BBButtonVariant.Outline)
            BBButton(l10n(R.string.back_83c968), {}, variant = BBButtonVariant.Secondary)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(l10n(L10n.close), {}, variant = BBButtonVariant.Ghost)
            BBButton(l10n(R.string.delete_6b177b), {}, icon = BBIcon.Trash2, variant = BBButtonVariant.Destructive)
            BBButton(l10n(R.string.show_all_d72ef3), {}, variant = BBButtonVariant.Link)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2), verticalAlignment = Alignment.CenterVertically) {
            BBButton(l10n(R.string.save_c5965d), {}, size = BBButtonSize.Xs)
            BBButton(l10n(R.string.save_c5965d), {}, size = BBButtonSize.Sm)
            BBButton(l10n(R.string.save_c5965d), {}, size = BBButtonSize.Lg)
            BBButton(l10n(R.string.save_c5965d), {}, icon = BBIcon.Plus, variant = BBButtonVariant.Outline, size = BBButtonSize.Icon)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            BBButton(l10n(R.string.save_c5965d), {}, size = BBButtonSize.Touch, isLoading = true)
            BBButton(l10n(R.string.save_c5965d), {}, size = BBButtonSize.Touch, enabled = false)
        }
        BBButton(l10n(R.string.add_an_account_053139), {}, icon = BBIcon.Plus, size = BBButtonSize.Touch, fullWidth = true)
        GalleryLabel("BBTextField")
        BBTextField(name, { name = it }, label = l10n(R.string.name_13030d), placeholder = l10n(R.string.name_13030d))
        BBTextField(filled, { filled = it }, label = l10n(R.string.name_13030d), error = l10n(L10n.genericError))
        BBTextField(amount, { amount = it }, label = l10n(R.string.amount_da6661), keyboard = BBKeyboard.Amount, prefix = "€")
        BBTextField(filled, { filled = it }, label = l10n(R.string.name_13030d), enabled = false)
        GalleryLabel("BBSwitch · BBSlider")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4), verticalAlignment = Alignment.CenterVertically) {
            BBSwitch(on, { on = it })
            BBSwitch(off, { off = it })
            BBSwitch(on, { on = it }, size = BBSwitchSize.Sm)
            BBSwitch(off, { off = it }, size = BBSwitchSize.Sm)
        }
        BBSlider(slider, { slider = it })
    }
}

private data class GalleryRow(val id: Int, val name: String, val amount: Double)

@Composable
private fun ListsPage(toasts: ToastCenter) {
    val c = BuddyBudgetTheme.colors
    val rows = remember { mutableStateListOf(GalleryRow(0, "Netflix", -15.99), GalleryRow(1, "Stipendio", 2480.0)) }
    val deleted = l10n(L10n.itemDeleted)
    val undo = l10n(L10n.undo)
    Column(Modifier.animateContentSize(), verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        GalleryLabel("BBListRow · MerchantLogo")
        Column {
            BBListRow(
                "Esselunga", subtitle = "${l10n(R.string.expenses_6db1a3)} · Fineco", onClick = {},
                leading = { MerchantLogo("Esselunga", logoPath = "/api/merchant-logos/esselunga.it?s=x") },
                trailing = { AmountText(-82.4, GalleryFixtures.CURRENCY, tone = AmountTone.Income, signed = true) },
            )
            BBListRow(
                "Netflix", subtitle = l10n(R.string.subscriptions_3aab61), onClick = {},
                leading = { MerchantLogo("Netflix", logoPath = "/api/merchant-logos/demo.netflix.com?s=x") },
                trailing = { AmountText(-15.99, GalleryFixtures.CURRENCY, tone = AmountTone.Income, signed = true) },
            )
            BBListRow(
                l10n(R.string.cash_84f6d5), subtitle = l10n(R.string.balance_8b0fcd), showsChevron = true, onClick = {},
                leading = { BBAvatar(BBIcon.account("piggy-bank"), bbSwatch("teal")) },
                trailing = { AmountText(1245.5, GalleryFixtures.CURRENCY) },
            )
            BBListRow(
                l10n(R.string.settings_8f710a), showsChevron = true, onClick = {},
                leading = { BBAvatar(BBIcon.Settings, bbSwatch("slate")) },
            )
        }
        LogoCredit()
        GalleryLabel("BBSwipeToDelete · Undo")
        BBSwipeToDelete(onDelete = {}, previewFraction = 0.3f) {
            BBListRow(
                "Amazon", subtitle = l10n(R.string.expenses_6db1a3),
                leading = { MerchantLogo("Amazon") },
                trailing = { AmountText(-39.9, GalleryFixtures.CURRENCY, tone = AmountTone.Income, signed = true) },
            )
        }
        for (row in rows.toList()) {
            key(row.id) {
                BBSwipeToDelete(onDelete = {
                    val index = rows.indexOf(row)
                    rows.remove(row)
                    toasts.showUndo(deleted, undo, onUndo = { rows.add(minOf(index, rows.size), row) }, onCommit = {})
                }) {
                    BBListRow(
                        row.name, subtitle = l10n(R.string.transactions_2a6eec),
                        leading = { MerchantLogo(row.name) },
                        trailing = { AmountText(row.amount, GalleryFixtures.CURRENCY, tone = AmountTone.Income, signed = true) },
                    )
                }
            }
        }
        GalleryLabel("EmptyState · LoadError")
        EmptyState(
            BBIcon.Landmark, l10n(R.string.connect_your_bank_5ff3a3), l10n(L10n.offlineMessage),
            primary = BBStateAction(l10n(R.string.add_an_account_053139)) {},
            secondary = BBStateAction(l10n(L10n.close)) {},
        )
        EmptyState(BBIcon.Inbox, l10n(R.string.you_re_offline_72cc71), l10n(L10n.offlineMessage), color = c.swatchBlue, align = BBStateAlign.Center)
        LoadError(l10n(R.string.could_not_load_accounts_82f1b6), onRetry = {})
        GalleryLabel("BBSkeleton")
        BBSkeletonRows(2)
    }
}

@Composable
private fun DataVizPage() {
    val c = BuddyBudgetTheme.colors
    val locale = LocalBBLocale.current
    var selection by remember { mutableStateOf<Int?>(12) }
    var donutA by remember { mutableStateOf<Int?>(null) }
    var donutB by remember { mutableStateOf<Int?>(1) }
    val slices = listOf(
        BBDonutSlice(0, l10n(R.string.cash_84f6d5), 12400.0, c.swatchTeal),
        BBDonutSlice(1, l10n(R.string.net_worth_d2c5b8), 18273.0, c.primary),
        BBDonutSlice(2, l10n(R.string.subscriptions_3aab61), 4200.0, c.swatchSlate),
    )
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
            StatCard(l10n(R.string.income_5a21be), 2480.0, GalleryFixtures.CURRENCY, Modifier.weight(1f))
            StatCard(l10n(R.string.expenses_6db1a3), -1890.0, GalleryFixtures.CURRENCY, Modifier.weight(1f), subtitle = l10n(R.string.month_b333e2))
        }
        GalleryLabel("ProgressBar · Sparkline")
        ProgressBar(BBProgressState.Determinate(60.0, 100.0))
        ProgressBar(BBProgressState.Indeterminate)
        Row(verticalAlignment = Alignment.CenterVertically) {
            BBText(l10n(R.string.cash_84f6d5), Modifier.weight(1f), BBStyles.rowTitle)
            Sparkline(GalleryFixtures.sparkline)
        }
        GalleryLabel("BBLineChart")
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            BBLineChart(
                GalleryFixtures.chartPoints(locale), l10n(R.string.net_worth_d2c5b8),
                { BBFormat.formatCurrency(it, GalleryFixtures.CURRENCY, locale) },
                selection, { selection = it },
                Modifier.requiredWidth(maxWidth + 32.dp),
            )
        }
        GalleryLabel("BBDonut")
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
            BBDonut(slices, GalleryFixtures.CURRENCY, donutA, { donutA = it }, size = 160.dp, centerLabel = l10n(R.string.total_82c634))
            BBDonut(slices, GalleryFixtures.CURRENCY, donutB, { donutB = it }, size = 160.dp, centerLabel = l10n(R.string.total_82c634))
        }
    }
}

@Composable
private fun SheetPage() {
    var open by remember { mutableStateOf(true) }
    var amount by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBButton(l10n(R.string.add_an_account_053139), { open = true }, size = BBButtonSize.Touch)
        BBSkeletonRows(3)
    }
    BBSheet(open, { open = false }, title = l10n(R.string.add_an_account_053139)) {
        BBTextField(amount, { amount = it }, label = l10n(R.string.amount_da6661), placeholder = "0,00", keyboard = BBKeyboard.Amount, prefix = "€")
        BBListRow(
            l10n(R.string.cash_84f6d5), subtitle = l10n(R.string.balance_8b0fcd), showsChevron = true, onClick = {},
            leading = { BBAvatar(BBIcon.Wallet, BuddyBudgetTheme.colors.swatchTeal) },
        )
        BBButton(l10n(R.string.save_c5965d), { open = false }, size = BBButtonSize.Touch, fullWidth = true)
    }
}

@Composable
private fun ConfirmPage() {
    var open by remember { mutableStateOf(true) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBButton(l10n(R.string.delete_6b177b), { open = true }, icon = BBIcon.Trash2, variant = BBButtonVariant.Destructive, size = BBButtonSize.Touch)
        BBSkeletonRows(3)
    }
    BBAlertSheet(
        open, l10n(R.string.delete_this_transaction_13a3c1), l10n(L10n.offlineMessage), l10n(R.string.delete_6b177b),
        onConfirm = {}, onDismiss = { open = false }, icon = BBIcon.Trash2,
    )
}

@Composable
private fun ToastsPage(toasts: ToastCenter) {
    val save = l10n(R.string.save_c5965d)
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBToastView(BBToast(BBToastKind.Success, save))
        BBToastView(BBToast(BBToastKind.Error, l10n(L10n.genericError)))
        BBToastView(BBToast(BBToastKind.Loading, l10n(L10n.loading)))
        BBToastView(BBToast(BBToastKind.Plain, l10n(L10n.itemDeleted), l10n(L10n.undo)))
        BBButton(save, { toasts.show(BBToastKind.Success, save) }, size = BBButtonSize.Touch)
    }
}

@Composable
private fun IconsPage() {
    val c = BuddyBudgetTheme.colors
    Column {
        BBIcon.entries.chunked(10).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { icon ->
                    Box(Modifier.weight(1f).height(34.dp), contentAlignment = Alignment.Center) {
                        BBIconView(icon, size = BBIconSize.Lg.dp, color = c.foreground)
                    }
                }
                repeat(10 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}
