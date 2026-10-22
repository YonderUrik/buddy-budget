package io.buddybudget.app.features.imports

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import io.buddybudget.app.designsystem.BuddyBudgetTheme
import io.buddybudget.app.designsystem.components.BBCheckbox
import io.buddybudget.app.designsystem.components.BBIconButton
import io.buddybudget.app.designsystem.components.BBIconView
import io.buddybudget.app.designsystem.components.BBSpinner
import io.buddybudget.app.designsystem.components.BBText
import io.buddybudget.app.designsystem.components.bbPressable
import io.buddybudget.app.designsystem.components.rememberReduceMotion
import io.buddybudget.app.designsystem.generated.BBIcon
import io.buddybudget.app.designsystem.generated.BBLayout
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBSpacing
import io.buddybudget.app.designsystem.generated.BBTextStyle
import java.io.File

/** A file picked with the Storage Access Framework or shared to the app: name and bytes. Twin of iOS `PickedFile`. */
/** A file chosen or received; [size] is the real size (the bytes stop at `IncomingFiles.READ_LIMIT` for a huge file). */
class PickedFile(val name: String, val data: ByteArray, val size: Long = data.size.toLong()) {
    /** Size for the limit checks (IMP-017/019: the web's size message even when the bytes were not all read). */
    val checkedSize: Int get() = size.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
}

/** File types offered by the imports (IMP-017, INV-093, PEN-014); `.xls` so the app can explain it (IMP-019). */
object ImportFileTypes {
    val mimeTypes = arrayOf(
        "text/csv", "text/comma-separated-values", "text/plain", "text/tab-separated-values",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/csv",
        "application/octet-stream",
    )

    /**
     * Reads a content URI (picker grant or a share intent), at most `IncomingFiles.READ_LIMIT` bytes (IMP-065): a
     * bigger file keeps its real size for the web's size message without being loaded in memory.
     */
    fun read(context: Context, uri: Uri): PickedFile? = runCatching {
        var size: Long? = null
        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (!cursor.moveToFirst()) return@use null
            if (!cursor.isNull(1)) size = cursor.getLong(1)
            cursor.getString(0)
        } ?: uri.lastPathSegment?.substringAfterLast('/') ?: "file.csv"
        val limit = io.buddybudget.core.domain.imports.IncomingFiles.READ_LIMIT
        val data = context.contentResolver.openInputStream(uri)?.use { input ->
            val out = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            var total = 0
            while (total < limit) {
                val n = input.read(buffer, 0, minOf(buffer.size, limit - total))
                if (n < 0) break
                out.write(buffer, 0, n)
                total += n
            }
            out.toByteArray()
        } ?: return null
        val real = maxOf(size ?: data.size.toLong(), data.size.toLong())
        PickedFile(name, if (real > data.size) ByteArray(0) else data, real)
    }.getOrNull()

    /** The MIME type the provider declares for [uri] (null when unknown). */
    fun mimeType(context: Context, uri: Uri): String? = runCatching { context.contentResolver.getType(uri) }.getOrNull()

    /** Shares a generated file (template download, PEN-018) through the system share sheet. */
    fun share(context: Context, name: String, data: ByteArray, mime: String = "text/csv") {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, name)
        file.writeBytes(data)
        val uri = FileProvider.getUriForFile(context, context.packageName + ".exports", file)
        val send = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(send, name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

/** System document picker (SAF) filtered to the import types; `multiple` for broker statements (INV-093). */
@Composable
fun rememberImportFilePicker(multiple: Boolean = false, onPick: (List<PickedFile>) -> Unit): () -> Unit {
    val context = androidx.compose.ui.platform.LocalContext.current
    if (multiple) {
        val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            val files = uris.mapNotNull { ImportFileTypes.read(context, it) }
            if (files.isNotEmpty()) onPick(files)
        }
        return { launcher.launch(ImportFileTypes.mimeTypes) }
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { ImportFileTypes.read(context, it) }?.let { onPick(listOf(it)) }
    }
    return { launcher.launch(ImportFileTypes.mimeTypes) }
}

/** Text that pulses while work is in progress (the web's `TextShimmer`). */
@Composable
fun ShimmerText(text: String, modifier: Modifier = Modifier, style: BBTextStyle = BBTextStyle.Body, color: androidx.compose.ui.graphics.Color = BuddyBudgetTheme.colors.foreground,
                textStyle: TextStyle? = null) {
    val reduceMotion = rememberReduceMotion()
    val alpha = if (reduceMotion) 1f else {
        val transition = rememberInfiniteTransition(label = "shimmer")
        val value by transition.animateFloat(1f, 0.55f, infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "shimmerAlpha")
        value
    }
    BBText(text, modifier.alpha(alpha), textStyle ?: style.style, color = color, maxLines = 1)
}

/** Dashed zone-like button that opens the picker (no drag and drop on phone). */
@Composable
fun FilePickZone(title: String, subtitle: String, busy: Boolean = false, onClick: () -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 144.dp)
            .drawBehind {
                drawRoundRect(c.border, cornerRadius = CornerRadius(BBRadius.xl.toPx()),
                    style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))))
            }
            .bbPressable(onClick, shape, translate = false, role = Role.Button, enabled = !busy)
            .padding(BBSpacing.space6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2, Alignment.CenterVertically),
    ) {
        if (busy) BBSpinner(20.dp, c.mutedForeground) else BBIconView(BBIcon.Upload, size = 20.dp, color = c.mutedForeground)
        BBText(title, style = BBTextStyle.BodyStrong.style.copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
        BBText(subtitle, style = BBTextStyle.Caption.style.copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center), color = c.mutedForeground)
    }
}

/** Row of a chosen or received file: icon, name, detail, optional remove button. */
@Composable
fun ImportFileRow(name: String, detail: String, filled: Boolean = true, removeLabel: String? = null, onRemove: (() -> Unit)? = null) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Row(
        Modifier.fillMaxWidth()
            .then(if (filled) Modifier.background(c.alphaMuted50, shape) else Modifier.border(1.dp, c.border, shape))
            .padding(BBSpacing.space3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        Box(Modifier.size(40.dp).background(if (filled) c.background else c.muted, CircleShape), contentAlignment = Alignment.Center) {
            BBIconView(BBIcon.FileSpreadsheet, size = 20.dp, color = c.mutedForeground)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BBText(name, BBTextStyle.BodyStrong, maxLines = 1)
            BBText(detail, BBTextStyle.Caption, color = c.mutedForeground, maxLines = 2)
        }
        if (onRemove != null) BBIconButton(BBIcon.X, removeLabel ?: "", onClick = onRemove)
    }
}

/** Checkbox with its sentence as one tappable row (min height 44). */
@Composable
fun CheckboxRow(checked: Boolean, onChange: (Boolean) -> Unit, text: String, muted: String? = null, enabled: Boolean = true) {
    val c = BuddyBudgetTheme.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = BBLayout.minTouchTarget)
            .bbPressable({ onChange(!checked) }, RoundedCornerShape(BBRadius.md), translate = false, role = Role.Checkbox, enabled = enabled),
        horizontalArrangement = Arrangement.spacedBy(BBSpacing.space3),
    ) {
        BBCheckbox(checked, onChange, Modifier.padding(top = 4.dp), accessibilityLabel = text, enabled = enabled)
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = c.foreground)) { append(text) }
                if (muted != null) withStyle(SpanStyle(color = c.mutedForeground)) { append(muted) }
            },
            Modifier.weight(1f), style = BBTextStyle.Body.style,
        )
    }
}

/** `<details>` box: muted background, tappable title with chevron (mobile note: native disclosure). */
@Composable
fun DisclosureBox(title: String, open: Boolean, onToggle: () -> Unit, boxed: Boolean = true, icon: BBIcon? = null, content: @Composable ColumnScope.() -> Unit) {
    val c = BuddyBudgetTheme.colors
    val shape = RoundedCornerShape(BBRadius.xl)
    Column(
        Modifier.fillMaxWidth().then(if (boxed) Modifier.background(c.alphaMuted50, shape).padding(BBSpacing.space3) else Modifier),
        verticalArrangement = Arrangement.spacedBy(BBSpacing.space2),
    ) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 36.dp).bbPressable(onToggle, RoundedCornerShape(BBRadius.md), translate = false, role = Role.Button),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(BBSpacing.space2),
        ) {
            if (icon != null) BBIconView(icon, size = 16.dp, color = c.mutedForeground)
            BBText(title, BBTextStyle.BodyStrong, Modifier.weight(1f))
            BBIconView(BBIcon.ChevronDown, Modifier.rotate(if (open) 180f else 0f), size = 16.dp, color = c.mutedForeground)
        }
        AnimatedVisibility(open) { Column(verticalArrangement = Arrangement.spacedBy(BBSpacing.space2), content = content) }
    }
}

/** Inline text link (web `text-primary font-medium` buttons and links), 44 dp tall hit area. */
@Composable
fun TextLinkButton(title: String, onClick: () -> Unit) {
    BBText(title, BBTextStyle.BodyStrong, Modifier.bbPressable(onClick, RoundedCornerShape(BBRadius.sm), translate = false, role = Role.Button)
        .padding(vertical = BBSpacing.space1), color = BuddyBudgetTheme.colors.primary)
}

/** A part of a sentence with inline links. */
class LinkPart(val text: String, val onClick: (() -> Unit)? = null)

/** Sentence with inline links (the web's `text … <Link>…</Link> …`): one wrapping text. Twin of iOS `InlineLinkText`. */
@Composable
fun InlineLinkText(parts: List<LinkPart>, style: BBTextStyle = BBTextStyle.Body, color: androidx.compose.ui.graphics.Color = BuddyBudgetTheme.colors.mutedForeground) {
    val c = BuddyBudgetTheme.colors
    val text = buildAnnotatedString {
        parts.forEach { part ->
            val click = part.onClick
            if (click != null) {
                withLink(LinkAnnotation.Clickable("link", TextLinkStyles(SpanStyle(color = c.primary, fontWeight = FontWeight.W500))) { click() }) { append(part.text) }
            } else {
                withStyle(SpanStyle(color = color)) { append(part.text) }
            }
        }
    }
    Text(text, style = style.style)
}
