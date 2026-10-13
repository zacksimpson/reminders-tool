package com.zacksimpson.reminders.data

import android.util.Log
import com.thelightphone.sdk.LightJob
import com.thelightphone.sdk.LightJobHandler
import com.thelightphone.sdk.LightJobResult
import com.thelightphone.sdk.LightWork
import kotlinx.coroutines.flow.first

private const val TAG = "SyncJob"

/** WorkManager key shared by the periodic schedule and the immediate one-shot poke,
 *  see [com.zacksimpson.reminders.MainScreen] for where both get enqueued. */
const val SYNC_JOB_KEY = "sync-reminders"

/** uniqueness slot for the immediate one-shot, distinct from [SYNC_JOB_KEY]'s own
 *  periodic slot so triggering one doesn't cancel the other. shared by
 *  [com.zacksimpson.reminders.MainScreen]'s on-open poke and Account's "Sync now" row. */
const val SYNC_NOW_TAG = "$SYNC_JOB_KEY-now"

/** input flag set when the user asked for the sync, so going offline is reported rather than skipped. */
const val SYNC_MANUAL_KEY = "manual"

/** failure reason a manual sync reports when the device has no connection. */
const val SYNC_OFFLINE_REASON = "offline"

/**
 * background sync. no-op success when signed out (MainScreen only schedules it while
 * signed in). offline, a scheduled run just skips; a manual run (see [SYNC_MANUAL_KEY])
 * errors so Account can say so. [AuthException] (Firebase rejected the sign-in/refresh
 * call outright, bad API key, expired/revoked refresh token) is treated as permanent:
 * the periodic schedule is cancelled and Account shows "Error. Tap to try again";
 * anything else falls through to [LightJobResult.Retry], which WorkManager backs off
 * and retries automatically.
 */
@LightJob(SYNC_JOB_KEY)
val syncRemindersJob: LightJobHandler = { lightContext, input ->
    val authRepo = AuthRepository(lightContext.dataStore)
    try {
        if (authRepo.state.first() !is AuthState.SignedIn) {
            LightJobResult.Success(outputFilePath = null, message = null)
        } else if (!lightContext.connectivity.currentStatus.isConnected) {
            if (input[SYNC_MANUAL_KEY] == "true") {
                LightJobResult.Error(reason = SYNC_OFFLINE_REASON)
            } else {
                LightJobResult.Success(outputFilePath = null, message = null)
            }
        } else {
            val firestore = FirestoreClient(authRepo)
            try {
                SyncEngine(RemindersRepository(lightContext.dataStore), authRepo, firestore).sync()
                LightJobResult.Success(outputFilePath = null, message = null)
            } finally {
                firestore.close()
            }
        }
    } catch (e: AuthException) {
        Log.e(TAG, "Sync failed, won't retry", e)
        LightWork.cancel(lightContext, SYNC_JOB_KEY)
        LightJobResult.Error(reason = e.message ?: "sign-in rejected")
    } catch (e: Exception) {
        Log.e(TAG, "Sync failed, will retry", e)
        LightJobResult.Retry
    } finally {
        authRepo.close()
    }
}
