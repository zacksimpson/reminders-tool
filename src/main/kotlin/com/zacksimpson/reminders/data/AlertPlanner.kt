package com.zacksimpson.reminders.data

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/** device-local, not synced, since permissions are per phone */
data class NotificationSettings(
    val enabled: Boolean = false,
    val summaryEnabled: Boolean = false,
    val summaryTime: String = "09:00",
)

data class PlannedAlert(val id: String, val atMillis: Long, val title: String, val text: String)

/** a task's alert moved to [untilMillis]. the task keeps its own due time, [dueAtMillis] is the one it was saved against */
data class Snooze(val dueAtMillis: Long, val untilMillis: Long)

/** pure: which alerts should exist right now, given the tasks and settings */
object AlertPlanner {
    const val SUMMARY_ID = "daily-summary"
    const val TITLE = "Reminders"
    const val TASK_PREFIX = "task-"

    /** android caps how many alarms an app can hold, so only the soonest are scheduled */
    const val MAX_TASK_ALERTS = 50

    fun plan(
        tasks: List<Task>,
        settings: NotificationSettings,
        now: Long,
        zone: ZoneId,
        snoozes: Map<String, Snooze> = emptyMap(),
    ): List<PlannedAlert> {
        if (!settings.enabled) return emptyList()
        return taskAlerts(tasks, now, zone, snoozes) + listOfNotNull(summaryAlert(tasks, settings, now, zone))
    }

    /** one alert per task, at its due time or at the saved snooze time */
    fun taskAlerts(
        tasks: List<Task>,
        now: Long,
        zone: ZoneId,
        snoozes: Map<String, Snooze> = emptyMap(),
    ): List<PlannedAlert> =
        tasks.asSequence()
            .filter { isOpen(it) }
            .mapNotNull { task ->
                val due = dueAtMillis(task, zone) ?: return@mapNotNull null
                val at = activeSnooze(task, snoozes, zone)?.untilMillis ?: due
                PlannedAlert("$TASK_PREFIX${task.id}", at, TITLE, task.title)
            }
            .filter { it.atMillis > now }
            .sortedWith(compareBy({ it.atMillis }, { it.id }))
            .take(MAX_TASK_ALERTS)
            .toList()

    /** a saved snooze only counts while the task still has the due time it was saved against */
    fun activeSnooze(task: Task, snoozes: Map<String, Snooze>, zone: ZoneId): Snooze? {
        val due = dueAtMillis(task, zone) ?: return null
        return snoozes[task.id]?.takeIf { it.dueAtMillis == due }
    }

    fun isSnoozed(task: Task, snoozes: Map<String, Snooze>, zone: ZoneId): Boolean =
        isOpen(task) && activeSnooze(task, snoozes, zone) != null

    fun dueAtMillis(task: Task, zone: ZoneId): Long? {
        val date = task.date ?: return null
        val time = task.time ?: return null
        return dueAt(date, time, zone)
    }

    /** one alert at the next summary time, skipped when nothing is dated that day */
    fun summaryAlert(tasks: List<Task>, settings: NotificationSettings, now: Long, zone: ZoneId): PlannedAlert? {
        if (!settings.summaryEnabled) return null
        val at = nextSummaryAt(now, LocalTime.parse(settings.summaryTime), zone)
        val day = Instant.ofEpochMilli(at).atZone(zone).toLocalDate().toString()
        val count = tasks.count { isOpen(it) && it.date == day }
        if (count == 0) return null
        return PlannedAlert(SUMMARY_ID, at, TITLE, if (count == 1) "1 reminder today" else "$count reminders today")
    }

    /** next occurrence of the summary time strictly after [now] */
    fun nextSummaryAt(now: Long, summaryTime: LocalTime, zone: ZoneId): Long {
        val current = Instant.ofEpochMilli(now).atZone(zone)
        val today = current.toLocalDate().atTime(summaryTime).atZone(zone)
        val next = if (today.toInstant().isAfter(current.toInstant())) {
            today
        } else {
            current.toLocalDate().plusDays(1).atTime(summaryTime).atZone(zone)
        }
        return next.toInstant().toEpochMilli()
    }

    /** ids scheduled before that no longer belong */
    fun staleIds(previous: Set<String>, planned: List<PlannedAlert>): Set<String> =
        previous - planned.map { it.id }.toSet()

    private fun isOpen(t: Task) = !t.completed && !t.deleted

    private fun dueAt(date: String, time: String, zone: ZoneId): Long =
        LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli()
}
