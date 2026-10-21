plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "io.buddybudget.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.buddybudget.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "API_BASE_URL", "\"https://app.buddybudget.io/\"")
    }

    buildTypes {
        debug {
            // `-PbbIdSuffix=.a` lets parallel worktrees install side by side on one emulator.
            applicationIdSuffix = ".debug" + (project.findProperty("bbIdSuffix") as String? ?: "")
            // Emulator alias for the host machine running `pnpm dev` in the web repo.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001/\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
        // Sideloadable release build against production, for testing on a phone before the store:
        // `./gradlew :app:assemblePreview`. Installs next to the store app; signed with the local debug key.
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-preview"
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }

    // The preview build uses the release stubs (no debug launch hooks).
    sourceSets.getByName("preview").kotlin.directories += "src/release/kotlin"

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
}

dependencies {
    implementation(project(":core"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.browser)
    implementation(libs.kotlinx.coroutines.android)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
}
