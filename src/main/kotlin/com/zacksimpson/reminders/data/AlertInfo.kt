package com.zacksimpson.reminders.data

import java.time.Instant
import java.time.ZoneId

/** what the alert screen shows */
sealed interface AlertInfo {
    data class Reminder(
        val taskId: String,
        val title: String,
        val listTitle: String?,
        val due: String,
        val dueAtMillis: Long,
        val snoozed: Boolean,
    ) : AlertInfo

    data class Summary(val text: String) : AlertInfo
}

/** null when the alert has nothing left to show, like a task finished or deleted since it was scheduled */
fun alertInfoFor(
    alertId: String,
    alertText: String,
    tasks: List<Task>,
    lists: List<ReminderList>,
    snoozes: Map<String, Snooze>,
    zone: ZoneId,
): AlertInfo? {
    if (alertId == AlertPlanner.SUMMARY_ID) return AlertInfo.Summary(alertText)
    if (!alertId.startsWith(AlertPlanner.TASK_PREFIX)) return null
    val taskId = alertId.removePrefix(AlertPlanner.TASK_PREFIX)
    val task = tasks.firstOrNull { it.id == taskId && !it.completed && !it.deleted } ?: return null
    val date = task.date ?: return null
    val time = task.time ?: return null
    return AlertInfo.Reminder(
        taskId = task.id,
        title = task.title,
        listTitle = lists.firstOrNull { it.id == task.listId && !it.deleted }?.title,
        due = "Due ${formatDate(date)}, ${formatTime(time)}",
        dueAtMillis = AlertPlanner.dueAtMillis(task, zone) ?: return null,
        snoozed = AlertPlanner.isSnoozed(task, snoozes, zone),
    )
}

/** "Nov 13, 2:30 PM", or just the time when [millis] is today */
fun formatAlertAt(millis: Long, now: Long, zone: ZoneId): String {
    val at = Instant.ofEpochMilli(millis).atZone(zone)
    val time = formatTime("%02d:%02d".format(at.hour, at.minute))
    if (at.toLocalDate() == Instant.ofEpochMilli(now).atZone(zone).toLocalDate()) return time
    return "${formatDate("%04d-%02d-%02d".format(at.year, at.monthValue, at.dayOfMonth))}, $time"
}
