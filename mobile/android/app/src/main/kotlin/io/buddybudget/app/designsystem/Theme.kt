package io.buddybudget.app.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import io.buddybudget.app.designsystem.generated.BBColors
import io.buddybudget.app.designsystem.generated.BBDarkColors
import io.buddybudget.app.designsystem.generated.BBLightColors
import io.buddybudget.app.designsystem.generated.BBRadius
import io.buddybudget.app.designsystem.generated.BBTextStyle

// Theme glue over the generated tokens in designsystem/generated/Tokens.kt (spec: design/tokens.md).
// Financial semantics (pos/neg, text2/3, chart, risk, groups, swatches, island) live only in
// LocalBBColors / BuddyBudgetTheme.colors — never read them from MaterialTheme.colorScheme.

/** In-app appearance setting: System / Light / Dark, default System (tokens.md §0). */
enum class BBThemePreference { SYSTEM, LIGHT, DARK }

/** Every BuddyBudget color token for the current theme. */
val LocalBBColors = staticCompositionLocalOf<BBColors> { BBLightColors }

/** True when the dark palette is active (follows the in-app override, not only the system). */
val LocalBBIsDark = staticCompositionLocalOf { false }

/** Accessors for BuddyBudget tokens that Material has no slot for. */
object BuddyBudgetTheme {
    val colors: BBColors
        @Composable @ReadOnlyComposable
        get() = LocalBBColors.current

    val isDark: Boolean
        @Composable @ReadOnlyComposable
        get() = LocalBBIsDark.current
}

/** Maps the shadcn roles onto Material 3 so stock components look right (tokens.md §9). */
fun bbColorScheme(c: BBColors, dark: Boolean): ColorScheme =
    if (dark) {
        darkColorScheme(
            primary = c.primary, onPrimary = c.primaryForeground,
            primaryContainer = c.alphaPrimary10, onPrimaryContainer = c.primary,
            secondary = c.secondaryForeground, onSecondary = c.secondary,
            secondaryContainer = c.secondary, onSecondaryContainer = c.secondaryForeground,
            tertiary = c.pos, onTertiary = c.primaryForeground,
            background = c.background, onBackground = c.foreground,
            surface = c.card, onSurface = c.cardForeground,
            surfaceVariant = c.muted, onSurfaceVariant = c.mutedForeground,
            surfaceContainerLowest = c.background, surfaceContainerLow = c.card,
            surfaceContainer = c.card, surfaceContainerHigh = c.popover, surfaceContainerHighest = c.secondary,
            inverseSurface = c.foreground, inverseOnSurface = c.background,
            error = c.destructive, onError = c.primaryForeground,
            errorContainer = c.alphaDestructive20, onErrorContainer = c.destructive,
            outline = c.border, outlineVariant = c.input, scrim = c.scrimDialog,
        )
    } else {
        lightColorScheme(
            primary = c.primary, onPrimary = c.primaryForeground,
            primaryContainer = c.alphaPrimary10, onPrimaryContainer = c.primary,
            secondary = c.secondaryForeground, onSecondary = c.secondary,
            secondaryContainer = c.secondary, onSecondaryContainer = c.secondaryForeground,
            tertiary = c.pos, onTertiary = c.primaryForeground,
            background = c.background, onBackground = c.foreground,
            surface = c.card, onSurface = c.cardForeground,
            surfaceVariant = c.muted, onSurfaceVariant = c.mutedForeground,
            surfaceContainerLowest = c.background, surfaceContainerLow = c.card,
            surfaceContainer = c.card, surfaceContainerHigh = c.popover, surfaceContainerHighest = c.secondary,
            inverseSurface = c.foreground, inverseOnSurface = c.background,
            error = c.destructive, onError = c.primaryForeground,
            errorContainer = c.alphaDestructive10, onErrorContainer = c.destructive,
            outline = c.border, outlineVariant = c.input, scrim = c.scrimDialog,
        )
    }

/** Material slots → BuddyBudget text styles. Prefer `BBTextStyle.X.style` directly in BuddyBudget components. */
val BBMaterialTypography = Typography(
    displayLarge = BBTextStyle.Display.style,
    displayMedium = BBTextStyle.Display.style,
    displaySmall = BBTextStyle.PageTitle.style,
    headlineLarge = BBTextStyle.PageTitle.style,
    headlineMedium = BBTextStyle.AmountLarge.style,
    // Section titles are the display face now (#411); Material slots keep Hanken.
    headlineSmall = BBTextStyle.AmountLarge.style,
    titleLarge = BBTextStyle.CardTitle.style,
    titleMedium = BBTextStyle.CardTitle.style,
    titleSmall = BBTextStyle.BodyStrong.style,
    bodyLarge = BBTextStyle.BodyLarge.style,
    bodyMedium = BBTextStyle.Body.style,
    bodySmall = BBTextStyle.Caption.style,
    labelLarge = BBTextStyle.Button.style,
    labelMedium = BBTextStyle.Badge.style,
    labelSmall = BBTextStyle.Micro.style,
)

/** Circular corners, as on the web (tokens.md §3). */
val BBShapes = Shapes(
    extraSmall = RoundedCornerShape(BBRadius.sm),
    small = RoundedCornerShape(BBRadius.md),
    medium = RoundedCornerShape(BBRadius.lg),
    large = RoundedCornerShape(BBRadius.xl),
    extraLarge = RoundedCornerShape(BBRadius.radius4xl),
)

@Composable
fun BuddyBudgetTheme(
    preference: BBThemePreference = BBThemePreference.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (preference) {
        BBThemePreference.SYSTEM -> isSystemInDarkTheme()
        BBThemePreference.LIGHT -> false
        BBThemePreference.DARK -> true
    }
    val colors = if (dark) BBDarkColors else BBLightColors
    CompositionLocalProvider(LocalBBColors provides colors, LocalBBIsDark provides dark) {
        MaterialTheme(
            colorScheme = bbColorScheme(colors, dark),
            typography = BBMaterialTypography,
            shapes = BBShapes,
            content = content,
        )
    }
}
