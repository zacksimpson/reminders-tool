package com.zacksimpson.reminders.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** signed-out vs signed-in, mirroring [DataState]'s Loading/Ready/Corrupt shape but for
 *  auth rather than task data. */
sealed interface AuthState {
    data object Loading : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val uid: String, val email: String) : AuthState
}

/** where the last sync left off, see [AuthRepository.syncCursor]. */
data class SyncCursor(val startedAt: Long?, val lastFullAt: Long?)

/**
 * stores the signed-in account's tokens for phone<->desktop sync in the shared
 * DataStore [RemindersRepository] uses. [AuthClient] does the network calls, this
 * persists what comes back and decides when a stored ID token needs refreshing.
 */
class AuthRepository(private val dataStore: DataStore<Preferences>) {
    private val client = AuthClient()

    val state: Flow<AuthState> = dataStore.data.map { p ->
        val uid = p[UID_KEY]
        val email = p[EMAIL_KEY]
        if (uid != null && email != null) AuthState.SignedIn(uid, email) else AuthState.SignedOut
    }

    /** epoch millis of the last successful [SyncEngine.sync] call, or null if this
     *  account has never synced. drives the Settings "last synced" row. */
    val lastSyncedAt: Flow<Long?> = dataStore.data.map { it[LAST_SYNCED_KEY] }

    /** when the last pass started and the last full pass finished, null until first sync */
    suspend fun syncCursor(): SyncCursor = dataStore.data.first().let {
        SyncCursor(startedAt = it[SYNC_STARTED_KEY], lastFullAt = it[LAST_FULL_SYNC_KEY])
    }

    suspend fun signIn(email: String, password: String) {
        val tokens = client.signInWithPassword(email, password)
        persist(tokens, email)
    }

    fun close() = client.close()

    suspend fun signOut() {
        dataStore.edit { p ->
            p.remove(UID_KEY)
            p.remove(EMAIL_KEY)
            p.remove(ID_TOKEN_KEY)
            p.remove(REFRESH_TOKEN_KEY)
            p.remove(EXPIRES_AT_KEY)
            p.remove(LAST_SYNCED_KEY)
            p.remove(SYNC_STARTED_KEY)
            p.remove(LAST_FULL_SYNC_KEY)
        }
    }

    /** called by [SyncEngine] after a sync pass completes without error. */
    suspend fun recordSyncSuccess(startedAt: Long, full: Boolean) {
        val now = System.currentTimeMillis()
        dataStore.edit { p ->
            p[LAST_SYNCED_KEY] = now
            p[SYNC_STARTED_KEY] = startedAt
            if (full) p[LAST_FULL_SYNC_KEY] = now
        }
    }

    /** a valid ID token for authenticated Firestore calls, refreshing first if the
     *  stored one is expired or about to be. null if signed out. */
    suspend fun validIdToken(): String? {
        val prefs = dataStore.data.first()
        val refreshToken = prefs[REFRESH_TOKEN_KEY] ?: return null
        val idToken = prefs[ID_TOKEN_KEY]
        val expiresAt = prefs[EXPIRES_AT_KEY] ?: 0L
        if (idToken != null && System.currentTimeMillis() < expiresAt - REFRESH_MARGIN_MS) {
            return idToken
        }
        val email = prefs[EMAIL_KEY] ?: return null
        val tokens = client.refresh(refreshToken)
        persist(tokens, email)
        return tokens.idToken
    }

    private suspend fun persist(tokens: AuthTokens, email: String) {
        dataStore.edit { p ->
            p[UID_KEY] = tokens.uid
            p[EMAIL_KEY] = email
            p[ID_TOKEN_KEY] = tokens.idToken
            p[REFRESH_TOKEN_KEY] = tokens.refreshToken
            p[EXPIRES_AT_KEY] = tokens.expiresAt
        }
    }

    private companion object {
        val UID_KEY = stringPreferencesKey("auth:uid")
        val EMAIL_KEY = stringPreferencesKey("auth:email")
        val ID_TOKEN_KEY = stringPreferencesKey("auth:idToken")
        val REFRESH_TOKEN_KEY = stringPreferencesKey("auth:refreshToken")
        val EXPIRES_AT_KEY = longPreferencesKey("auth:expiresAt")
        val LAST_SYNCED_KEY = longPreferencesKey("auth:lastSyncedAt")
        val SYNC_STARTED_KEY = longPreferencesKey("auth:syncStartedAt")
        val LAST_FULL_SYNC_KEY = longPreferencesKey("auth:lastFullSyncAt")

        // refresh a bit before actual expiry so a call made right at the boundary
        // doesn't get rejected by Firestore for using a token that expired mid-flight.
        const val REFRESH_MARGIN_MS = 60_000L
    }
}

/** same WhileSubscribed/initial-value/catch convention RemindersRepository.dataStateIn uses,
 *  an unreadable DataStore falls back to SignedOut rather than crashing the collector. */
fun AuthRepository.authStateIn(
    scope: CoroutineScope,
    initialValue: AuthState = AuthState.Loading,
): StateFlow<AuthState> =
    state
        .catch { emit(AuthState.SignedOut) }
        .stateIn(scope, SharingStarted.WhileSubscribed(5_000), initialValue)
