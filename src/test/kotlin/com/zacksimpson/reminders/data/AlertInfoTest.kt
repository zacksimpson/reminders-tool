package com.zacksimpson.reminders.data

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AlertInfoTest {
    private val zone = ZoneId.of("UTC")

    private fun at(date: String, time: String) =
        LocalDate.parse(date).atTime(LocalTime.parse(time)).atZone(zone).toInstant().toEpochMilli()

    private fun task(id: String, done: Boolean = false, deleted: Boolean = false) = Task(
        id = id, title = "Do the dishes", listId = "life", date = "2026-11-13", time = "14:30",
        completed = done, createdAt = 0L, order = 0, deleted = deleted,
    )

    private val lists = listOf(ReminderList(id = "life", title = "My Life", createdAt = 0L, order = 0))

    private fun info(id: String, tasks: List<Task>, snoozes: Map<String, Snooze> = emptyMap()) =
        alertInfoFor(id, "text", tasks, lists, snoozes, zone)

    @Test
    fun taskAlertShowsTheTaskAndItsOriginalDueTime() {
        val got = info("task-a", listOf(task("a"))) as AlertInfo.Reminder
        assertEquals("Do the dishes", got.title)
        assertEquals("My Life", got.listTitle)
        assertEquals("Due Nov 13, 2:30 PM", got.due)
        assertEquals(at("2026-11-13", "14:30"), got.dueAtMillis)
        assertEquals(false, got.snoozed)
    }

    @Test
    fun aSnoozeKeepsTheOriginalDueTextAndMarksItSnoozed() {
        val snooze = Snooze(at("2026-11-13", "14:30"), at("2026-11-13", "18:00"))
        val got = info("task-a", listOf(task("a")), mapOf("a" to snooze)) as AlertInfo.Reminder
        assertEquals("Due Nov 13, 2:30 PM", got.due)
        assertEquals(true, got.snoozed)
    }

    @Test
    fun finishedMissingOrUnknownAlertsHaveNothingToShow() {
        assertNull(info("task-a", listOf(task("a", done = true))))
        assertNull(info("task-a", listOf(task("a", deleted = true))))
        assertNull(info("task-zzz", listOf(task("a"))))
        assertNull(info("group-123", listOf(task("a"))))
    }

    @Test
    fun summaryAlertShowsItsOwnText() {
        assertEquals(AlertInfo.Summary("text"), info(AlertPlanner.SUMMARY_ID, emptyList()))
    }

    @Test
    fun aMissingListLeavesTheListOut() {
        val got = alertInfoFor("task-a", "t", listOf(task("a")), emptyList(), emptyMap(), zone) as AlertInfo.Reminder
        assertNull(got.listTitle)
    }

    @Test
    fun alertTimeShowsOnlyTheTimeForToday() {
        val now = at("2026-11-13", "10:30")
        assertEquals("3:00 PM", formatAlertAt(at("2026-11-13", "15:00"), now, zone))
        assertEquals("Nov 14, 9:00 AM", formatAlertAt(at("2026-11-14", "09:00"), now, zone))
        assertTrue(formatAlertAt(at("2026-11-14", "10:30"), now, zone).startsWith("Nov 14"))
    }
}
