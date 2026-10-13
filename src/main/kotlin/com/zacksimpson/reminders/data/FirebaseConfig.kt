package com.zacksimpson.reminders.data

/**
 * the reminders-web Firebase project this app syncs against.
 *
 * [API_KEY] is committed on purpose: Light's builder only sees the tool's source, and a
 * Firebase API key identifies the project rather than guarding it (Firestore rules and
 * Auth do that). it's Android-app restricted (scoped to [ANDROID_PACKAGE] +
 * [ANDROID_CERT_SHA1]), a separate key from reminders-web's own web key since a Google
 * Cloud API key can't be both referrer- and Android-restricted.
 */
object FirebaseConfig {
    const val API_KEY = "AIzaSyCBdNrZWgQ4LjaekiqxxRlNM9JYojEXq0o"
    const val PROJECT_ID = "reminders-web-zs2026"

    // sent as X-Android-Package/X-Android-Cert on every request, a raw REST call has
    // no Play-Services app identity, so these headers satisfy the restriction manually.
    const val ANDROID_PACKAGE = "com.zacksimpson.reminders"
    const val ANDROID_CERT_SHA1 = "B822D481499EE5C3CC7DB90AEEC2945D8F230715"

    // sent as X-Firebase-gmpid, the app ID every Firebase SDK attaches to itself.
    const val FIREBASE_APP_ID = "1:1055613872869:web:5d1911c7d04e6819e5020c"
}
