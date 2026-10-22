package io.buddybudget.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import io.buddybudget.app.generated.LocalStrings

/** Translates an Italian source from the domain layer (`L10n.lookup` on iOS). */
@Composable
@ReadOnlyComposable
fun tr(source: String, values: Map<String, String> = emptyMap()): String = LocalStrings.current.lookup(source, values)

/** The app container, available to every screen. */
val LocalEnv = staticCompositionLocalOf<AppEnvironment> { error("No AppEnvironment") }
