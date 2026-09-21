# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─── Capacitor's annotation types ────────────────────────────────────────────
# Inert while `minifyEnabled false` (build.gradle) — R8 does not run. It is here
# so that turning minification on does not ship the crash agency-dash did.
#
# `PluginHandle` stores each plugin's `@CapacitorPlugin` annotation in a field
# that `Bridge.getPermissionStates()` reads. Annotation instances are runtime
# proxies R8 cannot see, so R8 full mode (AGP 8's default) decides the field is
# always null, deletes it, and every plugin `checkPermissions()` — camera,
# geolocation, push — throws an NPE on the CapacitorPlugins thread and takes
# the app down. Capacitor's bundled consumer rules keep the plugin classes but
# not these annotation types. Keeping them pins them.
-keep @interface com.getcapacitor.** { *; }
