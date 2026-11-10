package io.buddybudget.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBButton
import io.buddybudget.app.designsystem.components.BBButtonSize
import io.buddybudget.app.designsystem.components.BBButtonVariant
import io.buddybudget.app.designsystem.components.BBErrorBox
import io.buddybudget.app.designsystem.components.BBIconBadge
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBKeyboard
import io.buddybudget.app.designsystem.components.BBLinkPart
import io.buddybudget.app.designsystem.components.BBLinkText
import io.buddybudget.app.designsystem.components.BBSelect
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSkeleton
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.BBTextField
import io.buddybudget.app.designsystem.components.LocalBBLocale
import io.buddybudget.app.designsystem.components.LocalLogoLoader
import io.buddybudget.app.designsystem.components.MerchantLogo
import io.buddybudget.app.designsystem.components.bbDisabled
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.bbSwatch
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.settings.Loadable
import io.buddybudget.app.tr
import io.buddybudget.core.data.Institution
import io.buddybudget.core.data.LogoLoader
import io.buddybudget.core.domain.accounts.AccountOptions
import io.buddybudget.core.domain.accounts.AccountsPaths
import io.buddybudget.core.domain.accounts.BankCountries
import io.buddybudget.core.domain.accounts.InstitutionHistory
import io.buddybudget.core.domain.accounts.InstitutionSearch
import io.buddybudget.core.domain.accounts.ManualAccountDraft
import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.shell.ExternalLinks
import okhttp3.OkHttpClient

/** GoCardless logos are public CDN images: loaded without the session token. */
private val institutionLogos by lazy { LogoLoader("https://cdn.gocardless.invalid/", OkHttpClient()) { null } }

/** «Nuovo conto» (ACC-011…022, 029…031): choice, bank picker, manual form. Twin of `NewAccountSheet` on iOS. */
@Composable
fun NewAccountSheet(model: NewAccountModel) {
    LaunchedEffect(model) { model.start() }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        val (title, description) = when (model.step) {
            NewAccountModel.Step.Choice -> "Nuovo conto" to "Come vuoi tenere aggiornato questo conto?"
            NewAccountModel.Step.Bank -> if (model.renew) "Rinnova il collegamento" to "Scegli di nuovo la tua banca per rinnovare il consenso."
            else "Collega la tua banca" to "Scegli la banca: saldi e movimenti arrivano da soli."
            NewAccountModel.Step.Manual -> "Conto manuale" to "Aggiorni tu saldo e movimenti, quando vuoi."
        }
        SheetHeader(if (model.step == NewAccountModel.Step.Manual) BBIcon.PencilLine else BBIcon.Landmark, tr(title), tr(description))
        when (model.step) {
            NewAccountModel.Step.Choice -> ChoiceView(model)
            NewAccountModel.Step.Bank -> BankView(model)
            NewAccountModel.Step.Manual -> ManualView(model)
        }
    }
}

/** Dialog header (web `PanelDialogHeader`): tinted icon 40, title text-lg, description. */
@Composable
fun SheetHeader(icon: BBIcon, title: String, description: String? = null) {
    val c = BuddyBudgetTheme.colors
    Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        BBIconBadge(icon, c.primary, 40.dp, 20.dp)
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            BBText(title, Modifier.semantics { heading() }, BBTextStyle.CardTitle.style.copy(fontSize = 18.sp, lineHeight = 22.sp))
            if (description != null) BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
    }
}

// ---------------------------------------------------------------------------------------------------------- Choice (ACC-011…013)

@Composable
private fun ChoiceView(model: NewAccountModel) {
    val c = BuddyBudgetTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space3)) {
        val blocked = model.unavailable
        if (blocked != null) {
            ChoiceRow(BBIcon.Zap, c.text3, tr("Collega la tua banca"), tr(blocked.badge), tr(blocked.description), unavailable = true) {}
        } else {
            ChoiceRow(BBIcon.Zap, c.primary, tr("Collega la tua banca"), tr("Automatico"), tr("Saldi e movimenti si aggiornano da soli, in sola lettura.")) {
                model.choose(NewAccountModel.Step.Bank)
            }
        }
        ChoiceRow(BBIcon.PencilLine, c.swatchIndigo, tr("Conto manuale"), null, tr("Per contanti, carte prepagate o qualsiasi banca: il saldo lo aggiorni tu.")) {
            model.choose(NewAccountModel.Step.Manual)
        }
        ChoiceRow(BBIcon.FileSpreadsheet, c.swatchAmber, tr("Importa un file CSV o Excel"), null,
            tr("Carica l'estratto conto: lo leggiamo e crei il conto con i suoi movimenti.")) { model.onNavigate(AccountsPaths.IMPORTS) }
    }
}

@Composable
private fun ChoiceRow(icon: BBIcon, color: Color, title: String, badge: String?, description: String, unavailable: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 72.dp)
            .border(1.dp, c.border, shape)
            .bbPressable(if (unavailable) null else onClick, shape, background = if (unavailable) c.muted.copy(alpha = 0.3f) else c.background,
                pressedBackground = c.muted.copy(alpha = 0.6f), translate = false, enabled = !unavailable)
            .padding(BBSpacing.space3_5),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3_5),
    ) {
        BBIconBadge(icon, color, 44.dp, 20.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                BBText(title, style = BBTextStyle.BodyStrong.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W600))
                if (badge != null) {
                    BBText(
                        badge,
                        Modifier.background(if (unavailable) c.muted else c.alphaPrimary10, CircleShape)
                            .padding(horizontal = BBSpacing.space2, vertical = BBSpacing.space0_5),
                        BBTextStyle.Badge.style, color = if (unavailable) c.mutedForeground else c.primary, maxLines = 1,
                    )
                }
            }
            BBText(description, BBTextStyle.Body, color = c.mutedForeground)
        }
        if (!unavailable) BBIconView(BBIcon.ChevronRight, color = c.mutedForeground)
    }
}

// ---------------------------------------------------------------------------------------------------------- Bank (ACC-014, 016…022)

@Composable
private fun BankView(model: NewAccountModel) {
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space4)) {
        Row(
            Modifier.padding(top = 0.dp).heightIn(min = BBLayout.minTouchTarget).bbDisabled(model.busy)
                .bbPressable(if (model.busy) null else ({ model.step = NewAccountModel.Step.Choice }), RoundedCornerShape(BBRadius.md), translate = false),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5),
        ) {
            BBIconView(BBIcon.ArrowLeft, color = c.mutedForeground)
            BBText(tr("Cambia modo"), BBTextStyle.BodyStrong, color = c.mutedForeground)
        }
        val inApp = remember(context) {
            object : UriHandler {
                override fun openUri(uri: String) = BankBrowser.open(context, uri)
            }
        }
        Row(
            Modifier.fillMaxWidth().background(c.muted.copy(alpha = 0.6f), RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2_5),
        ) {
            BBIconView(BBIcon.LockKeyhole, Modifier.padding(top = 2.dp), color = c.mutedForeground)
            CompositionLocalProvider(LocalUriHandler provides inApp) {
                BBLinkText(
                    listOf(
                        BBLinkPart.Plain(tr("Ti porto sul sito della tua banca per dare il consenso. Il collegamento è in sola lettura: BuddyBudget non vede le tue credenziali e non può muovere denaro.") + " "),
                        BBLinkPart.Link(tr("Come funziona"), ExternalLinks.SECURITY),
                    ),
                    style = BBTextStyle.Body.style, color = c.mutedForeground,
                )
            }
        }
        BBSelect(
            BankCountries.all.map { it.code to "${it.flag} ${tr(it.label)}" }, model.country, { model.updateCountry(it) },
            label = tr("Paese"), height = 44.dp, enabled = !model.busy,
        )
        BBTextField(model.search, { model.search = it }, label = tr("Cerca la tua banca"), placeholder = tr("Es. Intesa, Fineco, N26"),
            enabled = !model.busy, height = 44.dp)
        Results(model)
        model.chosen?.let { BBText(tr("Ti porto sul sito di {0}…", mapOf("0" to it.name)), BBTextStyle.Body, color = c.mutedForeground) }
        model.linkError?.let { BBErrorBox(it, reportArea = io.buddybudget.core.domain.support.ReportErrorArea.CollegaBanca) }
    }
}

@Composable
private fun Results(model: NewAccountModel) {
    val c = BuddyBudgetTheme.colors
    val context = LocalContext.current
    val shape = RoundedCornerShape(BBRadius.xl)
    when (model.institutions) {
        is Loadable.Loading -> {
            val label = tr("Caricamento delle banche")
            Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                repeat(5) { BBSkeleton(height = 56.dp, radius = BBRadius.xl) }
            }
        }
        is Loadable.Failed -> Column(
            Modifier.fillMaxWidth().background(c.destructive.copy(alpha = 0.05f), shape).border(1.dp, c.destructive.copy(alpha = 0.3f), shape)
                .padding(BBSpacing.space4),
            verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            BBText(tr("Non riesco a caricare l'elenco delle banche."), BBTextStyle.BodyStrong)
            BBText(tr("Succede se la connessione cade o il servizio è occupato. Non hai perso nulla."), BBTextStyle.Body, color = c.mutedForeground)
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space4), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                BBText(tr("Riprova"), Modifier.bbPressable({ model.loadInstitutions() }, RoundedCornerShape(BBRadius.md), translate = false),
                    BBTextStyle.BodyStrong.style, color = c.primary)
                io.buddybudget.app.features.help.ReportErrorLink(io.buddybudget.core.domain.support.ReportErrorArea.CollegaBanca, "Non riesco a caricare l'elenco delle banche.")
            }
        }
        is Loadable.Loaded -> {
            val list = model.filtered
            if (list.isEmpty()) {
                Column(
                    Modifier.fillMaxWidth().drawBehind {
                        drawRoundRect(c.border, cornerRadius = CornerRadius(BBRadius.xl.toPx()),
                            style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
                    }.padding(BBSpacing.space4),
                    verticalArrangement = Arrangement.spacedBy(BBSpacing.space1),
                ) {
                    BBText(accountsText(InstitutionSearch.emptyTitle(model.search)), BBTextStyle.BodyStrong)
                    BBText(tr("Controlla il nome o cambia paese.") + tr(" Se non c'è, puoi tenere il conto a mano e importare i movimenti da un file."),
                        BBTextStyle.Body, color = c.mutedForeground)
                    Box(Modifier.heightIn(min = BBLayout.minTouchTarget).bbPressable({ model.choose(NewAccountModel.Step.Manual) },
                        RoundedCornerShape(BBRadius.md), translate = false), contentAlignment = Alignment.CenterStart) {
                        BBText(tr("Aggiungi un conto manuale"), BBTextStyle.BodyStrong, color = c.primary)
                    }
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                    BBText(accountsText(InstitutionSearch.countLabel(list.size)), BBTextStyle.Caption, color = c.mutedForeground)
                    CompositionLocalProvider(LocalLogoLoader provides institutionLogos) {
                        list.forEach { institution ->
                            InstitutionRow(institution, model.chosen?.id == institution.id, model.busy) { model.select(context, institution) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InstitutionRow(institution: Institution, chosen: Boolean, disabled: Boolean, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).alpha(if (disabled && !chosen) 0.6f else 1f)
            .border(1.dp, c.border, shape)
            .bbPressable(if (disabled) null else onClick, shape, background = c.background, pressedBackground = c.muted.copy(alpha = 0.6f),
                translate = false, enabled = !disabled)
            .padding(horizontal = BBSpacing.space3, vertical = BBSpacing.space2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        MerchantLogo(institution.name, logoPath = institution.logo, fallback = BBIcon.Building2)
        Column(Modifier.weight(1f)) {
            BBText(institution.name, BBTextStyle.BodyStrong)
            InstitutionHistory.label(institution.transactionTotalDays)?.let { BBText(accountsText(it), BBTextStyle.Caption, color = c.mutedForeground) }
        }
        if (chosen) BBSpinner(BBIconSize.Md.dp, c.mutedForeground) else BBIconView(BBIcon.ChevronRight, color = c.mutedForeground)
    }
}

// ---------------------------------------------------------------------------------------------------------- Manual (ACC-029…031)

@Composable
private fun ManualView(model: NewAccountModel) {
    val c = BuddyBudgetTheme.colors
    var picker by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space5)) {
        StepProgressBar(model.manualStep, 2, tr("Passi del nuovo conto"))
        if (model.manualStep == 0) {
            StepTitle(tr("Come si chiama il conto?"))
            BBTextField(
                model.draft.name, { model.draft = model.draft.copy(name = ManualAccountDraft.clampName(it)) },
                label = tr("Nome del conto"), placeholder = tr("Es. Conto Intesa"), error = model.errors.name?.let { tr(it) }, height = 44.dp,
                onSubmit = { model.next() }, autofocus = true,
            )
            Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
                BBSelect(
                    AccountOptions.typePresets.map<String, Pair<String?, String>> { it to tr(it) } + (null to tr("Altro…")),
                    model.draft.typePreset, { model.draft = model.draft.copy(typePreset = it) }, label = tr("Tipo"), height = 44.dp,
                )
                if (model.draft.typePreset == null) {
                    BBTextField(model.draft.customType, { model.draft = model.draft.copy(customType = it) },
                        placeholder = tr("Es. Cassa contanti, Wallet crypto"), error = model.errors.type?.let { tr(it) }, height = 44.dp)
                }
            }
        } else {
            StepTitle(tr("Quanto c'è sul conto oggi?"), tr("Da qui in poi lo aggiornano i movimenti che registri."))
            BBTextField(
                model.draft.balanceText, { model.draft = model.draft.copy(balanceText = it) }, label = tr("Saldo di oggi"),
                error = model.errors.balance?.let { tr(it) }, keyboard = BBKeyboard.SignedAmount,
                prefix = BBFormat.getCurrencySymbol(model.env.session.currency, LocalBBLocale.current), height = 44.dp,
            )
            Row(
                Modifier.fillMaxWidth().border(1.dp, c.border, RoundedCornerShape(BBRadius.xl)).padding(BBSpacing.space3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
            ) {
                val label = tr("Cambia icona e colore")
                Box(Modifier.bbPressable({ picker = true }, CircleShape, translate = false).semantics { contentDescription = label }) {
                    BBIconBadge(BBIcon.account(model.draft.icon), bbSwatch(model.draft.color), 40.dp, 20.dp)
                }
                Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space0_5)) {
                    BBText(model.draft.name.trim().ifEmpty { tr("Il tuo conto") }, BBTextStyle.BodyStrong, maxLines = 1)
                    BBText(tr("Tocca l'icona per cambiare icona e colore (facoltativo)."), BBTextStyle.Caption, color = c.mutedForeground)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
            if (model.manualStep == 0) {
                BBButton(tr("Continua"), { model.next() }, size = BBButtonSize.Touch, fullWidth = true)
            } else {
                BBButton(tr(if (model.creating) "Aggiungo il conto…" else "Aggiungi il conto"), { model.create() }, size = BBButtonSize.Touch,
                    fullWidth = true, isLoading = model.creating)
            }
            BBButton(tr("Indietro"), { model.back() }, variant = BBButtonVariant.Ghost, size = BBButtonSize.Touch, fullWidth = true, enabled = !model.creating)
        }
        model.createError?.let { BBErrorBox(it, reportArea = io.buddybudget.core.domain.support.ReportErrorArea.Conto) }
    }
    BBSheet(picker, { picker = false }) {
        AppearancePicker(model.draft.color, model.draft.icon) { color, icon -> model.draft = model.draft.copy(color = color, icon = icon) }
    }
}

/** «Passo 1 di 2» and a segmented bar (web `StepProgress`). */
@Composable
fun StepProgressBar(index: Int, count: Int, label: String) {
    val c = BuddyBudgetTheme.colors
    val step = tr("Passo {0} di {1}", mapOf("0" to (index + 1).toString(), "1" to count.toString()))
    Column(Modifier.semantics { contentDescription = "$label, $step" }, verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(step, style = BBTextStyle.Caption.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), color = c.mutedForeground)
        Row(horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1_5)) {
            repeat(count) { i -> Box(Modifier.weight(1f).height(4.dp).background(if (i <= index) c.primary else c.border, CircleShape)) }
        }
    }
}

/** Step question (web `StepHeading`): font-heading text-xl medium + optional description. */
@Composable
fun StepTitle(title: String, description: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
        BBText(title, Modifier.semantics { heading() }, BBTextStyle.SectionTitle.style)
        if (description != null) BBText(description, BBTextStyle.Body, color = BuddyBudgetTheme.colors.mutedForeground)
    }
}

// ---------------------------------------------------------------------------------------------------------- Icon & colour picker

/** «Colore» (16 base swatches) and «Icona» (30 icons); every tap reports the new pair. */
@Composable
fun AppearancePicker(initialColor: String, initialIcon: String, onChange: (String, String) -> Unit) {
    val c = BuddyBudgetTheme.colors
    var color by remember { mutableStateOf(initialColor) }
    var icon by remember { mutableStateOf(initialIcon) }
    Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
        BBText(tr("Colore"), style = BBTextStyle.Caption.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), color = c.mutedForeground)
        AccountOptions.colors.chunked(8).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2)) {
                row.forEach { key ->
                    val label = tr("Colore {0}", mapOf("0" to AccountOptions.colorName(key)))
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        Box(
                            Modifier.size(38.dp)
                                .border(2.dp, if (color == key) c.foreground else Color.Transparent, CircleShape)
                                .padding(3.dp)
                                .background(bbSwatch(key), CircleShape)
                                .bbPressable({ color = key; onChange(color, icon) }, CircleShape, translate = false)
                                .semantics { contentDescription = label; selected = color == key },
                        )
                    }
                }
            }
        }
        BBText(tr("Icona"), Modifier.padding(top = BBSpacing.space2),
            BBTextStyle.Caption.style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.W500), color = c.mutedForeground)
        AccountOptions.icons.chunked(6).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(BBSpacing.space1)) {
                row.forEach { key ->
                    val label = tr("Icona {0}", mapOf("0" to key))
                    Box(
                        Modifier.weight(1f).heightIn(min = 44.dp)
                            .background(if (icon == key) c.accent else Color.Transparent, RoundedCornerShape(BBRadius.lg))
                            .bbPressable({ icon = key; onChange(color, icon) }, RoundedCornerShape(BBRadius.lg), translate = false)
                            .semantics { contentDescription = label; selected = icon == key },
                        contentAlignment = Alignment.Center,
                    ) { BBIconView(BBIcon.account(key), size = BBIconSize.Lg.dp, color = if (icon == key) c.accentForeground else c.mutedForeground) }
                }
            }
        }
    }
}
