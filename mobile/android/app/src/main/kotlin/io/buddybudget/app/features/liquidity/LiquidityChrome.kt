package io.buddybudget.app.features.liquidity

import io.buddybudget.core.domain.shell.LiquiditySegment
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.buddybudget.app.R
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconSize
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBScreen
import io.buddybudget.app.designsystem.components.BBSheet
import io.buddybudget.app.designsystem.components.BBSunIconButton
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBMotion
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import io.buddybudget.app.features.shell.LocalShell
import io.buddybudget.app.features.shell.LocalShellBack
import io.buddybudget.app.features.shell.ShellRoute
import io.buddybudget.app.generated.l10n
import io.buddybudget.core.domain.shell.AppDestination
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Shared chrome of the Movimenti and Analisi views (TX-001…004): `BBScreen` titled «Liquidità» with the
 * «Categorie e regole» and `Aggiungi` actions, pull-to-refresh, the segment bar, the add menu and «Nuovo movimento».
 * Starts the model (marks movements as seen, TX-004). Twin of `LiquidityChrome` on iOS.
 */
@Composable
fun LiquidityChrome(model: LiquidityModel, content: @Composable ColumnScope.(onAdd: () -> Unit) -> Unit) {
    val shell = LocalShell.current
    val segment = LocalLiquiditySegment.current
    val scope = rememberCoroutineScope()
    var addMenu by remember { mutableStateOf(false) }
    var addTransaction by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        model.start()
    }
    LaunchedEffect(shell.dataVersion) { if (shell.dataVersion > 0) model.refresh() }
    BBScreen(
        null,
        onBack = LocalShellBack.current,
        onRefresh = { model.refresh() },
    ) {
        LiquiditySegmentBar { BBSunIconButton(l10n(R.string.add_83f510)) { addMenu = true } }
        Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space8)) { content { addTransaction = true } }
    }
    LiquidityAddSheets(model, addMenu, { addMenu = false }, addTransaction, { addTransaction = it })
}

/** Liquidità's main action (TX-002): the yellow `Aggiungi` circle with the add menu and «Nuovo movimento». */
@Composable
fun LiquidityAddButton(model: LiquidityModel) {
    var addMenu by remember { mutableStateOf(false) }
    var addTransaction by remember { mutableStateOf(false) }
    BBSunIconButton(l10n(R.string.add_83f510)) { addMenu = true }
    LiquidityAddSheets(model, addMenu, { addMenu = false }, addTransaction, { addTransaction = it })
}

/** The add menu (a movement, an account or bank, a CSV/Excel import) and the add-transaction sheet. */
@Composable
private fun LiquidityAddSheets(model: LiquidityModel, addMenuOpen: Boolean, closeMenu: () -> Unit, addTransaction: Boolean, setAddTransaction: (Boolean) -> Unit) {
    val shell = LocalShell.current
    val scope = rememberCoroutineScope()
    BBSheet(addMenuOpen, closeMenu, l10n(R.string.add_83f510)) {
        Column {
            SheetActionRow(BBIcon.ReceiptText, l10n(R.string.a_transaction_cb9d03)) {
                closeMenu()
                scope.launch {
                    delay(BBMotion.durationSheetExit.toLong() + 50)
                    setAddTransaction(true)
                }
            }
            SheetActionRow(BBIcon.Landmark, l10n(R.string.an_account_or_bank_ed4931)) {
                closeMenu()
                shell.open("/liquidita/conti?nuovo=1")
            }
            // TX-002: «Importa da CSV o Excel» → /importazioni.
            SheetActionRow(BBIcon.FileSpreadsheet, io.buddybudget.app.tr("Importa da CSV o Excel")) {
                closeMenu()
                shell.open(AppDestination.Imports)
            }
        }
    }
    BBSheet(addTransaction, { setAddTransaction(false) }, l10n(R.string.new_transaction_416352)) {
        AddTransactionSheet(model, onClose = { setAddTransaction(false) }, onAddAccount = {
            setAddTransaction(false)
            shell.open("/liquidita/conti?nuovo=1")
        })
    }
}

/** One tappable action in a sheet: icon 20 + label, 48 dp high; destructive in `--destructive`. */
@Composable
fun SheetActionRow(icon: BBIcon, label: String, destructive: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp)
            .bbPressable(onClick, RoundedCornerShape(BBRadius.lg), pressedBackground = c.muted, translate = false)
            .padding(horizontal = BBSpacing.space1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBIconView(icon, size = BBIconSize.Lg.dp, color = if (destructive) c.destructive else c.text2)
        BBText(label, BBTextStyle.BodyLarge, color = if (destructive) c.destructive else c.foreground, maxLines = 1)
    }
}
