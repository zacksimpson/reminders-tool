package com.zacksimpson.reminders.data

import android.util.Log
import com.thelightphone.sdk.LightJob
import com.thelightphone.sdk.LightJobHandler
import com.thelightphone.sdk.LightJobResult
import com.thelightphone.sdk.LightWork
import com.thelightphone.sdk.SealedLightContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.lang.ref.WeakReference
import java.time.ZoneId

private const val TAG = "AlertReconciler"

const val RECONCILE_JOB_KEY = "reconcile-alerts"

/** brings the scheduled alerts in line with the tasks, settings and snoozes, safe to run any time */
suspend fun reconcileAlerts(ctx: SealedLightContext) {
    val notifications = ctx.notifications
    val store = ctx.dataStore
    val settings = NotificationPrefs(store).settings.first()
    val tasks = RemindersRepository(store).snapshotForSync().tasks
    val zone = ZoneId.systemDefault()

    val snoozeStore = AlertSnoozeStore(store)
    val snoozes = snoozeStore.all()
    snoozeStore.keepOnly(tasks.filter { AlertPlanner.isSnoozed(it, snoozes, zone) }.map { it.id }.toSet())

    // without notifications allowed nothing can fire, so drop whatever was scheduled
    val planned = if (notifications.canPostNotifications()) {
        AlertPlanner.plan(tasks, settings, System.currentTimeMillis(), zone, snoozes)
    } else {
        emptyList()
    }

    // cancel also clears a notification that already fired, which the scheduled ids no longer list
    val stale = AlertPlanner.staleIds(notifications.scheduledAlertIds.value, planned) +
        AlertPlanner.outdatedIds(tasks, planned)
    stale.forEach { notifications.cancel(it) }
    planned.forEach { p ->
        runCatching { notifications.schedule(p.id, p.atMillis, p.title, p.text) }
            .onFailure { Log.e(TAG, "couldn't schedule ${p.id}", it) }
    }
}

@LightJob(RECONCILE_JOB_KEY)
val reconcileAlertsJob: LightJobHandler = { ctx, _ ->
    try {
        reconcileAlerts(ctx)
        LightJobResult.Success(outputFilePath = null, message = null)
    } catch (e: Exception) {
        Log.e(TAG, "reconcile failed, will retry", e)
        LightJobResult.Retry
    }
}

/**
 * asks for a reconcile whenever tasks, notification settings or snoozes change. it only
 * enqueues the job above, which runs on an application context, because a screen's
 * context wraps the activity and shouldn't be held here.
 */
object AlertSync {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var ctxRef = WeakReference<SealedLightContext>(null)
    private var watching = false

    @OptIn(FlowPreview::class)
    @Synchronized
    fun attach(ctx: SealedLightContext) {
        ctxRef = WeakReference(ctx)
        if (!watching) {
            watching = true
            val store = ctx.dataStore
            scope.launch {
                combine(
                    RemindersRepository(store).appData.map { it.tasks },
                    NotificationPrefs(store).settings,
                    AlertSnoozeStore(store).snoozes,
                ) { tasks, settings, snoozes -> Triple(tasks, settings, snoozes) }
                    .distinctUntilChanged()
                    .drop(1)
                    .debounce(1_000)
                    .collect { requestNow() }
            }
        }
        requestNow()
    }

    fun requestNow() {
        ctxRef.get()?.let { LightWork.enqueue(it, RECONCILE_JOB_KEY) }
    }
}
