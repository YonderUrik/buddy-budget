pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "buddy-budget-android"

// `core` is plain Kotlin/JVM (domain + data) so it builds and tests without the Android SDK.
include(":core")
if (file("local.properties").exists() || System.getenv("ANDROID_HOME") != null) {
    include(":app")
}
