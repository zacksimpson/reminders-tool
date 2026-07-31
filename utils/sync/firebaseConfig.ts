/**
 * The reminders-web Firebase project this app syncs against.
 *
 * API_KEY comes from EXPO_PUBLIC_FIREBASE_API_KEY (a gitignored .env.local locally,
 * an EAS secret/env for cloud builds), never hardcode it here. It's Android-app
 * restricted in Google Cloud (scoped to a set of allowed (package, cert) pairs), which
 * is why ANDROID_PACKAGE/ANDROID_CERT_SHA1 below have to be sent on every request.
 */
export const FirebaseConfig = {
  API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  PROJECT_ID: "reminders-web-zs2026",

  // Sent as X-Android-Package/X-Android-Cert on every request: a raw REST call has no
  // Play-Services app identity, so these headers satisfy the restriction manually.
  // Dev builds (bun run dev) get a ".debug" applicationId suffix at the Gradle level
  // (see plugins/withDebugApplicationIdSuffix.js); EAS preview/production builds
  // don't, so this mirrors the real package name for each.
  ANDROID_PACKAGE:
    process.env.NODE_ENV === "production"
      ? "com.im360noscope.reminderstool"
      : "com.im360noscope.reminderstool.debug",
  // Must match whichever keystore actually signs the running build: the local debug
  // keystore for `bun run dev`, or the EAS-managed keystore for preview/production.
  // `keytool`/`gradlew signingReport` print this colon-separated (e.g. "AB:CD:..."),
  // but the X-Android-Cert header Google checks against needs raw hex with no
  // separators, so strip them here to let .env.local hold either format.
  ANDROID_CERT_SHA1: (
    process.env.EXPO_PUBLIC_FIREBASE_ANDROID_CERT_SHA1 ?? ""
  )
    .replace(/:/g, "")
    .toUpperCase(),

  // Sent as X-Firebase-gmpid: the app ID every Firebase SDK attaches to itself.
  // Same project-wide web app id the native rewrite also reuses, not restricted per
  // package, so safe to hardcode.
  FIREBASE_APP_ID: "1:1055613872869:web:5d1911c7d04e6819e5020c",
};
